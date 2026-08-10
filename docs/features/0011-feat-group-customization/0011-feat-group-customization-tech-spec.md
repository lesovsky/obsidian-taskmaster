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
anything, and doubles as the reset mechanism.

## Architecture

### What we're building/modifying

- **`Group.title`** — per-group user-defined name; empty string means "use default".
- **`Board.groupOrder`** — explicit render order of the six groups on that board.
- **Migration v7 → v8** — adds both fields with values that reproduce current appearance exactly.
- **`groupOrderUtils`** (new) — pure functions for arrow moves and arrow-enabled state,
  including skipping hidden groups; unit-tested in isolation.
- **`BoardLayout.svelte`** — assigns CSS `order` to group wrappers, tags each wrapper with a
  stable test attribute, feeds `computeGroupClasses` a pre-sorted array.
- **`BoardSettingsPopup.svelte`** — title input and move arrows per group row; dimmed rows
  for hidden groups; scrollable popup body.
- **Title resolution** in `GroupHeader`, `CollapsibleGroup`, `GroupSettingsPopup`,
  `BoardSettingsPopup`; **`EmptyState`** additionally switches to a neutral hint once a group
  is renamed.
- **Test infrastructure** — Node version pinned in the repo, vitest picks up the board-layout
  test, existing E2E locators moved off group names.

### How it works

1. User edits titles and presses arrows in the board settings popup. All edits live in local
   component state; visibility toggles there are already local too, and the arrows read that
   local state — so toggling visibility immediately changes how arrows behave, before saving.
2. On **Save**, the popup passes titles and order up through `BoardHeader` to
   `dataStore.updateBoard`, which writes them into the board and calls `persist()`.
3. `BoardLayout` reacts: it derives the visible groups in `groupOrder` sequence, hands that
   array to `computeGroupClasses` for half/full packing, and writes an `order` style onto each
   wrapper. The grid re-flows; no DOM node moves, so drag & drop keeps working.
4. On load, `migrateData` fills the new fields for old data and sanitizes `groupOrder`.

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

### Decision 3: Distinct test attribute on the group wrapper
**Decision:** The outer wrapper gets `data-group-container`, distinct from the existing
`data-group-id` on the group body.
**Rationale:** Reusing `data-group-id` would match two elements per group. Playwright strict
mode would fail 12 inline assertions, and — worse — `document.querySelector` calls in the
card-columns suite would silently return the wrapper and read an empty custom property,
turning a real check into a false pass.
**Alternatives considered:** Same attribute on both — rejected for the reason above.

### Decision 4: Titles resolve at the point of display, not in the store
**Decision:** Components resolve `group.title || $groupLabels[groupId]` where they render.
**Rationale:** All four display sites already receive `group` or `board`, so no new props and
no plumbing are needed. Storing a resolved title would freeze the current language into the
data and break translation for non-renamed groups.
**Alternatives considered:** Resolving in the store — rejected: breaks language switching.

### Decision 5: Reorder logic extracted as pure functions
**Decision:** Arrow behavior (move visible group past hidden neighbours, move hidden group by
list adjacency, decide arrow-enabled state) lives in a new pure module with unit tests.
**Rationale:** This is the most branch-heavy new logic in the feature. Verifying it only
through browser scenarios would be slow and unreliable.
**Alternatives considered:** Inline logic in the popup component — rejected: untestable in
isolation.

### Decision 6: Order is sanitized on load, silently
**Decision:** `migrateData` drops unknown ids, collapses duplicates, appends missing ids in
default order. No user-facing message.
**Rationale:** A malformed order would produce `board.groups[id] === undefined` and a blank
board. Duplicates additionally matter because a duplicate id would make two wrappers claim the
same order slot. The user cannot act on such a message anyway.
**Alternatives considered:** Failing loudly — rejected: the board must open.

### Decision 7: Node is pinned in the repo, upgrade is a precondition
**Decision:** Add `engines` to `package.json` and an `.nvmrc` requiring Node ≥ 22.12. The
actual upgrade happens on the developer machine and is a precondition to execution.
**Rationale:** The requirement is the intersection of what the build tooling and package
manager need. Pinning it in the repo keeps the drift from recurring.
**Alternatives considered:** Rolling the test runner back to a version compatible with Node 18
— rejected by the user deliberately: it would anchor the project to an unsupported runtime,
and the mismatch already extends beyond the test runner.

