---
status: planned
depends_on: ["01"]
wave: 1
skills: [code-writing]
verify: bash
reviewers: [dev-code-reviewer, dev-security-auditor, dev-test-reviewer]
teammate_name:
---

# Task 03: Data model, migration and sanitization

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:code-writing` — [skills/code-writing/SKILL.md](~/.claude/skills/code-writing/SKILL.md)

## Description

The feature adds two per-board settings: a user-defined name for each group and an explicit
render order of groups on a board. This task lays the data foundation for everything that
follows — it adds both fields to the model, gives them defaults that reproduce today's
appearance exactly, migrates existing `data.json` from version 7 to version 8, and adds
sanitization that runs on **every** load so damaged data can never blank the board.

Two fields are added (tech-spec, Data Models):

- `Group.title: string` — the user-defined name. An empty string means "use the default
  localized name". Emptiness is therefore both the initial state and the reset mechanism —
  do not introduce a `null`/`undefined` variant.
- `Board.groupOrder: GroupId[]` — the render order of the six groups on that board. It must
  always be a permutation of `GROUP_IDS`: exactly the six known ids, each exactly once.

Sanitization is the load-bearing part of this task, not a nicety. `migrateData` is called from
`src/main.ts:52` inside `loadPluginData()`, before the view is ever created — an exception
thrown there means the plugin fails to load and the user sees no board at all. A `groupOrder`
containing an unknown id would make `board.groups[id]` come back `undefined` at render time; a
duplicate id would make two group wrappers claim the same CSS `order` slot. Both must be
impossible by the time `migrateData` returns.

Both sanitizers therefore accept `unknown`, never assume a shape, and never throw
(tech-spec Decisions 6 and 7). They run in a block placed **outside all version branches**, so
they also repair data that was damaged *after* the migration already ran — that is precisely
what makes the Backward Compatibility promise in the tech-spec true. Sanitizing only inside the
`version < 8` branch would silently break that promise, and the tests below are written to catch
exactly that mistake.

Per Decision 10, this task does **not** introduce a `CURRENT_VERSION` constant. The hardcoded
`7` is bumped to `8` in place, in the three source locations and in the test expectations that
assert it.

## What to do

1. Extend the model in `src/data/types.ts`: `Group` gains `title: string`, `Board` gains
   `groupOrder: GroupId[]`. Document the semantics of both in a short comment, matching the
   existing comment style on `Group.fullWidth`.
2. Extend the defaults in `src/data/defaults.ts` so a freshly created board looks exactly like
   today: `createDefaultGroup` returns `title: ''`, `createDefaultBoard` returns
   `groupOrder` equal to the current fixed order (`GROUP_IDS`) — as a **fresh array per board**,
   not a shared reference to the exported constant.
3. Bump `DEFAULT_DATA.version` from `7` to `8` in `src/data/defaults.ts`.
4. Add two exported pure sanitizers to `src/data/migration.ts`:
   - one that takes `unknown` and always returns a valid `GroupId[]` permutation;
   - one that takes `unknown` and always returns a normalized title string.
   Export both — the settings popup save path (Task 8) reuses the title one, and the unit tests
   import both directly.
5. Add the `version < 8` migration block: every group of every board gets `title: ''` if it has
   no title yet, every board gets the default order if it has no order yet, and
   `result.version = 8`. Follow the existing block style in this file (`(board as any).field ===
   undefined` check plus assignment).
6. Add a sanitization block **after** all version branches and before `return result`: for every
   board, replace `groupOrder` with the sanitized value and every group's `title` with the
   normalized value — unconditionally, regardless of the incoming version.
7. Update `tests/unit/migration.test.ts`: retarget the nine existing `toBe(7)` expectations and
   the three test names to 8, and add the new suites listed under TDD Anchor. Existing coverage
   of v1…v6 must keep passing — those inputs now land on 8 with both new fields present.
8. Confirm — by reading, not by assumption — that `cleanupOrphanedTasks` in
   `src/data/cleanup.ts` still collects live task ids through `Object.values(board.groups)` and
   not through `groupOrder`. It must stay that way: if it ever iterated `groupOrder`, a sanitized
   order would decide which tasks survive, and a group missing from the order would have all its
   tasks deleted from `data.json`. This is a read-and-verify step — `cleanup.ts` is not modified
   by this task.

## TDD Anchor

Write these first in `tests/unit/migration.test.ts`, watch them fail, then implement.
The existing `makeBoard` / `fullWidthGroups` helpers build boards without the new fields — reuse
them rather than writing new stubs.

**Version bump and migration**

- `tests/unit/migration.test.ts::v7 → v8: every group gets an empty title` — a v7 board's six
  groups all end up with `title === ''`.
- `tests/unit/migration.test.ts::v7 → v8: every board gets the default group order` — resulting
  `groupOrder` deep-equals `GROUP_IDS`.
- `tests/unit/migration.test.ts::v7 → v8: tasks are untouched` — the `tasks` dictionary is
  deep-equal before and after.
- `tests/unit/migration.test.ts::v1 → v8: all fields are migrated in one pass` — existing test,
  retargeted; additionally asserts both new fields.
- `tests/unit/migration.test.ts::v8 → v8: data unchanged (idempotent)` — existing test,
  retargeted; `JSON.stringify` equality still holds, which also proves the sanitizers leave
  valid data byte-identical.
- Each existing `vN → v7` case (N = 2…6) becomes `vN → v8` and asserts `title` and `groupOrder`
  are present on the result.

**Order sanitization** (called through `migrateData`, and directly on the exported function)

- `::groupOrder missing → default order` — a v8 board with no `groupOrder` key.
- `::groupOrder null → default order` — no throw.
- `::groupOrder not an array → default order` — cover a string and an object.
- `::groupOrder with an unknown id → unknown id dropped` — e.g. `'archive'` disappears and the
  result is still a full permutation.
- `::groupOrder with a duplicate id → duplicate collapsed` — the id keeps its first position and
  appears once.
- `::groupOrder missing ids → missing ids appended in default order` — assert the **exact**
  resulting array, not just its length.
- `::groupOrder already valid and non-default → preserved as is` — a custom permutation survives
  untouched.
- `::groupOrder is sanitized on already-migrated v8 data` — input with `version: 8` and a damaged
  order comes back repaired. This is the test that fails if sanitization is placed inside the
  version branch.
- `::two boards get independent groupOrder arrays` — mutating one board's array does not affect
  the other (guards against sharing the `GROUP_IDS` reference).

**Title sanitization**

- `::title whitespace-only → empty string`.
- `::title is trimmed` — leading/trailing spaces removed, inner text preserved.
- `::title longer than 40 characters → capped at 40`.
- `::title of exactly 40 characters → unchanged` (boundary).
- `::title not a string → empty string` — cover missing, `null`, and a number; none of them throw.
- `::valid title survives migration` — an existing non-empty title is not reset to default.

## Acceptance Criteria

- [ ] `Group.title: string` and `Board.groupOrder: GroupId[]` exist in `src/data/types.ts`
- [ ] `createDefaultGroup` returns `title: ''`; `createDefaultBoard` returns `groupOrder` equal to
      the current fixed group order, as a fresh array per board
- [ ] `DEFAULT_DATA.version` is `8`; `migrateData` produces `version: 8` for every input
- [ ] Data migrated from v7 renders identically to before the upgrade — empty titles, default order
- [ ] Migration from v1…v6 still works in a single pass and lands on 8 with both new fields
- [ ] A `groupOrder` that is missing, `null`, a non-array, or contains unknown / duplicate /
      missing ids always yields a valid permutation of the six group ids — no throw, no user-facing
      message
- [ ] A `title` that is missing, `null`, a non-string, whitespace-only, or over-long always yields
      a valid string of at most 40 characters — no throw
- [ ] Sanitization runs on every load, outside any version branch — damaged v8 data is repaired
- [ ] `migrateData` remains idempotent: valid v8 data passes through byte-identical
- [ ] `cleanupOrphanedTasks` still derives live task ids from `Object.values(board.groups)`, not
      from `groupOrder`
- [ ] `npm test` passes; `npx tsc --noEmit` is clean

## Context Files

**Feature artifacts:**
- [0011-feat-group-customization.md](0011-feat-group-customization.md) — user-spec
- [0011-feat-group-customization-tech-spec.md](0011-feat-group-customization-tech-spec.md) — tech-spec (Data Models, Decisions 6, 7, 10, Backward Compatibility)
- [0011-feat-group-customization-decisions.md](0011-feat-group-customization-decisions.md) — decisions log
- [0011-feat-group-customization-code-research.md](0011-feat-group-customization-code-research.md) — code research; see "Структура `migrateData`", "Где захардкожена версия", Problems #6 and #11

**Project knowledge:**

This project has no `.claude/skills/project-knowledge/` directory — project context lives in the
repository documentation:
- [CLAUDE.md](../../../CLAUDE.md) — conventions; see "Data Model", "Adding a new task field",
  "Common Tasks" and the migration rules
- [docs/overview.md](../../overview.md) — product overview, what the six groups mean
- [docs/technical.md](../../technical.md) — technical decisions, current data schema

**Code files:**
- [src/data/types.ts](../../../src/data/types.ts) — add `Group.title` and `Board.groupOrder`
- [src/data/defaults.ts](../../../src/data/defaults.ts) — defaults for both fields, version 7 → 8
- [src/data/migration.ts](../../../src/data/migration.ts) — v8 block plus the unconditional sanitization block
- [tests/unit/migration.test.ts](../../../tests/unit/migration.test.ts) — retarget to 8, add sanitization suites
- [src/data/cleanup.ts](../../../src/data/cleanup.ts) — read only: confirm it does not depend on `groupOrder`
- [src/main.ts](../../../src/main.ts) — read only: `loadPluginData()` calls `migrateData` before the first render and writes the result straight back to disk

## Verification Steps

- Precondition: `node -v` reports ≥ 22.12 (Task 1 pins this; the unit runner does not work below it)
- Run `npm test` — the whole unit suite passes, including all new migration and sanitization cases
- Run `npx tsc --noEmit` — clean; in particular no `strict` violations from the new `unknown`
  parameters
- Confirm the new tests actually failed before the implementation existed (TDD order), not only
  that they pass now
- Re-read the final `migrateData`: the sanitization block sits after every `if (version < N)`
  branch and before `return result`

## Details

**Files:**

- `src/data/types.ts` — currently `Group` (L23–29) has `taskIds`, `wipLimit`, `collapsed`,
  `completedRetentionDays`, `fullWidth`; `Board` (L31–40) has `id`, `title`, `subtitle`, `groups`,
  `notes`, `notesCollapsed`, `notesHidden`, `hiddenGroups`. `GroupId` (L5) and `GROUP_IDS` (L9)
  stay unchanged — the group set is fixed and this feature does not touch it. Add the two fields.
  Note `Board.title` already exists and means the board's own name; `Group.title` is a different
  thing living on a different interface (code research, Problem #10) — the comment on the new
  field should make that unambiguous for the next reader.
- `src/data/defaults.ts` — `createDefaultGroup` (L13–21) returns the group literal; add
  `title: ''`. `createDefaultBoard` (L23–42) returns the board literal; add `groupOrder`. L52 has
  `version: 7` → `8`.
- `src/data/migration.ts` — structure: early returns for non-object and `version < 1` (L6–15),
  then independent `if (version < N)` blocks that all compare the **original** `version`, which is
  why a v1 file passes through every step in one call. The last block is `version < 7` (L75–82),
  containing the second hardcoded `7` (L75) and the third (L81). Insert the v8 block after L82,
  then the unconditional sanitization block, then `return result`.
- `tests/unit/migration.test.ts` — nine `expect(result.version).toBe(7)` at lines 22, 29, 37, 57,
  72, 91, 107, 120, 129, plus test names carrying the number at lines 20, 27, 124 (and the comment
  at 125). The input versions in the snapshots (1, 2, 3, 4, 5, 6) stay as they are — they define
  the coverage. The idempotency test builds its input via `migrateData(null)`, so it becomes a
  v8 → v8 test automatically once the defaults are bumped.

**Dependencies:**

- Depends on Task 1 (Node pin and a runnable unit suite) — `npm test` cannot be executed
  otherwise.
- Nothing in this task depends on Task 2. Tasks 4 and 5 run in the same wave and touch different
  files; Task 5 deliberately takes plain strings rather than the `Group` type so it does not wait
  on this task.
- Downstream, Task 7 (board render) and Task 8 (settings popup and save chain) both assume these
  fields exist and are always valid.
- No new packages.

**Edge cases:**

- `groupOrder` missing entirely, `null`, `undefined`, a string, a number, a plain object → default
  order. The sanitizer signature must be `unknown`, not `GroupId[]`, or a hand-edited `null` would
  throw on `.filter` and abort the whole plugin load.
- `groupOrder` with a mix of problems at once — e.g. `['completed', 'completed', 'nope']` — must
  still produce a full six-element permutation.
- Deduplication keeps the **first** occurrence position; ids that are absent are appended after
  the surviving ones, in `GROUP_IDS` order. Pin this rule down with an exact-array assertion so it
  cannot drift.
- Empty array `[]` → the full default order.
- `title` non-string of any kind → `''`. Trimming happens before the length cap, so
  `'  ' + 40 chars + '  '` keeps all 40 characters. A title of exactly 40 characters is unchanged;
  41 is cut to 40.
- Already-migrated v8 data with a damaged field: repaired on load. Already-migrated v8 data that is
  valid: byte-identical after the call — the idempotency test enforces this.
- Two boards must not share one `groupOrder` array instance, otherwise reordering on one board
  silently reorders the other. Use a fresh copy per board everywhere the default is produced.

**Implementation hints:**

- Version-number scope: bump `7` → `8` in place. Do **not** extract a shared constant
  (Decision 10) — that is a refactor of migration infrastructure this feature was not asked to
  perform.
- The length cap of 40 comes from the user-spec (input field maximum). The project has no shared
  validation constants and enforces limits with literals (`maxlength="200"` / `"500"` in
  `BoardSettingsPopup.svelte`); follow that and keep the number local to the sanitizer rather than
  inventing a new exported constant. Task 8 will set `maxlength="40"` on the input separately —
  the two limits are deliberately expressed twice, the input guarding fresh typing and the loader
  guarding hand-edited files.
- Hardening beyond the two new fields is out of scope. In particular, do **not** add guards for a
  missing or non-array `result.boards`: the existing migration blocks already iterate it, and
  `cleanupCompletedTasks` in `main.ts` would fail on such data regardless — a guard here would move
  the failure, not prevent it, and CLAUDE.md forbids improving adjacent code beyond the request.
  Mention it in the decisions log if a reviewer raises it.
- Keep the sanitizers pure and free of side effects on their input, so the unit tests can call them
  directly with hostile values instead of always going through `migrateData`.
- Titles are rendered later through Svelte `{...}` interpolation, which escapes HTML, and the
  project bans `{@html}` — so sanitization here is about shape and length, not about stripping
  markup. Do not add HTML escaping at this layer.
- The migration result is written straight back to `data.json` by `loadPluginData()`
  (`src/main.ts:50–60`), so whatever the sanitizer returns becomes the persisted truth on the very
  first load. A wrong default order here is not a display glitch — it is written to the user's file.

## Reviewers

- **dev-code-reviewer** → `0011-feat-group-customization-task-03-dev-code-reviewer-review.json`
- **dev-security-auditor** → `0011-feat-group-customization-task-03-dev-security-auditor-review.json`
- **dev-test-reviewer** → `0011-feat-group-customization-task-03-dev-test-reviewer-review.json`

## Post-completion

- [ ] Записать краткий отчёт в [0011-feat-group-customization-decisions.md](0011-feat-group-customization-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [ ] Если отклонились от спека — описать отклонение и причину
- [ ] Обновить user-spec/tech-spec если что-то изменилось
