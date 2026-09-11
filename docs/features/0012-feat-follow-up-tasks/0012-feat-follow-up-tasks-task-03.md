---
status: planned
depends_on: ["02"]
wave: 2
skills: [code-writing]
verify: bash                       # npx vitest run tests/unit/followUps.test.ts
reviewers: [dev-code-reviewer, dev-security-auditor]
---

# Task 03: Follow-up logic module

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:code-writing` — [skills/code-writing/SKILL.md](~/.claude/skills/code-writing/SKILL.md)

## Description

All rules of the feature live in one pure module, `src/logic/followUps.ts` (tech-spec Decision 3), so the
store and the UI stay thin callers and every rule gets direct unit tests in the `node` test environment.
The module must not import stores, i18n or `obsidian` — callers pass in the localized strings and the data.

Downstream tasks rely on the exported API below; keep these names and shapes.

| Export | Purpose |
|--------|---------|
| `MAX_FOLLOW_UPS` (20), `FOLLOW_UP_TEXT_MAX_LENGTH` (200) | limits shared with the editor |
| `pendingFollowUps(task)` | items with empty `createdTaskId`, in list order; tolerates a task without the field |
| `buildFollowUpTask(item, parent, opts)` | the new `Task` for an item; `opts = { whyPrefix, priority, today }` |
| `spawnFollowUps(data, boardId, parentTaskId, opts, itemIds?)` | creates tasks for pending items (all of them, or only `itemIds`), appends them to the end of that board's backlog in list order, writes `createdTaskId`, returns the new task ids in order; `opts = { whyPrefix, today }`, priority from `data.settings.defaultPriority` |
| `revertSpawnedFollowUps(data, boardId, parentTaskId, spawnedTaskIds)` | removes those tasks from every group of the board and from `tasks`, flips matching items back to pending |
| `FollowUpDraft` type, `finalizeFollowUpDrafts(drafts)` | `{ id, text, createdTaskId, marked }` → `{ followUps, spawnItemIds }` |
| `formatFollowUpNotice(template, groupTitle, count, hiddenSuffix)` | fills `{group}` / `{count}`, appends the suffix when not `null` |

## What to do

1. Create `src/logic/followUps.ts` with the exports above. `spawnFollowUps` and `revertSpawnedFollowUps`
   mutate the `PluginData` passed in (same convention as `applyStatusTransition`) and return synchronously.
2. Built task fields (user-spec "Основной сценарий" step 4): `what` = item text; `why` = `whyPrefix` +
   parent `what`, cut to 10 000 characters; `who`, `deadline`, `completedAt` = `''`; `priority` from opts;
   `status` = `'new'`; `createdAt` = `today`; `followUps` = `[]`; `id` = fresh UUID.
3. Draft finalization: trim texts, drop empty drafts (marked ones too), keep order, cap text at 200 and the
   list at 20, keep `createdTaskId` of created drafts, return ids of drafts that are marked **and** still
   pending **and** survive finalization.
4. Notice formatting must substitute without `String.replace` string patterns (Decision 7) — a group title
   containing `$&`, `$1` or `$$` must appear literally.
5. Write `tests/unit/followUps.test.ts` with the anchors below.

## TDD Anchor

- `::pendingFollowUps skips created items and keeps order`
- `::pendingFollowUps of a task without followUps is empty`
- `::buildFollowUpTask sets exactly the specified fields`
- `::buildFollowUpTask caps why at 10000 characters`
- `::spawnFollowUps appends one task per pending item to the end of backlog, in list order`
- `::spawnFollowUps writes createdTaskId and returns the new ids in order`
- `::spawnFollowUps skips already created items` — re-spawn after a spawn returns `[]`, no duplicates
- `::spawnFollowUps with itemIds spawns only those pending items`
- `::spawnFollowUps uses settings.defaultPriority`
- `::spawnFollowUps targets the given board only` — second board untouched
- `::spawnFollowUps for an unknown parent, unknown board or missing backlog returns [] and changes nothing`
- `::revertSpawnedFollowUps removes spawned tasks from any group and from tasks`
- `::revertSpawnedFollowUps flips only matching items back to pending` — an earlier, separately created item stays created
- `::revertSpawnedFollowUps tolerates a spawned task that was already deleted`
- `::finalizeFollowUpDrafts trims, drops empty and marked-but-empty drafts, keeps order`
- `::finalizeFollowUpDrafts caps text at 200 and list at 20`
- `::finalizeFollowUpDrafts returns ids of marked pending drafts only`
- `::formatFollowUpNotice substitutes group and count`
- `::formatFollowUpNotice keeps $& in a group title literal`
- `::formatFollowUpNotice appends the hidden suffix`

## Acceptance Criteria

- [ ] Module exports the API from the table; no imports of stores, i18n or `obsidian`
- [ ] Spawn/revert/finalize/format behave as specified; all anchors pass
- [ ] `npx vitest run tests/unit/followUps.test.ts` — green
- [ ] `npx tsc --noEmit` — clean

## Context Files

**Feature artifacts:**
- [0012-feat-follow-up-tasks.md](0012-feat-follow-up-tasks.md) — user-spec ("Как должно работать", "Граничные случаи")
- [0012-feat-follow-up-tasks-tech-spec.md](0012-feat-follow-up-tasks-tech-spec.md) — "How it works", Decisions 2, 3, 7
- [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) — decisions log

**Code files:**
- [src/logic/statusTransitions.ts](../../../src/logic/statusTransitions.ts) — convention for a mutating pure helper
- [src/data/types.ts](../../../src/data/types.ts) — `Task`, `FollowUp`, `PluginData`
- [src/data/migration.ts](../../../src/data/migration.ts) — surrogate-safe cap used by `sanitizeGroupTitle`
- [src/utils/dateFormat.ts](../../../src/utils/dateFormat.ts) — callers pass `formatDate(new Date())` as `today`
- [tests/unit/cleanup.test.ts](../../../tests/unit/cleanup.test.ts) — factory style for test data

## Verification Steps

- `npx vitest run tests/unit/followUps.test.ts` — green, new tests seen failing first
- `npx tsc --noEmit` — clean
- `grep -n "from '../stores\|from '../i18n\|from 'obsidian'" src/logic/followUps.ts` — no matches

## Details

**Files:** `src/logic/followUps.ts` (new), `tests/unit/followUps.test.ts` (new).
**Dependencies:** Task 02 (types).
**Edge cases:** a backlog group object missing on a damaged board; a parent whose `followUps` is absent;
`itemIds` containing ids of created or unknown items (ignored); empty `spawnedTaskIds` (no-op).
**Implementation hints:** `revertSpawnedFollowUps` must look in every group of the board, not only backlog —
the user may have dragged a spawned task elsewhere within the undo window (user-spec edge case "Отмена").

## Reviewers

- **dev-code-reviewer** → `0012-feat-follow-up-tasks-task-03-dev-code-reviewer-review.json`
- **dev-security-auditor** → `0012-feat-follow-up-tasks-task-03-dev-security-auditor-review.json`

## Post-completion

- [ ] Записать краткий отчёт в [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [ ] Если отклонились от спека — описать отклонение и причину
- [ ] Обновить user-spec/tech-spec если что-то изменилось