### Decision 8: Autopilot assumption — fix the pre-existing type error
**Decision:** Add the missing `'boardSettings.notes'` key to the `TranslationKey` union.
**Rationale:** `npx tsc --noEmit` currently fails with two errors unrelated to this feature —
the key exists in both translation files and is used in a component, but was never added to
the union (a leftover from feature 0009). This feature adds keys to that same union, so
leaving it broken means our changes would be blamed for a pre-existing failure and no task
could pass a type-check gate. The fix is one line.
**Alternatives considered:** Leaving it — rejected: blocks the quality gate for every task here.

### Decision 9: Autopilot assumption — no data version constant is introduced
**Decision:** Bump the hardcoded `7` to `8` in place, without extracting a shared constant.
**Rationale:** The current version is hardcoded in three source locations and asserted in nine
test expectations. Introducing a constant is a refactor of migration infrastructure that this
feature was not asked to perform, and CLAUDE.md forbids improving adjacent code beyond the
request.
**Alternatives considered:** Extracting `CURRENT_VERSION` — rejected as unrequested scope.

### Decision 10: Autopilot assumption — reorder E2E asserts styles, not DOM position
**Decision:** New order scenarios assert the computed order values and on-screen geometry,
not element index.
**Rationale:** With the CSS approach the DOM sequence never changes, so `.nth()` based
assertions would pass regardless of the setting and prove nothing.
**Alternatives considered:** Index-based assertions — rejected: they cannot detect the feature
working or failing.

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
`groupOrder: [...GROUP_IDS]` on every board, then sanitizes any existing order.

Constraint: `title` is stored trimmed, at most 40 characters. `groupOrder` is always exactly
the six known ids, each once.

## Dependencies

### New packages

None.

### Using existing (from project)

- `svelte` — reactive derivation of ordered groups and per-row local popup state.
- `vitest` — unit tests for migration, sanitization, layout classes and reorder logic.
- `@playwright/test` — E2E scenarios and the existing harness.
- `src/ui/boardLayoutUtils.ts` — `computeGroupClasses`, reused unchanged.
- `src/i18n` — `groupLabels` store for default names.

## Testing Strategy

**Feature size:** L

### Unit tests

- Migration v7 → v8: every group gets an empty title, every board gets the default order,
  version becomes 8, tasks are untouched.
- Migration from older versions still lands on 8 with the new fields present.
- Sanitization: unknown id dropped; duplicate collapsed; missing id appended in default
  position; already-valid order left as is.
- Reorder: visible group swaps with nearest visible neighbour across hidden ones; hidden group
  swaps with its immediate list neighbour; arrow disabled when there is no target in that
  direction for each row type; single visible group has both arrows disabled.
- Layout classes with an arbitrary order: pairs pack, a lone half stretches to full.
- Title resolution: empty title falls back to the localized default; whitespace-only title
  behaves as empty; non-empty title wins.

### Integration tests

None — the project has no layer between unit and E2E that these would cover.

### E2E tests

- Rename a group, save, verify the new name on the board, in the collapsed header and in that
  group's settings popup; reload and verify persistence.
- Clear a title, save, verify the default name returns.
- Change order with arrows, save, verify group positions on the board.
- Move a visible group past a hidden one — the board order changes on the first press.
- Drag a task between reordered groups in the same session without reloading, including a
  collapsible group.
- Reopen the settings popup — rows keep the configured order, hidden rows sit in their own
  positions rather than at the end.
- Existing suites for group visibility, dynamic layout and card columns still pass.

## Agent Verification Plan

**Source:** user-spec "Как проверить" section.

### Verification approach

Automated tests carry the feature. Type checking and a production build guard against
regressions the tests would not catch. Visual checks in both themes remain with the user.

### Per-task verification

| Task | verify: | What to check |
|------|---------|--------------|
| 1 | bash | `npm test` — migration and sanitization suites pass |
| 2 | bash | `npm test` runs at all; board-layout test is collected |
| 3 | bash | `npx tsc --noEmit` — clean, no missing translation keys |
| 4 | bash | `npm test` — reorder suite passes |
| 5 | bash | `npx tsc --noEmit` and `npm run build` |
| 6 | bash | `npm test` and `npx tsc --noEmit` |
| 7 | bash | `npm run build`; `npx playwright test tests/e2e/0007-dynamic-layout.spec.ts` |
| 8 | bash | `npm run build`; `npx playwright test tests/e2e/0006-group-visibility.spec.ts` |
| 9 | bash | `npx playwright test` — all pre-existing suites green |
| 10 | bash | `npx playwright test tests/e2e/0011-group-customization.spec.ts` |
| 11 | bash | `npm test && npx playwright test && npm run build` |

### Tools required

bash only. No MCP verification — the plugin has no live environment to inspect.

## Backward Compatibility

**Breaking changes:** no

