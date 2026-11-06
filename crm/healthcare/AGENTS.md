# AGENTS.md: healthcare CRM template

Applies to everything under `crm/healthcare/`. The rules in the root `AGENTS.md` apply too. `CLAUDE.md` here is a
symlink to this file.

## What it is

A serverless, multi-tenant healthcare CRM: staff sign in with Cognito, call an HTTP API that runs one TypeScript Lambda,
which reads and writes DynamoDB. A React app on Cloudflare is the front end. It is a reference architecture, not
production-ready, and has never been deployed.

## Where things are

| Path | What it does |
|---|---|
| `backend/src/index.ts` | Router. Decides who is calling, runs the handler, and writes the audit records. |
| `backend/src/handlers/` | `patients.ts`, `interactions.ts`, `appointments.ts`. |
| `backend/src/lib/auth.ts` | Reads the caller from the JWT claims. Holds the role and permission matrix (`MATRIX`). |
| `backend/src/lib/db.ts` | DynamoDB client, key builders, paging (`queryPage`, `decodeToken`). |
| `backend/src/lib/audit.ts`, `http.ts` | Audit record writer. Request parsing and JSON responses. |
| `frontend/src/` | `App.tsx` (screens), `auth.ts` (Cognito sign-in and challenges), `api.ts` (calls the API). |
| `infra/template.yaml` | The app stack only: Lambda function, log group, Cognito role groups. The key, tables, user pool and API are the building blocks in the repo's `/infra` folder. |
| `docs/` | `security.md` (controls and known issues), `adr/`, `architecture.svg`. |

## Invariants: do not break these

- **Tenant isolation.** The tenant comes only from the verified token claim `custom:tenantId` (checked against
  `[A-Za-z0-9_-]{1,64}`), never from the request. Every DynamoDB key starts with `T#<tenantId>#`. Page tokens sent by
  clients must go through `decodeToken`.
- **RBAC lives in one place.** Permissions are defined only in `MATRIX` in `lib/auth.ts`, and every handler calls
  `requirePermission`. Keep the roles table in `README.md` in sync. Clinical notes: clinician and admin can read, only
  clinician can write.
- **Audit order.** Every request writes an audit record. For writes, the `attempt` record is stored before the handler
  runs, so a failed audit write stops the change. Audit records never contain patient field values.
- **No PHI in logs or errors.** Validation errors name fields, not values. Log only error class names.
- **Least privilege.** The Lambda role has GetItem, PutItem and Query on the data table and PutItem on the audit table.
  Do not add Scan or Delete.
- **Safe edits.** Updates are conditional on `updatedAt` and return 409 on a conflict.
- **The server enforces, the UI only hides.** The API expects the Cognito ID token, not the access token.

## Commands

```
# backend/
npm ci && npm run typecheck && npm test      # all tests must pass
# frontend/
npm ci && npm run typecheck
npm run dev                                  # needs a .env copied from .env.example
# repo root
cfn-lint crm/healthcare/infra/template.yaml
```

There is no local deploy script on purpose. Deployment happens only through `.github/workflows/crm-healthcare.yml`,
which fills in the security-header origins that a local deploy would leave as placeholders.

## When you change something

- **New route:** add it to `routes` in `index.ts`, give it a permission in `MATRIX`, add a test, and update the API
  table in `README.md`. Give it an audit action name.
- **New role or permission:** `MATRIX`, `auth.test.ts`, the roles table in `README.md`, and a Cognito group in
  `infra/template.yaml`.
- **New DynamoDB key or index:** update the `dynamodb-table` block parameters and the docs. Nothing is deployed yet, so
  no data migration is needed, but say so in the PR.
- **Behaviour or security change:** update `docs/security.md` (built-in controls and known issues).
- **Diagram:** `docs/architecture.svg` is plain SVG with embedded service logos. Edit it by hand, keep the alt text in
  both READMEs in sync, and keep the trademark note.
