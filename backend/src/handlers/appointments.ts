import { randomUUID } from 'node:crypto';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { requirePermission } from '../lib/auth';
import { TABLE, apptDayGsi, ddb, decodeToken, encodeToken, parseLimit, patientPk, stripKeys } from '../lib/db';
import { HttpError, json, parseBody } from '../lib/http';
import type { Handler } from '../lib/types';
import { getPatientItem } from './patients';

const AppointmentInput = z.object({
  patientId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  durationMin: z.number().int().min(5).max(480),
  providerId: z.string().min(1).max(64),
  reason: z.string().max(500).optional(),
});

export const createAppointment: Handler = async ({ caller, event, audit }) => {
  requirePermission(caller, 'appointment:write');
  const input = parseBody(event.body, AppointmentInput);
  audit.patientId = input.patientId;
  await getPatientItem(caller.tenantId, input.patientId);

  const id = randomUUID();
  const startsAt = new Date(input.startsAt).toISOString(); // normalise to UTC
  const item = {
    PK: patientPk(caller.tenantId, input.patientId),
    SK: `APPT#${startsAt}#${id}`,
    GSI1PK: apptDayGsi(caller.tenantId, startsAt.slice(0, 10)), // UTC day
    GSI1SK: `${startsAt}#${id}`,
    entity: 'APPOINTMENT',
    id,
    ...input,
    startsAt,
    status: 'scheduled',
    createdAt: new Date().toISOString(),
    createdBy: caller.sub,
  };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  return json(201, stripKeys(item));
};

export const listAppointments: Handler = async ({ caller, event }) => {
  requirePermission(caller, 'appointment:read');
  const q = event.queryStringParameters ?? {};
  if (!q.date || !/^\d{4}-\d{2}-\d{2}$/.test(q.date)) throw new HttpError(400, 'date=YYYY-MM-DD (UTC day) is required');
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': apptDayGsi(caller.tenantId, q.date) },
      Limit: parseLimit(q.limit),
      ExclusiveStartKey: decodeToken(q.next, caller.tenantId),
    }),
  );
  return json(200, { items: (res.Items ?? []).map(stripKeys), next: encodeToken(res.LastEvaluatedKey) });
};
