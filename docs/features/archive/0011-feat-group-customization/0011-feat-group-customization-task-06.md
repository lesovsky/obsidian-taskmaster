---
status: done                       # planned -> in_progress -> done
depends_on: ["02", "03", "05"]     # ID задач-зависимостей (строки: ["01", "02"])
wave: 3                            # волна параллельного выполнения
skills: [code-writing]             # МАССИВ скиллов для загрузки
verify: bash                       # инструмент верификации (опционально: curl, bash, user)
reviewers: [dev-code-reviewer, dev-security-auditor, dev-test-reviewer]  # явно указать. Пусто = fallback на defaults
teammate_name:                     # имя агента-исполнителя (опционально; если не задано — генерируется по описанию задачи)
---

# Task 06: Group name display

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:code-writing` — [skills/code-writing/SKILL.md](~/.claude/skills/code-writing/SKILL.md)

## Description

Wave 2 produced the data (`Group.title`, Task 03) and the pure rule that turns a stored title
plus a localized default into a displayed name (`src/ui/groupTitle.ts`, Task 05); wave 1 produced
the localization keys (Task 02). Nothing on the board uses any of it yet: all four display sites
still read `$groupLabels[groupId]` directly, so a renamed group would look exactly like a default
one.

This task wires the resolved name into every place a group name is shown on the board and makes
the header survive a maximum-length name.

Three sites already receive `group` (or `groupId` + `group`) and need no new props — only a
change of what they render:
- `GroupHeader.svelte:17` — the title of a normal group;
- `CollapsibleGroup.svelte:39` — the title of a collapsible group (backlog, completed);
- `GroupSettingsPopup.svelte:27` — the heading of that group's own settings popup.

`EmptyState.svelte` is the one component that needs a new prop. Today it only knows `groupId`
and derives the hint key as `emptyState.{groupId}`. Those hints are semantic — the Focus hint
asks "What needs your attention right now?". Once a user renames Focus to «Долгострой», that
hint is no longer merely stale, it contradicts what the group is now for. So a renamed group
must show `emptyState.renamed` — the neutral key added by Task 02 — instead. `EmptyState` is
rendered from exactly two places (`TaskGroup.svelte:36` and `CollapsibleGroup.svelte:72`), and
both parents already hold `group` — hence both are in this task's file list.

**Where the "is this group renamed?" rule lives.** In exactly one place: inside
`EmptyState.svelte`. The new prop carries the *stored title string* (`group.title`), not a
precomputed boolean, and `EmptyState` itself decides neutral vs semantic with a single
`.trim() !== ''` check. Neither parent evaluates renamed-ness, and `src/ui/groupTitle.ts` is not
extended with a predicate — Task 05's acceptance criteria require it to export exactly one
function and explicitly forbid a second export, so there is no helper to reuse and none is to be
added. One check, one component, no duplication.

Finally, the header row must tolerate a 40-character name (the cap enforced by Task 03). Right
now `.tm-group-header__title` and `.tm-collapsible-group__title` set only font properties — no
`overflow`, no `text-overflow`, and no `min-width: 0` on the flex items — so a long name pushes
the task counter and the settings/add buttons out of the row. Truncating the title is only half
the fix: in both headers the counter and the two action controls also lack `flex-shrink: 0`, so
without it the browser is free to squeeze them instead of the title. That is eight selectors in
`src/styles.css` — four per header — not the two title blocks alone.

The feature's own E2E coverage is **not** written here: renaming is not reachable through the UI
until the settings popup lands in Task 08, and `tests/e2e/0011-group-customization.spec.ts`
belongs to Task 10. This task's gate is a production build plus the existing `core.spec.ts`
staying green.

## What to do

1. Replace the direct `$groupLabels[groupId]` read with the resolved name in `GroupHeader.svelte`,
   `CollapsibleGroup.svelte` and `GroupSettingsPopup.svelte`, using the helper from
   `src/ui/groupTitle.ts`. The localized default stays the fallback argument, so a group with an
   empty stored title looks and translates exactly as it does today.
2. Give `EmptyState.svelte` one new prop carrying the group's stored title, and have the component
   itself decide the hint key: `emptyState.renamed` when the title is non-empty after `trim()`,
   the existing `emptyState.{groupId}` otherwise. This trimmed check is the single definition of
   "renamed" in the codebase — do not duplicate it in the parents and do not add a predicate to
   `src/ui/groupTitle.ts`.
3. Pass that prop from both render sites — `TaskGroup.svelte` and `CollapsibleGroup.svelte` —
   sourcing it from the `group` each already has.
4. In `src/styles.css`, make both header rows survive a 40-character name: truncate the two title
   styles with an ellipsis, and pin the counter and both action controls in each header with
   `flex-shrink: 0` so they cannot be squeezed instead. Eight selectors in total, four per header.
5. Verify with a production build and the existing core E2E suite.

## TDD Anchor

**This task adds no new automated test, and that is deliberate — read why before assuming it is an omission.**

Everything this task touches is a `.svelte` component or a CSS rule. `vitest.config.ts` sets
`environment: 'node'` and the project has no DOM testing library, so component markup cannot be
unit-tested here at all (tech-spec Decision 4). The pure rule these components consume is already
unit-covered by Task 05 in `tests/unit/groupTitle.test.ts` — re-asserting it from a component
would test nothing new.

The feature's own scenarios (rename → name appears on the board, in the collapsed header and in
the group popup; cleared title → default returns; 40-character name does not break the header)
are E2E, they need the settings popup from Task 08 to be reachable through the UI, and they are
owned by Task 10 in `tests/e2e/0011-group-customization.spec.ts`. **Do not create that file here**
— doing so would collide with Task 10 and produce tests that cannot rename anything yet.

The regression anchor for this task is the pre-existing suite, used in the TDD spirit:

- `tests/e2e/core.spec.ts` — run it **before** touching any file, confirm it is green, so a later
  failure is unambiguously yours. It exercises both display sites this task rewrites:
  `.tm-group-header__counter` alongside the title in the normal header, and a collapsible header
  located by its visible text `Backlog`. Since every group ships with an empty stored title, the
  resolved name must remain byte-identical to `$groupLabels[groupId]` — if this suite goes red,
  the fallback path is wrong.

## Acceptance Criteria

- [ ] `GroupHeader`, `CollapsibleGroup` and `GroupSettingsPopup` show the group's resolved name
      via the Task 05 helper — no direct `$groupLabels[groupId]` read remains as the displayed
      name in these three components
- [ ] With an empty stored title all three sites render exactly the localized default they render
      today, and still switch language when the plugin language changes
- [ ] A group whose stored title is non-empty shows that title on the board, in the collapsed
      header and in the heading of its own settings popup
- [ ] `EmptyState` takes one new prop and renders `emptyState.renamed` for a renamed group, the
      existing `emptyState.{groupId}` hint otherwise
- [ ] The renamed-check is written **once**, inside `EmptyState.svelte`, as a `trim()`-based test
      on the stored title — grep confirms no second renamed/emptiness check in `TaskGroup.svelte`,
      `CollapsibleGroup.svelte` or any other component, and `src/ui/groupTitle.ts` is unchanged
      (still exactly one export, per Task 05)
- [ ] That check uses the same emptiness rule as `src/ui/groupTitle.ts` (empty after `trim()` =
      not renamed), so name and hint can never disagree. The rule itself is already unit-covered
      by Task 05 in `tests/unit/groupTitle.test.ts` — it is not re-tested here, and a
      whitespace-only stored title is not reachable through the interface anyway, since Task 03
      normalizes titles both on save (`updateBoard`) and on load (migration sanitizer)
- [ ] Both `EmptyState` render sites (`TaskGroup.svelte`, `CollapsibleGroup.svelte`) pass the new
      prop; no call site is left on the old signature
- [ ] A 40-character name in either header type is truncated with an ellipsis; the task counter
      and the settings/add buttons stay visible on the same row and are not pushed out
- [ ] In both headers the counter and both action controls carry `flex-shrink: 0`, so the title is
      what shrinks — eight selectors changed in `src/styles.css` (two titles + counter and two
      controls per header), not just the two title blocks
- [ ] All new/changed CSS lives in `src/styles.css`, uses the `tm-` prefix, and no `<style>` block
      is added to any component
- [ ] Names are rendered by interpolation only — no `{@html}` anywhere
- [ ] `npm run build` succeeds
- [ ] `npx playwright test tests/e2e/core.spec.ts` passes

## Context Files

**Feature artifacts:**
- [0011-feat-group-customization.md](0011-feat-group-customization.md) — user-spec (see «Пустая группа» in Edge cases, and the acceptance checklist)
- [0011-feat-group-customization-tech-spec.md](0011-feat-group-customization-tech-spec.md) — tech-spec (Decisions 4 and 11; Task 6 row of the verification plan)
- [0011-feat-group-customization-decisions.md](0011-feat-group-customization-decisions.md) — decisions log
- [0011-feat-group-customization-code-research.md](0011-feat-group-customization-code-research.md) — code research

**Project knowledge:**
> This project has no `.claude/skills/project-knowledge/` directory. Project context lives in:
- [CLAUDE.md](../../../CLAUDE.md) — conventions: `tm-` prefix, BEM, styles only in `src/styles.css`, no `{@html}`, no scoped `<style>`
- [docs/technical.md](../../technical.md) — technical decisions and data model
- [docs/overview.md](../../overview.md) — product vision, what each group means

**Code files (modify):**
- [src/ui/GroupHeader.svelte](../../../src/ui/GroupHeader.svelte) — line 17: title of a normal group
- [src/ui/CollapsibleGroup.svelte](../../../src/ui/CollapsibleGroup.svelte) — line 39: collapsed header title; line 72: `EmptyState` render site
- [src/ui/GroupSettingsPopup.svelte](../../../src/ui/GroupSettingsPopup.svelte) — line 27: popup heading
- [src/ui/EmptyState.svelte](../../../src/ui/EmptyState.svelte) — new prop + neutral/semantic hint key selection
- [src/ui/TaskGroup.svelte](../../../src/ui/TaskGroup.svelte) — line 36: second `EmptyState` render site
- [src/styles.css](../../../src/styles.css) — **eight selectors, not two.** Truncation on the two
  titles: `.tm-group-header__title` (135-139), `.tm-collapsible-group__title` (219-221).
  `flex-shrink: 0` on everything that must not be squeezed instead — normal header:
  `.tm-group-header__counter` (140-143), `.tm-group-header__settings` (151-163),
  `.tm-group-header__add` (168-180); collapsible header: `.tm-collapsible-group__count`
  (222-225), `.tm-collapsible-group__settings` (233-238), `.tm-collapsible-group__add` (243-248)

**Code files (read):**
- [src/ui/groupTitle.ts](../../../src/ui/groupTitle.ts) — the Task 05 helper; read its actual exported signature before calling it
- [src/i18n/index.ts](../../../src/i18n/index.ts) — `t` and `groupLabels` derived stores
- [src/i18n/en.ts](../../../src/i18n/en.ts), [src/i18n/ru.ts](../../../src/i18n/ru.ts) — confirm `'emptyState.renamed'` (the key Task 02 adds) is present in both dictionaries
- [src/data/types.ts](../../../src/data/types.ts) — `Group.title` added by Task 03
- [tests/e2e/core.spec.ts](../../../tests/e2e/core.spec.ts) — the regression suite this task must keep green.
  Be honest about its reach: it locates ordinary groups by their identifiers and counters, not by
  their names, and the only name it matches is the collapsed backlog header. A broken fallback in
  the ordinary group header or in the group settings popup would leave this suite green. Real
  coverage of the names arrives with Task 10; here the suite only proves nothing else regressed.
  > **Post-execution correction (Task 06, see the decisions log).** The paragraph above was true
  > when this task was written and is no longer true of the suite as it stands: review found the gap
  > empirically, so `core.spec.ts` now asserts the *default* name in all three display sites
  > (scenarios 3.4, 8.1, 7.1) and a broken fallback in any of them turns it red. Still uncovered by
  > anything: the empty-state hint key, i.e. `emptyState.renamed` vs `emptyState.{groupId}`.
  > Task 10 owns it, and should not re-add default-path scenarios that 3.4 / 8.1 / 7.1 already cover.

## Verification Steps

- Precondition, before any edit: `grep -n "emptyState.renamed" src/i18n/types.ts src/i18n/en.ts src/i18n/ru.ts`
  — three hits (union member + both translations). No hits means Task 02 has not landed; stop and
  report, do not add the key yourself.
- Baseline next: `npx playwright test tests/e2e/core.spec.ts` **before** any edit — must be green.
  If it is already red, stop and report; do not build on a broken baseline.
- `npm run build` — production build succeeds with no esbuild/Svelte error. This is the only
  compile-level gate for this task; `npx tsc --noEmit` does **not** check `.svelte` files despite
  `tsconfig.json` listing them (verified experimentally, tech-spec Decision 11), so do not use it
  as this task's gate and do not report it as evidence that components compile.
- `npx playwright test tests/e2e/core.spec.ts` — green again after the changes. Playwright's
  `webServer` builds the harness itself (`node esbuild.harness.mjs --serve`), so no separate
  harness build step is needed.
- `grep -n "trim()" src/ui/EmptyState.svelte src/ui/TaskGroup.svelte src/ui/CollapsibleGroup.svelte`
  — exactly one hit, in `EmptyState.svelte`. Any hit in a parent means the renamed-check got
  duplicated. (Scope the grep to these three files: `trim()` is used legitimately elsewhere in
  `src/ui/` — form components already call it.)
- `git diff src/ui/groupTitle.ts` — empty. This task must not touch Task 05's module.
- Read the six sibling blocks in `src/styles.css` and confirm each declares `flex-shrink: 0`.
  A bare `grep -c flex-shrink` proves nothing here — the file already has seven unrelated
  `flex-shrink: 0` declarations further down.
- Manual read-through: confirm every `EmptyState` usage passes the new prop and no component
  still renders `$groupLabels[groupId]` as its displayed name.

## Details

<!-- All details for task execution — technical, organizational, any other. -->

**Files:**

- `src/ui/GroupHeader.svelte` — 26 lines. Props: `groupId`, `group`, `onAdd`, `onSettings`.
  Imports `{ t, groupLabels }` from `../i18n`. Line 17 renders
  `<span class="tm-group-header__title">{$groupLabels[groupId]}</span>`. Change: the span shows
  the resolved name. `$t` stays in use for the two button tooltips, `$groupLabels` stays in use as
  the fallback argument.
- `src/ui/CollapsibleGroup.svelte` — 87 lines. Two separate changes. Line 39:
  `<span class="tm-collapsible-group__title">{$groupLabels[groupId]}</span>` → resolved name.
  Line 72: `<EmptyState {groupId} />` → also passes the new prop, sourced from `group`.
- `src/ui/GroupSettingsPopup.svelte` — 47 lines. Props already include `group`, so nothing new is
  needed. Line 27: `<h3 class="tm-popup__title">{$t('groupSettings.heading')} {$groupLabels[groupId]}</h3>`
  → the resolved name after the heading label. Note the popup only reads the name here; the *input*
  for editing group names is not this popup — it goes into `BoardSettingsPopup` in Task 08. Do not
  add an editing field here.
- `src/ui/EmptyState.svelte` — 13 lines, currently the whole component is
  `export let groupId: GroupId` plus `$: key = \`emptyState.${groupId}\` as TranslationKey`. Add
  one prop holding the stored title (`string`) and make `key` conditional: non-empty after
  `trim()` → `'emptyState.renamed'`, otherwise the existing template key. Keep the
  `TranslationKey` cast honest — `'emptyState.renamed'` is a literal member of the union, so that
  branch needs no cast of its own; only the template-literal branch does.
