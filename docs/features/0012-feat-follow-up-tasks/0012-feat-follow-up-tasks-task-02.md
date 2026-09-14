---
status: done
depends_on: []
wave: 1
skills: [code-writing]
verify: bash                       # npx vitest run tests/unit/migration.test.ts
reviewers: [dev-code-reviewer, dev-security-auditor]
---

# Task 02: Data model, migration v9 and sanitization

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:code-writing` — [skills/code-writing/SKILL.md](~/.claude/skills/code-writing/SKILL.md)

## Description

Every task gets an embedded list of follow-up items. This task lays the data foundation: the
`FollowUp` type and `Task.followUps`, a migration from data version 8 to 9 that gives every existing
task an empty list, and a sanitizer that runs on **every** load so a hand-edited or badly synced
`data.json` can never keep the plugin from opening (user-spec AC-11, tech-spec Decisions 1, 2, 11, 12).

`migrateData` runs inside `loadPluginData()` before the view exists and its result is written straight
back to disk — an exception there means no board at all, and whatever the sanitizer returns becomes the
persisted truth. This is the first migration that touches `tasks`; every previous one touched settings,
boards or groups.

## What to do

1. In `src/data/types.ts` add the exported `FollowUp` interface (`id`, `text`, `createdTaskId`, with the
   semantics from tech-spec "Data Models" as short comments) and `followUps: FollowUp[]` on `Task`.
2. Bump `DEFAULT_DATA.version` in `src/data/defaults.ts` from 8 to 9 — the only existing version literal
   that changes. Historical guards and `result.version = N` lines inside older blocks stay as they are.
3. Add an exported `sanitizeFollowUps(value: unknown): FollowUp[]` to `src/data/migration.ts`, following
   the rules of Decision 11 exactly (non-array → `[]`; non-object item dropped; non-string or empty-after-trim
   text dropped; text trimmed, capped at 200, trailing lone high surrogate removed; non-string
   `createdTaskId` → `''`; missing / non-string / empty / duplicate `id` → fresh UUID; at most 20 items,
   the first 20 kept). Never throws, does not mutate its input.
4. Add a `version < 9` block after the `version < 8` block: every task object without `followUps` gets `[]`,
   `result.version = 9`. The block must tolerate the same damaged shapes as the sanitization loop (non-object
   `tasks`, non-object entries) — it is the first block that iterates `tasks`.
5. In the unconditional sanitization block, after the existing board loop, sanitize `followUps` of every
   task. Skip task entries that are not objects; if `result.tasks` itself is not an object, leave it alone
   (TD-01 is out of scope — do not add wider hardening).
6. `src/ui/TaskFormContent.svelte` builds a complete `Task` literal on Save. Add `followUps` to it, carrying
   over a copy of the edited task's list (`[]` for a new task), so saving a task between this task and
   Task 05 never drops the field. Nothing else in the form changes here.
7. Update `tests/unit/migration.test.ts`: retarget every `toBe(8)` version expectation and the test names
   carrying the number to 9; rewrite `v7 → v8: tasks are untouched` into a test that tasks only gain an
   empty `followUps` list and are otherwise deep-equal; add the suites under TDD Anchor.

## TDD Anchor

Write first in `tests/unit/migration.test.ts`, watch them fail, then implement.

- `::v8 → v9: every task gets an empty followUps list`
- `::v8 → v9: other task fields are unchanged` — deep-equal apart from the new field
- `::v1 → v9: all fields are migrated in one pass` — existing test retargeted, also asserts `followUps`
- `::v9 → v9: data unchanged (idempotent)` — a v9 input with valid, non-empty lists passes through
  `JSON.stringify`-identical (proves sanitizer keeps valid data byte-identical, ids included)
- `::followUps not an array → []` — cover `null`, a string, an object
- `::followUps item that is not an object is dropped` — `null`, number, string items
- `::followUps item with non-string text is dropped`
- `::followUps item with whitespace-only text is dropped`
- `::followUps text is trimmed and capped at 200` — 201 chars → 200; exactly 200 unchanged;
  head and tail differ so the assertion pins which 200 survive
- `::followUps text cap does not leave a lone high surrogate`
- `::followUps non-string createdTaskId becomes ''`
- `::followUps missing or duplicate id gets a fresh unique id` — resulting ids non-empty and unique; the
  first of two duplicates keeps its id
- `::followUps longer than 20 items is cut to the first 20`
- `::followUps is sanitized on already-migrated v9 data` — fails if sanitization sits inside the version branch
- `::a task entry that is not an object does not throw` — run on a **v8** input (exercises the new
  `version < 9` block) and on a v9 input (sanitization block only)
- `::tasks that is not an object does not throw` — same two input versions

## Acceptance Criteria

- [x] `FollowUp` and `Task.followUps` exist in `src/data/types.ts`
- [x] `DEFAULT_DATA.version` is 9; `migrateData` yields version 9 for every migrating input
- [x] Data from v8 gains `followUps: []` on every task and is otherwise unchanged
- [x] A damaged `followUps` of any shape yields a valid list per Decision 11 — no throw
- [x] Sanitization runs on every load, outside version branches; valid v9 data passes byte-identical
- [x] Saving a task through the form keeps its `followUps`
- [x] `npx vitest run tests/unit/migration.test.ts` — green
- [x] `npx tsc --noEmit` — no errors

## Context Files

**Feature artifacts:**
- [0012-feat-follow-up-tasks.md](0012-feat-follow-up-tasks.md) — user-spec (edge case "Повреждённые данные", AC-11)
- [0012-feat-follow-up-tasks-tech-spec.md](0012-feat-follow-up-tasks-tech-spec.md) — Data Models, Decisions 1, 2, 11, 12, Backward Compatibility
- [0012-feat-follow-up-tasks-code-research.md](0012-feat-follow-up-tasks-code-research.md) — section 2 (data layer), problems 14–16
- [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) — decisions log

**Project knowledge:** [CLAUDE.md](../../../CLAUDE.md) "Adding a new task field" (note: `createDefaultTask()` it
mentions does not exist); [docs/decisions-log.md](../../decisions-log.md) — 0011 ADR "Санитизация данных на каждой
загрузке"; [docs/tech-debt.md](../../tech-debt.md) TD-01.

**Code files:**
- [src/data/types.ts](../../../src/data/types.ts) — new type and field
- [src/data/defaults.ts](../../../src/data/defaults.ts) — version 8 → 9
- [src/data/migration.ts](../../../src/data/migration.ts) — v9 block, sanitizer, per-load loop; `sanitizeGroupTitle` is the style reference
- [src/ui/TaskFormContent.svelte](../../../src/ui/TaskFormContent.svelte) — carry `followUps` in the saved literal
- [tests/unit/migration.test.ts](../../../tests/unit/migration.test.ts) — retarget and extend
- [src/data/cleanup.ts](../../../src/data/cleanup.ts), [src/main.ts](../../../src/main.ts) — read only: load order

## Verification Steps

- `npx vitest run tests/unit/migration.test.ts` — green; confirm the new tests failed before the code existed
- `npx tsc --noEmit` — clean
- `npm run build` — succeeds (the form edit)
- Re-read `migrateData`: the follow-up loop is after every `if (version < N)` block

## Details

**Files:** as listed above.
**Dependencies:** none (Wave 1, parallel with Task 01 — no shared files).
**Edge cases:** `crypto.randomUUID` is available in Node ≥ 19 (project pins ≥ 22.12) and in Obsidian; a
sanitizer that generates ids is still deterministic for valid input. `cleanup.test.ts` and e2e fixtures
build tasks without `followUps`; tests are not type-checked (TD-02) and the harness migrates versioned
snapshots, so they keep working — do not edit them here.
**Implementation hints:** keep the sanitizer free of side effects on its input so tests can call it with
hostile values directly. Security relevance: this is the only validation of hand-editable data for the
new field; no HTML escaping at this layer — rendering uses `{}` interpolation.

## Reviewers

- **dev-code-reviewer** → `0012-feat-follow-up-tasks-task-02-dev-code-reviewer-review.json`
- **dev-security-auditor** → `0012-feat-follow-up-tasks-task-02-dev-security-auditor-review.json`

## Post-completion

- [x] Записать краткий отчёт в [0012-feat-follow-up-tasks-decisions.md](0012-feat-follow-up-tasks-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [x] Если отклонились от спека — описать отклонение и причину
- [x] Обновить user-spec/tech-spec если что-то изменилось
