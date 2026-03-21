---
name: github-project-workflow
description: Use when working on Glyph GitHub issues, pull requests, or roadmap execution. Keeps the GitHub Project board, issue states, and PR links in sync for this repo.
---

# GitHub Project Workflow

Use this skill whenever the task involves:

- starting work from a GitHub issue
- creating or updating roadmap issues
- opening or updating a pull request
- keeping the GitHub Project board aligned with implementation progress

Project board:

- `https://github.com/users/FALAK097/projects/1/views/1`

## Required workflow

1. Prefer starting implementation from an existing GitHub issue.
2. If the work should be tracked and no issue exists yet, create the issue first unless the task is truly tiny.
3. When work actually starts on an issue, move its project status from `Todo` to `In Progress`.
4. When the work is complete, move the project status to `Done`.
5. When opening a PR, always link the relevant issue or issues in the PR body.
6. Use closing keywords when appropriate, for example `Closes #123`.
7. If one PR covers multiple issues, link every relevant issue in the PR body.
8. Keep the issue state, PR linkage, and project status consistent with the real state of the work.

## Guardrails

- Do not leave an actively worked issue in `Todo`.
- Do not leave finished work in `In Progress`.
- Do not open a PR without linking the issue or issues it addresses.
- Treat the GitHub Project board as the source of truth for roadmap execution state.

## Release Please Compatibility

Glyph uses Release Please from [release-please.yml](/Users/falakgala/projects/glyph/.github/workflows/release-please.yml), so commits that land on `main` must follow Conventional Commits.

Use this format for every commit you create:

- `<type>(<scope>): <summary>`

Preferred types and scopes:

- `feat(desktop): ...` for user-visible desktop features
- `fix(desktop): ...` for desktop bug fixes
- `feat(web): ...` or `fix(web): ...` for the web app
- `docs(skills): ...` or `docs(repo): ...` for documentation and skill updates
- `refactor(desktop): ...` for internal cleanup without behavior changes
- `build(repo): ...` or `ci(repo): ...` for tooling and workflow changes
- `chore(repo): ...` only for non-user-facing maintenance

Important rules:

1. Do not use vague commit headers like `update`, `misc`, or `fix stuff`.
2. Use `feat` for product-facing additions and `fix` for bug fixes so Release Please can version correctly.
3. For breaking changes, use `!` in the header and include a `BREAKING CHANGE:` footer in the commit body.
4. If the PR will be squash-merged, the PR title must also use the same Conventional Commit format because that squash commit is what lands on `main`.
5. Before pushing, make sure the final branch history and the PR title are both release-please friendly.
