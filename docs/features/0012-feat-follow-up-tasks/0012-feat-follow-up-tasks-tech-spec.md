---
created: 2026-09-11
status: approved
branch: feature/follow-up-tasks
size: M
---

# Tech Spec: Follow-up Tasks

## Solution

Every `Task` gains an embedded list of follow-up items (`followUps`). An item is plain text plus
the id of the task that was created from it (`createdTaskId`, empty while the item is still
pending). Keeping items inside the parent — not as separate `tasks` records — is forced by
`cleanupOrphanedTasks`, which deletes any task not referenced from a group.

All the rules live in one pure module, `src/logic/followUps.ts`: which items are pending, how a
follow-up task is built from an item, spawning items into the backlog of a board, reverting a
spawn, turning form drafts into stored items, and composing the notice text. The store calls
that module from the two completion paths that move a task into the completed group —
`quickCompleteTask` (☑) and `moveTask` (drag) — and from a new `createFollowUpTasks` operation
used by the form. Each of these returns the ids of the tasks it spawned; UI-side callers use them
to show one Obsidian `Notice` and, for ☑, to keep the ids on the completion toast so Undo can
revert exactly that spawn.

The form edits a copy of the list through a new `FollowUpsEditor` component. "→ to backlog"
only marks a draft; the form's single Save hands the parent task and the marked item ids to its
caller, which saves the task and then spawns. For a task that sits in the completed group the
editor is read-only. The card shows `↪ N` for pending items. Data moves from version 8 to 9, and
the new field is sanitized on every load.

## Architecture

### What we're building/modifying

- **`Task.followUps` + `FollowUp` type** (`src/data/types.ts`) — the embedded list.
- **Migration v8 → v9 + `sanitizeFollowUps`** (`src/data/migration.ts`) — every task gets `[]`;
  the list is sanitized on every load, outside version branches.
- **`src/logic/followUps.ts`** (new, pure) — pending items, follow-up task builder, spawn,
  revert, draft finalization, notice text.
- **`dataStore`** — `quickCompleteTask` and `moveTask` spawn when a task enters the completed
  group from another group and return the spawned ids; `undoQuickComplete` reverts a given spawn;
  new `createFollowUpTasks(boardId, parentTaskId, itemIds)`.
- **`uiStore.CompleteToast`** — carries `spawnedTaskIds`.
- **`src/ui/followUpNotice.ts`** (new) — shows the Obsidian `Notice` for a board: resolves the
  backlog's display name and hidden state, delegates text to the pure formatter.
- **`BoardLayout.svelte`** — wires ☑ (notice + toast ids), Undo (revert + dismiss delete toasts
  of reverted tasks), create and edit Save (spawn marked items + notice).
- **`useSortable.ts`** — the drop handler goes through an exported move function that also shows
  the notice; the test harness calls the same function.
- **`FollowUpsEditor.svelte`** (new) + **`TaskFormContent.svelte`** + **`TaskModal.ts`** — the
  "After completion" block; Save passes `(task, spawnItemIds)`.
- **`TaskCard.svelte`** — the `↪ N` marker with a tooltip, both view modes.
- **`src/styles.css`** — editor and marker styles (`tm-` prefix, BEM, Obsidian variables).
- **i18n** — new `followUps.*` keys in `types.ts`, `en.ts`, `ru.ts`.
- **Test harness** — `Notice` mock in `obsidian-mock.ts`, `__test.moveTask` routed through the
  UI move function.

### How it works

1. **Editing.** The form builds drafts `{ id, text, createdTaskId, marked }` from a *copy* of
   `task.followUps`. Save runs `finalizeFollowUpDrafts`: texts are trimmed, empty drafts dropped
   (a marked but emptied draft is dropped too), limits applied. It returns the stored list and the
   ids of marked drafts. The modal calls `onSave(task, spawnItemIds)`.
2. **Save in BoardLayout.** Create: `addTask(task, groupId)`; edit: `updateTask(task)`. Then, if
   ids were marked, `createFollowUpTasks(board.id, task.id, ids)` → notice with the returned count.
