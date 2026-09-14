# Code Research — 0012 Follow-up Tasks

**Date:** 2026-09-11
**Feature base:** `docs/features/0012-feat-follow-up-tasks/0012-feat-follow-up-tasks`
**Context:** no user-spec yet; only `0012-feat-follow-up-tasks-interview.yml` (cycle 1 partially filled).
Working idea: a task carries a list of follow-up items; the card shows a marker (near the deadline);
the task form shows and edits the list and may turn an item into a real task (e.g. in backlog);
possibly a reminder when the parent task is completed.

All line numbers refer to the state at commit `82a7bd0` (main, clean).

---

## 1. Entry Points

### `src/ui/TaskCard.svelte` (108 lines) — card, both view modes
Props: `task: Task`, `onClick`, `onDelete`, `onComplete`, `isInCompletedGroup = false` (L7–11).
Reactive: `isOverdue` (L29), `isLowPriority` (L30), `isCompact = $dataStore.settings.cardView === 'compact'` (L31).

- **Compact branch** (L34–70): one flex row, in DOM order:
  `.tm-task-card__icons` (priority + status, L45–48) → `.tm-task-card__who-compact` (only if `task.who`, L49–51) →
  `.tm-task-card__what-compact` (L52) → `.tm-task-card__deadline-compact` (only if `task.deadline`, L53–57, text `📅 {formatDeadlineShort()}`) →
  `☑ .tm-task-card__complete-compact` (L58–64) → `✕ .tm-task-card__delete-compact` (L65–69).
- **Default branch** (L71–107): `.tm-task-card__top` row = priority (L83) + status (L84) + `.tm-task-card__deadline` (only if deadline, L85–89, text `📅 {task.deadline}`);
  then `.tm-task-card__what` (L91), `.tm-task-card__who` (L92–94); absolutely positioned `☑ .tm-task-card__complete` (L95–101) and `✕ .tm-task-card__delete` (L102–106).
- Root element in both modes carries `data-task-id={task.id}` (L39, L76), `role="button"`, `tabindex="0"`, `on:keydown` Enter → `onClick` (L41, L78).
- Buttons use `on:click|stopPropagation` (L61, L68, L98, L104) — the only existing pattern for an interactive element inside the card.

### `src/ui/TaskFormContent.svelte` (133 lines) — the task form (create + edit)
Props (L6–10): `task: Task | null = null`, `groupId: GroupId`, `defaultPriority`, `onSave: (task: Task) => void`, `onDelete: (() => void) | null`.
- `const isEdit = !!task` (L12). Local copies initialized once from `task` (L14–19): `what, why, who, deadline, priority, status`. Default status: `'new'` for backlog, else `'inProgress'` (L19).
- `canSave = what.trim().length > 0` (L21).
- `handleSave()` (L23–37) builds a **complete `Task` literal** (id, what, why, who, deadline, createdAt, completedAt, priority, status) and calls `onSave(saved)`. `completedAt: task?.completedAt ?? ''` (L32) — the form never sets or clears `completedAt`.
- Layout: `What` textarea (L41–51, `#tm-what`, maxlength 10000), `Why` textarea (L53–63, `#tm-why`), row Who/When (L65–86, `#tm-who` maxlength 200, `#tm-deadline` type=date), row Priority/Status selects (L88–107, `#tm-priority`, `#tm-status`), meta created/completed (L109–116, edit only), actions: Delete (edit only) + spacer + Save (L118–132).
- No `on:keydown` / Enter-to-submit handling; no dirty tracking.

### `src/modals/TaskModal.ts` (64 lines) — Obsidian `Modal` wrapper
`constructor(app, groupId, defaultPriority = 'medium', onSave, task = null, onDelete = null)` (L15–22).
`onOpen()` (L31–56): title = `modal.editTask` / `modal.newTask` (L36); mounts `TaskFormContent` with props; wraps `onSave` → callback then `this.close()` (L44–47); same for `onDelete` (L48–53).
`onClose()` (L58–63) destroys the component. Closing via Escape/overlay discards form state (standard Obsidian Modal behaviour).