**Migration strategy:** one-shot migration on load, version 7 → 8. Existing boards receive an
empty title on every group and the current default order, so appearance is byte-for-byte
unchanged for existing users. Sanitization runs on every load, not only during migration, so
data damaged later is repaired too.

**DB migration compatibility:** not applicable — data lives in a single JSON document loaded
and saved by the plugin. There is no rolling deploy. Down-migration is not needed: an older
plugin version reading v8 data ignores the unknown fields, and its own migration would leave
them alone.

**Consumer impact:** `dataStore.updateBoard` gains fields in its `fields` argument. Its only
caller is `BoardHeader.svelte`, updated in the same wave. `EmptyState` gains one prop; both
its render sites are updated. `BoardSettingsPopup`'s `onSave` signature grows; its only
consumer is `BoardHeader.svelte`.

## Risks

| Risk | Mitigation |
|------|-----------|
| Node is not upgraded before execution starts — tests cannot run at all | Task 2 verifies the runtime first and stops the pipeline with a clear message instead of working around it |
| Reusing `data-group-id` on the wrapper silently breaks card-column assertions | Distinct attribute `data-group-container` (Decision 3); Task 9 re-runs all pre-existing suites |
| Popup row locators break regardless of renaming, because the title moves into an input value | Task 9 migrates those locators before new scenarios are written |
| CSS `order` misapplied to the notes block pushes it above the groups | Explicit order value for notes (Decision 2); covered by the layout E2E |
| Order-related E2E written against DOM index would pass without proving anything | Assertions target computed order and geometry (Decision 10) |
| Pre-existing type errors block per-task quality gates | Fixed in Task 3 (Decision 8) |

## Acceptance Criteria

- [ ] `npm test` runs and passes, including the board-layout suite that is currently not collected
- [ ] `npx tsc --noEmit` is clean
- [ ] `npm run build` succeeds
- [ ] `npx playwright test` passes, including all pre-existing suites
- [ ] Data version is 8; migrated boards render identically to before the upgrade
- [ ] No DOM wrapper is recreated when order changes — drag & drop works without reload
- [ ] Every acceptance criterion from the user-spec is satisfied

## Implementation Tasks

### Wave 1 (независимые)

#### Task 1: Data model and migration to version 8
- **Description:** Add `Group.title` and `Board.groupOrder` to the data model with defaults that
  reproduce today's appearance, and migrate existing data to version 8. Include order
  sanitization so damaged data cannot blank the board.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-test-reviewer
- **Verify:** bash — `npm test`
- **Files to modify:** `src/data/types.ts`, `src/data/defaults.ts`, `src/data/migration.ts`, `tests/unit/migration.test.ts`
- **Files to read:** `docs/features/0011-feat-group-customization/0011-feat-group-customization-code-research.md`, `src/data/cleanup.ts`

#### Task 2: Test infrastructure
- **Description:** Make the unit suite runnable and complete: pin the required Node version in
  the repository and bring the board-layout test into the collected test set. Verify the runtime
  before anything else — if Node is below the required version, stop and report rather than
  working around it.
- **Skill:** infrastructure-setup
- **Reviewers:** dev-infrastructure-reviewer, dev-code-reviewer
- **Verify:** bash — `npm test`
- **Files to modify:** `package.json`, `.nvmrc`, `vitest.config.ts`, `src/ui/boardLayoutUtils.test.ts`, `tests/unit/boardLayoutUtils.test.ts`
- **Files to read:** `playwright.config.ts`, `esbuild.harness.mjs`

#### Task 3: Localization keys
- **Description:** Add the interface strings this feature needs in both languages — group name
  column, arrow labels, and the neutral empty-group hint shown for renamed groups. Also add the
  translation key left missing by feature 0009, which currently makes type checking fail.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer
- **Verify:** bash — `npx tsc --noEmit`
- **Files to modify:** `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/ru.ts`
- **Files to read:** `src/ui/BoardSettingsPopup.svelte`, `src/ui/EmptyState.svelte`

#### Task 4: Reorder logic
- **Description:** Implement the arrow behavior as pure functions: moving a visible group swaps
  it with the nearest visible neighbour across hidden ones, moving a hidden group swaps it with
  its immediate list neighbour, and each arrow reports whether it has anywhere to go. This is the
  most branch-heavy logic in the feature and is verified in isolation.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-test-reviewer
- **Verify:** bash — `npm test`
- **Files to modify:** `src/ui/groupOrderUtils.ts`, `tests/unit/groupOrderUtils.test.ts`
- **Files to read:** `src/ui/boardLayoutUtils.ts`, `src/data/types.ts`

### Wave 2 (зависит от Wave 1)