3. **Completion by ☑.** `quickCompleteTask` moves the task, stamps completion, then spawns all
   pending items into the backlog of the same board and returns `spawnedTaskIds` along with the
   undo data. BoardLayout shows the notice (if any) and stores the ids on the complete toast.
4. **Undo.** `undoQuickComplete(..., spawnedTaskIds)` restores the task as today and reverts the
   spawn: each spawned task is removed from whichever group of the board holds it and deleted
   from `tasks`; the parent's items pointing to those ids go back to pending. BoardLayout also
   dismisses any live delete toast of a reverted task, so its Undo cannot restore a dangling id.
5. **Completion by drag.** Sortable's drop calls the exported move function, which calls
   `moveTask`; `moveTask` spawns when `to === 'completed' && from !== 'completed'`, returns the ids,
   and the move function shows the notice. There is no undo for drag, as today.
6. **Spawned task fields.** `what` = item text; `why` = localized prefix (`'After: '` / `'После: '`)
   + parent `what`, capped at 10 000; `who`, `deadline`, `completedAt` = `''`; `priority` =
   `settings.defaultPriority`; `status` = `'new'`; `createdAt` = today; `followUps` = `[]`;
   appended to the end of `backlog.taskIds` in list order. The prefix language is the interface
   language at creation time.
7. **Load.** `migrateData` adds `followUps: []` to tasks of pre-v9 data and sanitizes every task's
   list on every load.

## Decisions

### Decision 1: Items are embedded in the parent task
**Decision:** `Task.followUps: FollowUp[]`, not separate records in `tasks`.
**Rationale:** `cleanupOrphanedTasks` deletes any `tasks` entry not referenced by a group, on load
and hourly. Separate records would vanish. The user-spec also rules out cross-card links.
**Alternatives considered:** separate task records in a hidden structure — rejected: would need a
new orphan-cleanup exception and a new relation model the user explicitly declined.

### Decision 2: An item stores `createdTaskId`, not a boolean
**Decision:** `FollowUp = { id: string; text: string; createdTaskId: string }`, `''` = pending.
Each item also has its own `id` (UUID).
**Rationale:** Undo must revert exactly the tasks spawned by one completion and leave earlier,
manually spawned items alone. Matching by task id makes that exact. The item `id` identifies rows
across the form (keyed `{#each}`, marking) and the store call (`itemIds`) without relying on
array positions that change when rows are inserted or removed.
**Alternatives considered:** `created: boolean` plus spawned ids on the toast only — rejected: after
revert the store could not tell which items to flip back without a second, position-based mapping.

### Decision 3: All rules in one pure module
**Decision:** `src/logic/followUps.ts` holds pending selection, task building, spawn, revert, draft
finalization and notice formatting; spawn/revert mutate a `PluginData` passed in, like
`applyStatusTransition` mutates a task.
**Rationale:** `vitest` runs in `node` with no DOM library, so logic inside components is not
unit-testable; the store module is testable but imports stores. A pure module gets direct tests for
every rule, and the store stays a thin caller.
**Alternatives considered:** logic inline in `dataStore` — rejected: harder to test in isolation,
and the form's draft finalization would have nowhere shared to live.

### Decision 4: Trigger = entering the completed group from another group
**Decision:** Spawn in `quickCompleteTask` and in `moveTask` only when `to === 'completed'` and
`from !== 'completed'`. Not on `updateTask`, not on the form's status select.
**Rationale:** User-spec. `applyStatusTransition` also runs for reorders inside the completed group
(`useSortable` passes them through), so the `from` check is mandatory.
**Alternatives considered:** hooking `applyStatusTransition` — rejected: it has no access to the
board or settings and is also called for in-group reorders.