### `src/ui/BoardLayout.svelte` (333 lines) — orchestrator of modals, toasts, completion
- `openCreateModal(groupId)` (L73–83): `new TaskModal(plugin.app, groupId, settings.defaultPriority, (task) => addTask(task, groupId)).open()`.
- `openEditModal(task, groupId)` (L85–97): `new TaskModal(..., (updated) => updateTask(updated), task, () => handleDelete(task.id, groupId)).open()`. The `task` passed is the **live store object** (from `groupTasks` map in TaskGroup/CollapsibleGroup).
- `handleDelete` (L113–143), `handleComplete` (L145–178), `handleUndo` (L180–197), `handleToastExpire` (L199–204), `evictOldestToastIfNeeded` (L99–111), `MAX_TOASTS = 3` (L71).
- Six literal group blocks (L208–298), each wires `onCardComplete={(taskId) => handleComplete(taskId, '<group>')}`.
- Toast rendering (L311–324): `{#each $uiStore.toasts as toast (toast.taskId)}` → `DeleteToast` with `message` built from `toast.type`.

### `src/ui/TaskGroup.svelte` (50 lines) / `src/ui/CollapsibleGroup.svelte` (89 lines)
Pass-through of callbacks to `TaskCard` (TaskGroup L39–47, CollapsibleGroup L77–85); `isInCompletedGroup={groupId === 'completed'}`.
Both compute `columns = isMulti ? (group.fullWidth ? 4 : 2) : 1` (TaskGroup L23, CollapsibleGroup L30) and apply `use:useSortable={{ groupId }}` on the body with `data-group-id` (TaskGroup L32–33, CollapsibleGroup L70–71).
CollapsibleGroup body is not in the DOM while collapsed (L66). Backlog and Completed are collapsed by default (`defaults.ts:29–30`).

---

## 2. Data Layer

### `src/data/types.ts` (56 lines)
- `Task` (L11–21): `id, what, why, who, deadline, createdAt, completedAt: string; priority: Priority; status: Status`. All fields required, no optional fields anywhere in the model.
- `Status = 'new' | 'inProgress' | 'waiting' | 'meeting' | 'completed'` (L4); `GroupId` (L5); `GROUP_IDS` (L9).
- `Group` (L23–30), `Board` (L32–42), `Settings` (L44–49), `PluginData { version; settings; boards; tasks: Record<string, Task> }` (L51–56).
- No link/relation field between tasks exists today; tasks are only referenced from `Group.taskIds`.

### `src/data/defaults.ts` (58 lines)
- `DEFAULT_DATA.version: 8` (L54) — the single source of the current schema version in `src/`.
- `createDefaultGroup` (L13–22), `createDefaultBoard` (L24–44), `DEFAULT_SETTINGS` (L46–51).
- **There is no `createDefaultTask()`** — `CLAUDE.md:227` ("Update `createDefaultTask()` in defaults.ts") is stale. The only place a `Task` object is constructed in `src/` is `TaskFormContent.svelte:25–35`.

### `src/data/migration.ts` (162 lines) — current version 8
- `migrateData(data: unknown): PluginData` (L58). Early returns `freshDefaultData()` for non-object (L59–61) and `version < 1` (L66–68).
- Unconditional `settings.cardView` backfill (L85–87).
- Version branches: `<2` settings/language (L72–82), `<3` notes/notesCollapsed (L89–99), `<4` hiddenGroups (L101–108), `<5` fullWidth per group (L110–119), `<6` cardLayout (L121–126), `<7` notesHidden (L128–135), `<8` group title + groupOrder (L137–149).
- Pattern for adding a field: `if (version < N) { for (...) if ((x as any).field === undefined) (x as any).field = default; result.version = N; }`. No branch has ever iterated `result.tasks` — every prior change touched `settings`, `boards` or `groups`; a task-level migration would be the first.
- **Per-load sanitize block** (L151–159) runs after all branches, independent of version: `board.groupOrder = sanitizeGroupOrder(...)`, `group.title = sanitizeGroupTitle(...)`. Sanitizers take `unknown`, never throw (comment L9–10): `sanitizeGroupOrder(value: unknown): GroupId[]` (L16–35), `sanitizeGroupTitle(value: unknown): string` (L38–46, trim → slice(0, 40) → drop lone high surrogate).
- `sanitizeGroupTitle` is also reused by `dataStore.updateBoard` (dataStore.ts:5, L223) — "same sanitizer at store boundary and on load" pattern.

