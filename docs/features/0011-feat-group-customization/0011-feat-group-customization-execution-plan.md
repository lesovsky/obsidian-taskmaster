# Execution Plan: Group Customization (0011)

**Branch:** `feature/group-customization`
**Mode:** autopilot — no intermediate user approvals
**Tasks:** 12 across 9 waves

## Environment note

Node 22.23.1 is installed via snap, but the apt package (18.19.1) shadows it in `PATH`.
Every command that runs `node`, `npm`, `npx`, `vitest` or `playwright` must be prefixed with
`export PATH=/snap/bin:$PATH`. Without it the unit runner fails at config load, before any
test is collected. Verified: with the correct `PATH`, `npm test` passes 25 tests in 3 files.

## Waves

| Wave | Tasks | What lands |
|------|-------|-----------|
| 1 | 01, 02 | Node pinned in repo, unit suite collectible; localization keys + the type error left by 0009 |
| 2 | 03, 04, 05 | Data model + migration v8 + sanitization; reorder logic; title resolution |
| 3 | 06 | Group names on the board, neutral hint for renamed groups, header truncation |
| 4 | 07 | Board renders in configured order via CSS, wrapper test attribute |
| 5 | 08 | Settings popup controls + the whole save chain in one step |
| 6 | 09 | Existing E2E locators moved off group names |
| 7 | 10 | Feature E2E scenarios, including real mouse drag |
| 8 | 11 | Pre-deploy QA against 36 acceptance criteria |
| 9 | 12 | Technical documentation and changelogs |

## Execution protocol (adapted)

`TeamCreate` is unavailable in this session, so the lead orchestrates directly:

1. Lead spawns the executor for a task with its file and skills.
2. Executor implements, runs its own gate, commits.
3. Lead spawns the task's reviewers in parallel against the diff.
4. Lead relays findings back to the executor; executor fixes and commits.
5. Max 3 rounds per task; unresolved findings after that escalate to the user.

## Order constraints that must not be violated

- Task 07 introduces the board wrapper attribute, task 08 the popup row attribute — only then
  task 09 migrates existing locators onto them.
- Task 08 changes all three links of the save chain in a single task; a partial chain writes
  `undefined` into the new order field while the board already depends on it.
- The title input binds to the stored title verbatim; the localized default goes to the
  placeholder only. The resolution helper is not used in the popup at all.
- Group order is applied through CSS on existing wrappers. The six literal blocks in the board
  layout must not be collapsed into a loop — that would destroy the drag & drop bindings.

## Verification gates

`npx tsc --noEmit` does not check `.svelte` files. Component tasks are gated by a production
build plus the relevant automated scenarios, never by type checking alone.

## What the user checks at the end

- Rename "Фокус" to "Долгострой", restart Obsidian, confirm the name survived and the empty
  hint no longer contradicts it.
- Reorder groups, confirm half-width groups repacked and no gaps appeared.
- Immediately after reordering, without restarting, drag tasks between several pairs of groups,
  including backlog and completed.
- Check a second board keeps its own names and order.
- Check both light and dark themes.
- Open a board created before the upgrade and confirm it looks unchanged.
