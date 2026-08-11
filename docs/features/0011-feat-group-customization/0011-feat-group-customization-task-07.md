---
status: done                       # planned -> in_progress -> done
depends_on: ["01", "03", "06"]     # ID задач-зависимостей (строки: ["01", "02"])
wave: 4                            # волна параллельного выполнения
skills: [code-writing]             # МАССИВ скиллов для загрузки
verify: bash — `npm run build` и `npx playwright test tests/e2e/0007-dynamic-layout.spec.ts`
reviewers: [dev-code-reviewer, dev-security-auditor, dev-test-reviewer]  # явно указать. Пусто = fallback на defaults
teammate_name:                     # имя агента-исполнителя (опционально; если не задано — генерируется по описанию задачи)
---

# Task 07: Board renders in configured order

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:code-writing` — [skills/code-writing/SKILL.md](~/.claude/skills/code-writing/SKILL.md)

## Description

This is the central task of the feature: the board must render its groups in the order stored
in `board.groupOrder` (added by Task 3) instead of the hardcoded sequence it uses today.

The order is applied through the CSS `order` property on the existing group wrappers — **not**
by reordering DOM nodes (tech-spec Decision 1). The six literal `{#if !hidden.has('<id>')}`
blocks in `BoardLayout.svelte` (lines 181–271) stay exactly where they are and must **not** be
collapsed into an `{#each}` loop.

Why this constraint exists: rebuilding the markup into a loop would recreate the wrapper
elements, and Svelte would tear down and re-create the group bodies inside them. Those bodies
carry `use:useSortable` ([TaskGroup.svelte:32](src/ui/TaskGroup.svelte),
[CollapsibleGroup.svelte:68](src/ui/CollapsibleGroup.svelte)), so every SortableJS instance
would be destroyed on reorder and drag & drop — the functionality CLAUDE.md names critical —
would break. Changing the value of a `style` attribute does not recreate a DOM node, so the
instances survive. The approach was verified empirically in Chromium against a reproduction of
the real grid: visual order follows the `order` values, half-width pairs still pack into one
row even when separated in the DOM, and both `grid-column: 1 / -1` and `span 1` behave
correctly (code-research, section U1).

Two supporting changes come with it. Each wrapper gets a stable test attribute
`data-group-container` so tests can address the wrapper without depending on the group's
(now user-editable) name or on its collapsed state. And the notes container gets an explicit
`order` value, because an element without `order` computes to `0` and would float above every
group once the groups receive positive values — this reproduced in the research probe
(tech-spec Decision 2).

After this task the order is not yet user-editable (that is Task 8), so on real data the board
must look **exactly as it does today** — `groupOrder` still holds the default sequence.

## What to do

1. Derive the rendered group sequence from `board.groupOrder` instead of the local
   `GROUP_ORDER` constant ([BoardLayout.svelte:23–27](src/ui/BoardLayout.svelte)), still
   filtered by `board.hiddenGroups`, still mapped to `{ id, fullWidth }`.
2. Feed that ordered array into `computeGroupClasses` unchanged. The function is already
   order-agnostic — **do not modify its body**; it only has to receive a pre-sorted array.
3. Derive, from the same ordered array, a per-group `order` value and write it as an inline
   style on each of the six wrapper `div`s (lines 182, 198, 213, 228, 243, 258). Classes and
   `order` must come from the same array so pairing and position cannot diverge.
4. Give each of those six wrappers a `data-group-container` attribute holding the group id.
   It must **not** be named `data-group-id` — that attribute already exists on the group
   *body* and reusing it would match two elements per group.
5. Give `.tm-board-layout__notes` in [src/styles.css:86–88](src/styles.css) an explicit `order`
   value higher than any group's, so the notes block stays below all groups.
6. Remove the stale header comment in
   [src/ui/boardLayoutUtils.ts:3–4](src/ui/boardLayoutUtils.ts) ("зависит от фиксированного
   порядка групп… переработать"). The condition it describes arrives with this feature and its
   claim is false — the function is order-agnostic. Leaving it would mislead the next reader.
7. Extend `tests/unit/boardLayoutUtils.test.ts` with cases proving the class computation holds
   for an arbitrary (non-default) group order.

Everything inside the six wrappers is out of scope: callbacks, the `CollapsibleGroup` vs
`TaskGroup` split, `onAdd={null}` on `completed` — none of it changes.

## TDD Anchor

<!-- Fill if task includes writing code. For non-code tasks (user instructions, deploy, config) — delete this section. -->

Тесты, которые нужно написать ДО реализации. Пишем → запускаем → убеждаемся что падают → пишем код → убеждаемся что проходят.

**Be honest about what these tests can and cannot prove.** They call the pure
`computeGroupClasses` directly with a hand-built array; they never render the component and
therefore never observe the wiring inside `BoardLayout.svelte`. They pin down the *function's*
contract — that its output follows array position rather than group identity — and nothing more.
The central claim of this task, that the array fed to it actually comes from `board.groupOrder`,
is **not** covered by any unit test here. That claim is checked by `npm run build`, by the
manual harness run in Verification Steps (computed `order` values and geometry on a seeded
reversed `groupOrder`), and by the E2E scenarios of Task 10. Do not treat a green unit suite as
evidence that the ordering works.

The unit-testable surface here is the class computation over a reordered array (the component
itself is untestable in this project — `vitest.config.ts` sets `environment: 'node'` and there
is no DOM testing library). The file lands in `tests/unit/` via Task 1.

- `tests/unit/boardLayoutUtils.test.ts::произвольный порядок — соседние half образуют пару` —
  input `[completed(full), focus(half), inProgress(half), backlog(full)]`: `focus` and
  `inProgress` both get `--half`, the two full ones get `--full`. Proves pairing follows array
  position, not group identity.
- `tests/unit/boardLayoutUtils.test.ts::перестановка разрывает пару — оба half становятся alone` —
  input `[focus(half), backlog(full), inProgress(half)]`: `focus` and `inProgress` both get
  `--half-alone`. Same three groups as the default layout, different order, different result —
  so a regression that made the function key off group identity instead of array position would
  fail here. It says nothing about whether the component passes an ordered array in.
- `tests/unit/boardLayoutUtils.test.ts::произвольный порядок — одинокий half в конце` —
  input `[completed(full), delegated(half)]`: `delegated` gets `--half-alone`.

Behavioural coverage of the rendered order (computed `order` values, on-screen geometry,
drag & drop across reordered groups) belongs to Task 10 — do not create
`tests/e2e/0011-group-customization.spec.ts` here. Until Task 10 lands, the manual harness check
below is the only end-to-end evidence that the wiring works; do not skip it.

## Уточнение по итогам волны 2

Санитайзер порядка групп гарантирует, что порядок — валидная перестановка известных
идентификаторов. Он НЕ гарантирует, что соответствующий объект группы существует: доску с
руками удалённым ключом группы миграция не восстанавливает, воссоздание группы было
сознательно отвергнуто как незапрошенное упрочнение. Значит обращение к группе по
идентификатору из порядка теоретически может дать пустое значение.

Решение принять здесь: либо отрисовывать только те идентификаторы порядка, для которых объект
группы фактически есть, либо сознательно принять падение на таком файле и записать это
решение. Первое дешевле и согласуется с принципом «доска обязана открыться», ради которого
писался санитайзер.

Также учесть: после загрузки сохранённое название группы всегда строка, обрезанная по краям и
ограниченная по длине — отдельная проверка типа в компоненте не нужна.

## Acceptance Criteria

- [x] `BoardLayout.svelte` derives its group sequence from `board.groupOrder`, filtered by
      `board.hiddenGroups`; the hardcoded `GROUP_ORDER` constant no longer drives rendering
- [x] The six literal `{#if}` blocks are still present and literal — no `{#each}` over groups,
      DOM order of the wrappers unchanged
- [x] Every rendered wrapper carries an inline `order` value matching its position in the
      configured visible sequence; no wrapper ever renders with an empty or `undefined` order
- [x] Every rendered wrapper carries `data-group-container` with its group id
- [x] Within `src/`, `data-group-container` appears **only** on the six wrappers in
      `BoardLayout.svelte` — `grep -rn "data-group-container" src/` returns nothing else.
      (The criterion is deliberately scoped to `src/`: Task 9 will start using this attribute in
      `tests/e2e/`, so a codebase-wide "used nowhere else" check would be unsatisfiable later.)
- [x] `data-group-id` still exists on exactly one element per group (the group body):
      `page.locator('[data-group-id="X"]')` resolves to a single element
- [x] `.tm-board-layout__notes` has an explicit `order` greater than any group's; the notes
      block renders below all groups
- [x] `computeGroupClasses` body is unchanged; only its stale header comment is removed
- [x] `tests/unit/boardLayoutUtils.test.ts` covers an arbitrary group order; `npm test` green
- [x] `npm run build` succeeds
- [x] `npx playwright test tests/e2e/0007-dynamic-layout.spec.ts` passes with the spec file
      **unmodified** (locator migration is Task 9)
- [x] With a non-default `groupOrder` seeded into the store, a task can be dragged between two
      reordered groups in both directions without reloading

## Context Files

**Feature artifacts:**
- [0011-feat-group-customization.md](docs/features/0011-feat-group-customization/0011-feat-group-customization.md) — user-spec
- [0011-feat-group-customization-tech-spec.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-tech-spec.md) — tech-spec (Decisions 1, 2, 3, 11, 12; Task 7)
- [0011-feat-group-customization-decisions.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-decisions.md) — decisions log
- [0011-feat-group-customization-code-research.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-code-research.md) — sections **U1** (CSS `order` probe, notes trap, side effects) and **U2** (wrapper attribute, why `data-group-id` cannot be reused, test inventory)

**Project knowledge:**
> Note: this project has no `.claude/skills/project-knowledge/` directory. Project context lives in the repo docs below.
- [CLAUDE.md](CLAUDE.md) — CSS conventions (`tm-` prefix, BEM, all styles in `src/styles.css`), Svelte conventions, drag & drop "Cancel + Update" contract
- [docs/overview.md](docs/overview.md) — product vision, board and group model
- [docs/technical.md](docs/technical.md) — technical decisions, data model, layout

**Code files:**
- [src/ui/BoardLayout.svelte](src/ui/BoardLayout.svelte) — ordered source array, `order` style and `data-group-container` on the six wrappers
- [src/ui/boardLayoutUtils.ts](src/ui/boardLayoutUtils.ts) — remove the stale header comment only
- [src/styles.css](src/styles.css) — explicit `order` on `.tm-board-layout__notes`
- [tests/unit/boardLayoutUtils.test.ts](tests/unit/boardLayoutUtils.test.ts) — arbitrary-order cases (file moved here by Task 1)
- [src/ui/useSortable.ts](src/ui/useSortable.ts) — read-only: why wrappers must not be recreated
- [src/ui/TaskGroup.svelte](src/ui/TaskGroup.svelte) — read-only: `data-group-id` on `.tm-task-group__body` (line 31)
- [src/ui/CollapsibleGroup.svelte](src/ui/CollapsibleGroup.svelte) — read-only: `data-group-id` on `.tm-collapsible-group__body` (line 67), absent from DOM when collapsed
- [tests/e2e/0007-dynamic-layout.spec.ts](tests/e2e/0007-dynamic-layout.spec.ts) — read-only: reaches the wrapper via `.locator('..')` from the body / header; must keep passing untouched

## Verification Steps

<!-- How to verify task is complete. For code — run tests. For deploy — check logs. For user-action — user confirmation. -->

- `npm test` — unit suite green, including the new arbitrary-order cases in
  `tests/unit/boardLayoutUtils.test.ts`.
- `npm run build` — production build succeeds. **This is the type gate for this task.**
  `npx tsc --noEmit` silently ignores `.svelte` files (tech-spec Decision 11), so a broken
  component would pass it; do not report a clean `tsc` as evidence the component compiles.
- `npx playwright test tests/e2e/0007-dynamic-layout.spec.ts` — all scenarios pass with the
  spec file unmodified. This is the regression gate for the layout classes.
- `grep -rn "data-group-container" src/` — hits only `src/ui/BoardLayout.svelte`, six times.
  Scoped to `src/` on purpose: Task 9 adds uses of this attribute under `tests/e2e/`.
- `npx playwright test tests/e2e/0006-group-visibility.spec.ts tests/e2e/0008-card-columns.spec.ts tests/e2e/core.spec.ts` —
  cheap confirmation that the new wrapper attribute did not collide with `data-group-id`.
  A strict-mode violation in 0006/core, or a card-columns assertion reading an empty
  `--tm-card-columns`, means the attribute name was reused. Expected: all green.
- Manual check in the harness (`node esbuild.harness.mjs --serve`, then open
  `http://localhost:5173`): seed a board via `window.__test.resetData(...)` with a reversed
  `groupOrder`, then confirm (a) the visual top-to-bottom order follows `groupOrder`,
  (b) the notes block is still at the bottom, (c) a task drags between two reordered groups in
  both directions without a reload. Compare positions with `getBoundingClientRect()` or read
  the computed `order` — **not** `querySelectorAll` index, which is unchanged by design.

## Details

<!-- All details for task execution — technical, organizational, any other. -->

**Files:**

- `src/ui/BoardLayout.svelte` — current state: line 23 declares a local
  `const GROUP_ORDER: GroupId[] = [...]` duplicating `GROUP_IDS` from `src/data/types.ts:9`;
  lines 25–27 derive `visibleGroups` by filtering that constant against
  `hidden = new Set(board.hiddenGroups)` (line 21) and mapping to `{ id, fullWidth }`; line 28
  computes `groupClasses`. Lines 180–282 hold the markup: six `{#if !hidden.has('<id>')}` blocks,
  each wrapping a bare `<div class={groupClasses['<id>']}>` with **no other attributes**, then
  the `{#if !board.notesHidden}` notes block. Change: swap the source of the ordered array,
  derive a position lookup from it, and add `style` + `data-group-container` to the six wrappers.
- `src/ui/boardLayoutUtils.ts` — current state: two comment lines (3–4) above an already
  order-agnostic function that scans the input array left to right and pairs adjacent
  `fullWidth: false` entries. Change: delete those two comment lines. Nothing else.
- `src/styles.css` — current state: `.tm-board-layout__notes` (lines 86–88) declares only
  `grid-column: 1 / -1`. Change: add an explicit `order`. Note the `@media (max-width: 600px)`
  block at lines 89–94 forces all groups to full width; it does not affect `order`, and order is
  respected in single-column mode too.
- `tests/unit/boardLayoutUtils.test.ts` — current state: five cases (all-full, all-half,
  three-half, `[full, half, full, half]`, single half) using a local `g(id, fullWidth)` helper,
  all in the default group sequence. Change: add the arbitrary-order cases from the TDD Anchor
  in the same style.

**Dependencies:**
- **Task 1** (wave 1) pins Node to `^22.12.0 || >=24.0.0`, makes `npm test` runnable at all and moves the
  board-layout suite into `tests/unit/`. This task extends that suite and runs it, so the
  dependency is declared explicitly in `depends_on` rather than left to arrive transitively
  through Task 3.
- **Task 3** (wave 2) supplies `Board.groupOrder` and the sanitizer that guarantees it is a
  permutation of the six known ids on **every** load, not only during migration. Do not
  re-implement sanitization in the component.
- **Task 6** (wave 3) also edits `src/styles.css` (group header truncation). It completes before
  this task starts, so its changes are already in the file — different section: touch only the
  notes rule, do not reformat or reorder the file, and do not revert anything Task 6 added.
- **Task 8** makes the order user-editable and owns the popup and save chain. Not in scope here.
- **Task 9** migrates existing E2E locators onto `data-group-container`. Do not edit anything
  under `tests/e2e/` in this task.
- No new packages.

**Edge cases:**
- **Attribute name collision.** `data-group-container` must differ from `data-group-id`. If the
  same name were used, each group would match two elements. Thirteen bare `[data-group-id="X"]`
  locators exist in the suite (verified by grep) and every one of them would then resolve to two
  elements:
  - **Twelve loud failures** — `expect()` assertions, which trip Playwright strict mode:
    `0006-group-visibility.spec.ts:95, 108, 112, 120, 199, 200, 240, 284, 285` and
    `core.spec.ts:245, 248, 252`.
  - **One silent failure** — `helpers.ts:100`, where the strict-mode violation is swallowed by
    `.isVisible().catch(() => false)`. `expandGroup` would conclude the group is collapsed and
    click the header, *collapsing* an already-expanded group; the damage would surface later as
    unrelated assertion failures.

  On top of that, four `document.querySelector` calls in `0008-card-columns.spec.ts` (lines 25,
  35, 43, 183) would silently return the wrapper instead of the body and read an empty
  `--tm-card-columns` — a real check turning into a false pass. Descendant locators
  (`[data-group-id="X"] .tm-task-card` and the `:has(...)` forms) are unaffected: CSS matching
  yields each descendant once. Production logic would survive (`useSortable.ts:26–27` reads
  `evt.from/to.dataset.groupId` and Sortable is bound to the body), which is exactly what makes
  the quiet failures quiet.

  Note: tech-spec Decision 3 and Task 9 both quote the older figure of "twelve" for this set.
  Twelve is the count of loud `expect()` assertions; thirteen is the count of bare locator sites.
- **Notes floating to the top.** An element without `order` computes to `0`. With groups at 1…6
  the notes block becomes the *first* grid item; with groups at 0…5 it ties with the first group
  and lands second. Either way it needs an explicit value above every group's, whichever
  numbering base is chosen.
- **Hidden groups.** They are filtered out before ordering, so `order` values are dense over the
  visible groups only. That is what keeps `computeGroupClasses` pairing and visual position
  consistent — both must come from the same array.
- **Missing order value.** A wrapper whose id is absent from the derived sequence would render
  `order: undefined` → computed `0` → jump to the top of the board. Task 3's sanitizer makes this
  unreachable in practice, but the derivation must still be total: every rendered group gets a
  number.
- **Collapsed groups.** `backlog` and `completed` are collapsed by default and their bodies
  (with `data-group-id`) are absent from the DOM. The wrapper and its `data-group-container` are
  present regardless — that is the point of putting the attribute on the wrapper.
- **DOM order stays fixed.** Tab order and screen-reader order keep the original sequence
  (tech-spec Decision 14, accepted). Consequently `.nth()`, `.first()` and `querySelectorAll`
  index are useless for asserting order (Decision 12).
- **`npx tsc --noEmit` does not check `.svelte`** (Decision 11) — the build is the gate.

**Implementation hints:**
- Keep the existing reactive style: one `$:` statement produces the ordered visible array, and
  both `groupClasses` and the position lookup derive from that single array. Deriving them
  separately is how "who pairs with whom" and "who sits where" drift apart.
- The local `GROUP_ORDER` constant on line 23 becomes unused once the board's order drives
  rendering — remove it then (and only then; CLAUDE.md: remove only what your change made unused).
- The inline style goes on the wrapper `div` only. The `class={groupClasses[id]}` binding stays;
  Svelte renders `style` as a plain attribute update, which is precisely why the SortableJS
  instances inside survive.
- For the notes rule pick a value comfortably above six (e.g. `100`) and add a short comment
  saying why it exists, so the next reader does not "clean it up".
- Do not add `data-group-id` to the wrappers under any circumstance, and do not move the existing
  one off the bodies — `useSortable.ts` reads it at runtime.
- Write the unit tests first, watch them fail against the current file, then implement.

## Reviewers

- **dev-code-reviewer** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-07-dev-code-reviewer-review.json`
- **dev-security-auditor** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-07-dev-security-auditor-review.json`
- **dev-test-reviewer** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-07-dev-test-reviewer-review.json`

## Post-completion

- [x] Записать краткий отчёт в [0011-feat-group-customization-decisions.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [x] Если отклонились от спека — описать отклонение и причину
- [x] Обновить user-spec/tech-spec если что-то изменилось