### Decision 5: Form marking is deferred to Save; caller spawns after saving the task
**Decision:** The form never touches the store. Its `onSave` becomes `(task, spawnItemIds)`;
BoardLayout saves the task (`addTask`/`updateTask`) and then calls `createFollowUpTasks`.
**Rationale:** One save moment, Escape discards everything (user-spec, option B). The form keeps
its current "no store access" shape.
**Alternatives considered:** a single combined store operation — rejected as unnecessary: both calls
are synchronous in-memory updates in the same tick, each persisting, as every store op does today.

### Decision 6: Notice is shown from UI modules, never from the store
**Decision:** `src/ui/followUpNotice.ts` imports `Notice` from `obsidian`; the store only returns
spawned ids. The notice text is composed by a pure formatter in `followUps.ts`.
**Rationale:** `tests/unit/dataStore.test.ts` imports the store in `node`, where `obsidian` is not
resolvable at runtime; an `obsidian` import in the store would break the unit suite. Keeping text
composition pure makes it unit-testable.
**Alternatives considered:** a new toast type — rejected: `DeleteToast` always shows Undo and a
countdown, toasts are keyed by `taskId` and would collide with the complete toast of the same
parent, and the user asked for a plain notification.

### Decision 7: Notice text uses a template with safe substitution
**Decision:** One key `followUps.noticeCreated` holding `{group}` and `{count}` placeholders, plus
`followUps.noticeHidden` for the hidden suffix, appended after a single space. Substitution is a
single pass over the template with a function replacer (both placeholders matched by one pattern), never
a string-pattern `String.replace` with the group title as replacement and never two sequential passes.
**Rationale:** The i18n layer has no interpolation. The group title is user text (feature 0011):
`'$&'`-style sequences in a replacement string are interpreted by `String.replace`, and with two passes a
`{count}` typed into the title would be replaced by the number in the second pass.
**Alternatives considered:** concatenating two keys around the title — rejected: word order differs
between languages.

### Decision 8: Drag path shares one move function with the harness
**Decision:** `useSortable.ts` exports a move function (store move + notice) used by the Sortable
drop handler; `window.__test.moveTask` calls the same function.
**Rationale:** `useSortable` currently calls the store directly, so BoardLayout never learns about a
drag. E2E tests drive moves through `__test.moveTask`; routing it through the same function keeps the
notice path covered instead of silently bypassed.
**Alternatives considered:** a callback option on the Svelte action — rejected: six call sites would
need wiring and the harness would still bypass it.

### Decision 9: Read-only editor for tasks in the completed group
**Decision:** The form passes `readOnly = (groupId === 'completed')` to the editor; read-only shows
item texts and "✓ created" labels without inputs or buttons, and nothing at all for an empty list.
Save keeps the list unchanged.
**Rationale:** User-spec (review round 1 decision): a pending item added there would never spawn and
would be silently deleted by retention cleanup.
**Alternatives considered:** spawning on save for completed tasks — rejected by the user.

### Decision 10: Undo also dismisses toasts of reverted tasks
**Decision:** When Undo reverts a spawn, BoardLayout clears the timers and removes any live toast — delete
or complete — whose `taskId` is one of the reverted ids.
**Rationale:** Within the 7-second window the user could delete a spawned task, or complete it with ☑;
either toast would outlive the revert and its Undo would push a dangling id back into a group.
**Alternatives considered:** leaving it — rejected: cheap to prevent, and a dangling id stays in
`taskIds` until cleanup.

### Decision 11: Autopilot assumption — sanitizer repairs rather than drops items with a bad id
**Decision:** An item with a missing, non-string, empty or duplicate `id` gets a fresh UUID; an item
whose `text` is not a string or is empty after trim is dropped; a non-string `createdTaskId` becomes
`''`; text is trimmed, capped at 200 and loses a trailing lone high surrogate (same rule as
`sanitizeGroupTitle`); the list is capped at 20; a non-array becomes `[]`; a task entry that is not an
object is skipped; a `tasks` value that is not an object is left alone (TD-01 scope).
**Rationale:** The text is the user's content; an id is an implementation detail. Valid data passes
through byte-identical, so idempotency holds.
**Alternatives considered:** dropping items with a bad id — rejected: loses user content for a
technical defect.

