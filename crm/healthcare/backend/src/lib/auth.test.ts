import { describe, expect, it } from 'vitest';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { can, getCaller, parseGroups, requirePermission, type Caller } from './auth';

const eventWith = (claims: Record<string, unknown>) =>
  ({ requestContext: { authorizer: { jwt: { claims } } } }) as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

describe('parseGroups', () => {
  it('parses API Gateway bracketed string claims', () => {
    expect(parseGroups('[admin clinician]')).toEqual(['admin', 'clinician']);
  });
  it('parses real arrays and drops unknown groups', () => {
    expect(parseGroups(['staff', 'hacker'])).toEqual(['staff']);
  });
  it('returns empty for missing claim', () => {
    expect(parseGroups(undefined)).toEqual([]);
  });
});

describe('getCaller', () => {
  it('builds a caller from claims', () => {
    const c = getCaller(eventWith({ sub: 'u1', 'custom:tenantId': 'clinic-1', 'cognito:groups': '[staff]' }));
    expect(c).toEqual({ sub: 'u1', tenantId: 'clinic-1', roles: ['staff'] });
  });
  it('rejects tenant ids that could inject key delimiters', () => {
    expect(() => getCaller(eventWith({ sub: 'u1', 'custom:tenantId': 'a#PATIENT#b', 'cognito:groups': '[admin]' }))).toThrow();
  });
  it('rejects users with no recognised role', () => {
    expect(() => getCaller(eventWith({ sub: 'u1', 'custom:tenantId': 't', 'cognito:groups': '[]' }))).toThrow();
  });
  it('rejects a missing tenant claim', () => {
    expect(() => getCaller(eventWith({ sub: 'u1', 'cognito:groups': '[admin]' }))).toThrow();
  });
});

describe('RBAC matrix', () => {
  const as = (...roles: Caller['roles']): Caller => ({ sub: 'u', tenantId: 't', roles });
  it('keeps clinical notes away from front-desk and billing', () => {
    expect(can(as('staff'), 'interaction:clinical:read')).toBe(false);
    expect(can(as('billing'), 'interaction:clinical:read')).toBe(false);
    expect(can(as('clinician'), 'interaction:clinical:read')).toBe(true);
  });
  it('only clinicians write clinical notes', () => {
    expect(can(as('admin'), 'interaction:clinical:write')).toBe(false);
    expect(can(as('clinician'), 'interaction:clinical:write')).toBe(true);
  });
  it('billing is read-only on demographics', () => {
    expect(can(as('billing'), 'patient:read')).toBe(true);
    expect(() => requirePermission(as('billing'), 'patient:write')).toThrow('Forbidden');
  });
});
