import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  standardBeforeEach,
  createTask,
  moveTask,
  expandGroup,
  openBoardSettings,
  saveBoardSettings,
  closeBoardSettings,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await standardBeforeEach(page);
});

// Helper: hide a group via board settings popup
async function hideGroup(page: Page, groupName: string) {
  await openBoardSettings(page);
  // Find the row by group name and uncheck visibility toggle
  const row = page.locator('.tm-popup__group-row').filter({ hasText: groupName });
  const visibilityCheckbox = row.locator('.tm-popup__group-toggle').first();
  if (await visibilityCheckbox.isChecked()) {
    await visibilityCheckbox.click();
  }
  await saveBoardSettings(page);
}

// Helper: show a group via board settings popup
async function showGroup(page: Page, groupName: string) {
  await openBoardSettings(page);
  const row = page.locator('.tm-popup__group-row').filter({ hasText: groupName });
  const visibilityCheckbox = row.locator('.tm-popup__group-toggle').first();
  if (!(await visibilityCheckbox.isChecked())) {
    await visibilityCheckbox.click();
  }
  await saveBoardSettings(page);
}

// ────────────────────────────────────────────────────────────────────────────────
// Happy path
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.1 hide and restore group — tasks preserved', async ({ page }) => {
  await createTask(page, 'orgIntentions', { what: 'Org task 1' });
  await createTask(page, 'orgIntentions', { what: 'Org task 2' });

  // Hide orgIntentions
  await hideGroup(page, 'Org Intentions');
  // Group is gone from board
  await expect(page.locator('.tm-task-group:has([data-group-id="orgIntentions"])')).not.toBeVisible();

  // Restore
  await showGroup(page, 'Org Intentions');
  // Group is back with 2 tasks
  await expect(page.locator('[data-group-id="orgIntentions"] .tm-task-card')).toHaveCount(2);
});

test('Сц.2 task counter shown in popup for non-empty groups', async ({ page }) => {
  await createTask(page, 'focus', { what: 'Focus task' });
  await createTask(page, 'focus', { what: 'Focus task 2' });

  await openBoardSettings(page);
  // Focus row should show (2)
  const focusRow = page.locator('.tm-popup__group-row').filter({ hasText: 'Focus' });
  await expect(focusRow.locator('.tm-popup__group-count')).toContainText('(2)');
  // InProgress row (no tasks) should NOT show counter
  const inProgressRow = page.locator('.tm-popup__group-row').filter({ hasText: 'In Progress' });
  await expect(inProgressRow.locator('.tm-popup__group-count')).not.toBeVisible();
  await closeBoardSettings(page);
});

test('Сц.3 Cancel discards changes', async ({ page }) => {
  await openBoardSettings(page);
  // Uncheck backlog (but don't save)
  const backlogRow = page.locator('.tm-popup__group-row').filter({ hasText: 'Backlog' });
  await backlogRow.locator('.tm-popup__group-toggle').first().click();
  await closeBoardSettings(page);

  // Backlog group header should still be visible on board (collapsed but present)
  await expect(page.locator('.tm-collapsible-group__header').filter({ hasText: 'Backlog' })).toBeVisible();
});

test('Сц.4 click overlay closes without saving', async ({ page }) => {
  await openBoardSettings(page);
  // Uncheck focus
  const focusRow = page.locator('.tm-popup__group-row').filter({ hasText: 'Focus' });
  await focusRow.locator('.tm-popup__group-toggle').first().click();
  // Click overlay
  await page.locator('.tm-popup-overlay').click({ position: { x: 10, y: 10 } });
  await page.waitForSelector('.tm-popup', { state: 'detached' });

  // Focus group still visible on board
  await expect(page.locator('[data-group-id="focus"]')).toBeVisible();
});