### Decision 12: Autopilot assumption — version literal bumped in place
**Decision:** `DEFAULT_DATA.version` 8 → 9 and a new `version < 9` block; no shared constant.
**Rationale:** Same reasoning as 0011 Decision 10 — a constant would be unrequested refactoring.
**Alternatives considered:** `CURRENT_VERSION` constant — rejected as unrequested scope.

### Decision 13: Autopilot assumption — no static type check for Svelte files
**Decision:** Component tasks are gated by `npm run build` plus automated scenarios; `npx tsc
--noEmit` does not read `.svelte` files (0011 Decision 11).
**Rationale:** Claiming `tsc` as a gate for component work would be a fiction.
**Alternatives considered:** adding `svelte-check` — rejected as unrequested scope (TD-04 territory).

### Decision 14: Autopilot assumption — marker is a plain span with a `title` tooltip
**Decision:** `↪ N` (compact: `↪N`) in a non-interactive `<span>` with a `title` listing pending texts
separated by newlines. Not focusable, no click handler.
**Rationale:** User-spec: not clickable; a click on it opens the form like the rest of the card, and
dragging by it works. A non-interactive span needs no Sortable filter and no keyboard handling.
**Alternatives considered:** a custom hover popover — rejected: more code for the same information.

## Data Models

```typescript
// src/data/types.ts
export interface FollowUp {
  id: string;            // UUID of the item itself
  text: string;          // trimmed, 1..200 chars
  createdTaskId: string; // '' = pending; otherwise id of the task spawned from this item
}

export interface Task {
  id: string;
  what: string;
  why: string;
  who: string;
  deadline: string;
  createdAt: string;
  completedAt: string;
  priority: Priority;
  status: Status;
  followUps: FollowUp[]; // NEW — at most 20 items
}
```

Data version: `8` → `9`. The `version < 9` block sets `followUps: []` on every task lacking it.
Invariants enforced on every load (Decision 11): `followUps` is an array of at most 20 items, each
with a unique non-empty `id`, a trimmed non-empty `text` of at most 200 characters and a string
`createdTaskId`.

Transient UI types (not persisted): `CompleteToast.spawnedTaskIds: string[]`; form draft
`{ id, text, createdTaskId, marked: boolean }`.

## Dependencies

### New packages

None.

### Using existing (from project)

- `svelte` — editor component, reactive marker.
- `obsidian` — `Notice` (first use in the project; mocked in the harness).
- `vitest` — unit tests for the logic module, migration and store.
- `@playwright/test` + harness — E2E scenarios.
- `src/ui/groupTitle.ts` — `resolveGroupTitle` for the backlog name in the notice.
- `src/i18n` — `t`, `groupLabels`.
- `src/utils/dateFormat.ts` — `formatDate` for `createdAt`.

## Testing Strategy

**Feature size:** M

### Unit tests

- **Logic module:**
  - pending selection ignores created items;
  - the built task has exactly the specified fields and a capped `why`;
  - spawn appends to the end of backlog in list order, sets `createdTaskId`, skips created items,
    spawns only the requested ids, returns ids in order, does nothing for an unknown parent or board;
  - revert removes spawned tasks from any group of the board and from `tasks`, flips only matching
    items back, tolerates already-deleted tasks;
  - draft finalization trims, drops empty, drops marked-but-empty, keeps order, caps 200/20 and
    returns marked ids;
  - notice formatting substitutes in one pass (a title containing `$&`, `{count}` or `{group}` stays
    literal), appends the hidden suffix after a space, and produces the expected text from both real
    dictionary templates (en and ru) — this is where AC-13's notice wording is proven, since the harness
    forces the `en` locale.
- **Migration:**
  - v8 → v9 gives every task `[]`;
  - older versions land on 9;
  - v9 → v9 is idempotent;
  - sanitization covers every shape in Decision 11, including on already-v9 data.
