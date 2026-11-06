import { randomUUID } from 'node:crypto';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { requirePermission } from '../lib/auth';
import { TABLE, ddb, patientPk, patientsGsi, queryPage, stripKeys } from '../lib/db';
import { HttpError, json, parseBody } from '../lib/http';
import type { Handler } from '../lib/types';

export const PatientInput = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
  email: z.string().email().max(254).optional(),
  phone: z.string().max(30).optional(),
  status: z.enum(['lead', 'active', 'inactive']).default('lead'),
});
const PatientUpdate = PatientInput.partial();

/** Tenant-scoped lookup; shared by other handlers to verify a patient exists. */
export async function getPatientItem(tenant: string, id: string) {
  const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: patientPk(tenant, id), SK: 'PROFILE' } }));
  if (!res.Item) throw new HttpError(404, 'Patient not found');
  return res.Item;
}

export const createPatient: Handler = async ({ caller, event, audit }) => {
  requirePermission(caller, 'patient:write');
  const input = parseBody(event.body, PatientInput);
  const id = randomUUID();
  const now = new Date().toISOString();
  const item = {
    PK: patientPk(caller.tenantId, id),
    SK: 'PROFILE',
    GSI1PK: patientsGsi(caller.tenantId),
    GSI1SK: `${input.lastName.toLowerCase()}#${id}`,
    entity: 'PATIENT',
    id,
    tenantId: caller.tenantId,
    ...input,
    createdAt: now,
    updatedAt: now,
    createdBy: caller.sub,
  };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: 'attribute_not_exists(PK)' }));
  audit.patientId = id;
  return json(201, stripKeys(item));
};

export const listPatients: Handler = async ({ caller, event }) => {
  requirePermission(caller, 'patient:read');
  return queryPage(
    {
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': patientsGsi(caller.tenantId) },
    },
    event.queryStringParameters ?? {},
    caller.tenantId,
  );
};

export const getPatient: Handler = async ({ caller, params }) => {
  requirePermission(caller, 'patient:read');
  return json(200, stripKeys(await getPatientItem(caller.tenantId, params.id)));
};

export const updatePatient: Handler = async ({ caller, event, params }) => {
  requirePermission(caller, 'patient:write');
  const patch = parseBody(event.body, PatientUpdate);
  const existing = await getPatientItem(caller.tenantId, params.id);
  const merged: Record<string, unknown> = { ...existing, ...patch, updatedAt: new Date().toISOString(), updatedBy: caller.sub };
  if (patch.lastName) merged.GSI1SK = `${patch.lastName.toLowerCase()}#${params.id}`;
  try {
    // Only save if nobody changed the patient since we read it; otherwise we would erase their edit.
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: merged,
        ConditionExpression: 'updatedAt = :seen',
        ExpressionAttributeValues: { ':seen': existing.updatedAt },
      }),
    );
  } catch (e) {
    if ((e as Error).name === 'ConditionalCheckFailedException') {
      throw new HttpError(409, 'Patient was changed or removed by someone else. Reload and try again.');
    }
    throw e;
  }
  return json(200, stripKeys(merged));
};
