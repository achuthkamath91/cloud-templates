# github-oidc-role

Lets a GitHub Actions workflow deploy to AWS without a stored access key. The workflow proves who it is with a
short-lived token from GitHub, and AWS hands back temporary credentials.

The role can be assumed only by workflow runs of **one repository** in **one GitHub environment**. A fork, another
repository, or a workflow on a pull request cannot use it. This is the lock-down that the healthcare CRM's security
notes ask for.

## Parameters

| Name | Default | What it does |
|---|---|---|
| `GitHubRepo` | required | `owner/name` of the repository. |
| `GitHubEnvironment` | `production` | The GitHub environment whose runs may assume the role. |
| `CreateOidcProvider` | `true` | An account can have only one GitHub provider. Use `false` if it already exists. |
| `PermissionsPolicyArn` | required | The managed policy that defines what the role may deploy. |
| `RoleName` | `github-actions-deploy` | Name of the role. |

## Outputs

| Name | Value |
|---|---|
| `RoleArn` | paste it into the `aws_deploy_role_arn` input when you start the deploy workflow |

## Deploy

```bash
aws cloudformation deploy --stack-name github-oidc-role --template-file template.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides GitHubRepo=achuthkamath91/cloud-templates \
  PermissionsPolicyArn=arn:aws:iam::123456789012:policy/crm-deploy
```

Deploy it once per AWS account, by hand, from an administrator session. The pipeline cannot create its own role.

## Notes
- **You must supply the permissions policy.** There is deliberately no default, because the right permissions depend on
  your stacks. `AdministratorAccess` works but is far too broad. A good policy covers CloudFormation, Lambda, API
  Gateway, DynamoDB, KMS, Cognito, CloudWatch Logs and the S3 bucket that `sam deploy` uses, and limits IAM actions to
  the roles those stacks create.
- Never deployed. It passes `cfn-lint` only.
