---
status: planned
depends_on: ["01", "03"]
wave: 3
skills: [code-writing]
verify: bash                       # npm run build; npx playwright test tests/e2e/core.spec.ts
reviewers: [dev-code-reviewer, dev-security-auditor]
---

# Task 05: Form editor

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:code-writing` — [skills/code-writing/SKILL.md](~/.claude/skills/code-writing/SKILL.md)

## Description

The task form gets an "After completion" block between "Why" and the Who/When row (user-spec "Дизайн и
интерфейс", AC-1, AC-2, AC-9, AC-12). It edits drafts built from a **copy** of the task's list — the form
receives the live store object, and editing it in place would leak changes past Escape. Marking
"→ to backlog" only flags a draft; the form's single Save hands the task and the marked ids to its caller
(Decision 5). For a task in the completed group the block is read-only (Decision 9).

This task does not spawn anything and does not touch `BoardLayout` — Task 07 wires the second Save argument.

## What to do

1. Create `src/ui/FollowUpsEditor.svelte`, bound to an array of `FollowUpDraft` plus a `readOnly` flag:
   - pending row: text input (`maxlength` = `FOLLOW_UP_TEXT_MAX_LENGTH`, placeholder `followUps.placeholder`),
     "→ to backlog" toggle (pressed state visible, `aria-pressed`, hint `followUps.toBacklogHint`), remove ✕;
     a marked row is visually highlighted;
   - created row: text as plain text (not editable) + `followUps.created` label + remove ✕, no toggle;
   - "+ Add item" appends an empty draft at the end and focuses it; disabled at `MAX_FOLLOW_UPS`;
   - Enter in a row input inserts an empty draft right after it and focuses it (no-op at the limit) and must
     not trigger anything else;
   - keyed `{#each}` by draft `id`;
   - read-only: item texts with the created label where applicable, no inputs or buttons; nothing rendered for
     an empty list.
2. `TaskFormContent.svelte`: build drafts from a copy of `task.followUps` (`[]` for a new task), render the
   editor in its place with `readOnly = groupId === 'completed'`, and on Save use `finalizeFollowUpDrafts`
   (read-only: keep the original list, no spawn ids). Call `onSave(task, spawnItemIds)`.
3. `TaskModal.ts`: widen the save callback type to `(task: Task, spawnItemIds: string[]) => void` and pass
   both arguments through.
4. Styles in `src/styles.css`, all `tm-follow-ups*` BEM classes, Obsidian variables only. Suggested hooks for
   tests: `tm-follow-ups`, `tm-follow-ups--readonly`, `__row`, `__row--marked`, `__row--created`, `__input`,
   `__to-backlog`, `__remove`, `__created-label`, `__add`.

## TDD Anchor

Draft rules are covered in Task 03. Component behavior is covered by E2E in Task 08 (the unit environment has
no DOM); here the gate is the build plus the existing core scenarios. Before finishing, run the core suite to
prove the form still creates and edits tasks.

## Acceptance Criteria

- [ ] Block appears between "Why" and Who/When in create and edit modes
- [ ] Add, Enter-insert, remove, mark/unmark work; limits 200 / 20 enforced in the UI
- [ ] Created items are not editable and have no toggle; can be removed (editable mode)
- [ ] Read-only for a task in the completed group; hidden when its list is empty
- [ ] Escape discards list edits — the store is not mutated before Save
- [ ] Save calls `onSave(task, spawnItemIds)`; existing one-argument callers keep working
- [ ] All new classes use the `tm-` prefix; no `<style>` blocks; no `{@html}`
- [ ] `npm run build` succeeds; `npx playwright test tests/e2e/core.spec.ts` green

## Context Files

**Feature artifacts:**
- [0012-feat-follow-up-tasks.md](0012-feat-follow-up-tasks.md) — user-spec (Ключевые компоненты, Формы и ввод данных, scenarios 1, 4, 5)
- [0012-feat-follow-up-tasks-tech-spec.md](0012-feat-follow-up-tasks-tech-spec.md) — Decisions 5, 9
- [0012-feat-follow-up-tasks-code-research.md](0012-feat-follow-up-tasks-code-research.md) — sections 1, 4.3, 4.4
- [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) — decisions log

**Project knowledge:** [CLAUDE.md](../../../CLAUDE.md) CSS rules; [docs/decisions-log.md](../../decisions-log.md) — 0011 ADR
"Поле ввода названия не является местом отображения" (raw value in inputs, defaults only as placeholders).

**Code files:**
- [src/ui/FollowUpsEditor.svelte](../../../src/ui/FollowUpsEditor.svelte) — new
- [src/ui/TaskFormContent.svelte](../../../src/ui/TaskFormContent.svelte) — drafts, placement, Save
- [src/modals/TaskModal.ts](../../../src/modals/TaskModal.ts) — callback type
- [src/styles.css](../../../src/styles.css) — `.tm-task-form__*` section as the style reference
- [src/logic/followUps.ts](../../../src/logic/followUps.ts) — draft type, limits, finalization
- [src/ui/BoardLayout.svelte](../../../src/ui/BoardLayout.svelte) — read only: how the modal is opened

## Verification Steps

- `npm run build` — succeeds (`tsc` does not read `.svelte`, Decision 13)
- `npx playwright test tests/e2e/core.spec.ts` — green
- Manual read-through: drafts are created from a copy; nothing in the editor writes to a store

## Details

**Files:** as listed.
**Dependencies:** Task 01 (strings), Task 03 (draft API). Parallel with Task 04 — no shared files.
**Edge cases:** a draft marked, then its text cleared → dropped on Save, not spawned; removing a created
item removes only the record; the Enter key inside the editor input must not bubble into anything that saves
or closes the modal.
**Implementation hints:** security — item text is user input; render with `{}` interpolation only, keep
`maxlength` on inputs (the store-side cap lives in finalization and the load sanitizer).

## Reviewers

- **dev-code-reviewer** → `0012-feat-follow-up-tasks-task-05-dev-code-reviewer-review.json`
- **dev-security-auditor** → `0012-feat-follow-up-tasks-task-05-dev-security-auditor-review.json`

## Post-completion

- [ ] Записать краткий отчёт в [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [ ] Если отклонились от спека — описать отклонение и причину
- [ ] Обновить user-spec/tech-spec если что-то изменилось
