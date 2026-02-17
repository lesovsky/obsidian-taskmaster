# Changelog

All notable changes to Obsidian TaskMaster will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Quick Notes section below the Completed group — a collapsible textarea for jotting down quick thoughts, links, and ideas without creating a full task. Per-board, auto-saved with debounce
- New task status "Meeting" (📞) to visually distinguish calls and meetings from regular work tasks in daily planning
- Quick Complete button (☑) on every task card — one click moves the task to the top of the Completed group with `completed` status, without opening the edit modal
- Undo Quick Complete via toast notification (7-second window), unified with the delete undo queue (max 3 toasts)
- Compact card view mode for working with large task lists
- Internationalization (i18n) support with English and Russian languages

### Changed
- Toast type is now a discriminated union (`delete` | `complete`) for type-safe handling
- Updated settings data structure with `language` and `cardView` fields
- Data schema version updated to `3` with automatic migration

### Fixed
- Fixed deadline date overlapping with action buttons in normal card mode
- Fixed task group stretching caused by long task names

## [0.1.0] - 2026-02-14

### Added
- Initial plugin release with visual task board and 6 groups
- SMART-structured task cards (What, Why, Who, When, Priority, Status)
- Drag-and-drop task movement between groups
- WIP limits for groups with visual overflow indicators
- Undo task deletion with toast notifications (7-second window)
- Automatic status transitions when moving tasks between groups
- Auto-cleanup of completed tasks based on configurable retention period
- Multiple boards support with board selector
- Overdue indicator (red card border when deadline is exceeded)
- Collapsible groups (Backlog and Completed)

---

[Unreleased]: https://github.com/lesovsky/obsidian-taskmaster/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lesovsky/obsidian-taskmaster/releases/tag/v0.1.0