### `src/data/cleanup.ts` (32 lines)
- `cleanupCompletedTasks(board, tasks)` (L3–18): for each id in `board.groups.completed.taskIds`: missing task → dropped from ids; `completedAt === ''` → kept forever (L11); `completedAt < today - retentionDays` (default 30) → `delete tasks[taskId]` and dropped (L12–15). Deletion is silent; no inspection of task content.
- `cleanupOrphanedTasks(data)` (L20–32): collects every id from every group of every board; deletes any `data.tasks` entry not referenced (L27–31).
- Called on load (`main.ts:54–57`) and hourly (`main.ts:39–47`, `registerInterval`, then `dataStore.set(current)` + `savePluginData()`).

**Consequences for follow-ups (fact, not recommendation):**
- A completed parent whose follow-ups are embedded in the `Task` object is deleted together with its follow-ups after retention expires (default 30 days), with no signal.
- Any follow-up stored as a separate record in `data.tasks` but not placed into some `Group.taskIds` is deleted by `cleanupOrphanedTasks` on the next load / hourly tick.
- A parent in a working group with `status = 'completed'` set via the form has `completedAt = ''` and is never auto-cleaned (it is not in the completed group, and even there `''` means "keep").
- `deleteBoard` (dataStore.ts:231–249) deletes only tasks referenced by the board's groups.

### `src/stores/dataStore.ts` (282 lines) — mutation API (all call `persist()`)
| Function | Line | Signature / behaviour |
|---|---|---|
| `persist()` (private) | L14–19 | `plugin.saveData(get(dataStore))` if `pluginStore` holds a plugin |
| `addTask` | L21–31 | `(task: Task, groupId: GroupId): void` — writes `data.tasks[id]`, **pushes to end** of `groupId.taskIds` of the **active board** (`getActiveBoard`, L279–282) |
| `updateTask` | L33–39 | `(task: Task): void` — replaces `data.tasks[id]`; does **not** move groups, does not touch `completedAt` |
| `removeTaskFromGroup` | L41–55 | `(taskId, groupId, boardId) → { position } \| null` |
| `restoreTaskToGroup` | L57–66 | `(taskId, groupId, boardId, position)` |
| `finalDeleteTask` | L68–74 | `(taskId)` — deletes from `tasks` |
| `quickCompleteTask` | L76–111 | `(taskId, sourceGroupId, boardId) → { position, previousStatus, previousCompletedAt } \| null`; moves id to **start** of completed (`unshift`, L101), sets status + `completedAt = formatDate(new Date())` |
| `undoQuickComplete` | L113–141 | restores position/status/completedAt |
| `moveTask` | L143–164 | `(taskId, fromGroupId, toGroupId, newIndex)` — splice + `applyStatusTransition` (L156–159); active board |
| `updateBoard` etc. | L166–277 | board/group/settings ops |

Store mutations are in place (`dataStore.update(data => { mutate; return data; })`); `data` object identity stays the same as `plugin.data` set in `main.ts:21`.

---

## 3. Similar Features (prior art)

| Feature | Spec | Relevant for 0012 |
|---|---|---|
| 0003 Quick Complete | `docs/specs/0003-feat-quick-complete.md` | Only prior feature that added a card affordance in both modes + a toast type. Introduced `Toast` discriminated union (spec L137–190), `evictOldestToastIfNeeded` (L378–397), `☑` positioning `right: 1.75rem` next to `✕` (L35, L640–666). Known limitations list (L806–814): completed group does not auto-expand; hover-only buttons unusable on touch. |
| 0005 Quick Notes | `docs/specs/0005-feat-quick-notes.md` | Free-text per-board list-ish content. Explicitly deferred "convert note into task" to post-MVP (L76–79). Patterns: 5000-char `maxlength` to protect data.json (L99–101); local variable decoupled from prop to survive re-render (L91–93, `NotesSection.svelte:13–14`); `boardId` captured in debounce closure (L89). |
| 0002 Compact Card View | `docs/specs/0002-feat-compact-card-view.md` | Fixed-width sections table for the compact row (L207–246); edge cases "no who / no deadline" (L91–141). |
| 0008 Card Columns | `docs/specs/0008-feat-card-columns.md`, `docs/technical.md:835–907` | 4/2 columns in multi mode; `what` clamped to one line in multi (styles.css:944–951). |
| 0011 Group Customization | archived | Per-load sanitizer pattern (ADR), three test attributes (ADR), popup row editing with arrows (list editing UI prior art in `BoardSettingsPopup.svelte`). |

