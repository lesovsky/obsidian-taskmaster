import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  standardBeforeEach,
  createTask,
  moveTask,
  openBoardSettings,
  saveBoardSettings,
  closeBoardSettings,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await standardBeforeEach(page);
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function setCardLayout(page: Page, layout: 'single' | 'multi') {
  await page.evaluate((l: string) => window.__test.updateSettings({ cardLayout: l as any }), layout);
  // Wait for Svelte to flush DOM: focus is always visible and half-width → 2 cols in multi, 1 in single
  const expectedCols = layout === 'multi' ? '2' : '1';
  await page.waitForFunction(
    (cols: string) => {
      const el = document.querySelector('[data-group-id="focus"]') as HTMLElement | null;
      return el?.style.getPropertyValue('--tm-card-columns').trim() === cols;
    },
    expectedCols,
  );
}

/** Returns the --tm-card-columns CSS variable value from the group body. */
async function getCardColumns(page: Page, groupId: string): Promise<string> {
  return page.evaluate((id: string) => {
    const el = document.querySelector(`[data-group-id="${id}"]`) as HTMLElement | null;
    return el ? el.style.getPropertyValue('--tm-card-columns').trim() : '';
  }, groupId);
}

/** Returns true if the group body has the --multi CSS class. */
async function isMultiClass(page: Page, groupId: string): Promise<boolean> {
  return page.evaluate((id: string) => {
    const el = document.querySelector(`[data-group-id="${id}"]`);
    if (!el) return false;
    return el.classList.contains('tm-task-group__body--multi') ||
           el.classList.contains('tm-collapsible-group__body--multi');
  }, groupId);
}

// ────────────────────────────────────────────────────────────────────────────────
// TC-1: Default state
// ────────────────────────────────────────────────────────────────────────────────

test('TC-1 default cardLayout is single — no --multi class on groups', async ({ page }) => {
  // focus and orgIntentions are always visible
  expect(await isMultiClass(page, 'focus')).toBe(false);
  expect(await isMultiClass(page, 'orgIntentions')).toBe(false);

  // --tm-card-columns should be 1
  expect(await getCardColumns(page, 'focus')).toBe('1');
  expect(await getCardColumns(page, 'orgIntentions')).toBe('1');
});

// ────────────────────────────────────────────────────────────────────────────────
// TC-2: Switch to multi
// ────────────────────────────────────────────────────────────────────────────────

test('TC-2 switch to multi → full-width group gets 4 columns, half-width gets 2', async ({ page }) => {
  await setCardLayout(page, 'multi');

  // orgIntentions is full-width by default
  expect(await isMultiClass(page, 'orgIntentions')).toBe(true);
  expect(await getCardColumns(page, 'orgIntentions')).toBe('4');

  // focus is half-width by default
  expect(await isMultiClass(page, 'focus')).toBe(true);
  expect(await getCardColumns(page, 'focus')).toBe('2');
});

// ────────────────────────────────────────────────────────────────────────────────
// TC-3: Switch back to single
// ────────────────────────────────────────────────────────────────────────────────

test('TC-3 switch back to single → --multi class removed, columns=1', async ({ page }) => {
  await setCardLayout(page, 'multi');
  await setCardLayout(page, 'single');

  expect(await isMultiClass(page, 'focus')).toBe(false);
  expect(await isMultiClass(page, 'orgIntentions')).toBe(false);
  expect(await getCardColumns(page, 'focus')).toBe('1');
  expect(await getCardColumns(page, 'orgIntentions')).toBe('1');
});

// ────────────────────────────────────────────────────────────────────────────────
// TC-4: Full-width group, multi → 4 columns
// ────────────────────────────────────────────────────────────────────────────────

test('TC-4 full-width group with tasks in multi → 4 columns', async ({ page }) => {
  // Create 8 tasks in orgIntentions (full-width)
  for (let i = 1; i <= 8; i++) {
    await createTask(page, 'orgIntentions', { what: `Task ${i}` });
  }
  await setCardLayout(page, 'multi');

  expect(await getCardColumns(page, 'orgIntentions')).toBe('4');
  await expect(page.locator('[data-group-id="orgIntentions"] .tm-task-card')).toHaveCount(8);
});

// ────────────────────────────────────────────────────────────────────────────────
// TC-5: Half-width group, multi → 2 columns
// ────────────────────────────────────────────────────────────────────────────────

