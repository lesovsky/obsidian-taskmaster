---
status: planned
depends_on: ["01", "03"]
wave: 3
skills: [code-writing]
verify: bash                       # npx vitest run tests/unit/dataStore.test.ts tests/unit/followUps.test.ts
reviewers: [dev-code-reviewer]
---

# Task 04: Store integration

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:code-writing` — [skills/code-writing/SKILL.md](~/.claude/skills/code-writing/SKILL.md)

## Description

The store is where tasks enter the completed group. This task makes both entry paths spawn pending
follow-ups and report what they spawned, lets Undo of ☑ revert exactly that spawn, and adds the operation
the form uses for items marked "→ to backlog" (tech-spec "How it works" steps 2–5, Decisions 4, 5).
The store stays a thin caller of `src/logic/followUps.ts` and must not import `obsidian` (Decision 6) —
notices are shown by UI code in Task 07 using the returned ids.

## What to do

1. `quickCompleteTask`: after moving and stamping the task, spawn all its pending items into the backlog of
   the same board; add `spawnedTaskIds: string[]` to the returned object.
2. `undoQuickComplete`: add a trailing parameter `spawnedTaskIds: string[] = []` and revert that spawn in the
   same update as the existing restore. The default keeps the current caller compiling until Task 07 wires it.
3. `moveTask`: return `string[]` — the spawned ids when `toGroupId === 'completed'` and
   `fromGroupId !== 'completed'`, otherwise `[]`. Moves between other groups and reorders inside completed
   spawn nothing.
4. New `createFollowUpTasks(boardId, parentTaskId, itemIds): string[]` — spawns only the given pending items
   and persists.
5. The why-prefix comes from the current locale (`get(t)('followUps.whyPrefix')`, read outside the update
   callback, as `createBoard` does); `today` is `formatDate(new Date())`.
6. `updateTask` is unchanged — choosing status "completed" in the form spawns nothing (user-spec AC-6).
7. Extend `tests/unit/dataStore.test.ts` with the anchors below. `moveTask` resolves the board through
   `uiStore.activeBoardId` — set it in the seed.

## TDD Anchor

- `::quickCompleteTask spawns pending items into backlog and returns their ids`
- `::quickCompleteTask on a task without pending items returns an empty spawnedTaskIds`
- `::undoQuickComplete with spawnedTaskIds removes those tasks and returns items to pending`
- `::undoQuickComplete leaves an item created earlier via the form untouched`
- `::moveTask into completed from a working group spawns and returns ids`
- `::moveTask inside completed spawns nothing` — the reorder rule (Decision 4)
- `::moveTask between working groups spawns nothing`
- `::completing again after moving back out creates no duplicates` (user-spec AC-8)
- `::createFollowUpTasks spawns only the given items and returns their ids`
- `::updateTask with status completed spawns nothing`
- `::spawned task why uses the locale prefix` — `'After: '` + parent `what` under the default `en` locale

## Acceptance Criteria

- [ ] ☑ and drag into completed spawn pending items into the same board's backlog and return the ids
- [ ] Reorder inside completed and moves between other groups spawn nothing
- [ ] Undo reverts exactly the ids it is given; earlier-created items stay created
- [ ] `createFollowUpTasks` exists and spawns only the given items
- [ ] No `obsidian` import in `src/stores/`
- [ ] `npx vitest run tests/unit/dataStore.test.ts tests/unit/followUps.test.ts` — green; `npm test` green
- [ ] `npx tsc --noEmit` — clean

## Context Files

**Feature artifacts:**
- [0012-feat-follow-up-tasks.md](0012-feat-follow-up-tasks.md) — user-spec ("Что считается завершением", scenarios 2–3)
- [0012-feat-follow-up-tasks-tech-spec.md](0012-feat-follow-up-tasks-tech-spec.md) — Decisions 4, 5, 6, Backward Compatibility
- [0012-feat-follow-up-tasks-code-research.md](0012-feat-follow-up-tasks-code-research.md) — section 4.1 (completion paths), problem 5
- [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) — decisions log

**Code files:**
- [src/stores/dataStore.ts](../../../src/stores/dataStore.ts) — `quickCompleteTask`, `undoQuickComplete`, `moveTask`, new op
- [tests/unit/dataStore.test.ts](../../../tests/unit/dataStore.test.ts) — `seedBoards` pattern, persistence fake
- [src/logic/followUps.ts](../../../src/logic/followUps.ts) — spawn / revert
- [src/logic/statusTransitions.ts](../../../src/logic/statusTransitions.ts) — read only: runs for in-group reorders too
- [src/ui/useSortable.ts](../../../src/ui/useSortable.ts), [src/ui/BoardLayout.svelte](../../../src/ui/BoardLayout.svelte) — read only: current callers

## Verification Steps

- `npx vitest run tests/unit/dataStore.test.ts tests/unit/followUps.test.ts` — green
- `npm test` — whole unit suite green
- `npx tsc --noEmit` — clean; `npm run build` — succeeds

## Details

**Files:** `src/stores/dataStore.ts`, `tests/unit/dataStore.test.ts`.
**Dependencies:** Task 01 (why-prefix key), Task 03 (logic). `uiStore.ts` is **not** changed here — the toast
type change belongs to Task 07 with the code that builds toasts.
**Edge cases:** ☑ called for a task already in completed is rejected by the caller today — keep it that way;
unknown board or task → existing `null` / no-op behavior preserved.
**Implementation hints:** keep each op a single `dataStore.update` + one `persist()`, like the existing ops.

## Reviewers

- **dev-code-reviewer** → `0012-feat-follow-up-tasks-task-04-dev-code-reviewer-review.json`

## Post-completion

- [ ] Записать краткий отчёт в [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [ ] Если отклонились от спека — описать отклонение и причину
- [ ] Обновить user-spec/tech-spec если что-то изменилось