No existing feature stores a list inside a `Task`, or links one task to another. `docs/overview.md:336` mentions sub-tasks only as a competitor capability (CardBoard). `docs/overview.md:380–387` (post-MVP list) does not mention follow-ups.

---

## 4. Integration Points

### 4.1 All completion paths

| Path | Trigger | Code path | Effect | Where BoardLayout learns about it |
|---|---|---|---|---|
| Quick complete ☑ | `TaskCard.svelte:58–64` / `95–101` | `onComplete` → `TaskGroup`/`CollapsibleGroup` → `BoardLayout.handleComplete(taskId, sourceGroupId)` (L145) → `quickCompleteTask` (dataStore.ts:76) | moved to top of completed, status/completedAt set, `complete` toast with Undo (7 s) | Directly — `handleComplete` is in BoardLayout |
| Drag to completed | SortableJS `onEnd` in `useSortable.ts:25–44` | `moveTask(taskId, from, to, newIndex)` imported **directly from the store** (useSortable.ts:2, L43) → `applyStatusTransition` (statusTransitions.ts:5–7) | status/completedAt set; no toast, no undo | **Not at all** — no callback from `useSortable` to BoardLayout; the action's options are only `{ groupId, disabled? }` (useSortable.ts:5–8) |
| Form status select = completed | `TaskFormContent.svelte:97–106` | `handleSave` → `TaskModal` → `BoardLayout.openEditModal` callback → `updateTask` (dataStore.ts:33) | only `status` changes; card **stays in its group**, `completedAt` stays `''`; icon becomes ✅; overdue highlight disappears (`TaskCard.svelte:29`) | Via the `onSave` closure in `openEditModal` (L93); previous status is available from the `task` argument captured in that closure |
| Test harness | `window.__test.moveTask` (`tests/harness/main.ts:118–120`) | `storeMoveTask` | same as drag | — |

Additional facts:
- `applyStatusTransition(task, from, to)` (statusTransitions.ts:4–16) runs for **completed → completed reorder** too: `useSortable` only skips when `from === to && oldIndex === newIndex` (useSortable.ts:32), and the `toGroup === 'completed'` branch (L5–7) re-stamps `completedAt` to today on every in-group reorder. A hook placed on "moved into completed" must exclude `fromGroup === 'completed'` explicitly.
- Undo of quick complete (`undoQuickComplete`) restores the previous state within 7 s; a reminder fired at completion time can be followed by an undo.
- Form path: "completion" is a status change only; no group move and no `completedAt`. Create mode also allows status `completed` for a brand-new task (`TaskFormContent.svelte:104`).

### 4.2 Toast / notification mechanisms
- `src/stores/uiStore.ts` (36 lines): `Toast = DeleteToast | CompleteToast` (L4–26), discriminant `type`; both carry `taskId, groupId, boardId, position, timerId, expiresAt`. `UiState { activeBoardId; toasts }` (L28–31). Not persisted.
- `src/ui/DeleteToast.svelte` (32 lines): generic despite its name — props `message, expiresAt, onUndo, onExpire`; **always renders a countdown and an Undo button** (L28–32); no other actions possible without changing the component.
- Toast list is keyed by `toast.taskId` (`BoardLayout.svelte:313`); `handleUndo` (L182, L195) and `handleToastExpire` (L200–203) and the timer callbacks (L122–125, L155–158) filter by `taskId`. Two simultaneous toasts for the same `taskId` would produce a duplicate key in the keyed `{#each}` and would be removed together.
- `evictOldestToastIfNeeded` (L99–111) special-cases `type === 'delete'` (final delete); any new toast type must be considered there.
- Styles: `.tm-toast*` (styles.css:593–631), container `.tm-toasts` fixed bottom-center (L634–643); text is single-line ellipsis, `max-width: 420px` (L602, L604–612).
- **Obsidian `Notice` is not used anywhere** in `src/` (grep: no matches). The test mock `tests/harness/obsidian-mock.ts` exports `App, WorkspaceLeaf, Plugin, Modal, ItemView, PluginSettingTab, Setting` only — importing `Notice` from `'obsidian'` in `src/` would break the harness build until a mock `Notice` is added.

