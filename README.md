# cloud-templates

Production-minded templates for cloud projects on AWS and Cloudflare. Each template is a self-contained project:
infrastructure as code, backend, frontend, tests, docs and a CI/CD workflow. Copy one folder and build on it.

> **Status:** reference templates. Read each template's `docs/security.md` before using it with real data. Nothing
> here is a compliance certification.

## Templates

| Template | What it is | Stack | Status |
|---|---|---|---|
| [`templates/healthcare-crm`](templates/healthcare-crm) | Multi-tenant healthcare CRM with role-based access and an audit trail | Cognito, API Gateway, Lambda, DynamoDB, KMS on AWS; React on Cloudflare; GitHub Actions | Reference architecture, never deployed |

<p align="center">
  <img src="templates/healthcare-crm/docs/architecture.svg" alt="Architecture of the healthcare CRM template: a staff browser loads a React app from Cloudflare, signs in with Cognito, and calls API Gateway, which runs a Lambda function that writes to encrypted DynamoDB tables." width="900">
</p>

## How the repo is organised

```
templates/<project>/
  infra/       CloudFormation stacks, one folder per stack, each with template.yaml and README.md
  backend/     API code and tests
  frontend/    web app
  docs/        architecture, security notes, decision records
  README.md    how to deploy and use this template
  AGENTS.md    instructions for AI coding agents (CLAUDE.md links to it)

.github/workflows/<project>.yml
               the template's CI/CD workflow; it runs only when that template's folder changes
```

GitHub only runs workflows from the repo-root `.github/workflows/` folder, so each template's workflow lives there and is
named after the template.

## Using a template

1. Copy the template folder (for example `templates/healthcare-crm`) into your own repo.
2. Copy its workflow (`.github/workflows/healthcare-crm.yml`) into your repo's `.github/workflows/` and update the paths.
3. Follow the template's own README to deploy.

Everything else the template needs is inside its folder.

## Adding a template

1. Create `templates/<project>/` with the layout above, named after the project, for example `school-management` or
   `hotel-management`.
2. Add `.github/workflows/<project>.yml` with a `paths:` filter for that folder only. Lint every
   `infra/*/template.yaml`.
3. Add `AGENTS.md` and a `CLAUDE.md` symlink to it.
4. Add a row to the table above.

Each template keeps its own copy of the infra it needs. When two templates need the same stack, copy it from the
existing template; do not link across templates.

## License

[MIT](LICENSE). AWS and Cloudflare logos in the diagrams are trademarks of their owners and are used only to identify
the services.
