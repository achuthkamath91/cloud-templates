# dynamodb-table

A pay-per-request DynamoDB table with a `PK` / `SK` key, encryption with the shared KMS key, point-in-time recovery and
an optional global secondary index (`GSI1`). Deploy it once per table: the healthcare CRM deploys it twice, as `data`
(with the index) and `audit` (without).

## Parameters

| Name | Default | What it does |
|---|---|---|
| `ExportPrefix` | required | Names this deployment. Must match the `kms-data-key` stack. |
| `TableLabel` | required | Short name, for example `data`. The table is called `<ExportPrefix>-<TableLabel>`. |
| `Stage` | `dev` | `prod` turns on deletion protection. |
| `EnableGsi` | `false` | Adds `GSI1` on `GSI1PK` / `GSI1SK`. |

## Exports

| Name | Value |
|---|---|
| `<prefix>-<label>-TableName` | table name |
| `<prefix>-<label>-TableArn` | table ARN |

## Deploy

```bash
aws cloudformation deploy --stack-name healthcare-crm-prod-data --template-file template.yaml \
  --parameter-overrides ExportPrefix=healthcare-crm-prod TableLabel=data Stage=prod EnableGsi=true
```

## Notes
- Needs the `kms-data-key` stack deployed first (it imports `<prefix>-DataKeyArn`).
- The table is kept if the stack is deleted.
- Never deployed. It passes `cfn-lint` only.
