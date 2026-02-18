# Claude Instructions for Obsidian TaskMaster

## Project Overview

**TaskMaster** is an Obsidian plugin for task management with SMART-style cards and a visual board designed for project managers. It provides an opinionated workflow with 6 fixed task groups and structured task fields.

**Key Documentation:**
- Product overview: [docs/overview.md](docs/overview.md)
- Technical spec: [docs/technical.md](docs/technical.md)
- Feature specs: [docs/specs/](docs/specs/) — спецификации фич (`{N}-feat-{description}.md`)
- Implementation plans: [docs/plans/](docs/plans/) — планы реализации (`{N}-feat-{description}-plan.md`)
- Test scenarios: [docs/testing/](docs/testing/) — тестовые сценарии (`{N}-feat-{description}-testing.md`)
- Changelog: [CHANGELOG.md](CHANGELOG.md), [CHANGELOG.ru.md](CHANGELOG.ru.md)

## Technology Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| **Language** | TypeScript | Strict mode enabled |
| **UI Framework** | Svelte 4 | No scoped styles, see CSS section |
| **Build Tool** | esbuild | With esbuild-svelte plugin |
| **Drag & Drop** | SortableJS | Framework-agnostic, touch support |
| **Platform** | Obsidian Plugin API | Min version 1.0.0 |
| **Localization** | Custom i18n system | English + Russian |

## Architecture

### Project Structure

```
src/
├── main.ts                 — Plugin entry point (TaskMasterPlugin extends Plugin)
├── view.ts                 — TaskMasterView (extends ItemView)
├── data/
│   ├── types.ts           — All TypeScript interfaces and types
│   ├── defaults.ts        — Default values, initial state
│   ├── migration.ts       — Data schema migrations
│   └── cleanup.ts         — Auto-cleanup functions (completed + orphaned tasks)
├── logic/
│   └── statusTransitions.ts — Automatic status transition rules
├── stores/
│   ├── dataStore.ts       — Svelte store: boards, tasks, settings
│   ├── uiStore.ts         — Svelte store: UI state (active board, modals, toasts)
│   └── pluginStore.ts     — Svelte store: reference to plugin instance
├── ui/
│   ├── App.svelte         — Root component
│   ├── BoardHeader.svelte
│   ├── BoardLayout.svelte
│   ├── CollapsibleGroup.svelte
│   ├── TaskGroup.svelte
│   ├── GroupHeader.svelte
│   ├── TaskCard.svelte
│   ├── EmptyState.svelte
│   ├── TaskFormContent.svelte
│   ├── GroupSettingsPopup.svelte
│   ├── BoardSettingsPopup.svelte
│   ├── DeleteToast.svelte
│   └── useSortable.ts     — Svelte action for SortableJS integration
├── modals/
│   └── TaskModal.ts       — Obsidian Modal wrapper for task form
├── utils/
│   └── dateFormat.ts      — Date formatting utilities
├── i18n/
│   ├── index.ts           — i18n core logic
│   ├── types.ts           — i18n types
│   ├── en.ts              — English translations
│   └── ru.ts              — Russian translations
├── settings.ts            — Settings tab (global plugin settings)
└── styles.css             — ALL plugin styles (global, no scoped styles)
```

### Data Model

**Storage:** Single `data.json` file via Obsidian `loadData()` / `saveData()` API.

**Key Principles:**
- **Flat task dictionary** — all tasks stored in `tasks: Record<string, Task>`, groups reference tasks via `taskIds: string[]`
- **UUID identifiers** — use `crypto.randomUUID()` for all IDs (tasks, boards)
- **Version field** — enables safe data migrations when schema changes
- **Immutable operations** — always update stores immutably, trigger persist after changes

### State Management (Svelte Stores)

| Store | Contents | Persisted? |
|-------|----------|------------|
| **dataStore** | Boards, tasks, settings — everything from data.json | Yes, on every change |
| **uiStore** | Active board, open modals, toast queue | No |
| **pluginStore** | Reference to plugin instance (access to saveData(), Modal API) | No |

**IMPORTANT:** Always call `persist()` after modifying dataStore.

## Critical Conventions

### CSS Rules (MUST FOLLOW)

**⚠️ CRITICAL:** Obsidian has built-in CSS classes (e.g., `.empty-state`) that WILL collide with plugin classes.

**Required practices:**
1. **ALL CSS classes MUST have `tm-` prefix** (e.g., `.tm-task-card`, `.tm-empty-state`, `.tm-board-layout`)
2. **Use BEM notation:** `.tm-block__element--modifier` (e.g., `.tm-task-card__deadline--overdue`)
3. **All styles in `src/styles.css`** — NO `<style>` blocks in `.svelte` files
4. **esbuild-svelte config:** `compilerOptions: { css: 'none' }` (already configured in [esbuild.config.mjs](esbuild.config.mjs))
5. **Use Obsidian CSS variables** for theming: `--background-primary`, `--text-normal`, `--interactive-accent`, etc.
6. **Relative units** (`rem`, `%`, `fr`) for mobile readiness

