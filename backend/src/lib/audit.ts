import { randomUUID } from 'node:crypto';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import type { Caller } from './auth';
import { AUDIT_TABLE, ddb } from './db';

export interface AuditEvent {
  action: string;
  outcome: 'attempt' | 'success' | 'denied' | 'error';
  patientId?: string;
  requestId?: string;
  sourceIp?: string;
}

/** Records who did what to which patient. Never store PHI field values here. */
export async function audit(caller: Caller, event: AuditEvent): Promise<void> {
  const ts = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: AUDIT_TABLE,
      Item: {
        PK: `T#${caller.tenantId}`,
        SK: `${ts}#${randomUUID()}`,
        ts,
        userId: caller.sub,
        roles: caller.roles,
        ...event,
      },
    }),
  );
}