### 4.3 Creating another task from the form
- Current form has no access to the store: it only calls `onSave` / `onDelete` passed via `TaskModal` props. `TaskModal` constructor has 6 positional params (TaskModal.ts:15–22); adding a callback means extending both `TaskModal` and the two call sites in `BoardLayout` (L77–82, L89–96).
- `addTask(task, groupId)` targets the active board and appends to the end of the group. Backlog is collapsed by default and can be hidden via `board.hiddenGroups` (0006) — a task created there is not visible on the board until expanded/unhidden. Status default for backlog is `'new'` (TaskFormContent.svelte:19 convention).
- In edit mode the modal knows only the parent's `groupId`, not the board id (active board is implicit via `uiStore`).
- A task created from inside the open form is persisted immediately via `addTask`, whereas parent edits are persisted only on Save; closing with Escape keeps the created task but discards unsaved parent changes.

### 4.4 Where the live task object flows
`BoardLayout.openEditModal(task, …)` passes the store object itself into `TaskFormContent`; scalar fields are copied into locals (L14–19). An array field on `Task` must be copied (e.g. `[...(task?.x ?? [])]`) before editing, otherwise in-form edits mutate `data.tasks[id]` in place without `persist()` and survive Cancel/Escape until the next write.

### 4.5 Sortable filter
`useSortable.ts:22` filters only `.tm-task-card__delete` (with `preventOnFilter: false`); the ☑ button is not filtered. Any new clickable element on the card behaves like ☑ regarding drag start.

---

## 5. Existing Tests

### Tooling
- Unit: vitest 4 (`vitest.config.ts`: node env, `tests/unit/**/*.test.ts`), `npm run test:unit`.
- E2E: Playwright (`playwright.config.ts`: `workers: 1`, web server `node esbuild.harness.mjs --serve` on :5173). Harness bundles `tests/harness/main.ts` with `obsidian` aliased to `obsidian-mock.ts` (`esbuild.harness.mjs:20–28`). `npm run test:e2e`, `npm run test:all`.
- Node `^22.12.0 || >=24.0.0` (`package.json` engines).
- `tests/` is **not type-checked** (`tsconfig.json` includes only `src/**`; TD-02). Fixtures missing a new required `Task` field will not fail compilation.

### Unit tests relevant to this feature
| File | Relevance |
|---|---|
| `tests/unit/migration.test.ts` (400+ lines) | 12 assertions `expect(result.version).toBe(8)` (L27, 37, 45, 70, 87, 108, 126, 141, 149, 179, 265) + test titles "→ v8". `'v7 → v8: tasks are untouched'` (L160–172) asserts byte-identical `tasks` after migration — **will fail by design** if a v9 branch adds a field to every task. `'v8 → v8: idempotent'` (L174–183). Local `makeBoard` stub (L12–22). |
| `tests/unit/cleanup.test.ts` | `makeTask(id, completedAt)` factory (L42–54) lists all Task fields; `makeBoard` (L24–40). `describe('cleanupCompletedTasks')` L56, `describe('cleanupOrphanedTasks')` L113. |
| `tests/unit/statusTransitions.test.ts` | 8 cases incl. `'any→completed: status=completed, completedAt set'` (L39). No case for completed→completed. |
| `tests/unit/dataStore.test.ts` | Only `updateBoard` covered; pattern: `seedBoards()` sets `dataStore` directly (L20–24), `pluginStore` fake with `saveData` for persistence check. `addTask`, `updateTask`, `quickCompleteTask`, `moveTask` have **no unit tests** (note: `addTask`/`moveTask` depend on `uiStore.activeBoardId`). |

