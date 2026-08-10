---
created: 2026-08-06
status: draft
branch: feature/group-customization
size: L
---

# Tech Spec: Group Customization

## Solution

Two per-board settings are added to the existing data model: a user-defined title on each
group and an explicit group order on each board. Neither changes the set of groups —
`GroupId` stays a fixed union of six literals, so status transitions, cleanup and every
other automation keep working untouched.

The board renders groups in the configured order **without reordering DOM nodes**: the six
literal `{#if}` blocks in `BoardLayout.svelte` stay exactly where they are, and each group
wrapper receives a CSS `order` value derived from `board.groupOrder`. This was verified
empirically in Chromium against a reproduction of the real grid — order is respected,
half-width pairs still pack into one row even when separated in the DOM, and both
`grid-column: 1 / -1` and `span 1` behave correctly. Because no wrapper is destroyed or
recreated, SortableJS instances survive reordering, which removes the feature's principal
risk. `computeGroupClasses` is already order-agnostic and needs no change — it only has to
receive the array pre-sorted by `groupOrder`.

Titles resolve as `group.title || $groupLabels[groupId]`: an empty stored title means the
default localized name, which preserves bilingual behavior for anyone who never renames
anything, and doubles as the reset mechanism. The resolution itself lives in a tiny pure
helper so it can be unit-tested — the project's test environment is `node`, with no DOM
testing library, so logic embedded directly in components is untestable.

## Architecture

### What we're building/modifying

- **`Group.title`** — per-group user-defined name; empty string means "use default".
- **`Board.groupOrder`** — explicit render order of the six groups on that board.
- **Migration v7 → v8** — adds both fields with values that reproduce current appearance
  exactly, plus sanitization that tolerates arbitrarily damaged input.
- **`groupOrderUtils`** (new) — pure functions for arrow moves and arrow-enabled state,
  including skipping hidden groups.
- **`groupTitle`** (new) — pure title resolution, shared by every display site.
- **`BoardLayout.svelte`** — assigns CSS `order` to group wrappers, tags each wrapper with a
  stable test attribute, feeds `computeGroupClasses` a pre-sorted array.
- **`BoardSettingsPopup.svelte`** — title input and move arrows per group row; rows rendered in
  the board's configured order instead of the fixed constant used today, with hidden groups
  keeping their own positions rather than sinking to the end; dimmed rows for hidden groups;
  scrollable body; stable per-row test attribute. Owns the whole save chain change together
  with `BoardHeader` and `dataStore`.
- **Display sites** — `GroupHeader`, `CollapsibleGroup`, `GroupSettingsPopup` show the
  resolved title; `EmptyState` additionally switches to a neutral hint once renamed; group
  header styles gain truncation so a long name cannot break the header row.
- **Test infrastructure** — Node version pinned in the repo, vitest picks up the board-layout
  test, existing E2E locators moved off group names.

### How it works

1. User edits titles and presses arrows in the board settings popup. All edits live in local
   component state; visibility toggles there are already local too, and the arrows read that
   local state — so toggling visibility immediately changes how arrows behave, before saving.
2. On **Save**, the popup passes titles and order up through `BoardHeader` to
   `dataStore.updateBoard`, which normalizes titles, writes both fields and calls `persist()`.
3. `BoardLayout` reacts: it derives the visible groups in `groupOrder` sequence, hands that
   array to `computeGroupClasses` for half/full packing, and writes an `order` style onto each
   wrapper. The grid re-flows; no DOM node moves, so drag & drop keeps working.
4. On load, `migrateData` fills the new fields for old data and sanitizes both of them.

## Decisions

### Decision 1: Visual order via CSS instead of DOM reordering
**Decision:** Group order is applied through the CSS `order` property on existing wrappers.
The six literal `{#if}` blocks in `BoardLayout.svelte` remain in place.
**Rationale:** Rebuilding the markup into an `{#each}` loop would recreate wrapper elements
and destroy the SortableJS instances bound to them, breaking drag & drop — the functionality
CLAUDE.md names critical. CSS `order` changes only a style attribute, so instances survive.
Verified empirically in Chromium on a reproduction of the real grid.
**Alternatives considered:** Keyed `{#each}` over group descriptors — rejected: two different
components (`CollapsibleGroup` for backlog/completed vs `TaskGroup`), five callbacks per group
and an `onAdd={null}` special case make the loop awkward, and any keying mistake silently
breaks drag & drop.

