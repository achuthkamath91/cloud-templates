import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createAppointment, listAppointments } from './handlers/appointments';
import { createInteraction, listInteractions } from './handlers/interactions';
import { createPatient, getPatient, listPatients, updatePatient } from './handlers/patients';
import { audit, type AuditEvent } from './lib/audit';
import { getCaller } from './lib/auth';
import { HttpError, json } from './lib/http';
import type { Ctx, Handler } from './lib/types';

interface Route {
  method: string;
  pattern: RegExp;
  action: string;
  handler: Handler;
}

const ID = '(?<id>[0-9a-fA-F-]{36})';
const routes: Route[] = [
  { method: 'GET', pattern: /^\/patients$/, action: 'patient.list', handler: listPatients },
  { method: 'POST', pattern: /^\/patients$/, action: 'patient.create', handler: createPatient },
  { method: 'GET', pattern: new RegExp(`^/patients/${ID}$`), action: 'patient.read', handler: getPatient },
  { method: 'PUT', pattern: new RegExp(`^/patients/${ID}$`), action: 'patient.update', handler: updatePatient },
  { method: 'GET', pattern: new RegExp(`^/patients/${ID}/interactions$`), action: 'interaction.list', handler: listInteractions },
  { method: 'POST', pattern: new RegExp(`^/patients/${ID}/interactions$`), action: 'interaction.create', handler: createInteraction },
  { method: 'GET', pattern: /^\/appointments$/, action: 'appointment.list', handler: listAppointments },
  { method: 'POST', pattern: /^\/appointments$/, action: 'appointment.create', handler: createAppointment },
];

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> => {
  const { method, sourceIp } = event.requestContext.http;
  let caller;
  try {
    caller = getCaller(event);
  } catch (e) {
    return e instanceof HttpError ? json(e.status, { error: e.message }) : json(500, { error: 'Internal error' });
  }

  const route = routes.find((r) => r.method === method && r.pattern.test(event.rawPath));
  if (!route) return json(404, { error: 'Not found' });

  const params = route.pattern.exec(event.rawPath)?.groups ?? {};
  const ctx: Ctx = { caller, event, params, audit: { patientId: params.id } };
  const meta = { action: route.action, requestId: event.requestContext.requestId, sourceIp };
  const record = (outcome: AuditEvent['outcome']) =>
    audit(caller, { ...meta, outcome, patientId: ctx.audit.patientId });
  const logAuditFailure = () => console.error(JSON.stringify({ level: 'error', message: 'audit write failed' }));
  const isWrite = method !== 'GET';

  try {
    // Writes: store the "attempt" record first. If that fails, the change never happens, so a retry is safe.
    if (isWrite) await record('attempt');
    const res = await route.handler(ctx);
    // A read is returned only if its audit record is stored. A write is already saved, so a failed record is logged, not shown to the user.
    await (isWrite ? record('success').catch(logAuditFailure) : record('success'));
    return res;
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    await record(status === 403 ? 'denied' : 'error').catch(logAuditFailure);
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    // Log the error class only; messages from the SDK can include item data.
    console.error(JSON.stringify({ level: 'error', action: route.action, name: (e as Error).name }));
    return json(500, { error: 'Internal error' });
  }
};
