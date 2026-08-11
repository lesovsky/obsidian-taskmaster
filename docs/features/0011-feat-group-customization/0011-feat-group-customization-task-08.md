---
status: done                    # planned -> in_progress -> done
depends_on: ["02", "03", "04", "05", "07"]     # ID задач-зависимостей (строки: ["01", "02"])
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

One pure module built earlier is consumed here, not reimplemented: `src/ui/groupOrderUtils.ts`
(Task 04), for arrow behavior and arrow-enabled state.

**The name input is an editing field, not a display site, and must not go through the Task 05
helper** (`src/ui/groupTitle.ts`). Its value is the raw stored `board.groups[groupId].title` —
empty for a group that was never renamed — and the localized default appears only as the field's
`placeholder`. Tech-spec Decision 4 now states this explicitly, and the reasoning matters:
routing the field through the helper would put the default name into the field as literal text,
so the placeholder could never be seen (contradicting the user-spec's "Пока поле пустое, в нём
серым показывается дефолтное название" and Сценарий 2), and pressing Save for any reason — even
just toggling one checkbox — would write the current localized defaults into `Group.title` for
all six groups. After that, switching the interface language would stop retranslating them
(contradicting Сценарий 1), and Task 06, which treats any non-empty title as "renamed", would
replace every empty group's meaningful hint with the neutral one.

## What to do

1. **Local state in `BoardSettingsPopup.svelte`.** Add two pieces of local state seeded from the
   `board` prop: a per-group name record holding the **raw stored titles** (copied verbatim,
   empty string when the group was never renamed) and a working copy of the group order. Per
   Decision 13 the name record is called `groupTitles` — the existing local `title` keeps meaning
   *the board's* title, and that word must not acquire a second meaning in this component.
2. **Render rows in the board's order.** Replace the `{#each GROUP_IDS as groupId}` iteration
   (line 52) with an iteration over the local order copy, keyed by group id. Hidden groups stay at
   their own index — no partitioning, no sorting visible-first.
3. **Row layout.** Each group row becomes, left to right: move-up/move-down arrows, name input,
   task counter (still only when the count is above zero), visibility toggle, full-width toggle.
   The existing column header row gains matching cells so the two stay aligned.
4. **Name input.** Its value is the **raw** stored title — `board.groups[groupId].title` as it
   sits in `data.json`, which is an empty string for every group the user has never renamed. Its
   placeholder is the default localized name from `$groupLabels[groupId]`, so an untouched row
   shows that default in grey while the field itself stays empty. Input is capped at 40
   characters via `maxlength`. Clearing the field means "return to the default name".
   **Do not call `src/ui/groupTitle.ts` here** — that helper belongs to display sites (Task 06)
   only; see Decision 4 and the Description above.
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
    storing it on the group — an empty or whitespace-only name is stored as `''`, never replaced
    by a default. Write the order onto the board **as given**, without sanitizing it (see Edge
    cases). Keep `persist()` at the end. The input's `maxlength` is not the enforcement point —
    Decision 7 puts title normalization at the store boundary.
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
- `tests/unit/dataStore.test.ts::updateBoard keeps an empty group title empty` — saving `''` for
  every group leaves all six `title` fields `''`; nothing substitutes a default name at the store
  boundary. This is the store-side half of the "save without editing keeps titles empty" rule.
- `tests/unit/dataStore.test.ts::updateBoard stores the supplied group order` — `board.groupOrder`
  equals the array handed in, not the default one.
- `tests/unit/dataStore.test.ts::updateBoard still writes the pre-existing fields` — title,
  subtitle, hiddenGroups, notesHidden and per-group fullWidth keep their current behavior after
  the signature change (regression guard for the chain edit).

## Дополнительное требование, выявленное при выполнении волны 2

Список скрытых групп доски нигде не санируется. Миграция трогает это поле только в
исторической ветке и только при строго отсутствующем значении, поэтому на текущих данных оно
не проверяется вовсе. Попап копирует его в локальное состояние спредом при инициализации —
и на повреждённом значении (например, `null` после ручной правки файла данных) падает там же,
до того как управление дойдёт до логики перестановки. Это делает бесполезной защиту внутри
чистых функций: они получают управление слишком поздно.

Требование: при инициализации локального состояния попап должен принимать список скрытых
групп в любом виде и приводить его к массиву известных идентификаторов — по тому же принципу,
по которому загрузка данных обходится с порядком групп. Симметрия здесь не косметическая:
оба поля хранят идентификаторы групп, оба правятся руками в файле данных, и оба ведут к
пустому экрану вместо доски.

Также учесть контракт функций перестановки: если на вход придёт не массив, перенос вернёт
пустой массив — единственный случай, когда результат не совпадает со входом при отрицательном
предикате. Записывать результат перестановки только когда предикат вернул истину.

## Acceptance Criteria

- [x] Every group row in the board settings popup has a name input and a pair of move arrows.
- [x] The name input holds the raw stored title — it is **empty** for a group that was never
      renamed — shows the default localized name as its grey placeholder, and refuses input
      beyond 40 characters.
- [x] Opening the popup and saving without editing any name leaves every `Group.title` empty in
      `data.json` (verifiable by inspecting the persisted board), so untouched groups keep
      falling back to their localized defaults and still retranslate on a language switch.
- [x] Clearing a name and saving returns the group to its default localized name.
- [x] Rows are rendered in `board.groupOrder`; hidden groups keep their positions instead of
      moving to the end, and the order survives reopening the popup.
- [x] A visible group's arrow swaps it with the nearest *visible* neighbour, skipping hidden ones;
      a hidden group's arrow swaps it with its immediate list neighbour.
- [x] An arrow is disabled when there is nowhere to move in that direction; a single visible group
      has both arrows disabled.
- [x] Toggling visibility changes both the row's dimming and its arrow behavior immediately,
      without saving.
- [x] Each group row carries `data-settings-group="{groupId}"`, and that attribute name is used
      nowhere else in the codebase.
- [x] With all rows present the popup stays inside the viewport and its body scrolls vertically.
- [x] Save writes names and order to `data.json`; Cancel and an overlay click discard both.
- [x] `updateBoard` trims titles and caps them at 40 characters regardless of the entry point, and
      calls `persist()`.
- [x] The task counter still appears only when a group has more than zero tasks.
- [x] Existing visibility and full-width toggles keep working, including the "last visible group
      cannot be hidden" rule.
- [x] `npm run build`, `npm test`, `npx playwright test tests/e2e/core.spec.ts` and
      `npx tsc --noEmit` all pass, in that order.

## Context Files

**Feature artifacts:**
- [0011-feat-group-customization.md](docs/features/0011-feat-group-customization/0011-feat-group-customization.md) — user-spec (see "Формы и ввод данных", "UX-поведение", "Граничные случаи")
- [0011-feat-group-customization-tech-spec.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-tech-spec.md) — tech-spec (Decisions 3, 4, 5, 6, 7, 13; Backward Compatibility)
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
- [src/styles.css](src/styles.css) — the `.tm-popup__group-header` and `.tm-popup__group-row` grids, `max-height`/scroll on `.tm-popup`, plus new arrow and dimmed-row styles. Locate these by selector name, not by line number — Tasks 06 and 07 edit this same file in earlier waves
- [src/ui/groupOrderUtils.ts](src/ui/groupOrderUtils.ts) — read: arrow move + enabled-state functions (Task 04)
- [src/ui/groupTitle.ts](src/ui/groupTitle.ts) — read only, to understand the display-side rule; **not called from this task** (Decision 4)
- [src/data/types.ts](src/data/types.ts) — read: `Group.title`, `Board.groupOrder`, `GROUP_IDS`
- [src/i18n/index.ts](src/i18n/index.ts) — read: `t` and `groupLabels` stores
- [tests/unit/migration.test.ts](tests/unit/migration.test.ts) — read: existing unit-test style

## Verification Steps

- `npm run build` — production build succeeds. This is the **primary** gate: `.svelte` files have
  no static type check (Decision 11), so the build is the only thing that catches component
  errors. Run it first.
- `npm test` — the whole unit suite passes, including the new `tests/unit/dataStore.test.ts`.
- `npx playwright test tests/e2e/core.spec.ts` — passes.
- `npx tsc --noEmit` — clean. Run it after the build: it does **not** check `.svelte` files
  (Decision 11), so it only covers the `dataStore.ts` half of the change and a green result here
  says nothing about the popup.
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
- `src/styles.css` — **find every block below by selector name, not by line number.** Tasks 06
  (group-title truncation) and 07 (`order` on the notes block) edit this same file in earlier
  waves, so any line number quoted here would already have drifted by the time this task runs.
  - `.tm-popup` — currently declares neither `max-height` nor `overflow`; add both.
  - `.tm-popup__group-header` and `.tm-popup__group-row` — both currently declare
    `grid-template-columns: 1fr 4rem 4rem` and must change together, or the header cells stop
    lining up with the row cells.
  - New classes for the arrow buttons and the dimmed row: all `tm-`-prefixed BEM, all in this
    file — no `<style>` blocks.

**Dependencies:**

- Task 04 → `src/ui/groupOrderUtils.ts`. **Read the real module before writing code** and call its
  actual exports; do not assume function names from this description.
- Task 05 → `src/ui/groupTitle.ts`. **Read it for context, do not call it from this component.**
  The helper resolves a name for *display*; the popup's field is for *editing* and binds the raw
  stored title with the localized default as placeholder (Decision 4). Nor should the rule be
  inlined as `group.title || $groupLabels[id]` here — there is no fallback to apply in an editing
  field at all.
- Task 03 → `Group.title` and `Board.groupOrder` must already exist in `src/data/types.ts`.
- Task 02 → the arrow labels and the group-name column header live in `src/i18n/{types,en,ru}.ts`.
  Task 02 fixes their names: `boardSettings.groupName` (column header), `boardSettings.moveUp`,
  `boardSettings.moveDown` (arrow labels). Use exactly these — do **not** invent a variant or add
  a near-duplicate next to an existing key. Verify they are present (`grep -n "boardSettings\.\(groupName\|moveUp\|moveDown\)" src/i18n/types.ts src/i18n/en.ts src/i18n/ru.ts`);
  if any is missing, **stop and report the blocker** rather than adding it here — same policy as
  Task 06 follows for `emptyState.renamed`. Never hardcode the text: the plugin is bilingual.
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
- **An untouched name stays empty.** Saving the popup for any other reason — a visibility toggle,
  a full-width toggle, a board-title edit — must not turn empty titles into stored defaults. This
  follows automatically as long as the field binds the raw title (step 4) and `updateBoard` only
  trims and caps what it is given.
- **`groupOrder` is written to the store without sanitization, and that is intentional** — the
  asymmetry with titles (which *are* normalized right next to it) is deliberate, not an
  oversight. The popup can only ever produce a permutation of the six known ids, and Task 03
  sanitizes the field on every load, outside any version branch (Decision 6), so damaged data is
  repaired at the entry point that actually sees untrusted input. Do not duplicate that sanitizer
  inside `updateBoard`.
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
  `Object.fromEntries(GROUP_IDS.map(...))`) — copy, never mutate the prop. For `groupTitles` the
  seeded value is `board.groups[id].title` verbatim (`?? ''` only as a defensive default), with
  no resolution step in between.
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

- [x] Записать краткий отчёт в [0011-feat-group-customization-decisions.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [x] Если отклонились от спека — описать отклонение и причину
- [x] Обновить user-spec/tech-spec если что-то изменилось
