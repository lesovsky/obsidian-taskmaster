---
status: planned
depends_on: ["03", "05"]
wave: 4
skills: [code-writing]
verify: bash                       # npm run build; npx playwright test tests/e2e/core.spec.ts tests/e2e/0008-card-columns.spec.ts
reviewers: [dev-code-reviewer]
---

# Task 06: Card marker

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:code-writing` — [skills/code-writing/SKILL.md](~/.claude/skills/code-writing/SKILL.md)

## Description

A card with pending follow-ups shows `↪ N` so the user sees on the board which tasks still have something
to do afterwards (user-spec "Маркер на карточке", AC-3). It is a plain, non-interactive span with a `title`
tooltip listing the pending texts, one per line (Decision 14).

The dependency on Task 05 is only about `src/styles.css` — both tasks edit it, so they run in different waves.

## What to do

1. `TaskCard.svelte`: derive the pending items with `pendingFollowUps`. When N > 0 render the marker:
   - default mode: in the top row, left of the deadline; without a deadline it takes the deadline's place at
     the right edge of the row;
   - compact mode: `↪N` (no space) immediately before the deadline, or in its place;
   - `title` = pending texts joined with `\n`.
   Nothing is rendered for N = 0.
2. Styles in `src/styles.css`: `tm-task-card__follow-ups` (default) and `tm-task-card__follow-ups-compact`
   (fixed width, `flex-shrink: 0`, like the other fixed compact blocks). Muted text colour via Obsidian
   variables. The default-mode row already pushes the deadline right with `margin-left: auto`; the marker must
   take over that role when present so the pair sits together at the right, keeping the existing padding
   reserved for ☑/✕.
3. The marker must not change drag behavior or card click/Enter handling — no handlers, not focusable.

## TDD Anchor

Pending selection is unit-tested in Task 03. Rendering is covered by E2E in Task 08; here the gate is the build
plus the existing card-display and multi-column suites, which must stay green.

## Acceptance Criteria

- [ ] Marker shown with the pending count in default and compact modes, with and without a deadline
- [ ] Tooltip lists the pending texts, each on its own line
- [ ] No marker when N = 0 (no items, or all created)
- [ ] Card click, Enter and drag behave as before, including when started on the marker
- [ ] `npm run build` succeeds; `npx playwright test tests/e2e/core.spec.ts tests/e2e/0008-card-columns.spec.ts` green

## Context Files

**Feature artifacts:**
- [0012-feat-follow-up-tasks.md](0012-feat-follow-up-tasks.md) — user-spec (Маркер на карточке, Риски)
- [0012-feat-follow-up-tasks-tech-spec.md](0012-feat-follow-up-tasks-tech-spec.md) — Decision 14
- [0012-feat-follow-up-tasks-code-research.md](0012-feat-follow-up-tasks-code-research.md) — problem 11 (card real estate)
- [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) — decisions log

**Code files:**
- [src/ui/TaskCard.svelte](../../../src/ui/TaskCard.svelte) — both branches
- [src/styles.css](../../../src/styles.css) — `.tm-task-card__top`, `.tm-task-card__deadline`, compact section, multi-column rules
- [src/logic/followUps.ts](../../../src/logic/followUps.ts) — `pendingFollowUps`
- [docs/specs/0002-feat-compact-card-view.md](../../specs/0002-feat-compact-card-view.md) — fixed-width compact layout

## Verification Steps

- `npm run build` — succeeds
- `npx playwright test tests/e2e/core.spec.ts tests/e2e/0008-card-columns.spec.ts` — green

## Details

**Files:** `src/ui/TaskCard.svelte`, `src/styles.css`.
**Dependencies:** Task 03 (helper), Task 05 (same stylesheet, previous wave).
**Edge cases:** long pending texts in the tooltip are fine (native title); overdue styling of the deadline is
unaffected; cards in the completed group normally have no pending items.
**Implementation hints:** follow the existing emoji/icon language of the card; no hover-only visibility.

## Reviewers

- **dev-code-reviewer** → `0012-feat-follow-up-tasks-task-06-dev-code-reviewer-review.json`

## Post-completion

- [ ] Записать краткий отчёт в [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [ ] Если отклонились от спека — описать отклонение и причину
- [ ] Обновить user-spec/tech-spec если что-то изменилось
