# Security and compliance notes

This repo is a starting point, not a compliance certification, and **it has not been deployed or penetration
tested**. Do not put real PHI in it until you have fixed the known issues below and had a legal and security
review for your jurisdiction (HIPAA in the US, DPDP Act in India, GDPR in the EU).

## Built in
| Control | Where |
|---|---|
| Admin-only user creation, 12+ char passwords, mandatory TOTP MFA | `infra/template.yaml` (UserPool) |
| Immutable `custom:tenantId`, not writable by the client | UserPool schema + client `WriteAttributes` |
| JWT verified at the edge (issuer + audience) before Lambda runs | HTTP API authorizer |
| RBAC enforced server-side per route | `backend/src/lib/auth.ts` |
| Tenant-prefixed keys, tenant-checked pagination tokens | `backend/src/lib/db.ts` |
| Input validation, no values echoed in errors | `backend/src/lib/http.ts` |
| Audit record per request (who, what, which patient, outcome) | `backend/src/lib/audit.ts` |
| KMS (CMK, rotation), PITR, deletion protection in prod | `infra/template.yaml` |
| Short token lifetimes, strict CSP, HSTS, no-referrer | Cognito client, `frontend/public/_headers` |
| OIDC from GitHub to AWS, manual approval on `production` | `.github/workflows/deploy.yml` |

## Cloudflare and PHI
Cloudflare serves only static files (the JS bundle). The browser calls API Gateway and Cognito directly, so PHI
does not pass through Cloudflare. If you later proxy the API through Cloudflare, confirm that your Cloudflare
plan covers a BAA first.

## Known issues

### High
1. **Audit is not atomic for writes.** The audit record is written after the handler commits. If the audit write
   fails, the request returns an error but the change is already saved, and a client retry creates a duplicate.
   Reads are effectively fail-closed; writes are not. Fix: write the audit record first, or use a DynamoDB
   transaction.
2. **Lambda IAM is broader than needed.** `DynamoDBCrudPolicy` includes Scan and Delete, which no handler uses.
   Tenant isolation currently lives only in application code. Fix: grant only GetItem, PutItem and Query.
3. **Stack deletion can orphan encrypted data.** The tables are retained but the KMS key is not, so retained data
   becomes unreadable. The Cognito user pool has no deletion protection. Fix: retain the key, enable pool protection.
4. **CI trust is loose.** Restrict the AWS OIDC role to this repo and the `production` environment. `id-token: write`
   is granted to the whole workflow; scope it to the deploy job. Pin third-party Actions to commit SHAs.
5. **Revoked access lingers.** Removing a user or changing their group takes effect only when their token expires
   (30 minutes). Shorten token lifetimes for PHI.

### Medium
- All tenants share one throttle (25 req/s). No WAF, no API access logs, no Lambda concurrency limit, no DLQ.
- No minimum-necessary scoping: any clinician can read every patient's clinical notes in their clinic, and list
  calls are audited without patient IDs.
- Tokens live in browser storage (Amplify default); an XSS would mean account takeover. The CSP reduces this.
- PHI is encrypted at rest only. Anyone with DynamoDB console access sees plaintext; CloudTrail data events are off.
- Cognito advanced security (compromised-credential detection) is not enabled.
- `PUT /patients/{id}` can silently overwrite a concurrent edit; POST routes are not idempotent.
- `npm audit` reports a zod advisory (GHSA-mrhx-c7xc-m3w5, oversized collections). The schemas here contain no
  arrays, so it is probably not reachable; the fix is a breaking major upgrade.
- Tests cover only the RBAC logic. Tenant scoping and tampered pagination tokens are untested.

### Will likely break the first deploy
- The KMS key policy does not allow CloudWatch Logs, so creating the encrypted log group will probably fail.
- `npm run deploy` (local) ships the literal `__API_ORIGIN__` / `__COGNITO_ORIGIN__` placeholders in the CSP, which
  blocks all API calls. Only the CI workflow substitutes them.

### Other gaps
- Appointments are indexed by UTC day; add a per-tenant timezone before relying on day views.
- No patient-facing login (a second user pool is the natural next step).
- Audit table uses one partition per tenant; shard by day for large tenants and add a retention/export policy.
- No cross-region backup.

## Reporting a vulnerability
Please open a private security advisory on this repository rather than a public issue.
