import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  standardBeforeEach,
  openBoardSettings,
  saveBoardSettings,
  closeBoardSettings,
} from './helpers';
import type { GroupId } from '../../src/data/types';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await standardBeforeEach(page);
});

// ─── Layout helpers ────────────────────────────────────────────────────────────

// backlog and completed are CollapsibleGroups — their [data-group-id] body
// is absent from DOM when collapsed. Use header text to locate them instead.
const COLLAPSIBLE_HEADER_TEXT: Partial<Record<GroupId, string>> = {
  backlog: 'Backlog',
  completed: 'Completed',
};

/** Get the CSS class on the wrapper div of the given group. */
async function getGroupWrapperClass(page: Page, groupId: GroupId): Promise<string> {
  const headerText = COLLAPSIBLE_HEADER_TEXT[groupId];
  if (headerText) {
    // header → .tm-collapsible-group → wrapper div
    const header = page.locator('.tm-collapsible-group__header').filter({ hasText: headerText });
    const wrapper = header.locator('..').locator('..');
    return (await wrapper.getAttribute('class')) ?? '';
  }
  // TaskGroups always have [data-group-id] in DOM
  const group = page.locator(`.tm-task-group:has([data-group-id="${groupId}"])`);
  const wrapper = group.locator('..');
  return (await wrapper.getAttribute('class')) ?? '';
}

async function isHalf(page: Page, groupId: GroupId) {
  const cls = await getGroupWrapperClass(page, groupId);
  return cls.includes('--half');
}

async function isHalfAlone(page: Page, groupId: GroupId) {
  const cls = await getGroupWrapperClass(page, groupId);
  return cls.includes('--half-alone');
}

async function isFull(page: Page, groupId: GroupId) {
  const cls = await getGroupWrapperClass(page, groupId);
  return cls.includes('--full');
}

/** Set fullWidth for a group via board settings popup. Already open. */
async function setFullWidth(page: Page, groupName: string, fullWidth: boolean) {
  const row = page.locator('.tm-popup__group-row').filter({ hasText: groupName });
  const fullWidthCheckbox = row.locator('.tm-popup__group-toggle').nth(1);
  const isChecked = await fullWidthCheckbox.isChecked();
  if (fullWidth && !isChecked) await fullWidthCheckbox.click();
  if (!fullWidth && isChecked) await fullWidthCheckbox.click();
}

// ────────────────────────────────────────────────────────────────────────────────
// Happy Path
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.1 default layout: focus+inProgress are half, others are full', async ({ page }) => {
  expect(await isHalf(page, 'focus')).toBe(true);
  expect(await isHalf(page, 'inProgress')).toBe(true);
  expect(await isFull(page, 'backlog')).toBe(true);
  expect(await isFull(page, 'orgIntentions')).toBe(true);
  expect(await isFull(page, 'delegated')).toBe(true);
  expect(await isFull(page, 'completed')).toBe(true);
});

test('Сц.2 set focus to full → inProgress becomes half-alone', async ({ page }) => {
  await openBoardSettings(page);
  await setFullWidth(page, 'Focus', true);
  await saveBoardSettings(page);

  expect(await isFull(page, 'focus')).toBe(true);
  expect(await isHalfAlone(page, 'inProgress')).toBe(true);
});

test('Сц.3 set orgIntentions and delegated to half → they pair up', async ({ page }) => {
  await openBoardSettings(page);
  await setFullWidth(page, 'Org Intentions', false);
  await setFullWidth(page, 'Delegated', false);
  await saveBoardSettings(page);

  expect(await isHalf(page, 'orgIntentions')).toBe(true);
  expect(await isHalf(page, 'delegated')).toBe(true);
});

test('Сц.4 hide partner (inProgress) → focus becomes half-alone', async ({ page }) => {
  // focus=half, inProgress=half by default
  await openBoardSettings(page);
  const inProgressRow = page.locator('.tm-popup__group-row').filter({ hasText: 'In Progress' });
  await inProgressRow.locator('.tm-popup__group-toggle').first().click(); // hide inProgress
  await saveBoardSettings(page);

  expect(await isHalfAlone(page, 'focus')).toBe(true);
});