test('Сц.5 per-board visibility settings', async ({ page }) => {
  // Board A: hide delegated
  await hideGroup(page, 'Delegated');
  await expect(page.locator('.tm-task-group:has([data-group-id="delegated"])')).not.toBeVisible();

  // Create board B
  await page.locator('.tm-board-header__icon[title="Create board"]').click();
  await expect(page.locator('.tm-board-header__select option')).toHaveCount(2);

  // On board B: delegated should be visible
  await expect(page.locator('[data-group-id="delegated"]')).toBeVisible();

  // Hide focus on board B
  await hideGroup(page, 'Focus');
  await expect(page.locator('[data-group-id="focus"]')).not.toBeVisible();

  // Switch back to board A
  const firstOption = page.locator('.tm-board-header__select option').first();
  const boardAId = await firstOption.getAttribute('value');
  await page.selectOption('.tm-board-header__select', boardAId!);

  // Board A: focus visible, delegated hidden
  await expect(page.locator('[data-group-id="focus"]')).toBeVisible();
  await expect(page.locator('.tm-task-group:has([data-group-id="delegated"])')).not.toBeVisible();
});

// ────────────────────────────────────────────────────────────────────────────────
// Automation with hidden groups
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.7 delete task when completed is hidden → toast appears, undo works', async ({ page }) => {
  await createTask(page, 'focus', { what: 'Delete hidden completed' });
  await hideGroup(page, 'Completed');

  // Delete task
  await page.locator('[data-group-id="focus"] .tm-task-card .tm-task-card__delete').first().click();
  await expect(page.locator('.tm-toast')).toBeVisible();

  // Undo
  await page.locator('.tm-toast__undo').click();
  await expect(page.locator('[data-group-id="focus"] .tm-task-card')).toHaveCount(1);
});

test('Сц.8 add task when backlog is hidden → task created in visible group', async ({ page }) => {
  await hideGroup(page, 'Backlog');
  // Focus should still have + button
  await createTask(page, 'focus', { what: 'Task while backlog hidden' });
  await expect(page.locator('[data-group-id="focus"] .tm-task-card')).toHaveCount(1);
});

// ────────────────────────────────────────────────────────────────────────────────
// Protection against hiding last group
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.9 last visible group checkbox is disabled', async ({ page }) => {
  await openBoardSettings(page);
  // Hide 5 groups (leave only focus)
  const groups = ['Backlog', 'In Progress', 'Org Intentions', 'Delegated', 'Completed'];
  for (const name of groups) {
    const row = page.locator('.tm-popup__group-row').filter({ hasText: name });
    const cb = row.locator('.tm-popup__group-toggle').first();
    if (await cb.isEnabled()) {
      await cb.click();
    }
  }

  // Focus should now be the only visible one — checkbox disabled
  const focusRow = page.locator('.tm-popup__group-row').filter({ hasText: 'Focus' });
  await expect(focusRow.locator('.tm-popup__group-toggle').first()).toBeDisabled();
  await closeBoardSettings(page);
});

// ────────────────────────────────────────────────────────────────────────────────
// Layout when hiding focus / inProgress
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.10 hide focus → inProgress expands to full width', async ({ page }) => {
  await hideGroup(page, 'Focus');
  // inProgress should now be --half-alone or full width
  const inProgress = page.locator('.tm-task-group:has([data-group-id="inProgress"])').locator('..');
  // The parent div should have class containing 'full' or 'half-alone'
  const cls = await inProgress.getAttribute('class') ?? '';
  expect(cls).toMatch(/full|half-alone/);
});

test('Сц.11 hide inProgress → focus expands to full width', async ({ page }) => {
  await hideGroup(page, 'In Progress');
  const focus = page.locator('.tm-task-group:has([data-group-id="focus"])').locator('..');
  const cls = await focus.getAttribute('class') ?? '';
  expect(cls).toMatch(/full|half-alone/);
});

test('Сц.12 hide both focus and inProgress → no empty row', async ({ page }) => {
  await openBoardSettings(page);
  const focusRow = page.locator('.tm-popup__group-row').filter({ hasText: 'Focus' });
  await focusRow.locator('.tm-popup__group-toggle').first().click();
  const inProgressRow = page.locator('.tm-popup__group-row').filter({ hasText: 'In Progress' });
  await inProgressRow.locator('.tm-popup__group-toggle').first().click();
  await saveBoardSettings(page);

  // Neither group should be in DOM
  await expect(page.locator('[data-group-id="focus"]')).not.toBeVisible();
  await expect(page.locator('[data-group-id="inProgress"]')).not.toBeVisible();
  // Board layout should not have empty space
  await expect(page.locator('.tm-board-layout')).toBeVisible();
});

