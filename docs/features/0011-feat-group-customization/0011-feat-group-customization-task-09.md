---
status: planned
depends_on: ["07", "08"]
wave: 6
skills: [code-writing]
verify: bash — npx playwright test
reviewers: [dev-test-reviewer, dev-code-reviewer, dev-security-auditor]
teammate_name:
---

# Task 09: Migrate existing E2E locators

## Required Skills

Before starting, load:
- `/skill:code-writing` — [skills/code-writing/SKILL.md](~/.claude/skills/code-writing/SKILL.md)

## Description

The four existing Playwright suites (84 scenarios) locate groups and board-settings rows by
their displayed **English names** — `filter({ hasText: 'Focus' })`, `filter({ hasText: 'Backlog' })`
and the two label constants `COLLAPSIBLE_GROUP_LABELS` / `COLLAPSIBLE_HEADER_TEXT`. Waves 2–4 made
group names user-editable, so those names are no longer a stable addressing key. This task moves the
affected locators onto the two stable identifiers introduced earlier in the feature:

- `data-group-container="<groupId>"` on the board group **wrapper** (Task 07) — present regardless of
  the group's name and regardless of whether a collapsible group is collapsed;
- `data-settings-group="<groupId>"` on the board-settings popup **row** (Task 08).

Two distinct failure classes are being fixed, and they are not equally speculative:

1. **Popup rows — already broken, deterministically.** Task 08 moved the group name out of the row's
   text node into the `value` of a name input. `filter({ hasText })` inspects text content only, so
   every row locator misses its row from the moment Task 08 lands. This is a certain breakage, not a
   probabilistic one — it happens even if nobody ever renames a group.
2. **Collapsed group headers — broken as soon as a name changes.** `expandGroup` in
   [tests/e2e/helpers.ts](tests/e2e/helpers.ts) and `getGroupWrapperClass` in
   [tests/e2e/0007-dynamic-layout.spec.ts](tests/e2e/0007-dynamic-layout.spec.ts) fall back to header
   text precisely because `data-group-id` lives on the group **body**, which is absent from the DOM
   while the group is collapsed. `data-group-container` on the wrapper removes that reason.

`getGroupWrapperClass` additionally climbs to the wrapper with `.locator('..').locator('..')`, so it is
coupled to DOM nesting depth as well as to the name. The wrapper attribute replaces both hops.

**Equally important is what must NOT change.** Every `[data-group-id="X"]` locator that addresses the
group **body** stays exactly as it is — the body keeps its own attribute (Decision 3 of the tech-spec).
Swapping those for the wrapper attribute would break twelve strict-mode assertions loudly and, worse,
would make the four `document.querySelector` helpers in
[tests/e2e/0008-card-columns.spec.ts](tests/e2e/0008-card-columns.spec.ts) return the wrapper instead of
the body and silently read an empty `--tm-card-columns` — a real check turning into a false pass.

This task writes **no new scenarios**. It is done when the whole pre-existing suite is green again.

## What to do

1. Establish a baseline: run the full E2E suite and record which scenarios fail before any edit. After
   Waves 2–4 the popup-row scenarios are expected to be red; anything else that is red is a defect in an
   earlier task, not something to paper over here — report it instead of adapting the test to it.
2. Confirm on the built markup that `data-group-container` sits on the board group wrapper and
   `data-settings-group` on the popup group row, and that each resolves to exactly one element per
   group. If either attribute is missing, stop — the dependency task did not deliver it.
3. **helpers.ts** — remove the `COLLAPSIBLE_GROUP_LABELS` constant and re-point `expandGroup` at the
   collapsible header reached through the group's wrapper attribute. Keep its existing guard: it must
   still be a no-op when the group body is already in the DOM.
4. **0007-dynamic-layout.spec.ts** — remove the `COLLAPSIBLE_HEADER_TEXT` constant and collapse
   `getGroupWrapperClass` into a single wrapper lookup that works identically for `TaskGroup` and
   `CollapsibleGroup` groups, with no `.locator('..')` hops. Change `setFullWidth` to take a group id
   instead of a display name and address its row by the row attribute; update all of its call sites and
   the three inline row locators in the same file.
5. **0006-group-visibility.spec.ts** — change `hideGroup` / `showGroup` to take a group id, address rows
   by the row attribute, and update all call sites, the eight inline row locators, the group-name list in
   the "last visible group" scenario, and the two collapsed-header assertions.