- **Store:**
  - ☑ spawns pending items and returns ids;
  - ☑ on a task without pending items returns `[]`;
  - undo reverts only this spawn;
  - `moveTask` spawns on entry into completed and not on reorder inside completed or on moves
    between working groups;
  - re-completion creates no duplicates;
  - `createFollowUpTasks` spawns only the given ids;
  - `updateTask` with status `completed` spawns nothing.

### Integration tests

None — the plugin has no external services; store–UI interaction is covered by E2E.

### E2E tests

New `tests/e2e/0012-follow-up-tasks.spec.ts` covering user-spec AC-1…AC-12. AC-13 (both languages) is
proven by the strictly typed dictionaries (compile error on a missing key) plus the unit test of the
notice text from both dictionaries — the harness forces the `en` locale and cannot switch it.

- **Form editing:** add, Enter-insert, remove, persistence after reload, Escape discard.
- **Limits:** 200 characters per item, 20 items.
- **Marker:** both view modes, with and without a deadline, tooltip, hidden at N = 0.
- **☑ and Undo:** ☑ with notice and backlog contents, then Undo.
- **Drag:** move into completed, and reorder inside completed.
- **Form status:** status select set to completed spawns nothing.
- **Marking:** mark + Save in both the edit and the create form (different wiring paths), mark + Escape.
- **Backlog variants:** hidden and renamed backlog in the notice; a markup-like backlog title and item
  text render literally in the notice and the marker tooltip.
- **Loading:** v8 snapshot and a damaged list.
- **Read-only editor** for a completed task.

Existing suites must stay green.

## Agent Verification Plan

**Source:** user-spec "Как проверить" section.

### Verification approach

Automated tests carry the feature. Component tasks are gated by `npm run build` plus the relevant
Playwright scenarios (Decision 13). Theme appearance, multi-column fit and the real Obsidian notice
remain with the user.

### Per-task verification

| Task | verify: | What to check |
|------|---------|--------------|
| 1 | bash | `npx tsc --noEmit` — clean |
| 2 | bash | `npx vitest run tests/unit/migration.test.ts` |
| 3 | bash | `npx vitest run tests/unit/followUps.test.ts` |
| 4 | bash | `npx vitest run tests/unit/dataStore.test.ts tests/unit/followUps.test.ts` |
| 5 | bash | `npm run build`; `npx playwright test tests/e2e/core.spec.ts` |
| 6 | bash | `npm run build`; `npx playwright test tests/e2e/core.spec.ts tests/e2e/0008-card-columns.spec.ts` |
| 7 | bash | `npm run build`; `npm test`; `npx playwright test` |
| 8 | bash | `npx playwright test tests/e2e/0012-follow-up-tasks.spec.ts` |
| 9 | bash | `npm run test:all && npm run build` |
| 10 | bash | `grep -n "followUps" docs/technical.md` shows the field documented |

### Tools required

bash only. No live environment to inspect.

## Backward Compatibility

**Breaking changes:** no

**Migration strategy:** one-shot migration on load, version 8 → 9: every task receives `followUps: []`,
so boards look and behave as before. Sanitization runs on every load outside version branches.

**DB migration compatibility:** not applicable — a single JSON document, no rolling deploy.
Down-migration not needed: an older plugin reading v9 data ignores the unknown field (its own form
would drop it on the next save of that task, which is acceptable for a downgrade).

**Consumer impact:**
- `quickCompleteTask` result gains `spawnedTaskIds`; `undoQuickComplete` gains a trailing
  `spawnedTaskIds` parameter (defaulting to `[]` so the only caller keeps compiling until it is
  wired). `moveTask` returns `string[]` instead of `void` — callers that ignore it are unaffected.
- `TaskModal`/`TaskFormContent` `onSave` gains a second argument; existing one-argument callbacks
  stay type-compatible until wired.
- The existing test `v7 → v8: tasks are untouched` and all `toBe(8)` version assertions change by
  design.

## Risks

