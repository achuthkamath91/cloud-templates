# Infrastructure building blocks

Reusable CloudFormation templates for the parts that most cloud services need. Each block is a folder with a
`template.yaml` and a README, and can be deployed on its own. A template (for example
[`crm/healthcare`](../crm/healthcare)) deploys the blocks it needs as separate stacks.

> **Status:** these pass `cfn-lint` and have never been deployed to a real AWS account.

## Blocks

| Block | What it creates | Needs first |
|---|---|---|
| [`github-oidc-role`](github-oidc-role) | Role that GitHub Actions assumes to deploy, limited to one repo and environment | nothing (once per account) |
| [`kms-data-key`](kms-data-key) | Encryption key with rotation, kept if the stack is deleted | nothing |
| [`dynamodb-table`](dynamodb-table) | Encrypted table with point-in-time recovery and an optional index | `kms-data-key` |
| [`cognito-user-pool`](cognito-user-pool) | Staff user pool: admin-created users, mandatory MFA, immutable tenant ID | nothing |
| [`http-api-jwt`](http-api-jwt) | HTTP API that admits only valid Cognito tokens and calls one Lambda | `cognito-user-pool` and your app stack |

## How the blocks find each other

All stacks of one deployment share an `ExportPrefix`, for example `healthcare-crm-prod`. A block publishes its results
as CloudFormation exports named `<prefix>-<Name>`, and the blocks that need them import them by that name. No IDs are
copied by hand.

| Export | Published by |
|---|---|
| `<prefix>-DataKeyArn` | `kms-data-key` |
| `<prefix>-<label>-TableName`, `<prefix>-<label>-TableArn` | `dynamodb-table` (one pair per table label) |
| `<prefix>-UserPoolId`, `<prefix>-UserPoolClientId` | `cognito-user-pool` |
| `<prefix>-FunctionArn` | your app stack (the Lambda function the API calls) |

## Deploy order

1. `github-oidc-role` (once per AWS account, by hand)
2. `kms-data-key`
3. `dynamodb-table` (once per table) and `cognito-user-pool`
4. your app stack, which exports `FunctionArn`
5. `http-api-jwt`

The [healthcare CRM README](../crm/healthcare/README.md) and its workflow show this in full.

## Design notes

- **Separate stacks, not one big template.** A change to the API cannot touch the tables, and a different app can reuse
  a block.
- **Exports tie stacks together.** CloudFormation will not let you delete or change an export that another stack still
  imports. That protects the data, but it means stacks are deleted in reverse order.
- **State is kept.** The key, the tables and the user pool are retained when their stack is deleted.
- **App-specific parts stay with the app.** The role groups and the Lambda function belong to the app stack, so the
  blocks stay generic.

## Adding a block

1. Create `infra/<block>/template.yaml` and `README.md` (parameters, exports, deploy command).
2. Add the block to the matrix in `.github/workflows/infra.yml`.
3. Add a row to the table above and to the root README.