#### Task 5: Group title display
- **Description:** Show the user-defined name everywhere a group name appears — board header,
  collapsed header, the group's own settings popup and the board settings list — falling back to
  the localized default when no name is set. A renamed group also shows a neutral hint when empty,
  because the original hint describes a meaning the user has replaced.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-test-reviewer
- **Verify:** bash — `npx tsc --noEmit` and `npm run build`
- **Files to modify:** `src/ui/GroupHeader.svelte`, `src/ui/CollapsibleGroup.svelte`, `src/ui/GroupSettingsPopup.svelte`, `src/ui/EmptyState.svelte`, `src/ui/TaskGroup.svelte`
- **Files to read:** `src/i18n/index.ts`, `src/data/types.ts`

#### Task 6: Persisting titles and order
- **Description:** Extend the board update path so saved titles and group order reach the data
  store and get persisted. Keep the existing save-on-confirm behavior — nothing is written until
  the user confirms.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-test-reviewer
- **Verify:** bash — `npm test` and `npx tsc --noEmit`
- **Files to modify:** `src/stores/dataStore.ts`, `src/ui/BoardHeader.svelte`
- **Files to read:** `src/ui/BoardSettingsPopup.svelte`, `src/data/types.ts`

#### Task 7: Board renders in configured order
- **Description:** Render groups in the board's configured order without moving any DOM node, and
  give each group wrapper a stable identifier that does not depend on its name or collapsed state.
  Keep the existing half/full packing rules applied to the new order, and keep the notes section
  below all groups.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-test-reviewer
- **Verify:** bash — `npm run build` and `npx playwright test tests/e2e/0007-dynamic-layout.spec.ts`
- **Files to modify:** `src/ui/BoardLayout.svelte`, `src/styles.css`
- **Files to read:** `src/ui/boardLayoutUtils.ts`, `src/ui/useSortable.ts`, `docs/features/0011-feat-group-customization/0011-feat-group-customization-code-research.md`

### Wave 3 (зависит от Wave 2)

#### Task 8: Settings popup controls
- **Description:** Add a name field and move arrows to each group row in the board settings
  popup, dim rows of hidden groups, and keep the popup within the screen by making its body
  scrollable. Arrows must react to visibility toggled in the same session before saving, and
  cancelling must discard names and order along with the rest.
- **Skill:** code-writing
- **Reviewers:** dev-code-reviewer, dev-test-reviewer
- **Verify:** bash — `npm run build` and `npx playwright test tests/e2e/0006-group-visibility.spec.ts`
- **Files to modify:** `src/ui/BoardSettingsPopup.svelte`, `src/styles.css`
- **Files to read:** `src/ui/groupOrderUtils.ts`, `src/ui/BoardHeader.svelte`, `src/i18n/index.ts`

#### Task 9: Migrate existing E2E locators
- **Description:** Move the existing scenarios off locating groups by their displayed names,
  which stop being stable once names are editable, onto the group identifiers. Popup row locators
  break regardless of renaming because the name becomes an input value, so they must move too.
- **Skill:** code-writing
- **Reviewers:** dev-test-reviewer, dev-code-reviewer
- **Verify:** bash — `npx playwright test`
- **Files to modify:** `tests/e2e/helpers.ts`, `tests/e2e/0006-group-visibility.spec.ts`, `tests/e2e/0007-dynamic-layout.spec.ts`, `tests/e2e/0008-card-columns.spec.ts`, `tests/e2e/core.spec.ts`
- **Files to read:** `src/ui/BoardLayout.svelte`, `src/ui/BoardSettingsPopup.svelte`

### Wave 4 (зависит от Wave 3)

#### Task 10: Feature E2E scenarios
- **Description:** Cover the feature end to end: renaming with persistence across reload,
  resetting to the default name, reordering with arrows, moving a visible group past a hidden one,
  row order on reopening the popup, and dragging a task between reordered groups in the same
  session without reloading — including a collapsible group, where the drag binding is most
  fragile.
- **Skill:** code-writing
- **Reviewers:** dev-test-reviewer, dev-code-reviewer
- **Verify:** bash — `npx playwright test tests/e2e/0011-group-customization.spec.ts`
- **Files to modify:** `tests/e2e/0011-group-customization.spec.ts`
- **Files to read:** `tests/e2e/helpers.ts`, `tests/e2e/0007-dynamic-layout.spec.ts`, `docs/features/0011-feat-group-customization/0011-feat-group-customization.md`

### Final Wave

#### Task 11: Pre-deploy QA
- **Description:** Acceptance testing: run all tests, verify acceptance criteria from user-spec and tech-spec.
- **Skill:** pre-deploy-qa
- **Reviewers:** none