test('TC-5 half-width group with tasks in multi → 2 columns', async ({ page }) => {
  // Create 8 tasks in focus (half-width)
  for (let i = 1; i <= 8; i++) {
    await createTask(page, 'focus', { what: `Focus ${i}` });
  }
  await setCardLayout(page, 'multi');

  expect(await getCardColumns(page, 'focus')).toBe('2');
  await expect(page.locator('[data-group-id="focus"] .tm-task-card')).toHaveCount(8);
});

// ────────────────────────────────────────────────────────────────────────────────
// TC-7: Empty state in multi — body has --multi class
// ────────────────────────────────────────────────────────────────────────────────

test('TC-7 empty group in multi → body still has --multi class', async ({ page }) => {
  await setCardLayout(page, 'multi');

  // focus has no tasks — should have --multi class and show empty state
  expect(await isMultiClass(page, 'focus')).toBe(true);
  // EmptyState should still be visible
  const emptyState = page.locator('[data-group-id="focus"] .tm-empty-state');
  await expect(emptyState).toBeVisible();
});

// ────────────────────────────────────────────────────────────────────────────────
// TC-8: DnD within group in multi mode
// ────────────────────────────────────────────────────────────────────────────────

test('TC-8 DnD within group works in multi mode', async ({ page }) => {
  await createTask(page, 'focus', { what: 'Task A' });
  await createTask(page, 'focus', { what: 'Task B' });
  await setCardLayout(page, 'multi');

  // Get task ids
  const taskIds = await page.locator('[data-group-id="focus"] [data-task-id]').evaluateAll(
    (els) => els.map(el => el.getAttribute('data-task-id')!),
  );
  expect(taskIds.length).toBe(2);

  // Move first to second position
  await page.evaluate(([id, from, to]: string[]) => {
    window.__test.moveTask(id, from as any, to as any, 1);
  }, [taskIds[0], 'focus', 'focus']);

  await expect(page.locator('[data-group-id="focus"] .tm-task-card')).toHaveCount(2);
});

// ────────────────────────────────────────────────────────────────────────────────
// TC-9: DnD between groups in multi mode
// ────────────────────────────────────────────────────────────────────────────────

test('TC-9 DnD between groups works in multi mode', async ({ page }) => {
  const taskId = await createTask(page, 'orgIntentions', { what: 'Cross-group task' });
  await setCardLayout(page, 'multi');

  await moveTask(page, taskId, 'orgIntentions', 'delegated');

  await expect(page.locator('[data-group-id="delegated"] .tm-task-card')).toHaveCount(1);
  await expect(page.locator('[data-group-id="orgIntentions"] .tm-task-card')).toHaveCount(0);
});

// ────────────────────────────────────────────────────────────────────────────────
// TC-10: Compact + Multi
// ────────────────────────────────────────────────────────────────────────────────

test('TC-10 compact view + multi → groups still have --multi class', async ({ page }) => {
  await page.evaluate(() => window.__test.updateSettings({ cardView: 'compact', cardLayout: 'multi' }));
  // Wait for Svelte DOM update (same signal as setCardLayout uses)
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-group-id="focus"]') as HTMLElement | null;
    return el?.style.getPropertyValue('--tm-card-columns').trim() === '2';
  });

  expect(await isMultiClass(page, 'focus')).toBe(true);
  expect(await isMultiClass(page, 'orgIntentions')).toBe(true);
  expect(await getCardColumns(page, 'focus')).toBe('2');
  expect(await getCardColumns(page, 'orgIntentions')).toBe('4');
});

// ────────────────────────────────────────────────────────────────────────────────
// TC-13: Change group width in multi mode → columns update immediately
// ────────────────────────────────────────────────────────────────────────────────

test('TC-13 change group from full to half in multi → columns 4→2', async ({ page }) => {
  await setCardLayout(page, 'multi');
  // orgIntentions is full-width → 4 cols
  expect(await getCardColumns(page, 'orgIntentions')).toBe('4');

  // Change orgIntentions to half-width
  await openBoardSettings(page);
  const orgRow = page.locator('.tm-popup__group-row').filter({ hasText: 'Org Intentions' });
  const fullWidthCb = orgRow.locator('.tm-popup__group-toggle').nth(1);
  if (await fullWidthCb.isChecked()) await fullWidthCb.click();
  await saveBoardSettings(page);

  // Now orgIntentions should be 2 cols
  expect(await getCardColumns(page, 'orgIntentions')).toBe('2');
});