6. **0008-card-columns.spec.ts** — migrate the single popup row locator. Leave the four
   `document.querySelector('[data-group-id=...]')` helpers untouched.
7. **core.spec.ts** — migrate the one collapsed-header click.
8. Verify that no name-based group locator survives anywhere under `tests/e2e/`, and that the full suite
   is green.

## TDD Anchor

<!-- This task writes no new tests. The pre-existing suite IS the anchor: it must be red-then-green
     in the ordinary TDD sense, driven by the locator migration rather than by new assertions. -->

No new scenarios are written. The existing suites are the anchor — each must end green, with the
same scenario count and the same assertions as before:

- `tests/e2e/0006-group-visibility.spec.ts` — 17 scenarios; red before this task (popup rows), green after.
- `tests/e2e/0007-dynamic-layout.spec.ts` — 16 scenarios; red before this task (popup rows), green after.
- `tests/e2e/0008-card-columns.spec.ts` — 16 scenarios; `TC-13` red before this task, green after.
- `tests/e2e/core.spec.ts` — 35 scenarios; must stay green throughout (no popup-row dependency).

Working order per file: run the file, see the failure, migrate the locators in that file, run it again,
see it pass. Do not batch all five files before the first run.

Guard assertions that must hold at the end (check by inspection, not by adding tests):

- Scenario count is unchanged: 84 total.
- No `expect` was weakened, deleted or made conditional to get a suite green.
- No scenario was skipped, `.fixme`'d or renamed.

## Acceptance Criteria

- [ ] `npx playwright test` passes in full — all 84 pre-existing scenarios, no skips, no retries relied upon
- [ ] No locator under `tests/e2e/` addresses a group or a popup row by its displayed name
      (`'Backlog'`, `'Focus'`, `'In Progress'`, `'Org Intentions'`, `'Delegated'`, `'Completed'`)
- [ ] `COLLAPSIBLE_GROUP_LABELS` (helpers.ts) and `COLLAPSIBLE_HEADER_TEXT` (0007) are gone, with no
      replacement name-to-id map left behind
- [ ] `getGroupWrapperClass` reaches the wrapper directly, with no `.locator('..')` hop and no
      per-group-type branch
- [ ] `hideGroup`, `showGroup` and `setFullWidth` take a `GroupId` (typed, not `string`), and every call
      site passes a group id
- [ ] Every `[data-group-id="X"]` locator addressing the group **body** is byte-identical to before —
      including the four `document.querySelector` calls in `0008-card-columns.spec.ts`
- [ ] Scenario count, assertions and scenario names are unchanged; nothing was weakened to reach green
- [ ] No production code under `src/` was modified by this task

## Context Files

**Feature artifacts:**
- [0011-feat-group-customization.md](docs/features/0011-feat-group-customization/0011-feat-group-customization.md) — user-spec
- [0011-feat-group-customization-tech-spec.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-tech-spec.md) — tech-spec (Decision 3 — three distinct test attributes; Testing Strategy — "Existing suites … still pass")
- [0011-feat-group-customization-decisions.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-decisions.md) — decisions log
- [0011-feat-group-customization-code-research.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-code-research.md) — section "Инвентаризация тестов" holds the full line-by-line inventory (groups Б1–Б4 and the untouched category в)

**Project knowledge:**
> This repository has no `.claude/skills/project-knowledge/` directory. Project context lives in the
> repository documentation instead:
- [CLAUDE.md](CLAUDE.md) — conventions, testing checklist, "minimum code that solves the problem"
- [docs/technical.md](docs/technical.md) — data model, group ids, architecture decisions
- [docs/overview.md](docs/overview.md) — product intent behind the six fixed groups

**Code files (modify):**
- [tests/e2e/helpers.ts](tests/e2e/helpers.ts) — drop the label constant, re-point `expandGroup`
- [tests/e2e/0006-group-visibility.spec.ts](tests/e2e/0006-group-visibility.spec.ts) — popup rows + collapsed headers
- [tests/e2e/0007-dynamic-layout.spec.ts](tests/e2e/0007-dynamic-layout.spec.ts) — wrapper lookup + popup rows
- [tests/e2e/0008-card-columns.spec.ts](tests/e2e/0008-card-columns.spec.ts) — one popup row
- [tests/e2e/core.spec.ts](tests/e2e/core.spec.ts) — one collapsed-header click