### Code Style

**TypeScript:**
- Strict mode enabled — no implicit any, full type safety
- Import types from `src/data/types.ts`
- Use `formatDate()` from [src/utils/dateFormat.ts](src/utils/dateFormat.ts) for date formatting (YYYY-MM-DD)

**Svelte:**
- No scoped `<style>` blocks — add classes to [src/styles.css](src/styles.css)
- Reactive statements with `$:` for derived values
- Subscribe to stores with `$storeName` syntax
- Use `{#key}` blocks for re-rendering on data changes

**Naming:**
- Components: PascalCase (e.g., `TaskCard.svelte`)
- Functions: camelCase (e.g., `addTask`, `formatDate`)
- Constants: UPPER_SNAKE_CASE (e.g., `GROUP_IDS`, `DEFAULT_SETTINGS`)
- CSS classes: `tm-kebab-case` with BEM modifiers

## Key Patterns & Mechanisms

### Drag & Drop: SortableJS + Svelte Synchronization

**Problem:** SortableJS manipulates DOM directly, Svelte manages DOM via reactivity. Direct manipulation conflicts with Svelte.

**Solution:** "Cancel + Update" strategy:
1. SortableJS detects drag gesture → determines source/target/position
2. **Cancel DOM changes** (revert element to original position)
3. Update `dataStore` (modify `taskIds` arrays in groups)
4. Svelte reacts to store change and **re-renders** board in correct order

SortableJS = "ears" (listens to drags), Svelte = "hands" (draws result).

**Implementation:** See [src/ui/useSortable.ts](src/ui/useSortable.ts)

### Status Transitions

When moving tasks between groups (drag-and-drop), automatic status transitions apply:

| From Group | To Group | Status Change |
|------------|----------|---------------|
| Any | `completed` | → `completed`, set `completedAt` |
| `completed` | Any working | → `inProgress`, clear `completedAt` |
| `backlog` (status=`new`) | Any working | → `inProgress` |
| Working | Working | No change |
| Any | `backlog` | No change |

**Implementation:** See [src/logic/statusTransitions.ts](src/logic/statusTransitions.ts)

### Delete with Undo (Toast Mechanism)

1. User clicks delete → UUID removed from `taskIds` → task disappears from board
2. Task object remains in `tasks` dictionary (temporarily orphaned)
3. Toast appears for 7 seconds with countdown
4. **Undo clicked:** UUID restored to `taskIds` at original position
5. **Timer expires:** Task object deleted from `tasks` dictionary

**Toast stacking:** Max 3 toasts on screen. 4th toast evicts oldest.

**Implementation:** See [src/ui/DeleteToast.svelte](src/ui/DeleteToast.svelte)

### Data Cleanup on Load

On every plugin load, run sequentially:
1. **Migrate data** (`migrateData()`) — update schema if needed
2. **Auto-cleanup completed** — remove tasks older than `completedRetentionDays` from completed group
3. **Cleanup orphaned** — collect all `taskIds` from all groups, delete tasks not referenced anywhere

**Implementation:** See [src/data/cleanup.ts](src/data/cleanup.ts) and [src/data/migration.ts](src/data/migration.ts)

## Working with the Codebase

### Adding a New Feature

**Before writing code:**
1. Read [docs/overview.md](docs/overview.md) to understand product vision
2. Read [docs/technical.md](docs/technical.md) to understand technical decisions
3. Check if feature affects data schema → add migration if needed

**When adding UI:**
1. Create component in `src/ui/` with `.svelte` extension
2. Add ALL styles to [src/styles.css](src/styles.css) with `tm-` prefix
3. Use BEM notation for class names
4. Subscribe to stores with `$dataStore`, `$uiStore` syntax

**When modifying data:**
1. Update types in [src/data/types.ts](src/data/types.ts)
2. Update defaults in [src/data/defaults.ts](src/data/defaults.ts)
3. Add migration in [src/data/migration.ts](src/data/migration.ts) if changing schema
4. Update store operations in [src/stores/dataStore.ts](src/stores/dataStore.ts)

### Localization

**Adding new text:**
1. Add key to [src/i18n/en.ts](src/i18n/en.ts) and [src/i18n/ru.ts](src/i18n/ru.ts)
2. Use in components: `import { t } from '../i18n'; const tr = $t; tr('key.path')`
3. For nested objects, use dot notation: `tr('groups.focus.title')`

### Building & Testing

```bash
# Development mode (watch)
npm run dev

# Production build
npm run build
```

**Testing checklist:**
- Test in both light and dark themes
- Test drag & drop between all group combinations
- Test undo delete with multiple toasts
- Test status transitions (backlog → working, working → completed, completed → working)
- Test WIP limit visual indicators (normal → overdue)
- Verify no CSS collisions (check dev console for style conflicts)

## Common Tasks

### Adding a new task field

