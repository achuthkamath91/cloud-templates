# Infrastructure stacks

The CloudFormation stacks of the healthcare CRM. Each stack is a folder with a `template.yaml` and a README, and is
deployed separately. Other templates in this repo keep their own copy of the stacks they need, so this whole template
folder can be copied on its own.

> **Status:** these pass `cfn-lint` and have never been deployed to a real AWS account.

## Stacks

| Block | What it creates | Needs first |
|---|---|---|
| [`github-oidc-role`](github-oidc-role) | Role that GitHub Actions assumes to deploy, limited to one repo and environment | nothing (once per account) |
| [`kms-data-key`](kms-data-key) | Encryption key with rotation, kept if the stack is deleted | nothing |
| [`dynamodb-table`](dynamodb-table) | Encrypted table with point-in-time recovery and an optional index | `kms-data-key` |
| [`cognito-user-pool`](cognito-user-pool) | Staff user pool: admin-created users, mandatory MFA, immutable tenant ID | nothing |
| [`app`](app) | The Lambda function, its log group and the Cognito role groups; exports `FunctionArn` | `kms-data-key`, both tables, `cognito-user-pool` |
| [`http-api-jwt`](http-api-jwt) | HTTP API that admits only valid Cognito tokens and calls one Lambda | `cognito-user-pool` and `app` |

## How the stacks find each other

All stacks of one deployment share an `ExportPrefix`, for example `healthcare-crm-prod`. A block publishes its results
as CloudFormation exports named `<prefix>-<Name>`, and the blocks that need them import them by that name. No IDs are
copied by hand.

| Export | Published by |
|---|---|
| `<prefix>-DataKeyArn` | `kms-data-key` |
| `<prefix>-<label>-TableName`, `<prefix>-<label>-TableArn` | `dynamodb-table` (one pair per table label) |
| `<prefix>-UserPoolId`, `<prefix>-UserPoolClientId` | `cognito-user-pool` |
| `<prefix>-FunctionArn` | `app` (the Lambda function the API calls) |

## Deploy order

1. `github-oidc-role` (once per AWS account, by hand)
2. `kms-data-key`
3. `dynamodb-table` (once per table) and `cognito-user-pool`
4. `app` (builds the Lambda with SAM and exports `FunctionArn`)
5. `http-api-jwt`

The [template README](../README.md) and `.github/workflows/healthcare-crm.yml` at the repo root show this in full.

## Design notes

- **Separate stacks, not one big template.** A change to the API cannot touch the tables, and another template can copy
  a stack that fits.
- **Exports tie stacks together.** CloudFormation will not let you delete or change an export that another stack still
  imports. That protects the data, but it means stacks are deleted in reverse order.
- **State is kept.** The key, the tables and the user pool are retained when their stack is deleted.
- **App-specific parts stay with the app.** The role groups and the Lambda function belong to the app stack, so the
  blocks stay generic.

## Adding a stack

1. Create `<stack>/template.yaml` and `README.md` here (parameters, exports, deploy command).
2. Add it to the deploy steps in `.github/workflows/healthcare-crm.yml`. The lint step already picks up every
   `infra/*/template.yaml`.
3. Add a row to the table above.
