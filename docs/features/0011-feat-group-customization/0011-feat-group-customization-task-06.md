---
status: planned                    # planned -> in_progress -> done
depends_on: ["02", "03", "05"]     # ID задач-зависимостей (строки: ["01", "02"])
wave: 2                            # волна параллельного выполнения
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

Wave 1 produced the data (`Group.title`, Task 03) and the pure rule that turns a stored title
plus a localized default into a displayed name (`src/ui/groupTitle.ts`, Task 05). Nothing on the
board uses either yet: all four display sites still read `$groupLabels[groupId]` directly, so a
renamed group would look exactly like a default one.

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
must show the neutral hint added by Task 02 instead. `EmptyState` is rendered from exactly two
places (`TaskGroup.svelte:36` and `CollapsibleGroup.svelte:72`), and both parents already hold
`group` — hence both are in this task's file list.

Finally, the header row must tolerate a 40-character name (the cap enforced by Task 03). Right
now `.tm-group-header__title` and `.tm-collapsible-group__title` set only font properties — no
`overflow`, no `text-overflow`, and no `min-width: 0` on the flex items — so a long name pushes
the task counter and the settings/add buttons out of the row.

The feature's own E2E coverage is **not** written here: renaming is not reachable through the UI
until the settings popup lands in Task 08, and `tests/e2e/0011-group-customization.spec.ts`
belongs to Task 10. This task's gate is a production build plus the existing `core.spec.ts`
staying green.

## What to do

1. Replace the direct `$groupLabels[groupId]` read with the resolved name in `GroupHeader.svelte`,
   `CollapsibleGroup.svelte` and `GroupSettingsPopup.svelte`, using the helper from
   `src/ui/groupTitle.ts`. The localized default stays the fallback argument, so a group with an
   empty stored title looks and translates exactly as it does today.
2. Give `EmptyState.svelte` one new prop that tells it whether the group carries a user-defined
   name, and have it render the neutral hint key (added by Task 02) in that case and the existing
   `emptyState.{groupId}` hint otherwise.
3. Pass that prop from both render sites — `TaskGroup.svelte` and `CollapsibleGroup.svelte` —
   sourcing it from the `group` each already has.
4. Add truncation to the two group-title styles in `src/styles.css` so a 40-character name is cut
   with an ellipsis and the counter plus the action buttons stay on the row, in both the normal
   and the collapsible header.
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
- [ ] `EmptyState` takes one new prop and renders the neutral hint for a renamed group, the
      existing `emptyState.{groupId}` hint otherwise
- [ ] A whitespace-only stored title behaves exactly as an empty one — default name **and**
      original semantic hint — consistently with the Task 05 resolution rule
- [ ] Both `EmptyState` render sites (`TaskGroup.svelte`, `CollapsibleGroup.svelte`) pass the new
      prop; no call site is left on the old signature
- [ ] A 40-character name in either header type is truncated with an ellipsis; the task counter
      and the settings/add buttons stay visible on the same row and are not pushed out
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
- [src/styles.css](../../../src/styles.css) — title truncation, lines 135-139 and 219-221

**Code files (read):**
- [src/ui/groupTitle.ts](../../../src/ui/groupTitle.ts) — the Task 05 helper; read its actual exported signature before calling it
- [src/i18n/index.ts](../../../src/i18n/index.ts) — `t` and `groupLabels` derived stores
- [src/i18n/en.ts](../../../src/i18n/en.ts), [src/i18n/ru.ts](../../../src/i18n/ru.ts) — find the neutral hint key added by Task 02
- [src/data/types.ts](../../../src/data/types.ts) — `Group.title` added by Task 03
- [tests/e2e/core.spec.ts](../../../tests/e2e/core.spec.ts) — the regression suite this task must keep green

## Verification Steps

- Baseline first: `npx playwright test tests/e2e/core.spec.ts` **before** any edit — must be green.
  If it is already red, stop and report; do not build on a broken baseline.
- `npm run build` — production build succeeds with no esbuild/Svelte error. This is the only
  compile-level gate for this task; `npx tsc --noEmit` does **not** check `.svelte` files despite
  `tsconfig.json` listing them (verified experimentally, tech-spec Decision 11), so do not use it
  as this task's gate and do not report it as evidence that components compile.
- `npx playwright test tests/e2e/core.spec.ts` — green again after the changes. Playwright's
  `webServer` builds the harness itself (`node esbuild.harness.mjs --serve`), so no separate
  harness build step is needed.
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
  one prop and make `key` conditional. Keep the `TranslationKey` cast honest — the neutral key is
  a literal member of the union, so it needs no cast of its own.
- `src/ui/TaskGroup.svelte` — 49 lines. Line 36: `<EmptyState {groupId} />` → passes the new prop.
  It already has `group` in scope (line 10). Its `<GroupHeader {groupId} {group} .../>` call on
  line 27 needs no change — `GroupHeader` gets everything it needs from `group`.
- `src/styles.css` — two blocks. `.tm-group-header__title` (lines 135-139) and
  `.tm-collapsible-group__title` (lines 219-221) currently set only font properties. Their flex
  parents are `.tm-group-header` (line 125, `display: flex`) and `.tm-collapsible-group__header`
  (line 194, `display: flex`). Note the grandparents `.tm-task-group` (line 97) and
  `.tm-collapsible-group` (line 187) already carry `min-width: 0`, so the truncation only has to be
  solved inside the header rows themselves.

**Dependencies:**

- Task 02 — the neutral empty-group hint key must exist in `src/i18n/types.ts`, `en.ts` and `ru.ts`.
  Its exact name is decided by Task 02, not here: **grep `src/i18n/en.ts` for the English string
  "Nothing here yet — drag tasks in" and use whatever key it is bound to.** Do not invent a key
  name, and do not add the key yourself if it is missing — report the blocker instead.
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
- **Whitespace-only stored title** — must behave identically to empty: default name *and* the
  original semantic hint. Getting the name right but leaving the hint neutral (or vice versa) is a
  real risk here, because the two decisions are made in different components. Derive both from the
  same rule.
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
- For `EmptyState`, the least duplicated shape is to give it the group's stored title as the prop
  and let the component itself decide neutral vs semantic with a single trimmed-emptiness check.
  Then the "is this group renamed?" rule exists in exactly one place instead of being repeated in
  both parents. If `src/ui/groupTitle.ts` already exports a predicate for this, prefer that helper
  over a hand-rolled check — but do not extend `groupTitle.ts`, it is Task 05's file and its tests
  live there.
- Truncation on a flex item needs all of: `min-width: 0`, `overflow: hidden`,
  `text-overflow: ellipsis`, `white-space: nowrap`. `min-width: 0` is the one that is easy to
  forget — a flex item defaults to `min-width: auto` and will refuse to shrink below its content
  without it. Also make sure the counter and the icon buttons cannot be squeezed instead of the
  title (`flex-shrink: 0` on them is the usual answer).
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
- [ ] Зафиксировать в decisions log выбранную форму нового пропа `EmptyState` — Task 10 будет писать E2E против этого поведения
- [ ] Обновить user-spec/tech-spec если что-то изменилось