1. Add field to `Task` interface in [src/data/types.ts](src/data/types.ts)
2. Update `createDefaultTask()` in [src/data/defaults.ts](src/data/defaults.ts)
3. Add migration in [src/data/migration.ts](src/data/migration.ts) to add field to existing tasks
4. Update [src/ui/TaskFormContent.svelte](src/ui/TaskFormContent.svelte) to include field in form
5. Update [src/ui/TaskCard.svelte](src/ui/TaskCard.svelte) to display field
6. Add translations to [src/i18n/en.ts](src/i18n/en.ts) and [src/i18n/ru.ts](src/i18n/ru.ts)
7. Update [docs/technical.md](docs/technical.md) to document the change

### Adding a new CSS class

1. Choose semantic name with `tm-` prefix (e.g., `tm-new-feature`)
2. Use BEM for modifiers (e.g., `tm-new-feature--active`)
3. Add to [src/styles.css](src/styles.css) in appropriate section
4. Use Obsidian CSS variables for colors/spacing where possible
5. Test in both light and dark themes

### Modifying drag & drop behavior

1. Read [src/ui/useSortable.ts](src/ui/useSortable.ts) to understand current implementation
2. Modify SortableJS options if needed (animation, handle, etc.)
3. Test thoroughly — drag & drop is critical functionality
4. Ensure status transitions still work correctly

## Security & Best Practices

**Security:**
- NO `{@html}` directive — use `{variable}` interpolation (auto-escapes HTML)
- Field length limits enforced via `maxlength` attribute on inputs
- UUID collision resistance via `crypto.randomUUID()`

**Performance:**
- Immutable store updates minimize re-renders
- Flat task dictionary enables O(1) task lookup
- SortableJS handles large lists efficiently
- No external heavy dependencies

**Data Integrity:**
- Always call `persist()` after dataStore modifications
- Migrations run on load, never lose data
- Orphaned task cleanup prevents data.json bloat
- Toast mechanism prevents accidental data loss

## Troubleshooting

**CSS not applying:**
- Check for `tm-` prefix on all classes
- Verify no typos in class names
- Check if Obsidian built-in class is overriding (use more specific selector)

**Drag & drop not working:**
- Check [src/ui/useSortable.ts](src/ui/useSortable.ts) is applied to correct element
- Verify `taskIds` array updates in dataStore
- Check browser console for SortableJS errors

**Data not persisting:**
- Verify `persist()` is called after dataStore.update()
- Check browser console for saveData() errors
- Confirm data.json exists in `.obsidian/plugins/obsidian-taskmaster/`

**TypeScript errors:**
- Run `npm run dev` to see full type checking output
- Check imports from [src/data/types.ts](src/data/types.ts)
- Verify strict mode compliance (no implicit any)

## Release Process

1. Update version in [manifest.json](manifest.json) and [package.json](package.json)
2. Update [CHANGELOG.md](CHANGELOG.md) and [CHANGELOG.ru.md](CHANGELOG.ru.md)
3. Run `npm run build` to generate production files
4. Test production build in Obsidian
5. Create git tag: `git tag 0.x.0 && git push --tags`
6. Create GitHub release with `main.js`, `manifest.json`, `styles.css` attached

## Useful Commands

```bash
# Install dependencies
npm install

# Development (watch mode)
npm run dev

# Production build
npm run build

# Type checking
npx tsc --noEmit

# Lint (if configured)
npx eslint src/
```

## Git Hygiene

**Build artifacts vs source files in `.gitignore`:**

The root-level `main.js` and `styles.css` are Obsidian plugin build artifacts (generated by esbuild). They MUST be ignored in git. However, `.gitignore` patterns without a leading `/` match files in ALL subdirectories — so a pattern like `styles.css` would accidentally ignore `src/styles.css` (source file).

**Rule:** Always use a leading `/` for root-level build artifacts:
```
/main.js      ✅ ignores only root build artifact
/styles.css   ✅ ignores only root build artifact
main.js       ❌ would also ignore src/main.js, nested/main.js etc.
styles.css    ❌ would also ignore src/styles.css (source!)
```

**Before committing:** verify source files are tracked:
```bash
git ls-files src/        # should list all source files
git status               # check no source file appears in "untracked" or is missing
```

## Questions & Clarifications

When uncertain about:
- **Product decisions:** Consult [docs/overview.md](docs/overview.md) for intended behavior
- **Technical architecture:** Consult [docs/technical.md](docs/technical.md) for design rationale
- **Code patterns:** Look for similar existing code in the codebase
- **CSS conventions:** ALWAYS use `tm-` prefix, NEVER skip this rule

## Final Reminders

✅ **DO:**
- Prefix ALL CSS classes with `tm-`
- Add all styles to [src/styles.css](src/styles.css)
- Call `persist()` after dataStore updates
- Test in both light and dark themes
- Update migrations when changing data schema
- Update both English and Russian translations

❌ **DON'T:**
- Use `<style>` blocks in Svelte components
- Forget `tm-` prefix on CSS classes
- Use `{@html}` directive
- Modify DOM directly (let Svelte handle it)
- Skip migrations when changing schema
- Forget to test drag & drop after changes
