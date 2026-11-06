import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

vi.mock('./lib/audit', () => ({ audit: vi.fn() }));
vi.mock('./lib/db', async (orig) => ({ ...(await orig<typeof import('./lib/db')>()), ddb: { send: vi.fn() } }));

import { handler } from './index';
import { audit } from './lib/audit';
import { ddb } from './lib/db';

const post = (groups: string) =>
  ({
    rawPath: '/patients',
    body: JSON.stringify({ firstName: 'Ann', lastName: 'Lee', dob: '1990-01-01' }),
    requestContext: {
      requestId: 'r1',
      http: { method: 'POST', sourceIp: '203.0.113.5' },
      authorizer: { jwt: { claims: { sub: 'u1', 'custom:tenantId': 'clinic-1', 'cognito:groups': groups } } },
    },
  }) as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

const status = (res: unknown) => (res as { statusCode: number }).statusCode;
const outcomes = () => vi.mocked(audit).mock.calls.map((c) => c[1].outcome);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(audit).mockResolvedValue(undefined);
  vi.mocked(ddb.send).mockResolvedValue({} as never);
});

describe('router', () => {
  it('billing cannot create a patient, and the denial is audited', async () => {
    const res = await handler(post('[billing]'));
    expect(status(res)).toBe(403);
    expect(ddb.send).not.toHaveBeenCalled();
    expect(outcomes()).toEqual(['attempt', 'denied']);
  });

  it('saves nothing when the audit record cannot be written first', async () => {
    vi.mocked(audit).mockRejectedValue(new Error('throttled'));
    const res = await handler(post('[staff]'));
    expect(status(res)).toBe(500);
    expect(ddb.send).not.toHaveBeenCalled();
  });

  it('still returns success when only the final audit record fails after the save', async () => {
    vi.mocked(audit).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('throttled'));
    const res = await handler(post('[staff]'));
    expect(status(res)).toBe(201);
    expect(ddb.send).toHaveBeenCalledTimes(1);
  });
});
