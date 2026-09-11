---
status: planned
depends_on: ["09"]
wave: 7
skills: [documentation-writing]
verify: bash                       # grep -n "followUps" docs/technical.md
reviewers: [dev-code-reviewer]
---

# Task 10: Documentation update

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:documentation-writing` — [skills/documentation-writing/SKILL.md](~/.claude/skills/documentation-writing/SKILL.md)

## Description

Bring the repository documentation in line with what shipped: the new task field and schema version 9, the
follow-up behavior, the new modules, and the test infrastructure changes. Only the sections this feature
touches — a general audit is TD-06 and out of scope.

## What to do

1. `docs/technical.md`:
   - data.json example and `Task` interface (`followUps`, `FollowUp`);
   - migration section (v9 block and per-load sanitization of `followUps`);
   - component tree (`FollowUpsEditor`);
   - modal section (`onSave(task, spawnItemIds)`);
   - toast section (`spawnedTaskIds`, undo revert);
   - a short section on follow-ups: trigger rule, spawned task fields, notice, read-only in completed;
   - security / maxlength (200 per item, 20 items).
2. `docs/overview.md` — SMART card fields table and a short product description of follow-ups.
3. `docs/testing/infrastructure.md`:
   - unit and e2e tables with the new files;
   - `Notice` mock and Escape handling in the mock modal;
   - `__test.moveTask` now showing the notice.
4. `CHANGELOG.md` / `CHANGELOG.ru.md` `[Unreleased]` — the feature and "Data schema migrated to version 9".
5. `README.md` / `README.ru.md` "Task Card" section — one paragraph about follow-ups.
6. `docs/testing/test-scenarios.md` — manual scenarios for follow-ups, and a note in the existing ☑ and drag
   sections that completing a task with pending items now creates backlog tasks and shows a notice.

## Acceptance Criteria

- [ ] Every item above updated and consistent with the code
- [ ] `grep -n "followUps" docs/technical.md` shows the field documented
- [ ] No sections unrelated to this feature rewritten

## Context Files

- [0012-feat-follow-up-tasks.md](0012-feat-follow-up-tasks.md) — user-spec
- [0012-feat-follow-up-tasks-tech-spec.md](0012-feat-follow-up-tasks-tech-spec.md) — tech-spec
- [0012-feat-follow-up-tasks-code-research.md](0012-feat-follow-up-tasks-code-research.md) — section 8 (doc locations)
- [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) — decisions log
- [src/data/types.ts](../../../src/data/types.ts), [src/logic/followUps.ts](../../../src/logic/followUps.ts) — source of truth

## Verification Steps

- `grep -n "followUps" docs/technical.md` — present
- Both changelogs mention version 9

## Details

**Dependencies:** Task 09 (document what passed QA).
**Implementation hints:** documentation in the language each file already uses.

## Reviewers

- **dev-code-reviewer** → `0012-feat-follow-up-tasks-task-10-dev-code-reviewer-review.json`

## Post-completion

- [ ] Записать краткий отчёт в [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md)
- [ ] Если отклонились от спека — описать отклонение и причину
