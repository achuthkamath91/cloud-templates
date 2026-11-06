import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { HttpError } from './http';

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE = process.env.TABLE_NAME ?? '';
export const AUDIT_TABLE = process.env.AUDIT_TABLE_NAME ?? '';

// Every key is tenant-prefixed, so a query can never cross tenants.
export const patientPk = (tenant: string, id: string) => `T#${tenant}#PATIENT#${id}`;
export const patientsGsi = (tenant: string) => `T#${tenant}#PATIENTS`;
export const apptDayGsi = (tenant: string, date: string) => `T#${tenant}#APPTS#${date}`;

export function stripKeys(item: Record<string, unknown>): Record<string, unknown> {
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  return rest;
}

export function parseLimit(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '25', 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 25;
}

export const encodeToken = (key?: Record<string, unknown>): string | undefined =>
  key ? Buffer.from(JSON.stringify(key)).toString('base64url') : undefined;

/** Pagination tokens are client-supplied: reject any that point outside the caller's tenant. */
export function decodeToken(token: string | undefined, tenant: string): Record<string, unknown> | undefined {
  if (!token) return undefined;
  try {
    const key = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof key.PK !== 'string' || !key.PK.startsWith(`T#${tenant}#`)) throw new Error('tenant');
    return key;
  } catch {
    throw new HttpError(400, 'Invalid pagination token');
  }
}
