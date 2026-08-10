---
status: planned                    # planned -> in_progress -> done
depends_on: ["04", "05", "07"]     # ID задач-зависимостей (строки: ["01", "02"])
wave: 5                            # волна параллельного выполнения
skills: [code-writing]             # МАССИВ скиллов для загрузки
verify: bash                       # npm run build && npm test && npx playwright test tests/e2e/core.spec.ts
reviewers: [dev-code-reviewer, dev-security-auditor, dev-test-reviewer]  # явно указать. Пусто = fallback на defaults
teammate_name:                     # имя агента-исполнителя (опционально; если не задано — генерируется по описанию задачи)
---

# Task 08: Settings popup and save chain

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:code-writing` — [skills/code-writing/SKILL.md](~/.claude/skills/code-writing/SKILL.md)

## Description

This task turns the board settings popup into the place where group names and group order are
edited, and extends the save path so both new fields actually reach `data.json`.

Today `BoardSettingsPopup.svelte` renders one row per group over the fixed `GROUP_IDS` constant,
with three cells: name label + task counter, visibility checkbox, full-width checkbox. Two
controls are added to every row — a text input for the group's own name and a pair of move
arrows — and the rows start following `board.groupOrder` instead of the constant. Hidden groups
keep their own slot in that list (they do not sink to the end) and render dimmed, with the dimming
reacting to the local, unsaved visibility state.

All edits stay in local component state until Save, exactly like the existing visibility and
full-width toggles: Cancel and an overlay click must discard the new fields too, which they do for
free as long as nothing is written outside `handleSave`.

**The save chain changes in all three links inside this one task.** `BoardSettingsPopup.onSave`,
`BoardHeader.saveSettings` (lines 23–29) and `dataStore.updateBoard` (line 199) each carry the
same field shape. Updating only part of the chain would write `undefined` into `board.groupOrder`,
and by this wave the board already renders from that field (Task 07) — the result is a blank or
scrambled board that no partial verification would catch. This is why the tech-spec deliberately
puts all three files in one task (see Backward Compatibility / Consumer impact).

Two pure modules built earlier are consumed here, not reimplemented: `src/ui/groupOrderUtils.ts`
(Task 04) for arrow behavior and arrow-enabled state, and `src/ui/groupTitle.ts` (Task 05) for
resolving a group's displayed name from its stored name plus the localized default.

## What to do

1. **Local state in `BoardSettingsPopup.svelte`.** Add two pieces of local state seeded from the
   `board` prop: a per-group name record and a working copy of the group order. Per Decision 13
   the name record is called `groupTitles` — the existing local `title` keeps meaning *the board's*
   title, and that word must not acquire a second meaning in this component.
2. **Render rows in the board's order.** Replace the `{#each GROUP_IDS as groupId}` iteration
   (line 52) with an iteration over the local order copy, keyed by group id. Hidden groups stay at
   their own index — no partitioning, no sorting visible-first.
3. **Row layout.** Each group row becomes, left to right: move-up/move-down arrows, name input,
   task counter (still only when the count is above zero), visibility toggle, full-width toggle.
   The existing column header row gains matching cells so the two stay aligned.
4. **Name input.** Its current value is the name resolved through the Task 05 helper; its
   placeholder is the default localized name from `$groupLabels[groupId]`; input is capped at 40
   characters via `maxlength`. Clearing the field means "return to the default name".
5. **Arrows.** Wire both buttons to the Task 04 pure functions for the move itself and for the
   disabled state. They must be fed the **local** order and the **local** hidden-groups array, so
   that toggling visibility changes arrow behavior immediately, before any save.
6. **Row identity.** Every group row gets `data-settings-group="{groupId}"`. Do not reuse
   `data-group-id` (group body) or `data-group-container` (board wrapper) here — see Decision 3
   and the Edge cases below.
7. **Dimming.** Rows of groups hidden in the *local* state render dimmed through a `tm-`-prefixed
   BEM modifier class, so unchecking visibility dims the row on the spot.
8. **Popup sizing.** Constrain the popup to roughly four fifths of the viewport height and give it
   vertical scrolling, so six five-control rows never overflow the screen.
9. **Extend `onSave` payload** with the group names and the group order, and mirror the same shape
   in `BoardHeader.saveSettings` and in the `updateBoard` signature.
10. **Normalize in `updateBoard`.** Trim each incoming name and cap it at 40 characters before
    storing it on the group; write the order onto the board; keep `persist()` at the end. The
    input's `maxlength` is not the enforcement point — Decision 7 puts normalization at the store
    boundary.
11. **Unit-test the store boundary** (see TDD Anchor) — this is the part of the task that is
    testable without a DOM.

## TDD Anchor

Тесты, которые нужно написать ДО реализации. Пишем → запускаем → убеждаемся что падают → пишем код → убеждаемся что проходят.

New file `tests/unit/dataStore.test.ts` (the store is importable under `environment: 'node'` —
its only Obsidian dependency is a type-only import in `pluginStore.ts`, which is erased):

- `tests/unit/dataStore.test.ts::updateBoard trims surrounding whitespace from group titles` — a
  title passed as `'  Долгострой  '` is stored as `'Долгострой'`.
- `tests/unit/dataStore.test.ts::updateBoard stores a whitespace-only title as empty` — `'   '`
  becomes `''`, i.e. the group falls back to its default name.
- `tests/unit/dataStore.test.ts::updateBoard caps a group title at 40 characters` — a 60-character
  title is stored with length 40.
- `tests/unit/dataStore.test.ts::updateBoard stores the supplied group order` — `board.groupOrder`
  equals the array handed in, not the default one.
- `tests/unit/dataStore.test.ts::updateBoard still writes the pre-existing fields` — title,
  subtitle, hiddenGroups, notesHidden and per-group fullWidth keep their current behavior after
  the signature change (regression guard for the chain edit).

## Acceptance Criteria

- [ ] Every group row in the board settings popup has a name input and a pair of move arrows.
- [ ] The name input shows the current name, uses the default localized name as placeholder, and
      refuses input beyond 40 characters.
- [ ] Clearing a name and saving returns the group to its default localized name.
- [ ] Rows are rendered in `board.groupOrder`; hidden groups keep their positions instead of
      moving to the end, and the order survives reopening the popup.
- [ ] A visible group's arrow swaps it with the nearest *visible* neighbour, skipping hidden ones;
      a hidden group's arrow swaps it with its immediate list neighbour.
- [ ] An arrow is disabled when there is nowhere to move in that direction; a single visible group
      has both arrows disabled.
- [ ] Toggling visibility changes both the row's dimming and its arrow behavior immediately,
      without saving.
- [ ] Each group row carries `data-settings-group="{groupId}"`, and that attribute name is used
      nowhere else in the codebase.
- [ ] With all rows present the popup stays inside the viewport and its body scrolls vertically.
- [ ] Save writes names and order to `data.json`; Cancel and an overlay click discard both.
- [ ] `updateBoard` trims titles and caps them at 40 characters regardless of the entry point, and
      calls `persist()`.
- [ ] The task counter still appears only when a group has more than zero tasks.
- [ ] Existing visibility and full-width toggles keep working, including the "last visible group
      cannot be hidden" rule.
- [ ] `npm run build`, `npm test` and `npx playwright test tests/e2e/core.spec.ts` all pass.

## Context Files

**Feature artifacts:**
- [0011-feat-group-customization.md](docs/features/0011-feat-group-customization/0011-feat-group-customization.md) — user-spec (see "Формы и ввод данных", "UX-поведение", "Граничные случаи")
- [0011-feat-group-customization-tech-spec.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-tech-spec.md) — tech-spec (Decisions 3, 5, 7, 13; Backward Compatibility)
- [0011-feat-group-customization-decisions.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-decisions.md) — decisions log
- [0011-feat-group-customization-code-research.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-code-research.md) — codebase research

**Project knowledge** (this repo has no `.claude/skills/project-knowledge/`; these files are its equivalent):
- [CLAUDE.md](CLAUDE.md) — conventions: `tm-` prefix, BEM, no `<style>` blocks, `persist()` after store writes, no `{@html}`
- [docs/overview.md](docs/overview.md) — product context
- [docs/technical.md](docs/technical.md) — data model and architecture

**Code files:**
- [src/ui/BoardSettingsPopup.svelte](src/ui/BoardSettingsPopup.svelte) — add name input, arrows, row attribute, dimming; iterate over the order
- [src/ui/BoardHeader.svelte](src/ui/BoardHeader.svelte) — widen the `saveSettings` field shape (lines 23–29)
- [src/stores/dataStore.ts](src/stores/dataStore.ts) — widen `updateBoard` (line 199), normalize titles, write order
- [src/styles.css](src/styles.css) — row/header grid (lines 694–700, 713–719), popup max-height and scroll (line 638), arrow and dimmed-row styles
- [src/ui/groupOrderUtils.ts](src/ui/groupOrderUtils.ts) — read: arrow move + enabled-state functions (Task 04)
- [src/ui/groupTitle.ts](src/ui/groupTitle.ts) — read: name resolution (Task 05)
- [src/data/types.ts](src/data/types.ts) — read: `Group.title`, `Board.groupOrder`, `GROUP_IDS`
- [src/i18n/index.ts](src/i18n/index.ts) — read: `t` and `groupLabels` stores
- [tests/unit/migration.test.ts](tests/unit/migration.test.ts) — read: existing unit-test style

## Verification Steps

- `npx tsc --noEmit` — clean. Note it does **not** check `.svelte` files (Decision 11), so it only
  covers the `dataStore.ts` half of the change.
- `npm test` — the whole unit suite passes, including the new `tests/unit/dataStore.test.ts`.
- `npm run build` — production build succeeds; this is the real gate for the component work.
- `npx playwright test tests/e2e/core.spec.ts` — passes.
- `grep -rn "data-settings-group" src/` — the attribute appears only on the popup group row;
  `grep -rn "data-group-container\|data-group-id" src/ui/BoardSettingsPopup.svelte` returns nothing.
- Manual sanity check in Obsidian (optional, user-side): open board settings, confirm rows fit the
  screen and scroll, and that the popup looks right in both light and dark themes.

## Details

**Files:**

- `src/ui/BoardSettingsPopup.svelte` — currently 115 lines. Local state at lines 12–19 (`title`,
  `subtitle`, `hiddenGroups`, `notesHidden`, `fullWidths`, `confirmDelete`); `visibleCount` derived
  at line 22; `handleSave` at lines 24–27 sends `{ title, subtitle, hiddenGroups, fullWidths,
  notesHidden }`. Group rows are the `{#each GROUP_IDS as groupId}` block at lines 52–87; the
  column header is lines 47–51; a separate notes row (lines 89–98) reuses `.tm-popup__group-row`.
  Add `groupTitles` and the local order copy, switch the iteration source, add the two controls,
  the row attribute and the dimming modifier, and extend the `onSave` prop type at line 8.
- `src/ui/BoardHeader.svelte` — `saveSettings` (lines 23–29) rebuilds `fullWidths` into
  `groupFullWidths` and calls `updateBoard(board.id, { ...fields, groupFullWidths })`. Widen the
  `fields` parameter type with the two new members; the spread already forwards them, so the only
  real change here is the type — which is exactly why it is easy to forget and why it is pinned to
  this task.
- `src/stores/dataStore.ts` — `updateBoard` at line 199 assigns title/subtitle/hiddenGroups/
  notesHidden and loops `GROUP_IDS` for `fullWidth`, then calls `persist()`. Add the group-title
  assignment (trimmed, capped at 40) inside that same loop and the `groupOrder` assignment; leave
  `persist()` as the last statement.
- `src/styles.css` — `.tm-popup` (line 638) has neither `max-height` nor `overflow`; add both.
  `.tm-popup__group-header` (694–700) and `.tm-popup__group-row` (713–719) both use
  `grid-template-columns: 1fr 4rem 4rem` and must change together. New classes for the arrow
  buttons and the dimmed row, all `tm-`-prefixed BEM, all in this file — no `<style>` blocks.

**Dependencies:**

- Task 04 → `src/ui/groupOrderUtils.ts`. **Read the real module before writing code** and call its
  actual exports; do not assume function names from this description.
- Task 05 → `src/ui/groupTitle.ts`. Same: read it, then use it. Do not inline
  `group.title || $groupLabels[id]` — Decision 4 exists precisely to keep the rule in one place.
- Task 03 → `Group.title` and `Board.groupOrder` must already exist in `src/data/types.ts`.
- Task 02 → the arrow labels and the group-name column header live in `src/i18n/{types,en,ru}.ts`.
  Look up the actual key names there; if a needed string is missing, add it to all three files
  rather than hardcoding text — the plugin is bilingual.
- Task 07 → the board already renders from `board.groupOrder`, which is what makes a partial save
  chain destructive rather than merely incomplete.

**Edge cases:**

- **Attribute collision.** The overlay does not unmount the board, so the popup row and the board
  wrapper live in the DOM at the same time. Reusing `data-group-id` or `data-group-container` on
  the row would make Playwright strict-mode locators match two elements and turn real assertions
  into silent false passes (Decision 3).
- **The notes row shares `.tm-popup__group-row`** (lines 89–98). If the row grid gains columns, the
  notes row's checkbox lands in the wrong column unless it is handled — either give it its own
  modifier class or add the matching empty cells. Verify visually after the change.
- **Checkbox ordering in existing E2E.** `0006/0007/0008` locate toggles as
  `.tm-popup__group-toggle` `.first()` / `.nth(1)`. Arrows are buttons, not checkboxes, so the
  visibility/full-width indices stay 0 and 1 — keep it that way.
- **Existing E2E rows located by name will break, and that is expected.** `0006-group-visibility`,
  `0007-dynamic-layout` and `0008-card-columns` use
  `.tm-popup__group-row` + `filter({ hasText: 'Focus' })`; once the name becomes an input value,
  `hasText` no longer matches it. Task 09 migrates those locators onto `data-settings-group` —
  that is the intended order, do not pre-fix them here and do not treat the full Playwright run as
  this task's gate. Only `tests/e2e/core.spec.ts` (which does not touch popup rows) is.
- **Whitespace-only name** equals empty: the group falls back to the default localized name.
- **Duplicate names across groups are allowed** — no warning, no validation.
- **Last visible group** still cannot be hidden (`isLastVisible`, line 55) — preserve the disabled
  checkbox and its tooltip.
- **Single visible group** → both arrows disabled on its row.
- **A hidden group's arrows still work**, moving it by immediate list adjacency, so the user can
  pre-place it before turning it back on.
- **Cancel / overlay click** must leave `data.json` untouched — nothing may be written outside
  `handleSave`.
- **A 40-character name** must scroll inside the input rather than wrap or grow the row.

**Implementation hints:**

- Seed local state from the `board` prop the way the existing code does (`[...board.hiddenGroups]`,
  `Object.fromEntries(GROUP_IDS.map(...))`) — copy, never mutate the prop.
- Key the row loop by group id so Svelte reuses row DOM when the order changes.
- Arrows are `<button>` elements with `disabled` bound to the helper's enabled-state result, and
  accessible labels from i18n — not bare characters in a `<span>`.
- Use `{$groupLabels[groupId]}` as the `placeholder` attribute; a placeholder is plain text, so no
  `{@html}` is involved anywhere here.
- For the popup: `max-height: 80vh` plus `overflow-y: auto` is the shape the spec describes. Note
  `.tm-popup` is shared with `GroupSettingsPopup` — check that one still looks right.
- In the unit test, `persist()` is a no-op because `pluginStore` holds `null`, so no Obsidian mock
  is needed. Seed `dataStore` with `dataStore.set(...)` built from `createDefaultBoard` /
  `DEFAULT_DATA` and read it back with `get(dataStore)`.
- Do not touch `EmptyState`, `GroupHeader` or `BoardLayout` — those belong to Tasks 06 and 07.

## Reviewers

- **dev-code-reviewer** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-08-dev-code-reviewer-review.json`
- **dev-security-auditor** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-08-dev-security-auditor-review.json`
- **dev-test-reviewer** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-08-dev-test-reviewer-review.json`

## Post-completion

- [ ] Записать краткий отчёт в [0011-feat-group-customization-decisions.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [ ] Если отклонились от спека — описать отклонение и причину
- [ ] Обновить user-spec/tech-spec если что-то изменилось