- `src/ui/TaskGroup.svelte` — 49 lines. Line 36: `<EmptyState {groupId} />` → passes the new prop.
  It already has `group` in scope (line 10). Its `<GroupHeader {groupId} {group} .../>` call on
  line 27 needs no change — `GroupHeader` gets everything it needs from `group`.
- `src/styles.css` — eight selectors across two header rows.
  - Titles (truncation): `.tm-group-header__title` (135-139) and `.tm-collapsible-group__title`
    (219-221) currently set only font properties — no `overflow`, no `text-overflow`, no
    `min-width`.
  - Siblings that must not shrink (`flex-shrink: 0`): `.tm-group-header__counter` (140-143),
    `.tm-group-header__settings` (151-163), `.tm-group-header__add` (168-180),
    `.tm-collapsible-group__count` (222-225), `.tm-collapsible-group__settings` (233-238),
    `.tm-collapsible-group__add` (243-248). **None of these six declares `flex-shrink` today** —
    verified by reading the file, not assumed. The two buttons in the normal header do have a
    fixed `width: 1.5rem`/`height: 1.5rem`, but a fixed width does not prevent flex shrinking; the
    collapsible header's controls are `<span>`s with only padding, so they are the most
    squeezable of the six.
  - Their flex parents are `.tm-group-header` (line 125, `display: flex`) and
    `.tm-collapsible-group__header` (line 194, `display: flex`). The grandparents
    `.tm-task-group` (line 97) and `.tm-collapsible-group` (line 187) already carry
    `min-width: 0`, so the truncation only has to be solved inside the header rows themselves.
  - Line numbers are pre-change and will drift as you edit — locate the blocks by selector.

