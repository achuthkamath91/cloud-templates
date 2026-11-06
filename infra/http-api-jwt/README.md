# http-api-jwt

An API Gateway HTTP API that only lets in callers with a valid Cognito ID token, and sends every request to one Lambda
function. It handles the token check, CORS and throttling, so the function only sees authenticated calls with the
token's claims attached.

## Parameters

| Name | Default | What it does |
|---|---|---|
| `ExportPrefix` | required | Names this deployment. Must match the `cognito-user-pool` stack and the app stack. |
| `AllowedOrigin` | `http://localhost:5173` | The one web origin allowed to call the API from a browser. |
| `ThrottlingRateLimit` | `25` | Steady requests per second, shared by all callers. |
| `ThrottlingBurstLimit` | `50` | Short burst allowance. |

## Needs (imports)

| Export | From |
|---|---|
| `<prefix>-UserPoolId`, `<prefix>-UserPoolClientId` | `cognito-user-pool` |
| `<prefix>-FunctionArn` | your app stack, which must export the ARN of the Lambda function to call |

## Outputs

| Name | Value |
|---|---|
| `ApiUrl` | the public URL of the API |

## Deploy

```bash
aws cloudformation deploy --stack-name healthcare-crm-prod-api --template-file template.yaml \
  --parameter-overrides ExportPrefix=healthcare-crm-prod AllowedOrigin=https://crm.example.com
```

## Notes
- Deploy it last: it imports the app stack's `FunctionArn`.
- All routes go to one function (`ANY /{proxy+}`), which does its own routing and permission checks.
- No access logs yet, and the throttle is shared by all callers (see `crm/healthcare/docs/security.md`).
- Browser preflight (CORS `OPTIONS`) against the authorized catch-all route has not been tested on real AWS.
- Never deployed. It passes `cfn-lint` only.