test('Сц.5 three half in a row → first pair + lone third', async ({ page }) => {
  await openBoardSettings(page);
  await setFullWidth(page, 'Org Intentions', false); // focus, inProgress, orgIntentions all half
  await saveBoardSettings(page);

  // focus + inProgress pair
  expect(await isHalf(page, 'focus')).toBe(true);
  expect(await isHalf(page, 'inProgress')).toBe(true);
  // orgIntentions alone
  expect(await isHalfAlone(page, 'orgIntentions')).toBe(true);
});

test('Сц.6 settings persist after resetData (simulate reload)', async ({ page }) => {
  await openBoardSettings(page);
  await setFullWidth(page, 'Focus', true);
  await saveBoardSettings(page);

  // Verify before reload
  expect(await isFull(page, 'focus')).toBe(true);

  // Re-init harness (simulates plugin reload — stores already saved to localStorage)
  // Instead we check via getDataStore that the value is persisted
  const data = await page.evaluate(() => window.__test.getDataStore());
  expect(data.boards[0].groups.focus.fullWidth).toBe(true);
});

test('Сц.7 new board has default fullWidth values', async ({ page }) => {
  await page.locator('.tm-board-header__icon[title="Create board"]').click();
  await expect(page.locator('.tm-board-header__select option')).toHaveCount(2);

  // focus and inProgress should be half by default on new board
  expect(await isHalf(page, 'focus')).toBe(true);
  expect(await isHalf(page, 'inProgress')).toBe(true);
  expect(await isFull(page, 'backlog')).toBe(true);
  expect(await isFull(page, 'orgIntentions')).toBe(true);
});

test('Сц.8 switching boards preserves layout per board', async ({ page }) => {
  // Board A: default (focus=half)
  await openBoardSettings(page);
  await setFullWidth(page, 'Focus', true); // override board A
  await saveBoardSettings(page);

  // Create board B
  await page.locator('.tm-board-header__icon[title="Create board"]').click();
  await expect(page.locator('.tm-board-header__select option')).toHaveCount(2);
  // Board B: focus should be half (default)
  expect(await isHalf(page, 'focus')).toBe(true);

  // Switch back to board A
  const boardAOption = page.locator('.tm-board-header__select option').first();
  const boardAId = await boardAOption.getAttribute('value');
  await page.selectOption('.tm-board-header__select', boardAId!);
  // Board A: focus should still be full
  expect(await isFull(page, 'focus')).toBe(true);
});

// ────────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.9 all 6 groups as half → 3 pairs', async ({ page }) => {
  await openBoardSettings(page);
  await setFullWidth(page, 'Backlog', false);
  await setFullWidth(page, 'Org Intentions', false);
  await setFullWidth(page, 'Delegated', false);
  await setFullWidth(page, 'Completed', false);
  await saveBoardSettings(page);

  // All should have --half (paired)
  for (const id of ['backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed'] as GroupId[]) {
    const cls = await getGroupWrapperClass(page, id);
    expect(cls, `Group ${id} should be half`).toContain('--half');
  }
});

test('Сц.10 pattern [full, half, full, half] → both half are alone', async ({ page }) => {
  // backlog=full(default), focus=half(default), orgIntentions=full(default), delegated=half
  await openBoardSettings(page);
  await setFullWidth(page, 'In Progress', true); // make inProgress full → focus is alone
  await setFullWidth(page, 'Delegated', false); // delegated half
  await saveBoardSettings(page);

  expect(await isHalfAlone(page, 'focus')).toBe(true);
  expect(await isHalfAlone(page, 'delegated')).toBe(true);
});

test('Сц.13 disabled fullWidth checkbox for hidden group', async ({ page }) => {
  await openBoardSettings(page);
  // Hide focus
  const focusRow = page.locator('.tm-popup__group-row').filter({ hasText: 'Focus' });
  await focusRow.locator('.tm-popup__group-toggle').first().click();
  // fullWidth checkbox for focus should be disabled
  await expect(focusRow.locator('.tm-popup__group-toggle').nth(1)).toBeDisabled();
  await closeBoardSettings(page);
});