### Decision 2: `NotesSection` needs an explicit order value
**Decision:** The notes container gets an `order` value higher than any group's.
**Rationale:** Elements without `order` default to `0`. Once groups receive positive order
values, the notes block would float above them. This reproduced in the research probe.
**Alternatives considered:** Leaving notes unordered — rejected: it visibly breaks the layout.

### Decision 3: Three distinct test attributes, none reused
**Decision:** The board group wrapper gets `data-group-container`; the settings popup row gets
`data-settings-group`. The existing `data-group-id` on the group body stays as is.
**Rationale:** Reusing `data-group-id` on the wrapper would match two elements per group:
Playwright strict mode would fail twelve inline assertions, and four `document.querySelector`
calls in the card-columns suite would silently return the wrapper and read an empty custom
property — a real check turning into a false pass. The popup needs its own attribute rather
than either of the other two, because the popup and the board are in the DOM simultaneously
(the overlay does not unmount the board), so a shared attribute collides across them.
**Alternatives considered:** One shared attribute — rejected for the collisions above.

### Decision 4: Title resolution is a pure helper, not inline component logic
**Decision:** A small module exposes title resolution; all display sites call it.
**Rationale:** Testing Strategy requires unit coverage of the fallback rules, but
`vitest.config.ts` sets `environment: 'node'` and the project has no DOM testing library, so
logic inside `.svelte` files cannot be unit-tested at all. A pure helper is testable and keeps
all five call sites identical — four on the board side (Task 6) plus the settings popup row
(Task 8), where the resolved name becomes the input's current value and the localized default
becomes its placeholder. All display sites already receive `group` or `board`, so no new props
are needed except in `EmptyState`. The helper takes plain strings, not the group object, so it
does not depend on the model change happening in the same wave.
**Alternatives considered:** Inline `group.title || $groupLabels[id]` in each component —
rejected: four copies of a rule that the test plan requires to be covered.

### Decision 5: Reorder logic extracted as pure functions
**Decision:** Arrow behavior (move visible group past hidden neighbours, move hidden group by
list adjacency, decide arrow-enabled state) lives in a new pure module with unit tests.
**Rationale:** This is the most branch-heavy new logic in the feature.
**Alternatives considered:** Inline logic in the popup component — rejected: untestable in
isolation, same reason as Decision 4.

### Decision 6: Sanitization accepts arbitrary input and always yields a valid order
**Decision:** The sanitizer takes `unknown`. A value that is missing, `null`, or not an array
falls back to the default order; otherwise unknown ids are dropped, duplicates collapsed,
missing ids appended in default position. It runs on every load, outside any version branch.
No user-facing message.
**Rationale:** A malformed order would produce `board.groups[id] === undefined` and a blank
board, and a duplicate id would make two wrappers claim the same order slot. Handling only the
array case would still throw on a hand-edited `null` — the very outcome this is meant to
prevent. Running it outside the version branch is what makes the Backward Compatibility promise
("data damaged later is repaired too") true.
**Alternatives considered:** Failing loudly — rejected: the board must open. Sanitizing only
inside the v8 branch — rejected: would not repair damage introduced after migration.

### Decision 7: Title normalization happens on save and on load
**Decision:** The input caps length while typing; `updateBoard` trims and applies the length
cap when storing; the loader normalizes stored titles the same way and, like the order
sanitizer, accepts `unknown` — anything that is not a string becomes an empty title.
**Rationale:** The input cap alone protects only fresh input, leaving hand-edited data
unchecked — an asymmetry with `groupOrder`, which is re-validated on every load. Trimming at
the store boundary is what makes "whitespace-only equals empty" true regardless of entry point.
Accepting `unknown` matters because migration runs before the first render: calling a string
method on a hand-edited `null` would abort loading and produce exactly the blank board that
Decision 6 exists to prevent.
**Alternatives considered:** Relying on the input attribute alone — rejected as above. Handling
only the string case — rejected: same failure mode as an unguarded order field.