| Risk | Mitigation |
|------|-----------|
| Reorder inside completed triggers a spawn (it already re-stamps `completedAt`) | Explicit `from !== 'completed'` rule (Decision 4); dedicated unit and E2E cases |
| Undo removes the wrong tasks or leaves items created | `createdTaskId` matching (Decision 2); unit tests on revert; E2E undo scenario |
| Form edits leak into the store without Save (form receives the live task object) | Drafts built from a copy; E2E Escape scenario asserts stored data unchanged |
| `Notice` import breaks the unit suite or the harness build | Notice only in UI modules (Decision 6); mock added to `obsidian-mock.ts` in the task that first imports it |
| Marker squeezes task text in compact / 4-column layout | Fixed short marker, only when N > 0; text keeps ellipsis + tooltip; user checks visually |
| `$&` in a renamed backlog title corrupts the notice | Safe substitution (Decision 7) with a unit test |
| Delete toast of a reverted task restores a dangling id | Undo dismisses such toasts (Decision 10) |

## Acceptance Criteria

- [ ] `npx tsc --noEmit` is clean
- [ ] `npm run build` succeeds
- [ ] `npm test` passes, including new suites for the logic module, migration and store
- [ ] `npx playwright test` passes, including all pre-existing suites and the new 0012 suite
- [ ] Data version is 9; migrated boards look and behave as before
- [ ] A damaged `followUps` value of any shape still yields a working board
- [ ] No `obsidian` import in `src/stores/` or `src/logic/`
- [ ] Every acceptance criterion from the user-spec (AC-1…AC-13) is satisfied

## Implementation Tasks

### Wave 1 (независимые)

#### Task 1: Localization keys
- **Description:** Add every interface string the feature needs in both languages: editor labels and
  buttons, created label, why-prefix for spawned tasks, notice template and hidden suffix.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer
- **Verify:** bash — `npx tsc --noEmit`
- **Files to modify:** `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/ru.ts`
- **Files to read:** `src/i18n/index.ts`

#### Task 2: Data model, migration v9 and sanitization
- **Description:** Add `FollowUp` and `Task.followUps`, migrate existing data to version 9 and sanitize
  the list on every load so hand-damaged data can never stop the plugin from opening.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-security-auditor
- **Verify:** bash — `npx vitest run tests/unit/migration.test.ts`
- **Files to modify:** `src/data/types.ts`, `src/data/defaults.ts`, `src/data/migration.ts`, `src/ui/TaskFormContent.svelte`, `tests/unit/migration.test.ts`
- **Files to read:** `src/data/cleanup.ts`, `src/main.ts`

### Wave 2 (зависит от Wave 1)

#### Task 3: Follow-up logic module
- **Description:** Implement the pure rules of the feature — pending items, building a follow-up task,
  spawning into a board's backlog, reverting a spawn, finalizing form drafts and composing the notice
  text — with full unit coverage.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-security-auditor
- **Verify:** bash — `npx vitest run tests/unit/followUps.test.ts`
- **Files to modify:** `src/logic/followUps.ts`, `tests/unit/followUps.test.ts`
- **Files to read:** `src/logic/statusTransitions.ts`, `src/data/migration.ts`, `src/utils/dateFormat.ts`

### Wave 3 (зависит от Wave 2)

#### Task 4: Store integration
- **Description:** Make ☑ and drag into the completed group spawn pending items and report the spawned
  ids, let Undo revert exactly that spawn, and add the operation the form uses to spawn marked items.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer
- **Verify:** bash — `npx vitest run tests/unit/dataStore.test.ts tests/unit/followUps.test.ts`
- **Files to modify:** `src/stores/dataStore.ts`, `tests/unit/dataStore.test.ts`
- **Files to read:** `src/logic/followUps.ts`, `src/logic/statusTransitions.ts`, `src/ui/useSortable.ts`

#### Task 5: Form editor
- **Description:** Add the "After completion" block to the task form: editable rows with mark and
  remove, add button and Enter-insert, limits, created rows, read-only mode for completed tasks. Save
  hands the task and the marked item ids to the caller; Escape discards everything.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-security-auditor
