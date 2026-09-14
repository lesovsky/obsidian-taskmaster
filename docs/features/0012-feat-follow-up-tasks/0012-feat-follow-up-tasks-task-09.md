---
status: done
depends_on: ["08"]
wave: 6
skills: [pre-deploy-qa]
verify: bash                       # npm run test:all && npm run build
reviewers: []
---

# Task 09: Pre-deploy QA

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:pre-deploy-qa` — [skills/pre-deploy-qa/SKILL.md](~/.claude/skills/pre-deploy-qa/SKILL.md)

## Description

Acceptance testing of the whole feature before handing it to the user: run every automated check and walk
the acceptance criteria of the user-spec and the tech-spec. There is no Docker environment and no deploy —
the plugin is verified by its test suites and a production build; visual checks in real Obsidian stay with
the user.

## What to do

1. Run `npx tsc --noEmit`, `npm run build`, `npm run test:all`.
2. Go through user-spec AC-1…AC-13 and tech-spec Acceptance Criteria; for each, name the test or check that
   proves it. Anything unproven is a finding.
3. Confirm `grep -rn "from 'obsidian'" src/stores src/logic` is empty.
4. List the user's manual checks from the user-spec ("Пользователь проверяет") in the report.

## Acceptance Criteria

- [x] All commands green
- [x] Every AC mapped to evidence
- [x] Report written with any findings and the manual-check list

## Context Files

- [0012-feat-follow-up-tasks.md](0012-feat-follow-up-tasks.md) — user-spec
- [0012-feat-follow-up-tasks-tech-spec.md](0012-feat-follow-up-tasks-tech-spec.md) — tech-spec
- [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) — decisions log
- [docs/testing/infrastructure.md](../../testing/infrastructure.md) — how to run the suites

## Verification Steps

- `npm run test:all && npm run build` — green

## Details

**Dependencies:** Task 08.
**Edge cases:** Playwright uses `workers: 1`; run the full suite, not only the feature spec.

## Reviewers

None — QA is its own verification.

## Post-completion

- [x] Записать краткий отчёт в [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md)
- [x] Если отклонились от спека — описать отклонение и причину