### Decision 8: Node is pinned in the repo, upgrade is a precondition
**Decision:** Add `engines` to `package.json` and an `.nvmrc` requiring Node ≥ 22.12. The
actual upgrade happens on the developer machine and is a precondition to execution.
**Rationale:** Three constraints apply: the test runner's own (`^20 || ^22 || >=24`), the one it
pulls in transitively through vite (`^20.19.0 || >=22.12.0`), and the package manager's
(`^20.17.0 || >=22.9.0`). A floor of 22.12 satisfies all three; note it deliberately excludes
the 23.x line, which the test runner itself declares unsupported. Pinning the floor in the repo
keeps the drift from recurring. The bundler (esbuild) imposes no relevant constraint.
**Alternatives considered:** Rolling the test runner back to a version compatible with Node 18
— rejected by the user deliberately: it would anchor the project to an unsupported runtime.
Allowing `>=20.19` as well — rejected: two supported branches double the verification surface
for no benefit here.

### Decision 9: Autopilot assumption — fix the pre-existing type error
**Decision:** Add the missing `'boardSettings.notes'` key to the `TranslationKey` union.
**Rationale:** `npx tsc --noEmit` currently fails with two errors unrelated to this feature —
the key exists in both translation files and is used in a component, but was never added to the
union (a leftover from feature 0009). This feature adds keys to that same union, so leaving it
broken means our changes would be blamed for a pre-existing failure and no task could pass a
type-check gate. The fix is one line.
**Alternatives considered:** Leaving it — rejected: blocks the quality gate for every task here.

### Decision 10: Autopilot assumption — no data version constant is introduced
**Decision:** Bump the hardcoded `7` to `8` in place, without extracting a shared constant.
**Rationale:** The version is hardcoded in three source locations and asserted in nine test
expectations. Introducing a constant is a refactor of migration infrastructure this feature was
not asked to perform, and CLAUDE.md forbids improving adjacent code beyond the request.
**Alternatives considered:** Extracting `CURRENT_VERSION` — rejected as unrequested scope.

### Decision 11: Autopilot assumption — no static type checking for Svelte files
**Decision:** Do not add `svelte-check`. Tasks touching `.svelte` are verified by a production
build plus the relevant automated scenarios, and the verification plan says so explicitly.
**Rationale:** `npx tsc --noEmit` silently ignores `.svelte` despite `tsconfig.json` listing
them — proven by the current run, where a component using a non-existent translation key
produces no error while the two `.ts` files do. Claiming `tsc` as a gate for component work
would be a fiction. Adding `svelte-check` means a new dependency and, most likely, a batch of
pre-existing findings unrelated to this feature — exactly the "someone else's debt smuggled
inside a product feature" pattern the user-spec review already pushed back on.
**Alternatives considered:** Adding `svelte-check` to this feature — rejected as unrequested
scope with an unbounded tail; it belongs to the separate CI/testing feature already proposed in
the user-spec.

### Decision 12: Autopilot assumption — reorder E2E asserts styles, not DOM position
**Decision:** New order scenarios assert computed order values and on-screen geometry, not
element index.
**Rationale:** With the CSS approach the DOM sequence never changes, so index-based assertions
would pass regardless of the setting and prove nothing.
**Alternatives considered:** Index-based assertions — rejected: they cannot detect the feature
working or failing.

### Decision 13: Autopilot assumption — naming convention inside the settings popup
**Decision:** In `BoardSettingsPopup`, the new per-group names are held as `groupTitles`
(a record keyed by group id). The existing local `title` keeps meaning the board's own title.
**Rationale:** The popup already has a local `title` for the board. Introducing a second
meaning of the same word in one component is how silent bugs get written.
**Alternatives considered:** Renaming the existing variable — rejected: unrequested churn in
code this feature does not otherwise touch.