- **Verify:** bash — `npm run build`; `npx playwright test tests/e2e/core.spec.ts`
- **Files to modify:** `src/ui/FollowUpsEditor.svelte`, `src/ui/TaskFormContent.svelte`, `src/modals/TaskModal.ts`, `src/styles.css`
- **Files to read:** `src/logic/followUps.ts`, `src/ui/BoardLayout.svelte`

### Wave 4 (зависит от Wave 3)

Task 6 needs only Task 3, but sits here rather than in Wave 3 because Task 5 edits `src/styles.css`
in the same wave — two agents editing one file in parallel is avoidable conflict.

#### Task 6: Card marker
- **Description:** Show `↪ N` for pending items on the card in both view modes, next to the deadline or
  in its place, with a tooltip listing the pending texts; nothing when N = 0.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer
- **Verify:** bash — `npm run build`; `npx playwright test tests/e2e/core.spec.ts tests/e2e/0008-card-columns.spec.ts`
- **Files to modify:** `src/ui/TaskCard.svelte`, `src/styles.css`
- **Files to read:** `src/logic/followUps.ts`, `docs/specs/0002-feat-compact-card-view.md`

#### Task 7: UI wiring and notice
- **Description:** Connect the store results to the interface: notice after ☑, drag and form Save; spawned
  ids on the completion toast and their revert on Undo, including dismissal of delete toasts of reverted
  tasks; drag and the test harness go through one move function; `Notice` mocked in the harness, and
  the mock modal closes on Escape like Obsidian's (no existing test depends on Escape today). The toast
  type change lives here, next to the only code that builds toasts, because `tsc` does not check
  `.svelte` files and a required field added earlier would go unnoticed in `BoardLayout`.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer
- **Verify:** bash — `npm run build`; `npm test`; `npx playwright test`
- **Files to modify:** `src/ui/followUpNotice.ts`, `src/ui/BoardLayout.svelte`, `src/ui/useSortable.ts`, `src/stores/uiStore.ts`, `tests/harness/obsidian-mock.ts`, `tests/harness/main.ts`
- **Files to read:** `src/ui/groupTitle.ts`, `src/stores/dataStore.ts`, `src/ui/FollowUpsEditor.svelte`

### Wave 5 (зависит от Wave 4)

#### Task 8: Feature E2E scenarios
- **Description:** Cover user-spec AC-1…AC-13 end to end in a dedicated suite, as listed under Testing
  Strategy / E2E tests.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer
- **Verify:** bash — `npx playwright test tests/e2e/0012-follow-up-tasks.spec.ts`
- **Files to modify:** `tests/e2e/0012-follow-up-tasks.spec.ts`, `tests/e2e/helpers.ts`
- **Files to read:** `tests/e2e/core.spec.ts`, `tests/e2e/0011-group-customization.spec.ts`, `tests/harness/main.ts`

### Final Waves (6 and 7)

#### Task 9: Pre-deploy QA
- **Description:** Acceptance testing: run all tests, verify acceptance criteria from user-spec and tech-spec.
- **Skill:** pre-deploy-qa
- **Reviewers:** none
- **Verify:** bash — `npm run test:all && npm run build`

#### Task 10: Documentation update
- **Description:** Bring product and technical documentation, testing docs and changelogs in line with
  the new task field, schema version 9 and the follow-up behavior.
- **Skill:** documentation-writing
- **Reviewers:** dev-code-reviewer
- **Verify:** bash — `grep -n "followUps" docs/technical.md`
- **Files to modify:** `docs/technical.md`, `docs/overview.md`, `docs/testing/infrastructure.md`, `docs/testing/test-scenarios.md`, `CHANGELOG.md`, `CHANGELOG.ru.md`, `README.md`, `README.ru.md`
- **Files to read:** `docs/features/0012-feat-follow-up-tasks/0012-feat-follow-up-tasks-tech-spec.md`, `src/data/types.ts`
