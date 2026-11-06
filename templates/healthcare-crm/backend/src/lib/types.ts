import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { Caller } from './auth';

export interface Ctx {
  caller: Caller;
  event: APIGatewayProxyEventV2WithJWTAuthorizer;
  params: Record<string, string>;
  /** Handlers may set patientId so the audit record names the patient touched. */
  audit: { patientId?: string };
}

export type Handler = (ctx: Ctx) => Promise<APIGatewayProxyResultV2>;
