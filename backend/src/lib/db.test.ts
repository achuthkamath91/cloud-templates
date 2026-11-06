import { describe, expect, it } from 'vitest';
import { decodeToken, encodeToken } from './db';

const token = (key: Record<string, unknown>) => encodeToken(key);

describe('decodeToken (tenant guard for page tokens)', () => {
  it('accepts a token from the caller own clinic', () => {
    const key = { PK: 'T#clinic-1#PATIENT#abc', SK: 'PROFILE' };
    expect(decodeToken(token(key), 'clinic-1')).toEqual(key);
  });
  it('rejects a token from another clinic', () => {
    expect(() => decodeToken(token({ PK: 'T#clinic-2#PATIENT#abc' }), 'clinic-1')).toThrow('Invalid pagination token');
  });
  it('rejects a clinic whose id only starts the same way', () => {
    expect(() => decodeToken(token({ PK: 'T#clinic-10#PATIENT#abc' }), 'clinic-1')).toThrow('Invalid pagination token');
  });
  it('rejects garbage', () => {
    expect(() => decodeToken('not-a-token!!', 'clinic-1')).toThrow('Invalid pagination token');
  });
});