**Code files (read):**
- [src/ui/BoardLayout.svelte](src/ui/BoardLayout.svelte) — where `data-group-container` is emitted (Task 07)
- [src/ui/BoardSettingsPopup.svelte](src/ui/BoardSettingsPopup.svelte) — where `data-settings-group` is emitted (Task 08)
- [src/data/types.ts](src/data/types.ts) — `GroupId` union and `GROUP_IDS`
- [playwright.config.ts](playwright.config.ts) — harness is served by `node esbuild.harness.mjs --serve`, no separate build step

## Verification Steps

- Baseline, before editing: `npx playwright test` — record the failing scenarios and confirm they are
  the popup-row ones. Unexpected failures are reported, not worked around.
- Per file, while working: `npx playwright test tests/e2e/<file>` — red, migrate, green.
- Final: `npx playwright test` — 84 passed, 0 failed, 0 skipped.
- `grep -rn "hasText: '\(Backlog\|Focus\|In Progress\|Org Intentions\|Delegated\|Completed\)'" tests/e2e/`
  returns nothing.
- `grep -rn "COLLAPSIBLE_GROUP_LABELS\|COLLAPSIBLE_HEADER_TEXT" tests/e2e/` returns nothing.
- `git diff --stat src/` is empty — this task touches tests only.
- `git diff tests/e2e/` reviewed by eye: every removed line is a locator, none is an assertion.

## Details

**Files:**

- `tests/e2e/helpers.ts`
  - L90–93 `COLLAPSIBLE_GROUP_LABELS` — delete. Its own comment ("Uses title text to find the header
    since `[data-group-id]` is only in the body") states the reason it existed; that reason is gone.
  - L99–107 `expandGroup` — keep the `isVisible()` guard on the body, replace the header lookup with one
    scoped to the group's wrapper. The post-click `waitForSelector` on the body stays: it is the signal
    that the expand actually happened.
  - L110–117 `groupAddButton` and L148–155 `openGroupSettings` use `:has([data-group-id="X"])`. They are
    **not** name-based and are **out of scope** — leave them alone (research group Б4).

- `tests/e2e/0007-dynamic-layout.spec.ts`
  - L18–23 `COLLAPSIBLE_HEADER_TEXT` and its comment — delete.
  - L25–38 `getGroupWrapperClass` — becomes a single wrapper lookup returning its `class` attribute.
    Both branches and both `.locator('..')` hops disappear. `isHalf` / `isHalfAlone` / `isFull` keep
    their current bodies.
  - L56–62 `setFullWidth(page, groupName: string, …)` → `(page, groupId: GroupId, …)`, row addressed by
    the row attribute. Call sites: L79, 88, 89, 108, 120, 146, 169, 170, 171, 172, 185, 186, 271.
  - Inline row locators: L99 (`'In Progress'`), L196 (`'Focus'`), L206 (`'Focus'`).
  - L294 (Сц.21) reaches the wrapper via `.tm-task-group:has(...)` + `.locator('..')` for a
    `boundingBox()`. This is the same wrapper-addressing defect the task removes and it sits in the same
    file — migrate it to the wrapper attribute for consistency. The assertion itself is untouched.
  - L176 iterates group ids already — no change needed there.

- `tests/e2e/0006-group-visibility.spec.ts`
  - L19–28 `hideGroup`, L31–39 `showGroup` — parameter becomes `GroupId`, row addressed by the row
    attribute. Call sites: L50, 55, 100, 111, 130, 142, 175, 184, 211, 237, 238, 246, 247.
  - Inline row locators: L66, 69, 77, 88, 165, 192, 194, 225.
  - L155–157 — the `groups` array of display names becomes an array of group ids.
  - L82, L232 — `.tm-collapsible-group__header` filtered by `'Backlog'` → header scoped to the backlog
    wrapper. Note L82's intent: the *header* is visible while the body is not (Backlog is collapsed by
    default), so the assertion must keep targeting the header, not the wrapper or the body.
  - L52, 101, 121, 177, 185 use `.tm-task-group:has([data-group-id="X"])` — not name-based, out of scope.