// ────────────────────────────────────────────────────────────────────────────────
// TC-14: Settings persist (saved to localStorage)
// ────────────────────────────────────────────────────────────────────────────────

test('TC-14 cardLayout persists to localStorage', async ({ page }) => {
  await setCardLayout(page, 'multi');

  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('tm-test-data');
    return raw ? JSON.parse(raw) : null;
  });
  expect(stored?.settings?.cardLayout).toBe('multi');
});

// ────────────────────────────────────────────────────────────────────────────────
// TC-15: Migration v5→v6: cardLayout added
// ────────────────────────────────────────────────────────────────────────────────

test('TC-15 migration v5→v6: cardLayout defaults to single', async ({ page }) => {
  await page.evaluate(() => {
    window.__test.resetData({
      version: 5,
      boards: [{
        id: 'b1',
        title: 'My Board',
        subtitle: '',
        notes: '',
        notesCollapsed: true,
        notesHidden: false,
        hiddenGroups: [],
        groups: {
          backlog: { taskIds: [], wipLimit: null, collapsed: true, completedRetentionDays: null, fullWidth: true },
          focus: { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null, fullWidth: false },
          inProgress: { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null, fullWidth: false },
          orgIntentions: { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null, fullWidth: true },
          delegated: { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null, fullWidth: true },
          completed: { taskIds: [], wipLimit: null, collapsed: true, completedRetentionDays: 30, fullWidth: true },
        },
        // No cardLayout in settings!
      }],
      tasks: {},
      settings: { language: 'en', defaultPriority: 'medium', cardView: 'default' },
    } as any);
  });
  await page.waitForSelector('.tm-app', { timeout: 3000 });

  const data = await page.evaluate(() => window.__test.getDataStore());
  expect(data.settings.cardLayout).toBe('single');

  // groups should be in single mode
  expect(await isMultiClass(page, 'focus')).toBe(false);
  expect(await getCardColumns(page, 'focus')).toBe('1');
});

// ────────────────────────────────────────────────────────────────────────────────
// TC-16: Narrow viewport
// ────────────────────────────────────────────────────────────────────────────────

test('TC-16 narrow viewport (<600px) in multi mode → groups still render', async ({ page }) => {
  await setCardLayout(page, 'multi');
  await page.setViewportSize({ width: 480, height: 800 });
  await page.waitForTimeout(100);

  // Board still renders and multi class is present (CSS media query controls actual width)
  expect(await isMultiClass(page, 'focus')).toBe(true);
  await expect(page.locator('.tm-app')).toBeVisible();
});

// ────────────────────────────────────────────────────────────────────────────────
// EC-1: 1–3 tasks in multi full-width → columns still 4
// ────────────────────────────────────────────────────────────────────────────────

test('EC-1 1–3 tasks in full-width group multi → --tm-card-columns still 4', async ({ page }) => {
  await createTask(page, 'orgIntentions', { what: 'Only task' });
  await setCardLayout(page, 'multi');

  expect(await getCardColumns(page, 'orgIntentions')).toBe('4');
});

// ────────────────────────────────────────────────────────────────────────────────
// EC-3: Collapsible group (backlog) in multi → correct columns after expand
// ────────────────────────────────────────────────────────────────────────────────

test('EC-3 CollapsibleGroup (backlog) in multi → 4 columns when expanded', async ({ page }) => {
  await createTask(page, 'backlog', { what: 'Backlog task' }, { expand: true });
  await setCardLayout(page, 'multi');

  // backlog is full-width → should have 4 cols
  const columns = await getCardColumns(page, 'backlog');
  expect(columns).toBe('4');
  expect(await isMultiClass(page, 'backlog')).toBe(true);
});

// ────────────────────────────────────────────────────────────────────────────────
// EC-4: Both settings default → no regression
// ────────────────────────────────────────────────────────────────────────────────

test('EC-4 single + default card view → create/edit/complete task works', async ({ page }) => {
  const taskId = await createTask(page, 'focus', { what: 'Normal task' });
  await expect(page.locator(`[data-task-id="${taskId}"]`)).toBeVisible();

  // Complete it
  await page.locator(`[data-task-id="${taskId}"] .tm-task-card__complete`).click();
  await expect(page.locator('.tm-toast')).toBeVisible();

  // Undo
  await page.locator('.tm-toast__undo').click();
  await expect(page.locator('[data-group-id="focus"] .tm-task-card')).toHaveCount(1);
});