**Dependencies:**

- Task 02 — the neutral empty-group hint key is **`'emptyState.renamed'`**. Task 02 fixes that
  name; use it literally. Confirm it landed before you rely on it:
  `grep -n "emptyState.renamed" src/i18n/types.ts src/i18n/en.ts src/i18n/ru.ts` must return three
  hits — union member plus both translations. (The English text is
  "Nothing here yet — drag tasks in", but do not locate the key by that string: `emptyState.completed`
  follows the same "Nothing here yet — …" pattern and the wording may still change in localization
  review. Match on the key name, use the text only as a sanity check.) If the key is missing, do
  not invent or add it — `src/i18n/*` belongs to Task 02; report the blocker instead.
- Task 03 — `Group.title: string` exists on the model and migration guarantees it is a string on
  every group.
- Task 05 — `src/ui/groupTitle.ts` exists. **Read its exported signature before writing a call.**
  Per tech-spec Decision 4 it takes plain strings (stored title + localized default), not the group
  object, so a call looks like "helper(group.title, $groupLabels[groupId])" — but confirm the real
  name and argument order in the file rather than trusting this sentence.
- No new npm packages.

**Edge cases:**

- **Empty stored title** — the default localized name, unchanged from today's behavior, including
  live re-translation when the plugin language switches. This is the path `core.spec.ts` exercises,
  so it is the one that must not regress.
