# TaskMaster for Obsidian

> [Русская версия](README.ru.md)

A task management plugin for [Obsidian](https://obsidian.md) with SMART-style cards and a visual board designed for project managers.

![TaskMaster Board](docs/screenshots/board-en.png)

## Features

- **Visual board** with 6 fixed groups: Backlog, Focus, In Progress, Org. Intentions, Delegated, Completed
- **SMART task cards** with structured fields: What, Why, Who, When, Priority, Status
- **Drag & drop** — reorder cards within groups and move between groups
- **WIP limits** — configurable per-group limits with visual overload indicator
- **Undo delete** — 7-second toast with undo button, up to 3 stacked toasts
- **Multiple boards** — separate boards for different projects or contexts
- **Overdue highlighting** — red border on cards past their deadline
- **Auto-cleanup** — completed tasks are automatically removed after a configurable retention period (default 30 days)
- **Status transitions** — automatic status changes when moving cards between groups
- **Theme support** — uses Obsidian CSS variables, works with any theme (light/dark)

## Task Groups

| Group | Purpose |
|-------|---------|
| **Backlog** | Incoming tasks not yet started. Collapsible, collapsed by default |
| **Focus** | Tasks requiring close attention right now |
| **In Progress** | Tasks you are personally working on |
| **Org. Intentions** | Goals planned for the current week |
| **Delegated** | Tasks assigned to colleagues, requiring periodic check-ins |
| **Completed** | Archive of finished tasks with auto-cleanup |

## Task Card

Each task contains structured SMART fields:

| Field | Description |
|-------|-------------|
| **What** | Task description (required) |
| **Why** | Purpose / expected outcome |
| **Who** | Assignee |
| **When** | Deadline |
| **Priority** | Low / Medium / High |
| **Status** | New / In Progress / Waiting / Completed |

Card indicators: priority icon, status icon, deadline, overdue border, assignee.

## Why TaskMaster?

There are several task management plugins for Obsidian, but none of them offer an out-of-the-box combination of:

1. **Opinionated group structure** — six purpose-driven groups (Backlog, Focus, In Progress, Org Intentions, Delegated, Completed) instead of generic columns
2. **SMART-style cards** — structured fields (What, Why, Who, When, Priority, Status) on every task, not just plain text
3. **Visual drag & drop board** — move cards between groups with automatic status transitions

| Plugin / Tool | Visual Board | Structured Fields | Fixed Methodology |
|---------------|:---:|:---:|:---:|
| **TaskMaster** | + | + | + |
| Kanban (mgmeyers) | + | - | - |
| CardBoard (roovo) | + | - | - |
| Tasks (obsidian-tasks-group) | - | +/- | - |
| Projects (obsidian-projects) | + | - | - |
| Trello / Notion / ClickUp | + | + | - |

Closest alternatives require assembling 2-3 plugins (Tasks + Kanban + templates) or using cloud-based SaaS tools. TaskMaster fills the gap as an **opinionated, local-first task management tool** for project managers inside Obsidian.

## Installation

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest)
2. Create folder: `<vault>/.obsidian/plugins/obsidian-taskmaster/`
3. Copy the three files into this folder
4. Open Obsidian Settings → Community Plugins → Enable "TaskMaster"

### Installation via BRAT

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. In BRAT settings, click "Add Beta Plugin"
3. Enter the repository URL: `https://github.com/lesovsky/obsidian-taskmaster`
4. Enable the plugin in Community Plugins settings

### From Community Plugins (coming soon)

Once registered in the Obsidian community plugin registry, install directly from Settings → Community Plugins → Browse.

## Development

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- npm

### Setup

```bash
git clone https://github.com/lesovsky/obsidian-taskmaster.git
cd obsidian-taskmaster
npm install
```

### Build

```bash
# Development (watch mode)
npm run dev

# Production build
npm run build
```

Production build outputs `main.js` and `styles.css` to the project root.

### Creating a Release

```bash
npm run build
gh release create 0.1.0 main.js manifest.json styles.css --title "0.1.0" --notes "Initial release"
```

## License

[MIT](LICENSE)