// ────────────────────────────────────────────────────────────────────────────────
// DnD
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.13 DnD between visible groups with hidden orgIntentions', async ({ page }) => {
  const taskId = await createTask(page, 'backlog', { what: 'DnD task' }, { expand: true });
  await hideGroup(page, 'Org Intentions');

  // Move backlog → focus
  await moveTask(page, taskId, 'backlog', 'focus');
  await expect(page.locator('[data-group-id="focus"] .tm-task-card')).toHaveCount(1);
  await expect(page.locator(`[data-task-id="${taskId}"] .tm-task-card__status`)).toContainText('🛠️');
});

// ────────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.14 toggle checkbox multiple times → only final state saved', async ({ page }) => {
  await openBoardSettings(page);
  const backlogRow = page.locator('.tm-popup__group-row').filter({ hasText: 'Backlog' });
  const cb = backlogRow.locator('.tm-popup__group-toggle').first();
  // Toggle 4 times (ends checked = visible)
  for (let i = 0; i < 4; i++) await cb.click();
  await saveBoardSettings(page);

  // Backlog should be visible (collapsed header present)
  await expect(page.locator('.tm-collapsible-group__header').filter({ hasText: 'Backlog' })).toBeVisible();
});

test('Сц.15 hide then show collapsed group → collapsed state preserved', async ({ page }) => {
  // Backlog is collapsed by default
  await hideGroup(page, 'Backlog');
  await showGroup(page, 'Backlog');
  // Backlog should still be collapsed (body not visible)
  await expect(page.locator('[data-group-id="backlog"]')).not.toBeVisible();
});

test('Сц.16 move task to group, hide then show group → task still there', async ({ page }) => {
  const taskId = await createTask(page, 'focus', { what: 'Move then hide' });
  await moveTask(page, taskId, 'focus', 'delegated');
  await hideGroup(page, 'Delegated');
  await showGroup(page, 'Delegated');
  await expect(page.locator('[data-group-id="delegated"] .tm-task-card')).toHaveCount(1);
});

// ────────────────────────────────────────────────────────────────────────────────
// Migration
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.17 migration v3→v4: hiddenGroups=[] added', async ({ page }) => {
  // Simulate v3 data (no hiddenGroups field)
  await page.evaluate(() => {
    window.__test.resetData({
      version: 3,
      boards: [{
        id: 'b1',
        title: 'My Board',
        subtitle: '',
        notes: '',
        notesCollapsed: true,
        notesHidden: false,
        groups: {
          backlog: { taskIds: [], wipLimit: null, collapsed: true, completedRetentionDays: null, fullWidth: true },
          focus: { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null, fullWidth: false },
          inProgress: { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null, fullWidth: false },
          orgIntentions: { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null, fullWidth: true },
          delegated: { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null, fullWidth: true },
          completed: { taskIds: [], wipLimit: null, collapsed: true, completedRetentionDays: 30, fullWidth: true },
        },
        // No hiddenGroups field!
      }],
      tasks: {},
      settings: { language: 'en', defaultPriority: 'medium', cardView: 'default', cardLayout: 'single' },
    } as any);
  });
  await page.waitForSelector('.tm-app', { timeout: 3000 });

  // All groups should be visible (hiddenGroups defaults to [])
  await expect(page.locator('[data-group-id="focus"]')).toBeVisible();
  await expect(page.locator('[data-group-id="inProgress"]')).toBeVisible();

  const data = await page.evaluate(() => window.__test.getDataStore());
  expect(data.boards[0].hiddenGroups).toEqual([]);
});

// ────────────────────────────────────────────────────────────────────────────────
// Localisation
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.18 board settings popup shows EN labels', async ({ page }) => {
  await openBoardSettings(page);
  await expect(page.locator('.tm-popup__section-title')).toContainText('Group Visibility');
  await expect(page.locator('.tm-popup__section-desc')).toContainText('Show or hide groups on this board');
  await closeBoardSettings(page);
});
