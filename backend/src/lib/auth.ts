import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { HttpError } from './http';

export const ROLES = ['admin', 'clinician', 'staff', 'billing'] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | 'patient:read'
  | 'patient:write'
  | 'appointment:read'
  | 'appointment:write'
  | 'interaction:outreach:read'
  | 'interaction:outreach:write'
  | 'interaction:clinical:read'
  | 'interaction:clinical:write';

/** Single source of truth for RBAC. Mirrored in README; change both together. */
export const MATRIX: Record<Permission, readonly Role[]> = {
  'patient:read': ['admin', 'clinician', 'staff', 'billing'],
  'patient:write': ['admin', 'clinician', 'staff'],
  'appointment:read': ['admin', 'clinician', 'staff', 'billing'],
  'appointment:write': ['admin', 'clinician', 'staff'],
  'interaction:outreach:read': ['admin', 'clinician', 'staff'],
  'interaction:outreach:write': ['admin', 'clinician', 'staff'],
  'interaction:clinical:read': ['admin', 'clinician'],
  'interaction:clinical:write': ['clinician'],
};

export interface Caller {
  sub: string;
  tenantId: string;
  roles: Role[];
}

/** API Gateway serialises array claims as "[a b]"; handle that and real arrays. */
export function parseGroups(raw: unknown): Role[] {
  const list = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === 'string'
      ? raw.replace(/^\[|\]$/g, '').split(/[\s,]+/)
      : [];
  return list.filter((g): g is Role => (ROLES as readonly string[]).includes(g));
}

export function getCaller(event: APIGatewayProxyEventV2WithJWTAuthorizer): Caller {
  const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
  const tenantId = claims['custom:tenantId'];
  const sub = claims.sub;
  if (typeof sub !== 'string' || typeof tenantId !== 'string') {
    throw new HttpError(403, 'Missing tenant or subject claim');
  }
  // Restrictive charset also prevents key-delimiter ('#') injection into DynamoDB keys.
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(tenantId)) throw new HttpError(403, 'Invalid tenant claim');
  const roles = parseGroups(claims['cognito:groups']);
  if (roles.length === 0) throw new HttpError(403, 'No role assigned');
  return { sub, tenantId, roles };
}

export const can = (caller: Caller, permission: Permission): boolean =>
  caller.roles.some((r) => MATRIX[permission].includes(r));

export function requirePermission(caller: Caller, permission: Permission): void {
  if (!can(caller, permission)) throw new HttpError(403, 'Forbidden');
}
