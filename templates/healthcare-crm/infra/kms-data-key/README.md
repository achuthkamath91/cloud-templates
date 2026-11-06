# kms-data-key

A customer-managed KMS key with automatic rotation, for encrypting DynamoDB tables and CloudWatch log groups. The key
is kept if the stack is deleted, so data encrypted with it stays readable.

## Parameters

| Name | Default | What it does |
|---|---|---|
| `ExportPrefix` | required | Names this deployment, for example `healthcare-crm-prod`. All blocks of one deployment share it. |
| `LogGroupPathPattern` | `/aws/lambda/*` | Which CloudWatch log groups may use the key. |

## Exports

| Name | Value |
|---|---|
| `<prefix>-DataKeyArn` | ARN of the key |

## Deploy

```bash
aws cloudformation deploy --stack-name healthcare-crm-prod-kms --template-file template.yaml \
  --parameter-overrides ExportPrefix=healthcare-crm-prod
```

## Notes
- Deploy this first. The tables and the app's log group import the key.
- Deleting the stack does not delete the key. To remove it, schedule its deletion in KMS (7 to 30 day wait).
- Never deployed. It passes `cfn-lint` only.
