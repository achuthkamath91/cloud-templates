# ADR 0001: DynamoDB (single table) instead of Aurora PostgreSQL

Status: accepted (revisit if reporting needs grow)

## Context
The CRM stores patients, appointments and interaction notes. Access patterns are known and narrow:
list patients by tenant, fetch one patient, list a patient's interactions, list appointments for a day.
Compliance wants encryption at rest, point-in-time recovery and an audit trail.

## Decision
DynamoDB, one data table (PK/SK + one GSI) plus a separate append-only audit table, both encrypted with a
customer-managed KMS key.

## Why
- No VPC, NAT or connection pooling: Lambda talks to DynamoDB over IAM, which keeps the network surface small.
- Tenant isolation is structural: every key starts with `T#<tenantId>#`.
- Pay-per-request: near-zero cost at idle, which suits a template.
- DynamoDB is HIPAA eligible under an AWS BAA.

## Trade-offs
- Ad-hoc queries and reporting are hard. Mitigation: export to S3/Athena via DynamoDB export, or add an
  Aurora read model later.
- New access patterns need new GSIs or a data migration.
- No foreign keys: referential checks (does the patient exist?) live in handlers.

## When to pick Aurora instead
Heavy reporting, many-to-many relations, or a team that prefers SQL. The handler layer is thin, so swapping the
storage module is contained; the Cognito, API Gateway and CI/CD pieces are unchanged.