### Decision 14: Reading order diverges from visual order — accepted
**Decision:** Keyboard tab order and screen-reader order follow the DOM, which keeps the
original group sequence regardless of the configured visual order. Accepted as a known
limitation, recorded here rather than silently.
**Rationale:** This is the unavoidable cost of Decision 1. Aligning them would require
reordering the DOM, which reintroduces the drag & drop risk the whole approach exists to avoid.
The board is a visual planning surface, its groups are landmarks rather than a linear reading
sequence, and the plugin targets desktop Obsidian.
**Alternatives considered:** DOM reordering for accessibility parity — rejected: trades a
certain critical-functionality risk for a marginal benefit here.

## Data Models

```typescript
// src/data/types.ts
export interface Group {
  taskIds: string[];
  wipLimit: number | null;
  collapsed: boolean;
  completedRetentionDays: number | null;
  fullWidth: boolean;
  title: string;          // NEW — empty string means "use default localized name"
}

export interface Board {
  id: string;
  title: string;
  subtitle: string;
  groups: Record<GroupId, Group>;
  notes: string;
  notesCollapsed: boolean;
  notesHidden: boolean;
  hiddenGroups: GroupId[];
  groupOrder: GroupId[];  // NEW — render order, always a permutation of GROUP_IDS
}
```

Data version: `7` → `8`. Migration sets `title: ''` on every group and
`groupOrder: [...GROUP_IDS]` on every board, then sanitizes both.

Invariants enforced on every load, not only during migration:
- `groupOrder` contains exactly the six known ids, each once.
- `title` is trimmed and at most 40 characters.

## Dependencies

### New packages

None.

### Using existing (from project)

- `svelte` — reactive derivation of ordered groups and per-row local popup state.
- `vitest` — unit tests for migration, sanitization, layout classes, reorder and title rules.
- `@playwright/test` — E2E scenarios and the existing harness.
- `src/ui/boardLayoutUtils.ts` — `computeGroupClasses`, reused unchanged.
- `src/i18n` — `groupLabels` store for default names.

## Testing Strategy

**Feature size:** L

### Unit tests

- Migration v7 → v8: every group gets an empty title, every board gets the default order,
  version becomes 8, tasks are untouched.
- Migration from older versions still lands on 8 with the new fields present.
- Sanitization of order: missing field, `null`, non-array value, unknown id, duplicate id,
  missing id, already-valid order.
- Sanitization of titles: whitespace-only becomes empty, over-long is capped, valid untouched,
  and a non-string value (missing, `null`, number) becomes an empty title instead of throwing.
- Reorder: visible group swaps with nearest visible neighbour across hidden ones; hidden group
  swaps with its immediate list neighbour; arrow disabled when there is no target in that
  direction for each row type; single visible group has both arrows disabled.
- Layout classes with an arbitrary order: pairs pack, a lone half stretches to full.
- Title resolution: empty falls back to the localized default; whitespace-only behaves as
  empty; non-empty wins.

### Integration tests

None — the project has no layer between unit and E2E that these would cover.

### E2E tests

- Rename a group, save, verify the new name on the board, in the collapsed header and in that
  group's settings popup; reload and verify persistence.
- Clear a title, save, verify the default name returns and the input shows it as a placeholder.
- Change order with arrows, save, verify group positions on the board.
- Move a visible group past a hidden one — the board order changes on the first press.
- Drag a task **both ways** between reordered groups in the same session without reloading,
  including a collapsible group.
- Reopen the settings popup — rows keep the configured order, hidden rows sit in their own
  positions rather than at the end.
- Cancel and overlay click discard unsaved titles and order.
- Two boards keep independent titles and order.
- A 40-character title does not break the group header row.
- Toggling a group's visibility and pressing an arrow before saving behaves according to the
  new, unsaved state.
- With every row present the popup stays within the viewport and its body scrolls.
- Existing suites for group visibility, dynamic layout and card columns still pass.

## Agent Verification Plan

**Source:** user-spec "Как проверить" section.

### Verification approach

Automated tests carry the feature. Note that `npx tsc --noEmit` does **not** check `.svelte`
files (Decision 11) — component work is therefore gated by a production build plus the relevant
automated scenarios, never by type checking alone. Visual checks in both themes remain with the
user.