Representative signatures:
```ts
it('v7 → v8: tasks are untouched', () => { ... expect(JSON.stringify(result.tasks)).toBe(before); });   // migration.test.ts:160
it('срок истёк: retention=30, completedAt=31 день назад → задача удалена', () => { ... });            // cleanup.test.ts:57
```

### E2E tests
- `tests/e2e/helpers.ts`: `standardBeforeEach(page, partial?)` (L7), `resetData` (L16), `createTask(page, groupId, data, {expand?}) → taskId` (L37–60, returns id of the **last** card in the group), `fillTaskForm` (L63–69, uses `#tm-what`, `#tm-why`, `#tm-who`, `#tm-deadline`, `#tm-priority`), `moveTask` via `window.__test.moveTask` (L74–85), `expandGroup` (L94–101), `waitForToast` (L116–119).
- `tests/e2e/core.spec.ts`: sections 3 (create), 4 (edit — `'4.3 change status manually → icon updates, card stays in group'` L93–110, confirms form-status path does not move the card), 5 (delete + toast, incl. fake-clock test 5.4), 6 (DnD status transitions 6.2–6.5), 11 (overdue), 15 (card display), 20 (XSS).
- Quick complete ☑ is covered only incidentally: `0008-card-columns.spec.ts:310–321` (`EC-4`: click `.tm-task-card__complete`, toast, undo). No dedicated quick-complete spec file.
- Compact mode is switched in tests via `window.__test.updateSettings({ cardView: 'compact' })` (0008 spec L180).
- Versioned snapshots passed to `resetData` run the full migration (`tests/harness/main.ts:93–95`); existing fixtures use `version: 7`/older (e.g. `0006…spec.ts:279`, `0007…spec.ts:240`, `0008…spec.ts:254`).
- Harness `window.__test` API (`tests/harness/main.ts:78–125`): `resetData`, `getDataStore`, `moveTask`, `updateSettings`. There is no `addTask` / `quickComplete` hook; toast timers are cleared on reset (L81–84).

### Test selector conventions
- Data attributes: `data-task-id` (card), `data-group-id` (group body, absent when collapsed), `data-group-container` (group wrapper on board), `data-settings-group` (row in board settings popup). ADR "three separate test attributes" + `docs/technical.md:692–708`. No `data-testid` / `data-test` attributes anywhere.
- Form fields are addressed by `id="tm-…"`; everything else by BEM class (`.tm-task-form__btn--primary`, `.tm-toast__undo`, `.tm-task-card__complete`).
- Spec files named `tests/e2e/NNNN-<feature>.spec.ts`.

---

## 6. Shared Utilities

| Utility | Location | What it does |
|---|---|---|
| `formatDate(date): string` | `src/utils/dateFormat.ts:1–6` | `YYYY-MM-DD` local date |
| `formatDeadlineShort(dateStr): string` | `src/utils/dateFormat.ts:8–43` | compact deadline (`24`, `03-24`, `24 '27`) |
| `applyStatusTransition(task, from, to)` | `src/logic/statusTransitions.ts:4–16` | mutating status rules for group moves |
| `sanitizeGroupOrder / sanitizeGroupTitle` | `src/data/migration.ts:16–46` | reference implementation of "accept unknown, never throw" sanitizers |
| `t` (derived store), `groupLabels`, `setLocale` | `src/i18n/index.ts:11–14, 16–27, 35–37` | `$t('key')`; missing key falls back to the key string (L13) |
| `resolveGroupTitle(stored, fallback)` | `src/ui/groupTitle.ts` | display name of a group (useful if a reminder/label names the target group, e.g. backlog) |
| `DeleteToast.svelte` | `src/ui/DeleteToast.svelte` | countdown + Undo toast, `message` prop |
| `useSortable` | `src/ui/useSortable.ts` | Svelte action, cancel-and-update DnD |

### i18n
- Three files per key: `src/i18n/types.ts` (`TranslationKey` strict union, L4–44), `src/i18n/en.ts`, `src/i18n/ru.ts` (both typed `Translations = Record<TranslationKey, string>`, so a missing key in either file is a compile error in `src/`).
- Existing namespaces relevant here: `taskCard.*` (en.ts:43–45), `form.*` (en.ts:78–90), `toast.*` (en.ts:100–103), `status.*` (L34–38), `group.*` (L4–9). RU: `toast.completed: 'Завершена:'`, `form.completedAt: 'Завершена:'`.

