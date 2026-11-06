# cognito-user-pool

A Cognito user pool for staff sign-in, plus one app client for a web app.

- Only admins can create users. There is no self sign-up.
- Passwords need 12 or more characters, and an authenticator app (TOTP) is mandatory.
- Every user has an immutable `custom:tenantId` that the API reads from the ID token. Users cannot change it.
- Tokens are short: 30 minutes for ID and access tokens, 8 hours for refresh.

Role groups (for example `admin`, `staff`) belong to the app, not to this block, so the app stack creates them.

## Parameters

| Name | Default | What it does |
|---|---|---|
| `ExportPrefix` | required | Names this deployment, for example `healthcare-crm-prod`. |
| `ClientName` | `web` | Name of the app client. |

## Exports

| Name | Value |
|---|---|
| `<prefix>-UserPoolId` | user pool ID |
| `<prefix>-UserPoolClientId` | app client ID |

## Deploy

```bash
aws cloudformation deploy --stack-name healthcare-crm-prod-auth --template-file template.yaml \
  --parameter-overrides ExportPrefix=healthcare-crm-prod
```

## Notes
- The pool is kept if the stack is deleted and has deletion protection on. Changing the `tenantId` attribute would force
  a replacement, which Cognito does not allow in place, so treat that attribute as permanent.
- Never deployed. It passes `cfn-lint` only.
