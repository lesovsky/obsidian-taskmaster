---
status: planned
depends_on: ["04", "05"]
wave: 4
skills: [code-writing]
verify: bash                       # npm run build; npm test; npx playwright test
reviewers: [dev-code-reviewer]
---

# Task 07: UI wiring and notice

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:code-writing` — [skills/code-writing/SKILL.md](~/.claude/skills/code-writing/SKILL.md)

## Description

The store now reports spawned ids and the form reports marked ids; this task connects them to the interface
(tech-spec "How it works", Decisions 6, 7, 8, 10; user-spec AC-4, AC-5, AC-7, AC-9, AC-10):

- one Obsidian notice after ☑, drag into completed and form Save, when anything was spawned;
- spawned ids stored on the completion toast and reverted by Undo;
- drag and the test harness go through one exported move function, so E2E covers the notice path;
- harness support: a `Notice` mock and Escape closing the mock modal like Obsidian's.

## What to do

1. `src/stores/uiStore.ts`: `CompleteToast` gains `spawnedTaskIds: string[]`.
2. New `src/ui/followUpNotice.ts` exporting `showFollowUpNotice(boardId, count)`: no-op for `count === 0`;
   otherwise resolve the backlog's display name on that board (`resolveGroupTitle` with the stored title and
   the localized default), check whether backlog is in `hiddenGroups`, build the text with
   `formatFollowUpNotice` (`followUps.noticeCreated`, suffix `followUps.noticeHidden` only when hidden) and show
   `new Notice(text)`. This is the only `obsidian` import added by the feature outside existing Obsidian-layer
   files.
3. `BoardLayout.svelte`:
   - `handleComplete` — put `result.spawnedTaskIds` on the toast, call the notice;
   - `handleUndo` — pass the toast's ids to `undoQuickComplete`; additionally clear the timer and remove any
     live toast — **delete or complete** — whose `taskId` is one of those ids (Decision 10);
   - create and edit modal callbacks take `(task, spawnItemIds)`: save as today, then if ids were marked call
     `createFollowUpTasks(board.id, task.id, ids)` and the notice.
4. `useSortable.ts`: export a move function that calls the store `moveTask` and then the notice for the active
   board; the Sortable drop handler uses it.
5. `tests/harness/main.ts`: `__test.moveTask` calls that exported function; `resetData` also removes any notice
   elements left by a previous test.
6. `tests/harness/obsidian-mock.ts`:
   - add `Notice` — it renders the message into a `.notice` element inside a `.notice-container` attached to
     `document.body` (the structure real Obsidian uses) via `textContent`, never `innerHTML` (real `Notice`
     renders a string as text; the mock must not be more or less permissive), and removes it after its timeout;
   - make `Modal.open()` close the modal on the Escape key, detaching the listener on close.

## TDD Anchor

Store and formatter rules are unit-tested in Tasks 03–04. This wiring is exercised end to end in Task 08; the gate
here is the build, the full unit suite and the full existing Playwright suite (the harness changes affect every
spec).

## Acceptance Criteria

- [ ] ☑ on a task with pending items shows one notice with the right count and backlog name; no notice when nothing spawned
- [ ] Drag into completed (real Sortable drop and `__test.moveTask`) shows the notice; reorder inside completed does not
- [ ] Form Save with marked items spawns them and shows the notice; Escape spawns nothing
- [ ] Undo removes the spawned tasks, returns items to pending and dismisses delete and complete toasts of reverted tasks
- [ ] Hidden backlog → suffix in the notice; renamed backlog → its current name
- [ ] No `obsidian` import in `src/stores/` or `src/logic/`
- [ ] `npm run build`, `npm test`, `npx playwright test` — all green

## Context Files

**Feature artifacts:**
- [0012-feat-follow-up-tasks.md](0012-feat-follow-up-tasks.md) — user-spec (Уведомление, scenarios 2–5, edge cases)
- [0012-feat-follow-up-tasks-tech-spec.md](0012-feat-follow-up-tasks-tech-spec.md) — Decisions 6, 7, 8, 10
- [0012-feat-follow-up-tasks-code-research.md](0012-feat-follow-up-tasks-code-research.md) — sections 4.1, 4.2, problems 4, 6, 7
- [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) — decisions log

**Code files:**
- [src/stores/uiStore.ts](../../../src/stores/uiStore.ts) — toast type
- [src/ui/followUpNotice.ts](../../../src/ui/followUpNotice.ts) — new
- [src/ui/BoardLayout.svelte](../../../src/ui/BoardLayout.svelte) — ☑, Undo, modal callbacks
- [src/ui/useSortable.ts](../../../src/ui/useSortable.ts) — exported move function
- [tests/harness/main.ts](../../../tests/harness/main.ts), [tests/harness/obsidian-mock.ts](../../../tests/harness/obsidian-mock.ts) — harness
- [src/ui/groupTitle.ts](../../../src/ui/groupTitle.ts), [src/i18n/index.ts](../../../src/i18n/index.ts) — backlog name
- [src/stores/dataStore.ts](../../../src/stores/dataStore.ts), [src/logic/followUps.ts](../../../src/logic/followUps.ts) — read only: APIs
- [docs/testing/infrastructure.md](../../testing/infrastructure.md) — harness architecture

## Verification Steps

- `npm run build` — succeeds
- `npm test` — green
- `npx playwright test` — every existing spec green (the harness change touches all of them)
- `grep -rn "from 'obsidian'" src/stores src/logic` — no matches

## Details

**Files:** as listed.
**Dependencies:** Task 04 (store API), Task 05 (form `onSave` signature). Parallel with Task 06 — no shared files.
**Edge cases:** toast eviction of a `complete` toast just drops it — spawned tasks stay (no change needed); the
Undo cleanup of delete toasts must not touch toasts of unrelated tasks; `showFollowUpNotice` for a board that no
longer exists is a no-op.
**Implementation hints:** keep the notice call after the store call returns, never inside a store update.

## Reviewers

- **dev-code-reviewer** → `0012-feat-follow-up-tasks-task-07-dev-code-reviewer-review.json`

## Post-completion

- [ ] Записать краткий отчёт в [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [ ] Если отклонились от спека — описать отклонение и причину
- [ ] Обновить user-spec/tech-spec если что-то изменилось