---

## 7. Potential Problems

1. **Orphan cleanup vs. separate follow-up records** (`cleanup.ts:20–32`). Any task-like record not referenced by some `Group.taskIds` is deleted on load and hourly. Follow-ups stored as `Task` entries outside groups do not survive.
2. **Retention silently deletes a completed parent with pending follow-ups** (`cleanup.ts:12–15`, default 30 days, `technical.md:530` "deleted silently"). Embedded follow-ups disappear with it.
3. **Form-status completion is a different kind of "completed"**: card stays in its working group, `completedAt = ''` (`TaskFormContent.svelte:32`, `dataStore.ts:33–39`). Such a task is never auto-cleaned; any "completed" detection must decide whether it covers this path.
4. **Drag path has no UI hook**: `useSortable` calls the store directly (`useSortable.ts:43`); `BoardLayout` is not notified. Reminder on drag needs either a new channel (option callback on the action, or uiStore-driven signal) — every other toast today is created in BoardLayout.
5. **completed → completed reorder re-stamps `completedAt`** (`statusTransitions.ts:5–7` + `useSortable.ts:32`). A "moved into completed" hook would fire on every reorder inside the completed group unless `from !== 'completed'` is checked.
6. **Toast keyed by `taskId`** (`BoardLayout.svelte:313`, filters at L124, L157, L195, L202). A reminder toast for the same parent while its `complete` toast is alive collides (duplicate key / removed together). `DeleteToast` always shows Undo + countdown.
7. **`Notice` not mocked** in `tests/harness/obsidian-mock.ts`; using Obsidian `Notice` requires a mock addition or the harness build fails.
8. **Mutable store object in the form** (`BoardLayout.svelte:85–96` passes the live `task`). Array fields must be copied in `TaskFormContent` locals; otherwise edits leak into the store without `persist()` and bypass Cancel/Escape.
9. **Two persistence moments inside one modal** (§4.3): a task created from the form is persisted immediately, the parent's list change only on Save. Escape after "convert" can leave the item both converted and still listed.
10. **Created task visibility**: `addTask` targets the active board; backlog is collapsed by default (`defaults.ts:29`) and may be hidden (`board.hiddenGroups`). Precedent: quick complete does not auto-expand completed (0003 spec L808).
11. **Card real estate**:
    - Default mode top row reserves `padding-right: 3.25rem` for ☑/✕ (`styles.css:309`); deadline uses `margin-left: auto` (L322) and is rendered only when a deadline exists (`TaskCard.svelte:85`). A marker "next to the deadline" needs a defined position when there is no deadline.
    - Compact row has fixed widths: icons 2.5rem (L430), who 7rem (L435), deadline 4.5rem (L455), buttons 1.25rem each (L463, L483); `what` is `flex: 1; min-width: 0` (L443–451) and is the only shrinkable part — any extra fixed element takes width from `what`.
    - Multi layout (0008): full-width groups get 4 columns, half-width 2 (`TaskGroup.svelte:23`); `what` is forced to one line (`styles.css:944–951`); `<600px` → 1 column (L934–939). In a 4-column compact card the fixed parts alone already consume most of the width.
    - Status/priority icons are emoji (`TaskCard.svelte:13–25`); a marker is expected to follow the same visual language (the product rule "buttons always visible, not hover-only" — `overview.md:376` — applies if the marker is clickable).