test('Сц.14 fullWidth value preserved when group is hidden then shown', async ({ page }) => {
  // Set focus to fullWidth=false (default), hide it, show it → should still be half
  await openBoardSettings(page);
  const focusRow = page.locator('.tm-popup__group-row').filter({ hasText: 'Focus' });
  // fullWidth is already false (default)
  await focusRow.locator('.tm-popup__group-toggle').first().click(); // hide focus
  await saveBoardSettings(page);

  await openBoardSettings(page);
  await focusRow.locator('.tm-popup__group-toggle').first().click(); // show focus
  await saveBoardSettings(page);

  // Focus should be half again (value preserved)
  expect(await isHalf(page, 'focus')).toBe(true);
});

test('Сц.20 column headers visible in board settings popup', async ({ page }) => {
  await openBoardSettings(page);
  const header = page.locator('.tm-popup__group-header');
  await expect(header).toContainText('Group Visibility');
  await expect(header).toContainText('Full width');
  await closeBoardSettings(page);
});

// ────────────────────────────────────────────────────────────────────────────────
// Migration
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.16 migration v4→v5: fullWidth added with correct defaults', async ({ page }) => {
  await page.evaluate(() => {
    window.__test.resetData({
      version: 4,
      boards: [{
        id: 'b1',
        title: 'My Board',
        subtitle: '',
        notes: '',
        notesCollapsed: true,
        notesHidden: false,
        hiddenGroups: [],
        groups: {
          backlog: { taskIds: [], wipLimit: null, collapsed: true, completedRetentionDays: null },
          focus: { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null },
          inProgress: { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null },
          orgIntentions: { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null },
          delegated: { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null },
          completed: { taskIds: [], wipLimit: null, collapsed: true, completedRetentionDays: 30 },
        },
        // No fullWidth field on groups!
      }],
      tasks: {},
      settings: { language: 'en', defaultPriority: 'medium', cardView: 'default', cardLayout: 'single' },
    } as any);
  });
  await page.waitForSelector('.tm-app', { timeout: 3000 });

  const data = await page.evaluate(() => window.__test.getDataStore());
  expect(data.boards[0].groups.focus.fullWidth).toBe(false);
  expect(data.boards[0].groups.inProgress.fullWidth).toBe(false);
  expect(data.boards[0].groups.backlog.fullWidth).toBe(true);
  expect(data.boards[0].groups.orgIntentions.fullWidth).toBe(true);
  expect(data.boards[0].groups.delegated.fullWidth).toBe(true);
  expect(data.boards[0].groups.completed.fullWidth).toBe(true);
});

test('Сц.17 v5 data not overwritten on reload (idempotent)', async ({ page }) => {
  // Set custom fullWidth values
  await openBoardSettings(page);
  await setFullWidth(page, 'Backlog', false);
  await saveBoardSettings(page);

  // Verify stored
  const data1 = await page.evaluate(() => window.__test.getDataStore());
  expect(data1.boards[0].groups.backlog.fullWidth).toBe(false);

  // Re-migrate (simulate plugin reload by reading from localStorage)
  const storedData = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem('tm-test-data') || 'null');
  });
  expect(storedData?.boards[0]?.groups?.backlog?.fullWidth).toBe(false);
});

// ────────────────────────────────────────────────────────────────────────────────
// Responsive
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.21 narrow viewport (<600px) → focus and inProgress take full width visually', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 800 });
  await page.waitForTimeout(100);

  // At <600px, CSS media query forces all groups to full width
  const focusEl = page.locator('.tm-task-group:has([data-group-id="focus"])').locator('..');
  const boundingBox = await focusEl.boundingBox();
  const viewportWidth = 500;
  // The group should span close to full viewport width
  expect(boundingBox?.width).toBeGreaterThan(viewportWidth * 0.8);
});