### Per-task verification

| Task | verify: | What to check |
|------|---------|--------------|
| 1 | bash | `node -v` ≥ 22.12, then `npm test` runs at all and collects the board-layout suite |
| 2 | bash | `npx tsc --noEmit` — clean, no missing translation keys |
| 3 | bash | `npm test` — migration and sanitization suites pass |
| 4 | bash | `npx vitest run tests/unit/groupOrderUtils.test.ts` |
| 5 | bash | `npx vitest run tests/unit/groupTitle.test.ts` |
| 6 | bash | `npm run build`; `npx playwright test tests/e2e/core.spec.ts` |
| 7 | bash | `npm run build`; `npx playwright test tests/e2e/0007-dynamic-layout.spec.ts` |
| 8 | bash | `npm run build`; `npm test`; `npx playwright test tests/e2e/core.spec.ts` |
| 9 | bash | `npx playwright test` — all pre-existing suites green |
| 10 | bash | `npx playwright test tests/e2e/0011-group-customization.spec.ts` |
| 11 | bash | `npm test && npx playwright test && npm run build` |
| 12 | bash | `grep` over the technical doc shows both new fields documented |

### Tools required

bash only. No MCP verification — the plugin has no live environment to inspect.

## Backward Compatibility

**Breaking changes:** no

**Migration strategy:** one-shot migration on load, version 7 → 8. Existing boards receive an
empty title on every group and the current default order, so appearance is unchanged for
existing users. Sanitization runs on every load, outside the version branch, so data damaged
after migration is repaired too.

**DB migration compatibility:** not applicable — data lives in a single JSON document loaded
and saved by the plugin. There is no rolling deploy. Down-migration is not needed: an older
plugin version reading v8 data ignores the unknown fields.

**Consumer impact:** the save chain `BoardSettingsPopup.onSave` → `BoardHeader.saveSettings` →
`dataStore.updateBoard` changes shape in all three links **within a single task**, because a
partially updated chain would write `undefined` into `board.groupOrder` while the board already
depends on it. `EmptyState` gains one prop; both its render sites are updated in the same task
as the other display sites.

## Risks

| Risk | Mitigation |
|------|-----------|
| Node is not upgraded before execution starts — nothing can be verified | Task 1 checks the runtime first and stops the pipeline with a clear message instead of working around it |
| Reusing a test attribute across board wrapper, group body and popup row causes silent false passes | Three distinct attributes (Decision 3); Task 9 re-runs all pre-existing suites |
| Save chain updated partially across waves would write `undefined` into the new field | All three links change in one task (Task 8) |
| Popup row locators break regardless of renaming, because the title moves into an input value | Task 8 introduces the row attribute, Task 9 migrates locators onto it, in that order |
| CSS `order` misapplied to the notes block pushes it above the groups | Explicit order value for notes (Decision 2); covered by the layout E2E |
| Order-related E2E written against DOM index would pass without proving anything | Assertions target computed order and geometry (Decision 12) |
| Component changes have no static type gate | Acknowledged (Decision 11); build plus scenario coverage is the gate, and `svelte-check` is left to the separate CI feature |
| Freezing the six literal blocks is future debt if dynamic groups are ever wanted | Accepted: the group set is fixed by the user-spec; revisit only if that changes |

## Acceptance Criteria

- [ ] `npm test` runs and passes, including the board-layout suite that is currently not collected
- [ ] `npx tsc --noEmit` is clean
- [ ] `npm run build` succeeds
- [ ] `npx playwright test` passes, including all pre-existing suites
- [ ] Data version is 8; migrated boards render identically to before the upgrade
- [ ] A hand-damaged order field of any shape still yields a working board
- [ ] No DOM wrapper is recreated when order changes — drag & drop works without reload
- [ ] A 40-character group name truncates in the header instead of breaking its layout
- [ ] Every acceptance criterion from the user-spec is satisfied

## Implementation Tasks

### Wave 0 (предусловия — блокируют всё остальное)

