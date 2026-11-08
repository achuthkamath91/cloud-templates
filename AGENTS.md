# AGENTS.md

Instructions for AI coding agents working in this repo. `CLAUDE.md` is a symlink to this file. Each template has its own
`AGENTS.md` with template-specific rules; read it when you work inside that folder.

## What this repo is

`cloud-templates`: a monorepo of production-minded templates for cloud projects on AWS and Cloudflare. Healthcare CRM is
the first; other projects (school, hotel or real-estate management, for example) are meant to sit beside it. Each
template is self-contained. These are reference templates, not running products. **Nothing here has been deployed to a
real AWS or Cloudflare account.** Everything is checked by linting, typechecking and unit tests only.

## Layout

| Path | What it holds |
|---|---|
| `templates/<project>/` | One template: `infra/` (one CloudFormation stack per folder), `backend/`, `frontend/`, `docs/`, `README.md`, `AGENTS.md`. |
| `templates/healthcare-crm/` | The only template so far. Has its own `AGENTS.md`. |
| `.github/workflows/<project>.yml` | That template's CI/CD, path-filtered to its folder. GitHub only runs workflows from here, so they cannot live inside the template. |
| `README.md` | Index of templates. |

## Git workflow (required)

1. Before any change: `git fetch origin`, update `main` with `git pull --ff-only`, then create `feature/<short-description>` from it.
2. Never commit or push to `main`. Open a pull request with `gh pr create`. Do not merge unless the user says to.
3. If `main` moved while you worked (for example an earlier PR merged), rebase your branch onto the latest `origin/main` before opening the PR.
4. One topic per PR. Say in the PR what you verified and what you could not verify.

## Checks to run before opening a PR

Run the ones that match what you changed. CI runs the same checks.

```
# templates/healthcare-crm/backend
npm ci && npm run typecheck && npm test
# templates/healthcare-crm/frontend
npm ci && npm run typecheck
# every changed CloudFormation template
cfn-lint <path-to-template.yaml>        # or "templates/<project>/infra/*/template.yaml"
# every changed workflow
actionlint <file>   and   zizmor --offline <file>
```

Install the linters with `pip install cfn-lint actionlint-py zizmor`. One `zizmor` finding (cache poisoning on the
deploy job's `setup-node`) is known and believed to be a false positive; do not add new findings.

## Rules that matter here

- **Self-contained templates.** A template must work when its folder is copied alone: no paths, imports or links that
  point outside `templates/<project>/`. The one exception is its workflow in `.github/workflows/`, which the README tells
  you to copy. When two templates need the same stack, copy it; never link across templates.
- **Be honest about status.** Never call anything production-ready, certified, or HIPAA-compliant. Keep each template's
  known-issues list in `docs/security.md` accurate: remove an item only when it is really fixed.
- **Deploy only when asked, and only one way.** Never create cloud resources or run commands against a real AWS or Cloudflare account yourself. The one allowed route is the manual `healthcare-crm.yml` workflow (see "Deploy with an AI agent" in the template README), and only when the user has given all four inputs (`aws_region`, `frontend_origin`, `aws_deploy_role_arn`, `stack_prefix`) and said to deploy. Show the exact `gh workflow run` command first and wait for a yes. Never guess an input, and never put a secret in a prompt or in chat.
- **No secrets and no real patient data.** Not in code, tests, logs, docs or examples. Use synthetic data such as
  `clinic-1` and `Ann Lee`. `.env` files are ignored; only `.env.example` is committed.
- **Workflows:** pin every action to a commit SHA with a `# vX` comment. Keep `permissions` minimal (`id-token: write`
  only on the deploy job). Pass `vars.*`, `secrets.*` and `inputs.*` through `env:`, never straight into a shell script.
- **Infra stacks:** the stacks of one deployment share an `ExportPrefix`. Exports are named `<prefix>-<Name>` and every
  `Fn::ImportValue` must match an export. Keep stateful resources (`DeletionPolicy: Retain`, deletion protection).
  Each stack folder has its own README (parameters, exports, deploy command) and is listed in the template's
  `infra/README.md` and in its workflow.
- **New template:** follow "Adding a template" in the root `README.md`.
- **Keep docs in sync with code.** After a change, check that README tables, the security notes, the diagram alt text
  and relative links still match.
- **Plain writing.** Short sentences, everyday words, explain a technical term the first time you use it.

## Windows notes

- PowerShell 5.1 splits arguments at double quotes. Write commit messages and PR bodies to a file and use
  `git commit -F <file>` and `gh pr create --body-file <file>`.
- Git warns about LF to CRLF conversion. That is expected; do not rewrite line endings.
- The `CLAUDE.md` files are real symlinks. On Windows they need Developer Mode on and `git config core.symlinks true`,
  then `git checkout -- CLAUDE.md templates/healthcare-crm/CLAUDE.md`. Without that, they appear as a one-line text file.
