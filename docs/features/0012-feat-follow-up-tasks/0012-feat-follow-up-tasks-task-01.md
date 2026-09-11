---
status: planned
depends_on: []
wave: 1
skills: [code-writing]
verify: bash                       # npx tsc --noEmit
reviewers: [dev-code-reviewer]
---

# Task 01: Localization keys

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:code-writing` — [skills/code-writing/SKILL.md](~/.claude/skills/code-writing/SKILL.md)

## Description

The feature adds an "After completion" block to the task form, a created-item label, a text prefix
written into spawned tasks, and an Obsidian notice. Every visible string must exist in English and
Russian (user-spec AC-13). This task adds all of them up front so later tasks only consume keys.

`TranslationKey` is a strict union and both dictionaries are typed `Record<TranslationKey, string>`,
so a key missing in either file is a compile error in `src/` — the type check is the gate.

## What to do

Add the following keys to the `TranslationKey` union in `src/i18n/types.ts` and to both dictionaries.
Wording is fixed by the user-spec where it quotes UI text; keep it.

| Key | en | ru |
|-----|----|----|
| `followUps.title` | `After completion` | `После выполнения` |
| `followUps.add` | `+ Add item` | `+ Добавить пункт` |
| `followUps.placeholder` | `What to do afterwards` | `Что сделать после` |
| `followUps.toBacklog` | `→ to backlog` | `→ в бэклог` |
| `followUps.toBacklogHint` | `Will be created in the backlog on save` | `Будет заведена в бэклог при сохранении` |
| `followUps.created` | `✓ created` | `✓ заведено` |
| `followUps.remove` | `Remove item` | `Удалить пункт` |
| `followUps.whyPrefix` | `After: ` | `После: ` |
| `followUps.noticeCreated` | `Tasks created in "{group}": {count}` | `Заведено задач в «{group}»: {count}` |
| `followUps.noticeHidden` | `(group hidden)` | `(группа скрыта)` |

Group the new keys under one `followUps.*` block in each file, following the existing layout.

## Acceptance Criteria

- [ ] All ten keys exist in the union, in `en.ts` and in `ru.ts`
- [ ] `followUps.whyPrefix` ends with exactly one space in both languages
- [ ] `followUps.noticeCreated` contains the literal placeholders `{group}` and `{count}` in both languages
- [ ] `npx tsc --noEmit` is clean

## Context Files

**Feature artifacts:**
- [0012-feat-follow-up-tasks.md](0012-feat-follow-up-tasks.md) — user-spec ("Дизайн и интерфейс", "Как должно работать")
- [0012-feat-follow-up-tasks-tech-spec.md](0012-feat-follow-up-tasks-tech-spec.md) — tech-spec (Decision 7)
- [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) — decisions log

**Project knowledge:** no `project-knowledge` directory; see [CLAUDE.md](../../../CLAUDE.md) "Localization".

**Code files:**
- [src/i18n/types.ts](../../../src/i18n/types.ts) — extend the union
- [src/i18n/en.ts](../../../src/i18n/en.ts) — English strings
- [src/i18n/ru.ts](../../../src/i18n/ru.ts) — Russian strings
- [src/i18n/index.ts](../../../src/i18n/index.ts) — read only: `t` has no interpolation, hence the placeholders

## Verification Steps

- `npx tsc --noEmit` — clean
- grep both dictionaries for `followUps.` — ten keys each

## Details

**Files:** the three i18n files only.
**Dependencies:** none.
**Edge cases:** the placeholders are substituted by a pure formatter in Task 03 — do not add an
interpolation facility to the i18n module (Decision 7 keeps substitution local and safe).
**Implementation hints:** the notice quote style differs by language on purpose («» in Russian).

## Reviewers

- **dev-code-reviewer** → `0012-feat-follow-up-tasks-task-01-dev-code-reviewer-review.json`

## Post-completion

- [ ] Записать краткий отчёт в [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [ ] Если отклонились от спека — описать отклонение и причину
- [ ] Обновить user-spec/tech-spec если что-то изменилось