#### Task 1: Test infrastructure and Node pin
- **Description:** Make the unit suite runnable and complete: pin the required Node version in
  the repository and bring the board-layout test into the collected test set. Verify the runtime
  before anything else and stop with a clear report if it is below the required version.
- **Skill:** infrastructure-setup
- **Reviewers:** dev-infrastructure-reviewer, dev-code-reviewer, dev-security-auditor
- **Verify:** bash — `node -v` and `npm test`
- **Files to modify:** `package.json`, `.nvmrc`, `vitest.config.ts`, `src/ui/boardLayoutUtils.test.ts`, `tests/unit/boardLayoutUtils.test.ts`
- **Files to read:** `playwright.config.ts`, `esbuild.harness.mjs`

#### Task 2: Localization keys
- **Description:** Add the interface strings this feature needs in both languages — group name
  column, arrow labels, and the neutral empty-group hint. Also add the translation key left
  missing by feature 0009 (Decision 9).
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-security-auditor, dev-test-reviewer
- **Verify:** bash — `npx tsc --noEmit`
- **Files to modify:** `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/ru.ts`
- **Files to read:** `src/ui/BoardSettingsPopup.svelte`, `src/ui/EmptyState.svelte`

### Wave 1 (чистая логика, зависит от Wave 0)

#### Task 3: Data model, migration and sanitization
- **Description:** Add the per-group name and per-board order to the data model with defaults
  that reproduce today's appearance, and migrate existing data to version 8. Sanitize both new
  fields on every load so damaged data cannot blank the board.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-security-auditor, dev-test-reviewer
- **Verify:** bash — `npm test`
- **Files to modify:** `src/data/types.ts`, `src/data/defaults.ts`, `src/data/migration.ts`, `tests/unit/migration.test.ts`
- **Files to read:** `src/data/cleanup.ts`, `docs/features/0011-feat-group-customization/0011-feat-group-customization-code-research.md`

#### Task 4: Reorder logic
- **Description:** Implement arrow behavior as pure functions: which groups swap when an arrow
  is pressed, and whether an arrow has anywhere to go, for both visible and hidden rows.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-security-auditor, dev-test-reviewer
- **Verify:** bash — `npx vitest run tests/unit/groupOrderUtils.test.ts`
- **Files to modify:** `src/ui/groupOrderUtils.ts`, `tests/unit/groupOrderUtils.test.ts`
- **Files to read:** `src/ui/boardLayoutUtils.ts`, `src/data/types.ts`

#### Task 5: Title resolution
- **Description:** Implement resolution of a group's displayed name from its stored name and the
  localized default, as a pure function over plain strings shared by every display site. It must
  not depend on the group type, so that it neither waits for nor conflicts with Task 3.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-security-auditor, dev-test-reviewer
- **Verify:** bash — `npx vitest run tests/unit/groupTitle.test.ts`
- **Files to modify:** `src/ui/groupTitle.ts`, `tests/unit/groupTitle.test.ts`
- **Files to read:** `src/i18n/index.ts`

### Wave 2 (отображение, зависит от Wave 1)

#### Task 6: Group name display
- **Description:** Show the resolved name everywhere a group name appears on the board — header,
  collapsed header and the group's own settings popup — and switch a renamed group's empty-state
  hint to the neutral one. Make group headers tolerate a maximum-length name.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-security-auditor, dev-test-reviewer
- **Verify:** bash — `npm run build` and `npx playwright test tests/e2e/core.spec.ts`
- **Files to modify:** `src/ui/GroupHeader.svelte`, `src/ui/CollapsibleGroup.svelte`, `src/ui/GroupSettingsPopup.svelte`, `src/ui/EmptyState.svelte`, `src/ui/TaskGroup.svelte`, `src/styles.css`
- **Files to read:** `src/ui/groupTitle.ts`, `src/i18n/index.ts`

### Wave 3 (доска, зависит от Wave 2)

#### Task 7: Board renders in configured order
- **Description:** Render groups in the board's configured order without moving any DOM node,
  and give each group wrapper a stable identifier independent of its name and collapsed state.
  Keep the existing half/full packing applied to the new order, and keep notes below all groups.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-security-auditor, dev-test-reviewer
