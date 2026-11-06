# Security and compliance notes

This repo is a starting point, not a compliance certification, and **it has not been deployed or penetration
tested**. Do not put real PHI in it until you have fixed the known issues below and had a legal and security
review for your jurisdiction (HIPAA in the US, DPDP Act in India, GDPR in the EU).

## Built in
| Control | Where |
|---|---|
| Admin-only user creation, 12+ char passwords, mandatory TOTP MFA | `infra/cognito-user-pool` (repo root) |
| Immutable `custom:tenantId`, not writable by the client | UserPool schema + client `WriteAttributes` |
| JWT verified at the edge (issuer + audience) before Lambda runs | `infra/http-api-jwt` (repo root) |
| RBAC enforced server-side per route | `backend/src/lib/auth.ts` |
| Tenant-prefixed keys, tenant-checked pagination tokens | `backend/src/lib/db.ts` |
| Input validation, no values echoed in errors | `backend/src/lib/http.ts` |
| Audit record per request (who, what, which patient, outcome); for writes an "attempt" record is stored first, so a failed audit write stops the change | `backend/src/index.ts`, `backend/src/lib/audit.ts` |
| Lambda role limited to GetItem, PutItem and Query on the data table, and PutItem on the audit table | `infra/template.yaml` (this template's app stack) |
| KMS (CMK with rotation, kept if the stack is deleted), PITR, deletion protection on the prod tables and the user pool | `infra/kms-data-key`, `infra/dynamodb-table`, `infra/cognito-user-pool` (repo root) |
| Short token lifetimes, strict CSP, HSTS, no-referrer | Cognito client, `frontend/public/_headers` |
| OIDC from GitHub to AWS (token scoped to the deploy job), Actions pinned to commit SHAs, template linted on every PR, manual approval on `production` | `.github/workflows/crm-healthcare.yml` (repo root) |

## Cloudflare and PHI
Cloudflare serves only static files (the JS bundle). The browser calls API Gateway and Cognito directly, so PHI
does not pass through Cloudflare. If you later proxy the API through Cloudflare, confirm that your Cloudflare
plan covers a BAA first.

## Known issues

### High
1. **Lock down the AWS role that GitHub Actions assumes.** Create it with
   [`infra/github-oidc-role`](../../../infra/github-oidc-role), which limits it to one repository and the `production`
   environment. You must still supply a permissions policy scoped to what the stacks need.
2. **Revoked access lingers.** Removing a user or changing their group takes effect only when their token expires
   (30 minutes). Shorten token lifetimes for PHI.
3. **Small gap in the write audit trail.** An "attempt" record is stored before every write. If the final
   "success" record then fails, the change is saved and the attempt record is the only trace (outcome unknown).
   Reads are fail-closed: they are returned only after their audit record is stored.

### Medium
- All tenants share one throttle (25 req/s). No WAF, no API access logs, no Lambda concurrency limit, no DLQ.
- No minimum-necessary scoping: any clinician can read every patient's clinical notes in their clinic, and list
  calls are audited without patient IDs.
- Tokens live in browser storage (Amplify default); an XSS would mean account takeover. The CSP reduces this.
- PHI is encrypted at rest only. Anyone with DynamoDB console access sees plaintext; CloudTrail data events are off.
- Cognito advanced security (compromised-credential detection) is not enabled.
- `POST` routes are not idempotent: a client that retries after a timeout can create a duplicate.
- `npm audit` reports a zod advisory (GHSA-mrhx-c7xc-m3w5, oversized collections). The schemas here contain no
  arrays, so it is probably not reachable; the fix is a breaking major upgrade.
- Tests cover RBAC, the page-token tenant guard and the audit ordering in the router. The handlers' DynamoDB queries
  and the frontend are untested.

### Untested against real AWS
The template passes `cfn-lint` but has never been deployed. Two things are most likely to need a fix on the first
deploy: the KMS key-policy statement that lets CloudWatch Logs use the key, and the Cognito sign-in flow.

### Other gaps
- Appointments are indexed by UTC day; add a per-tenant timezone before relying on day views.
- No patient-facing login (a second user pool is the natural next step).
- Audit table uses one partition per tenant; shard by day for large tenants and add a retention/export policy.
- No cross-region backup.

## Reporting a vulnerability
Please open a private security advisory on this repository rather than a public issue.
