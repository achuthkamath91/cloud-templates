import { randomUUID } from 'node:crypto';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { requirePermission } from '../lib/auth';
import { TABLE, ddb, decodeToken, encodeToken, parseLimit, patientPk, stripKeys } from '../lib/db';
import { HttpError, json, parseBody } from '../lib/http';
import type { Handler } from '../lib/types';
import { getPatientItem } from './patients';

const InteractionInput = z.object({
  kind: z.enum(['outreach', 'clinical']),
  channel: z.enum(['phone', 'email', 'sms', 'in_person', 'portal']).optional(),
  summary: z.string().trim().min(1).max(5000),
});

// Separate sort-key prefixes per kind let us authorise and query without filter expressions.
const prefix = (kind: 'outreach' | 'clinical') => (kind === 'clinical' ? 'INT#C#' : 'INT#O#');

export const createInteraction: Handler = async ({ caller, event, params }) => {
  const input = parseBody(event.body, InteractionInput);
  requirePermission(caller, `interaction:${input.kind}:write`);
  await getPatientItem(caller.tenantId, params.id);
  const id = randomUUID();
  const now = new Date().toISOString();
  const item = {
    PK: patientPk(caller.tenantId, params.id),
    SK: `${prefix(input.kind)}${now}#${id}`,
    entity: 'INTERACTION',
    id,
    patientId: params.id,
    ...input,
    createdAt: now,
    createdBy: caller.sub,
  };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  return json(201, stripKeys(item));
};

export const listInteractions: Handler = async ({ caller, event, params }) => {
  const q = event.queryStringParameters ?? {};
  if (q.kind !== 'outreach' && q.kind !== 'clinical') throw new HttpError(400, 'kind must be outreach or clinical');
  requirePermission(caller, `interaction:${q.kind}:read`);
  await getPatientItem(caller.tenantId, params.id);
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :p)',
      ExpressionAttributeValues: { ':pk': patientPk(caller.tenantId, params.id), ':p': prefix(q.kind) },
      ScanIndexForward: false,
      Limit: parseLimit(q.limit),
      ExclusiveStartKey: decodeToken(q.next, caller.tenantId),
    }),
  );
  return json(200, { items: (res.Items ?? []).map(stripKeys), next: encodeToken(res.LastEvaluatedKey) });
};
