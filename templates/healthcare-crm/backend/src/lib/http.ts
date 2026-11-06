import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (status: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode: status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

export function parseBody<T extends z.ZodTypeAny>(raw: string | undefined, schema: T): z.infer<T> {
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    // Paths + messages only: never echo submitted values (they may be PHI).
    const detail = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new HttpError(400, `Validation failed: ${detail}`);
  }
  return result.data;
}
