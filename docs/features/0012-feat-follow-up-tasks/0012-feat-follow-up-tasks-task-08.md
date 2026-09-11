---
status: planned
depends_on: ["06", "07"]
wave: 5
skills: [code-writing]
verify: bash                       # npx playwright test tests/e2e/0012-follow-up-tasks.spec.ts
reviewers: [dev-code-reviewer]
---

# Task 08: Feature E2E scenarios

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:code-writing` — [skills/code-writing/SKILL.md](~/.claude/skills/code-writing/SKILL.md)
- `/skill:test-master` — [skills/test-master/SKILL.md](~/.claude/skills/test-master/SKILL.md)

## Description

Cover user-spec AC-1…AC-13 end to end in a dedicated Playwright suite. The form, the marker in two view
modes, ☑ with Undo, drag, the notice and the read-only editor can only be verified through the UI.

## What to do

Create `tests/e2e/0012-follow-up-tasks.spec.ts`; add helpers to `tests/e2e/helpers.ts` only when reused by
several tests (e.g. open a task's form, add a follow-up item, read notice text). Scenarios, each mapped to AC:

1. **AC-1:** add two items (button, then Enter), Save → stored in `getDataStore()` and shown on reopen; Escape
   after edits → stored list unchanged.
2. **AC-2:** whitespace-only item not stored; 250 typed characters → 200 stored; "+ Add item" disabled at 20.
3. **AC-3:** marker `↪ 2` in default mode with a deadline and without one; compact mode `↪2`; `title` lists
   pending texts; no marker when all items are created.
4. **AC-4:** ☑ → two new backlog tasks at the end, with `why` = `After: <parent what>`, status new, default
   priority; items created in the parent; one notice with count 2.
5. **AC-5:** `moveTask` into completed → same result; reorder inside completed → nothing spawned, no notice.
6. **AC-6:** status "Completed" chosen in the form → nothing spawned.
7. **AC-7:** ☑ then Undo → spawned tasks gone, items pending again, marker back; an item created earlier via the
   form stays created.
8. **AC-8:** complete, move back out, complete again → no duplicates.
9. **AC-9:** mark + Save → task spawned with notice, marker decremented; mark + Escape → nothing.
10. **AC-10:** hidden backlog → notice with the hidden suffix; renamed backlog → notice uses the new name.
11. **AC-11:** a v8 snapshot loads with empty lists and unchanged board; a v9 snapshot with a damaged
    `followUps` (non-array, bad items) loads and the board renders.
12. **AC-12:** form of a completed task shows the block read-only (no inputs/buttons); hidden when the list is empty.
13. **AC-13 (spot check):** switch locale to ru and check the block title and notice wording.

## TDD Anchor

The suite is the deliverable. Every scenario must fail against a build without the feature for the reason it
names — assert behavior (stored data, visible elements, notice text), not the mere presence of class names.

## Acceptance Criteria

- [ ] Every user-spec AC-1…AC-13 has at least one scenario
- [ ] `npx playwright test tests/e2e/0012-follow-up-tasks.spec.ts` green
- [ ] `npx playwright test` — whole suite green

## Context Files

**Feature artifacts:**
- [0012-feat-follow-up-tasks.md](0012-feat-follow-up-tasks.md) — user-spec (AC list, "Как проверить")
- [0012-feat-follow-up-tasks-tech-spec.md](0012-feat-follow-up-tasks-tech-spec.md) — Testing Strategy / E2E
- [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) — decisions log

**Code files:**
- [tests/e2e/helpers.ts](../../../tests/e2e/helpers.ts) — existing helpers
- [tests/e2e/core.spec.ts](../../../tests/e2e/core.spec.ts), [tests/e2e/0011-group-customization.spec.ts](../../../tests/e2e/0011-group-customization.spec.ts) — style and fixture patterns
- [tests/harness/main.ts](../../../tests/harness/main.ts) — `window.__test` API, versioned snapshots
- [docs/testing/infrastructure.md](../../testing/infrastructure.md) — harness conventions

## Verification Steps

- `npx playwright test tests/e2e/0012-follow-up-tasks.spec.ts` — green
- `npx playwright test` — green

## Details

**Files:** the new spec, `tests/e2e/helpers.ts`.
**Dependencies:** Tasks 06, 07.
**Edge cases:** backlog is collapsed by default — expand it before asserting cards, or assert via `getDataStore()`;
the harness page never reloads from storage, so "after restart" is proven by store state plus a v9 snapshot
round trip; the complete button is hover-revealed but clickable (see 0008 EC-4).
**Implementation hints:** locate groups by `data-group-id` / `data-group-container`, never by displayed names
(0011 ADR); notices via `.notice`.

## Reviewers

- **dev-code-reviewer** → `0012-feat-follow-up-tasks-task-08-dev-code-reviewer-review.json`

## Post-completion

- [ ] Записать краткий отчёт в [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [ ] Если отклонились от спека — описать отклонение и причину
- [ ] Обновить user-spec/tech-spec если что-то изменилось
