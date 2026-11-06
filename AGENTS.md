# AGENTS.md

Instructions for AI coding agents working in this repo. `CLAUDE.md` is a symlink to this file. Each template has its own
`AGENTS.md` with template-specific rules; read it when you work inside that folder.

## What this repo is

`cloud-templates`: production-minded templates for cloud services on AWS and Cloudflare. It is a collection of
reference templates, not a running product. **Nothing here has been deployed to a real AWS or Cloudflare account.**
Everything is checked by linting, typechecking and unit tests only.

## Layout

| Path | What it holds |
|---|---|
| `crm/healthcare/` | The healthcare CRM template (backend, frontend, app stack, docs). Has its own `AGENTS.md`. |
| `infra/<block>/` | Reusable CloudFormation building blocks, each with `template.yaml` and `README.md`. See `infra/README.md`. |
| `.github/workflows/` | `crm-healthcare.yml` (test and deploy, runs only for `crm/healthcare/**` and `infra/**`), `infra.yml` (lints each block). |
| `README.md` | Index of templates and blocks. |

## Git workflow (required)

1. Before any change: `git fetch origin`, update `main` with `git pull --ff-only`, then create `feature/<short-description>` from it.
2. Never commit or push to `main`. Open a pull request with `gh pr create`. Do not merge unless the user says to.
3. If `main` moved while you worked (for example an earlier PR merged), rebase your branch onto the latest `origin/main` before opening the PR.
4. One topic per PR. Say in the PR what you verified and what you could not verify.

## Checks to run before opening a PR

Run the ones that match what you changed. CI runs the same checks.

```
# crm/healthcare/backend
npm ci && npm run typecheck && npm test
# crm/healthcare/frontend
npm ci && npm run typecheck
# every changed CloudFormation template
cfn-lint <path-to-template.yaml>
# every changed workflow
actionlint <file>   and   zizmor --offline <file>
```

Install the linters with `pip install cfn-lint actionlint-py zizmor`. One `zizmor` finding (cache poisoning on the
deploy job's `setup-node`) is known and believed to be a false positive; do not add new findings.

## Rules that matter here

- **Be honest about status.** Never call anything production-ready, certified, or HIPAA-compliant. Keep the known-issues
  list in `crm/healthcare/docs/security.md` accurate: remove an item only when it is really fixed.
- **Never deploy.** Do not create cloud resources or run commands against a real AWS or Cloudflare account.
- **No secrets and no real patient data.** Not in code, tests, logs, docs or examples. Use synthetic data such as
  `clinic-1` and `Ann Lee`. `.env` files are ignored; only `.env.example` is committed.
- **Workflows:** pin every action to a commit SHA with a `# vX` comment. Keep `permissions` minimal (`id-token: write`
  only on the deploy job). Pass `vars.*` and `secrets.*` through `env:`, never straight into a shell script.
- **Infra blocks:** all stacks of one deployment share an `ExportPrefix`. Exports are named `<prefix>-<Name>` and every
  `Fn::ImportValue` must match an export. Keep stateful resources (`DeletionPolicy: Retain`, deletion protection).
  A new block needs its own README (parameters, exports, deploy command), a row in `infra/README.md` and the root
  README, and an entry in the matrix in `.github/workflows/infra.yml`.
- **New template:** create `<category>/<template>/` with `infra/`, `backend/`, `frontend/`, `docs/` and a README; add a
  path-filtered workflow `.github/workflows/<category>-<template>.yml`; add a row to the root README.
- **Keep docs in sync with code.** After a change, check that README tables, the security notes, the diagram alt text
  and relative links still match.
- **Plain writing.** Short sentences, everyday words, explain a technical term the first time you use it.

## Windows notes

- PowerShell 5.1 splits arguments at double quotes. Write commit messages and PR bodies to a file and use
  `git commit -F <file>` and `gh pr create --body-file <file>`.
- Git warns about LF to CRLF conversion. That is expected; do not rewrite line endings.
- The `CLAUDE.md` files are real symlinks. On Windows they need Developer Mode on and `git config core.symlinks true`,
  then `git checkout -- CLAUDE.md crm/healthcare/CLAUDE.md`. Without that, they appear as a one-line text file.