- `tests/e2e/0008-card-columns.spec.ts`
  - L204 — the only popup row locator in the file (`'Org Intentions'`).
  - L25, 35, 43, 183 `document.querySelector('[data-group-id="…"]')` — **must not be touched**. They read
    `style.getPropertyValue('--tm-card-columns')` and `classList` from the group **body**. Pointing them
    at the wrapper would return an empty string and a missing class with no visible error.

- `tests/e2e/core.spec.ts`
  - L251 — `.tm-collapsible-group__header` filtered by `'Backlog'`, clicked to collapse the group. Scope
    it to the backlog wrapper. Every other locator in this file addresses cards, bodies or button text
    and stays as is.

**Dependencies:**
- Task 07 — `data-group-container` on the board group wrapper. Without it, step 3–7 have nothing to
  point at.
- Task 08 — `data-settings-group` on the popup group row, and the popup rendering rows in the board's
  configured order.
- No new npm packages. No changes under `src/`.

**Edge cases:**
- **Popup and board coexist in the DOM.** The settings overlay does not unmount the board, so a popup
  row locator must be scoped by the row attribute alone — never by a selector that could also match a
  board element. This is exactly why Decision 3 gave the row its own attribute name.
- **Notes row.** `.tm-popup__group-row` is also used by the Notes row, which is not a group and carries
  no `data-settings-group`. Row locators must therefore key on the attribute, not on row position. A
  quick sanity check: exactly six elements match `[data-settings-group]`.
- **Two checkboxes per row.** Scenarios use `.tm-popup__group-toggle` `.first()` (visibility) and
  `.nth(1)` (full width). Task 08 adds a name input and move arrows to the row — confirm those did not
  land with the `tm-popup__group-toggle` class, or the index meaning silently shifts.
- **Row order is now configurable.** Rows follow the board's `groupOrder` after Task 08. Nothing may
  address a row by index; attribute lookups are order-independent by construction.
- **Scrollable popup body.** Task 08 makes the popup body scroll. Playwright auto-scrolls before
  clicking, so no manual scroll is needed — but if a click times out on a row, that is a real layout
  defect in Task 08, not something to fix with a forced click.
- **Collapsed vs hidden.** A collapsed group has a wrapper but no body; a hidden group has neither.
  `not.toBeVisible()` passes for a missing element, so hidden-group assertions keep working after the
  migration — do not "fix" them into `toHaveCount(0)`.
- **`expandGroup` on a non-collapsible group.** A `TaskGroup` body is always in the DOM, so the
  `isVisible()` guard returns early and the header lookup is never reached. Preserve that ordering, or
  the helper starts timing out on `focus`.
- **`0011-group-customization.spec.ts` does not exist yet** — it arrives in Wave 6 (Task 10). A full-suite
  run at this point covers four files.

**Implementation hints:**
- The line-by-line inventory in the code-research doc (section "Инвентаризация тестов", groups Б1, Б2, Б3
  and the untouched category в) is the checklist for this task. Work through it rather than grepping
  from scratch.
- Type the migrated helper parameters as `GroupId` (already imported in `helpers.ts` and
  `0007-dynamic-layout.spec.ts`, needs importing in `0006-group-visibility.spec.ts`). A typed parameter
  makes a missed call site a compile error rather than a runtime timeout.
- `0008-card-columns.spec.ts` uses plain `string` group ids in its own helpers today. Leave that as is —
  retyping them is unrequested scope.
- Do not introduce a shared "group id → display name" map anywhere; reintroducing names as an addressing
  layer defeats the whole task.
- Keep the diff to locators. If a scenario fails for a reason other than its locator, that is a finding
  about Tasks 06–08 — report it, do not absorb it into the test.
- Playwright strict mode is the friend here: if a migrated locator matches two elements the run fails
  loudly. Do not silence it with `.first()` — investigate what the second match is.

## Reviewers

- **dev-test-reviewer** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-09-dev-test-reviewer-review.json`
- **dev-code-reviewer** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-09-dev-code-reviewer-review.json`
- **dev-security-auditor** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-09-dev-security-auditor-review.json`

## Post-completion

- [ ] Записать краткий отчёт в [0011-feat-group-customization-decisions.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-decisions.md) (Summary: 1–3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [ ] Если отклонились от спека — описать отклонение и причину (в частности, если пришлось тронуть что-то за пределами списка локаторов)
- [ ] Обновить user-spec/tech-spec если что-то изменилось