- **Whitespace-only stored title** — not reachable through the interface: Task 03 normalizes
  titles on save (`updateBoard`) and again on load (migration sanitizer), so what reaches these
  components is either `''` or a trimmed non-empty string. It still matters as a *code* property:
  name and hint must be derived from the same emptiness rule, so use `trim()` in `EmptyState` just
  as `groupTitle.ts` does. Do not write a test for this case here — the rule is unit-covered in
  Task 05's `tests/unit/groupTitle.test.ts`, and Task 10's E2E cannot construct the state.
- **Language switch on a renamed group** — the user's name must *not* change; only the fallback is
  localized. Keep the resolution reactive (`$:`) so a language change still re-renders the fallback
  case.
- **40-character name** — the cap Task 03 enforces. In `GroupHeader` the row is
  title + counter + `flex: 1` spacer + settings + add buttons; in `CollapsibleGroup` it is
  arrow + title + count + spacer + settings + add. Truncation must not let the title consume the
  counter or the buttons.
- **Short name** — the title must not stretch to fill the row and push the counter away from it;
  the existing look (title immediately followed by the counter, then the spacer) has to survive.
- **`group.title` absent at runtime** — should not happen once Task 03 has run, but the field is
  read straight from `data.json`. A defensive read costs one `?? ''` and prevents a blank board.