12. **Keyboard on nested interactive elements**: the card root handles `keydown Enter → onClick` (`TaskCard.svelte:41, 78`); buttons stop only `click` propagation. A focusable marker inside the card inherits this.
13. **Field length / data.json growth**: every text input has `maxlength` (`TaskFormContent.svelte:47, 59, 73`; security section `technical.md:914`); 0005 capped notes at 5000 chars. A list field has no count limit unless one is defined.
14. **Load-path robustness (TD-01, Medium)**: `migrateData` is unguarded; per ADR "sanitization on every load", new hand-editable fields are expected to be sanitized in the unconditional block (`migration.ts:151–159`) with `unknown`-accepting, non-throwing sanitizers. A task-level sanitizer would iterate `result.tasks`, which itself is not validated today (can be `null` in a damaged file).
15. **TD-02 (Low)**: tests are not type-checked — test factories (`cleanup.test.ts:42–54`, e2e fixtures) will not be flagged when `Task` gains a required field.
16. **TD-03 (Low)**: `freshDefaultData()` shallow copy (`migration.ts:51–56`) shares `tasks` with `DEFAULT_DATA` — relevant if harness tests reset data twice in one test and add tasks.
17. **TD-06 (Low)**: `docs/technical.md` migration listing is simplified; `CLAUDE.md:227` references non-existent `createDefaultTask()`.
18. **ADR "input field is not a display place"** (0011) — generic rule for future edit forms: raw stored value in the input, defaults only as placeholders.

---

## 8. Constraints & Infrastructure

- **Stack:** TypeScript strict (`tsconfig.json`, target ES2021 — no `Object.hasOwn`, see comment `BoardLayout.svelte:34–35`), Svelte 4.2, esbuild 0.21 + esbuild-svelte 0.8 (`css: 'none'`), SortableJS 1.15, Obsidian API ≥1.0 (`obsidian` 1.6.6 types).
- **CSS:** all classes `tm-` + BEM, only in `src/styles.css`, no `<style>` in `.svelte`; Obsidian CSS vars only; not every palette var exists in every theme (0003 chose `--interactive-success` over `--color-green`, spec L703; the test harness defines vars in `tests/harness/obsidian-vars.css`).
- **No `{@html}`**; interpolation only.
- **`npx tsc --noEmit` does not read `.svelte` files** (comment `BoardLayout.svelte:35`); type errors inside Svelte components surface only at build.
- **Schema version** hard-coded at `src/data/defaults.ts:54` (and in the built artifact `tests/harness/harness.js`, regenerated by `npm run test:harness`).
- **Persistence:** single `data.json` via `saveData`; every store op calls `persist()`; load path = migrate → cleanup completed → cleanup orphans → save (`main.ts:50–60`).
- **CI:** none (TD-04). Pre-commit: gitleaks only (`.pre-commit-config.yaml`).
- **Release docs:** `CHANGELOG.md` / `CHANGELOG.ru.md` `[Unreleased]` section lists features with schema version notes (e.g. "Data schema migrated to version 8").

### Docs that a Task-field feature touches (per `CLAUDE.md` "Adding a new task field" + current layout)
- `docs/technical.md`: `Task` interface (L122–133), data.json example (section L17), component tree (L205–218), modal section (L220–235), saving table (L353–359), migration section (L363–460) + sanitize section (L462–477), auto-cleanup (L506–530), toast section (L284–299), security/maxlength (L911–914).
- `docs/overview.md`: §3 SMART card fields table (L40–50), post-MVP list (L380+).
- `docs/testing/infrastructure.md`: unit table (L163–171), e2e table (L177–183), `window.__test` table (L105–110) if the harness API grows.
- `docs/testing/test-scenarios.md` (manual scenarios, sections 3–6).
- `docs/features-catalog.md`, `docs/decisions-log.md`, `docs/tech-debt.md` — updated at `/done`.
- `CHANGELOG.md`, `CHANGELOG.ru.md`; `README.md` / `README.ru.md` "Task Card" section (L35).

---

## 9. External Libraries

- **SortableJS 1.15** (`useSortable.ts`): relevant options already used — `group`, `draggable: '[data-task-id]'`, `filter`, `preventOnFilter: false`, `onEnd(evt)` with `evt.from/to.dataset.groupId`, `oldIndex/newIndex`, `evt.item.dataset.taskId`. No other events (`onAdd`, `onRemove`) are used.
- **Obsidian API** (from `obsidian` typings): `Modal` (`titleEl`, `contentEl`, `open/close`, `onOpen/onClose`) is used; `Notice(message, durationMs?)` exists in the API but is unused in this project and absent from the test mock.
- **Svelte 4**: keyed `{#each ... (key)}` requires unique keys — relevant to the toast list keyed by `taskId`.