- **Verify:** bash — `npm run build` and `npx playwright test tests/e2e/0007-dynamic-layout.spec.ts`
- **Files to modify:** `src/ui/BoardLayout.svelte`, `src/ui/boardLayoutUtils.ts`, `src/styles.css`
- **Files to read:** `src/ui/useSortable.ts`, `docs/features/0011-feat-group-customization/0011-feat-group-customization-code-research.md`

> The header comment in `boardLayoutUtils.ts` claims the function must be reworked once group
> order becomes configurable. That condition arrives with this feature and the claim is false —
> the function is order-agnostic. Remove the stale comment; leaving it would mislead the next
> reader and gives a reviewer documented grounds to block this task.

### Wave 4 (настройки, зависит от Wave 3)

#### Task 8: Settings popup and save chain
- **Description:** Add a name field and move arrows to each group row, dim rows of hidden
  groups, give each row a stable identifier, and keep the popup within the screen. Rows follow
  the board's configured order rather than the fixed constant they use today. Extend the whole
  save path in one step so names and order reach storage together, normalized on the way.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-security-auditor, dev-test-reviewer
- **Verify:** bash — `npm run build`, `npm test` and `npx playwright test tests/e2e/core.spec.ts`
- **Files to modify:** `src/ui/BoardSettingsPopup.svelte`, `src/ui/BoardHeader.svelte`, `src/stores/dataStore.ts`, `src/styles.css`
- **Files to read:** `src/ui/groupOrderUtils.ts`, `src/ui/groupTitle.ts`, `src/data/types.ts`

### Wave 5 (тесты, зависит от Wave 4)

#### Task 9: Migrate existing E2E locators
- **Description:** Move existing scenarios off locating groups and popup rows by displayed
  names onto the identifiers introduced in the previous waves.
- **Skill:** code-writing
- **Reviewers:** dev-test-reviewer, dev-code-reviewer, dev-security-auditor
- **Verify:** bash — `npx playwright test`
- **Files to modify:** `tests/e2e/helpers.ts`, `tests/e2e/0006-group-visibility.spec.ts`, `tests/e2e/0007-dynamic-layout.spec.ts`, `tests/e2e/0008-card-columns.spec.ts`, `tests/e2e/core.spec.ts`
- **Files to read:** `src/ui/BoardLayout.svelte`, `src/ui/BoardSettingsPopup.svelte`

### Wave 6 (приёмка фичи, зависит от Wave 5)

#### Task 10: Feature E2E scenarios
- **Description:** Cover the feature end to end with the scenarios listed under Testing
  Strategy / E2E tests. The drag scenario carries the most weight: it is the only check that the
  reordering approach preserved drag & drop.
- **Skill:** code-writing
- **Reviewers:** dev-test-reviewer, dev-code-reviewer, dev-security-auditor
- **Verify:** bash — `npx playwright test tests/e2e/0011-group-customization.spec.ts`
- **Files to modify:** `tests/e2e/0011-group-customization.spec.ts`
- **Files to read:** `tests/e2e/helpers.ts`, `tests/e2e/0007-dynamic-layout.spec.ts`, `docs/features/0011-feat-group-customization/0011-feat-group-customization.md`

### Final Wave

#### Task 11: Pre-deploy QA
- **Description:** Acceptance testing: run all tests, verify acceptance criteria from user-spec and tech-spec.
- **Skill:** pre-deploy-qa
- **Reviewers:** none
- **Verify:** bash — `npm test && npx playwright test && npm run build`

#### Task 12: Documentation update
- **Description:** Bring the technical documentation in line with the shipped data schema and
  the new board settings, so the next feature starts from an accurate picture.
- **Skill:** documentation-writing
- **Reviewers:** dev-code-reviewer
- **Verify:** bash — `grep -n "groupOrder\|title" docs/technical.md` shows both new fields documented
- **Files to modify:** `docs/technical.md`, `CHANGELOG.md`, `CHANGELOG.ru.md`
- **Files to read:** `docs/features/0011-feat-group-customization/0011-feat-group-customization-tech-spec.md`, `src/data/types.ts`