- **Group renamed to exactly its default name** (e.g. Focus → "Focus") — a non-empty stored title,
  so the neutral hint appears. That is acceptable and consistent; do not add a special case for it.

**Implementation hints:**

- Resolve the name reactively in each component (`$: title = ...`) rather than inline in markup, so
  the store subscription and the fallback read stay in one readable place.
- The prop `EmptyState` gets is the **stored title string**, not a boolean computed by the parent.
  The trimmed-emptiness check lives inside `EmptyState` and nowhere else — that is the whole point
  of the shape. Two parents each computing a boolean would recreate exactly the duplication this
  avoids.
- Do not look for (or add) a renamed-predicate in `src/ui/groupTitle.ts`. Task 05's acceptance
  criteria require **one** exported function there and forbid a second export; the file and its
  tests are Task 05's. `groupTitle.ts` resolves the displayed *name*; `EmptyState` decides the
  *hint*. Both apply the same emptiness rule (`trim()`), which is what keeps them in agreement.
- Truncation on a flex item needs all of: `min-width: 0`, `overflow: hidden`,
  `text-overflow: ellipsis`, `white-space: nowrap`. `min-width: 0` is the one that is easy to
  forget — a flex item defaults to `min-width: auto` and will refuse to shrink below its content
  without it. Equally required, not optional: `flex-shrink: 0` on the counter and both action
  controls in **each** header. Without it the flex algorithm may shrink them rather than the
  title, and the criterion "counter and buttons stay visible on the row" silently fails even
  though the title truncates.
- Keep the two header styles consistent — the same treatment in both, so the collapsible groups do
  not behave differently from the normal ones.
- Do not add `title=` tooltips, `aria-label`s, or any other affordance that was not asked for —
  CLAUDE.md is explicit that every changed line should trace to the request.
- Names come from user input and are rendered into markup: interpolation `{variable}` only, never
  `{@html}`. Svelte auto-escapes interpolated values, which is exactly the protection needed here.
- Do not touch `BoardLayout.svelte` — group ordering and the wrapper test attribute are Task 07.

## Reviewers

- **dev-code-reviewer** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-06-dev-code-reviewer-review.json`
- **dev-security-auditor** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-06-dev-security-auditor-review.json`
- **dev-test-reviewer** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-06-dev-test-reviewer-review.json`

## Post-completion

- [ ] Записать краткий отчёт в [0011-feat-group-customization-decisions.md](0011-feat-group-customization-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [ ] Если отклонились от спека — описать отклонение и причину
- [ ] Зафиксировать в decisions log имя нового пропа `EmptyState` (значение — строка `group.title`, не boolean) — Task 10 будет писать E2E против этого поведения
- [ ] Обновить user-spec/tech-spec если что-то изменилось
