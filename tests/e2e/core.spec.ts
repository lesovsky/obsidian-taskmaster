import { test, expect } from '@playwright/test';
import {
  standardBeforeEach,
  resetData,
  createTask,
  fillTaskForm,
  moveTask,
  waitForToast,
  expandGroup,
  openBoardSettings,
  saveBoardSettings,
  closeBoardSettings,
  openGroupSettings,
  saveGroupSettings,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await standardBeforeEach(page);
});

// ────────────────────────────────────────────────────────────────────────────────
// Section 3 — Creating tasks
// ────────────────────────────────────────────────────────────────────────────────

test.describe('Section 3 — Creating tasks', () => {
  test('3.1 create task in focus → card appears, status=inProgress', async ({ page }) => {
    await createTask(page, 'focus', { what: 'Prepare report', why: 'For Q2 budget', who: 'Ivanov' });
    const card = page.locator('[data-group-id="focus"] .tm-task-card').first();
    await expect(card).toBeVisible();
    await expect(card.locator('.tm-task-card__status')).toContainText('🛠️');
  });

  test('3.2 create task in backlog → status=new', async ({ page }) => {
    await createTask(page, 'backlog', { what: 'Study competitors' }, { expand: true });
    const card = page.locator('[data-group-id="backlog"] .tm-task-card').first();
    await expect(card.locator('.tm-task-card__status')).toContainText('📋');
  });

  test('3.3 Save button disabled while "What" is empty', async ({ page }) => {
    await page.locator('.tm-task-group:has([data-group-id="focus"]) .tm-group-header__add').click();
    await page.waitForSelector('.tm-test-modal-overlay');
    const saveBtn = page.locator('.tm-task-form__btn--primary');
    await expect(saveBtn).toBeDisabled();
    await page.fill('#tm-what', 'Some text');
    await expect(saveBtn).toBeEnabled();
  });

  test('3.4 create 3 tasks → counter shows 3', async ({ page }) => {
    await createTask(page, 'inProgress', { what: 'Task 1' });
    await createTask(page, 'inProgress', { what: 'Task 2' });
    await createTask(page, 'inProgress', { what: 'Task 3' });
    const counter = page.locator('.tm-task-group:has([data-group-id="inProgress"]) .tm-group-header__counter');
    await expect(counter).toHaveText('(3)');
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// Section 4 — Editing tasks
// ────────────────────────────────────────────────────────────────────────────────

test.describe('Section 4 — Editing tasks', () => {
  test('4.1 click card → modal opens with pre-filled fields', async ({ page }) => {
    await createTask(page, 'focus', { what: 'Review code', who: 'Petrov' });
    await page.locator('[data-group-id="focus"] .tm-task-card').first().click();
    await page.waitForSelector('.tm-test-modal-overlay');

    const whatVal = await page.inputValue('#tm-what');
    expect(whatVal).toBe('Review code');
    // Edit modal has title "Edit Task"
    await expect(page.locator('.modal-title')).toContainText('Edit Task');
    // Delete button exists
    await expect(page.locator('.tm-task-form__btn--danger')).toBeVisible();
  });

  test('4.2 edit what field and priority → card updates', async ({ page }) => {
    await createTask(page, 'focus', { what: 'Original text' });
    await page.locator('[data-group-id="focus"] .tm-task-card').first().click();
    await page.waitForSelector('.tm-test-modal-overlay');

    await page.fill('#tm-what', 'Updated text');
    await page.selectOption('#tm-priority', 'high');
    await page.click('.tm-task-form__btn--primary');
    await page.waitForSelector('.tm-test-modal-overlay', { state: 'detached' });

    const card = page.locator('[data-group-id="focus"] .tm-task-card').first();
    await expect(card.locator('.tm-task-card__what')).toContainText('Updated text');
    await expect(card.locator('.tm-task-card__priority')).toContainText('🔴');
  });

  test('4.3 change status manually → icon updates, card stays in group', async ({ page }) => {
    await createTask(page, 'focus', { what: 'Status test' });
    await page.locator('[data-group-id="focus"] .tm-task-card').first().click();
    await page.waitForSelector('.tm-test-modal-overlay');

    await page.selectOption('#tm-status', 'waiting');
    await page.click('.tm-task-form__btn--primary');
    await page.waitForSelector('.tm-test-modal-overlay', { state: 'detached' });

    const card = page.locator('[data-group-id="focus"] .tm-task-card').first();
    await expect(card.locator('.tm-task-card__status')).toContainText('⏳');
    // card is still in focus group
    await expect(page.locator('[data-group-id="focus"] .tm-task-card')).toHaveCount(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// Section 5 — Deletion and Toast
// ────────────────────────────────────────────────────────────────────────────────

test.describe('Section 5 — Deletion and Toast', () => {
  test('5.1 delete via × button → card gone, toast appears', async ({ page }) => {
    await createTask(page, 'focus', { what: 'Delete me' });
    await page.locator('[data-group-id="focus"] .tm-task-card').first().hover();
    await page.locator('[data-group-id="focus"] .tm-task-card .tm-task-card__delete').first().click();

    await expect(page.locator('[data-group-id="focus"] .tm-task-card')).toHaveCount(0);
    await expect(page.locator('.tm-toast')).toBeVisible();
  });

  test('5.2 delete via modal → card gone, toast appears', async ({ page }) => {
    await createTask(page, 'focus', { what: 'Delete via modal' });
    await page.locator('[data-group-id="focus"] .tm-task-card').first().click();
    await page.waitForSelector('.tm-test-modal-overlay');
    await page.click('.tm-task-form__btn--danger');
    await page.waitForSelector('.tm-test-modal-overlay', { state: 'detached' });

    await expect(page.locator('[data-group-id="focus"] .tm-task-card')).toHaveCount(0);
    await expect(page.locator('.tm-toast')).toBeVisible();
  });

  test('5.3 undo deletion → card restored', async ({ page }) => {
    await createTask(page, 'focus', { what: 'Restore me' });
    await page.locator('[data-group-id="focus"] .tm-task-card .tm-task-card__delete').first().click();
    await expect(page.locator('.tm-toast')).toBeVisible();

    await page.locator('.tm-toast__undo').click();

    await expect(page.locator('[data-group-id="focus"] .tm-task-card')).toHaveCount(1);
    await expect(page.locator('[data-group-id="focus"] .tm-task-card .tm-task-card__what')).toContainText('Restore me');
  });

  test('5.4 timer expires → toast gone, task deleted permanently', async ({ page }) => {
    // clock.install() MUST come before page.goto() so the page loads with fake timers already
    // active. This test therefore performs its own goto instead of relying on beforeEach, which
    // already navigated with real timers. The repeated goto is intentional, not a copy-paste error.
    await page.clock.install();
    await page.goto('/');
    await standardBeforeEach(page);

    await createTask(page, 'focus', { what: 'Temp task' });
    await page.locator('[data-group-id="focus"] .tm-task-card .tm-task-card__delete').first().click();
    await expect(page.locator('.tm-toast')).toBeVisible();

    // Advance 8 seconds — toast timer fires
    await page.clock.fastForward(8000);
    await expect(page.locator('.tm-toast')).toHaveCount(0);
    await expect(page.locator('[data-group-id="focus"] .tm-task-card')).toHaveCount(0);
  });

  test('5.5 max 3 toasts visible simultaneously', async ({ page }) => {
    await createTask(page, 'focus', { what: 'Task A' });
    await createTask(page, 'focus', { what: 'Task B' });
    await createTask(page, 'focus', { what: 'Task C' });
    await createTask(page, 'focus', { what: 'Task D' });

    // Delete all 4 quickly
    for (let i = 0; i < 4; i++) {
      const cards = page.locator('[data-group-id="focus"] .tm-task-card');
      await cards.first().hover();
      await page.locator('[data-group-id="focus"] .tm-task-card .tm-task-card__delete').first().click();
    }

    // At most 3 toasts visible at once
    const toastCount = await page.locator('.tm-toast').count();
    expect(toastCount).toBeLessThanOrEqual(3);
    expect(toastCount).toBeGreaterThanOrEqual(1);
  });

  test('5.6 task name appears in toast message', async ({ page }) => {
    // Note: current implementation shows full task name in toast (no truncation).
    // This test verifies the toast text contains the task's what field.
    const taskName = 'A'.repeat(50);
    await createTask(page, 'focus', { what: taskName });
    await page.locator('[data-group-id="focus"] .tm-task-card .tm-task-card__delete').first().click();
    await expect(page.locator('.tm-toast')).toBeVisible();
    const toastText = await page.locator('.tm-toast__text').first().textContent();
    expect(toastText).toContain('Deleted:');
    expect(toastText).toContain(taskName.slice(0, 10)); // at least starts with our name
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// Section 6 — Drag and Drop (via window.__test.moveTask)
// ────────────────────────────────────────────────────────────────────────────────

test.describe('Section 6 — Drag and Drop', () => {
  test('6.3 backlog(new) → focus: status becomes inProgress', async ({ page }) => {
    const taskId = await createTask(page, 'backlog', { what: 'Backlog task' }, { expand: true });
    // Verify status is new
    await expect(page.locator(`[data-task-id="${taskId}"] .tm-task-card__status`)).toContainText('📋');

    await moveTask(page, taskId, 'backlog', 'focus');
    await expect(page.locator('[data-group-id="focus"] .tm-task-card')).toHaveCount(1);
    await expect(page.locator(`[data-task-id="${taskId}"] .tm-task-card__status`)).toContainText('🛠️');
  });

  test('6.4 any → completed: status becomes completed', async ({ page }) => {
    const taskId = await createTask(page, 'focus', { what: 'Finish me' });
    await moveTask(page, taskId, 'focus', 'completed');
    // completed group may be collapsed — expand to verify card
    await expandGroup(page, 'completed');
    await expect(page.locator(`[data-task-id="${taskId}"] .tm-task-card__status`)).toContainText('✅');
  });

  test('6.5 completed → focus: status=inProgress, completedAt cleared', async ({ page }) => {
    const taskId = await createTask(page, 'focus', { what: 'Return me' });
    await moveTask(page, taskId, 'focus', 'completed');
    await moveTask(page, taskId, 'completed', 'focus');

    await expect(page.locator(`[data-task-id="${taskId}"] .tm-task-card__status`)).toContainText('🛠️');

    const data = await page.evaluate(() => window.__test.getDataStore());
    expect(data.tasks[taskId].completedAt).toBe('');
  });

  test('6.2 focus → delegated: status unchanged', async ({ page }) => {
    const taskId = await createTask(page, 'focus', { what: 'Delegate' });
    const data0 = await page.evaluate(() => window.__test.getDataStore());
    const originalStatus = data0.tasks[taskId].status;

    await moveTask(page, taskId, 'focus', 'delegated');
    const data = await page.evaluate(() => window.__test.getDataStore());
    expect(data.tasks[taskId].status).toBe(originalStatus);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// Section 7 — Group collapsing
// ────────────────────────────────────────────────────────────────────────────────

test.describe('Section 7 — Collapsing groups', () => {
  test('7.1 toggle backlog: expand then collapse', async ({ page }) => {
    // Backlog is collapsed by default
    await expect(page.locator('[data-group-id="backlog"]')).not.toBeVisible();

    await expandGroup(page, 'backlog');
    await expect(page.locator('[data-group-id="backlog"]')).toBeVisible();

    // Collapse again — now body is in DOM so filter by text works too
    await page.locator('.tm-collapsible-group__header').filter({ hasText: 'Backlog' }).click();
    await expect(page.locator('[data-group-id="backlog"]')).not.toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// Section 8 — WIP limits
// ────────────────────────────────────────────────────────────────────────────────

test.describe('Section 8 — WIP limits', () => {
  test('8.1 set WIP=3 → counter shows (N/3)', async ({ page }) => {
    await createTask(page, 'inProgress', { what: 'Task 1' });
    await openGroupSettings(page, 'inProgress');
    await page.fill('#tm-wip', '3');
    await saveGroupSettings(page);

    const counter = page.locator('.tm-task-group:has([data-group-id="inProgress"]) .tm-group-header__counter');
    await expect(counter).toContainText('/3');
  });

  test('8.2 exceed WIP → counter turns red', async ({ page }) => {
    await createTask(page, 'inProgress', { what: 'T1' });
    await createTask(page, 'inProgress', { what: 'T2' });
    await createTask(page, 'inProgress', { what: 'T3' });
    await openGroupSettings(page, 'inProgress');
    await page.fill('#tm-wip', '2');
    await saveGroupSettings(page);

    const counter = page.locator('.tm-group-header__counter--over');
    await expect(counter).toBeVisible();
  });

  test('8.3 clear WIP → counter without fraction', async ({ page }) => {
    await openGroupSettings(page, 'inProgress');
    await page.fill('#tm-wip', '3');
    await saveGroupSettings(page);

    await openGroupSettings(page, 'inProgress');
    await page.fill('#tm-wip', '');
    await saveGroupSettings(page);

    const counter = page.locator('.tm-task-group:has([data-group-id="inProgress"]) .tm-group-header__counter');
    await expect(counter).not.toContainText('/');
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// Section 10 — Board management
// ────────────────────────────────────────────────────────────────────────────────

test.describe('Section 10 — Board management', () => {
  test('10.1 create board → switches to new board with 6 groups', async ({ page }) => {
    await page.click('.tm-board-header__icon[title="Create board"]');
    await expect(page.locator('.tm-board-header__select')).toContainText('New board');
    const selectValue = await page.locator('.tm-board-header__select').inputValue();
    // The select value is the new board's id; board title shows "New board"
    const selectText = await page.locator('.tm-board-header__select').textContent();
    expect(selectText).toContain('New board');
    // 6 groups exist on new board (4 task groups + 2 collapsible)
    await expect(page.locator('.tm-task-group')).toHaveCount(4);
  });

  test('10.2 tasks do not mix between boards', async ({ page }) => {
    await createTask(page, 'focus', { what: 'Board A task' });

    // Create board B
    await page.click('.tm-board-header__icon[title="Create board"]');
    await expect(page.locator('.tm-board-header__select option')).toHaveCount(2);
    // Board B focus should be empty
    await expect(page.locator('[data-group-id="focus"] .tm-task-card')).toHaveCount(0);

    // Switch back to board A
    const boardA = await page.locator('.tm-board-header__select option').first().getAttribute('value');
    await page.selectOption('.tm-board-header__select', boardA!);
    await expect(page.locator('[data-group-id="focus"] .tm-task-card')).toHaveCount(1);
  });

  test('10.3 rename board → shows new name in selector', async ({ page }) => {
    await openBoardSettings(page);
    await page.fill('#tm-board-title', 'Project Alpha');
    await saveBoardSettings(page);

    await expect(page.locator('.tm-board-header__select')).toContainText('Project Alpha');
  });

  test('10.4 empty board title → Save disabled', async ({ page }) => {
    await openBoardSettings(page);
    await page.fill('#tm-board-title', '');
    await expect(page.locator('.tm-popup .tm-popup__btn--primary')).toBeDisabled();
    await closeBoardSettings(page);
  });

  test('10.5 delete board with confirmation — No cancels', async ({ page }) => {
    // Need 2 boards first
    await page.locator('.tm-board-header__icon[title="Create board"]').click();
    await expect(page.locator('.tm-board-header__select option')).toHaveCount(2);

    await openBoardSettings(page);
    // Click "Delete board" button
    await page.locator('.tm-popup .tm-popup__btn--danger').filter({ hasText: 'Delete board' }).click();
    // Confirmation button "Confirm deletion" should appear
    await expect(page.locator('.tm-popup .tm-popup__btn--danger').filter({ hasText: 'Confirm deletion' })).toBeVisible();
    // Click "No" to cancel
    await page.locator('.tm-popup .tm-popup__btn').filter({ hasText: 'No' }).click();
    // Popup still open
    await expect(page.locator('.tm-popup')).toBeVisible();
    await closeBoardSettings(page);
  });

  test('10.6 confirm board deletion → board removed, switches to remaining', async ({ page }) => {
    await page.locator('.tm-board-header__icon[title="Create board"]').click();
    await expect(page.locator('.tm-board-header__select option')).toHaveCount(2);

    const newBoardId = await page.locator('.tm-board-header__select').inputValue();
    await openBoardSettings(page);
    await page.locator('.tm-popup .tm-popup__btn--danger').filter({ hasText: 'Delete board' }).click();
    await page.locator('.tm-popup .tm-popup__btn--danger').filter({ hasText: 'Confirm deletion' }).click();
    await page.waitForSelector('.tm-popup', { state: 'detached' });

    // Should no longer show new board in selector
    const options = await page.locator('.tm-board-header__select option').all();
    for (const opt of options) {
      expect(await opt.getAttribute('value')).not.toBe(newBoardId);
    }
  });

  test('10.7 single board → delete button absent', async ({ page }) => {
    // Default state: 1 board
    await openBoardSettings(page);
    await expect(page.locator('.tm-popup .tm-popup__btn--danger')).not.toBeVisible();
    await closeBoardSettings(page);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// Section 11 — Deadline overdue
// ────────────────────────────────────────────────────────────────────────────────

test.describe('Section 11 — Deadline overdue', () => {
  test('11.1 past deadline → red border on card', async ({ page }) => {
    await createTask(page, 'focus', { what: 'Overdue', deadline: '2020-01-01' });
    await expect(page.locator('[data-group-id="focus"] .tm-task-card--overdue')).toBeVisible();
  });

  test('11.2 completed task with past deadline → no red border', async ({ page }) => {
    const taskId = await createTask(page, 'focus', { what: 'Was overdue', deadline: '2020-01-01' });
    await moveTask(page, taskId, 'focus', 'completed');
    await expect(page.locator('[data-group-id="completed"] .tm-task-card--overdue')).not.toBeVisible();
  });

  test('11.3 task without deadline → no red border', async ({ page }) => {
    await createTask(page, 'focus', { what: 'No deadline' });
    await expect(page.locator('[data-group-id="focus"] .tm-task-card--overdue')).not.toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// Section 14 — Global settings
// ────────────────────────────────────────────────────────────────────────────────

test.describe('Section 14 — Global settings', () => {
  test('14.1 default priority=high → new task created with high priority', async ({ page }) => {
    await resetData(page, { settings: { defaultPriority: 'high' } });
    await createTask(page, 'focus', { what: 'Priority test' });
    await expect(page.locator('[data-group-id="focus"] .tm-task-card .tm-task-card__priority')).toContainText('🔴');
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// Section 15 — Task card display
// ────────────────────────────────────────────────────────────────────────────────

test.describe('Section 15 — Task card display', () => {
  test('15.1 full card: all fields displayed', async ({ page }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const deadline = tomorrow.toISOString().slice(0, 10);

    await createTask(page, 'focus', {
      what: 'Prepare report',
      who: 'Ivanov',
      deadline,
      priority: 'high',
    });

    const card = page.locator('[data-group-id="focus"] .tm-task-card').first();
    await expect(card.locator('.tm-task-card__priority')).toContainText('🔴');
    await expect(card.locator('.tm-task-card__status')).toContainText('🛠️');
    await expect(card.locator('.tm-task-card__deadline')).toBeVisible();
    await expect(card.locator('.tm-task-card__what')).toContainText('Prepare report');
    await expect(card.locator('.tm-task-card__who')).toContainText('Ivanov');
  });

  test('15.2 minimal card: only icons + what text', async ({ page }) => {
    await createTask(page, 'focus', { what: 'Minimal task' });
    const card = page.locator('[data-group-id="focus"] .tm-task-card').first();
    await expect(card.locator('.tm-task-card__priority')).toBeVisible();
    await expect(card.locator('.tm-task-card__what')).toBeVisible();
    await expect(card.locator('.tm-task-card__deadline')).not.toBeVisible();
    await expect(card.locator('.tm-task-card__who')).not.toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// Section 20 — Edge cases
// ────────────────────────────────────────────────────────────────────────────────

test.describe('Section 20 — Edge cases', () => {
  test('20.2 XSS in task name → rendered as text, no script execution', async ({ page }) => {
    let xssExecuted = false;
    await page.exposeFunction('__xssAlert', () => { xssExecuted = true; });
    // Also override alert
    await page.evaluate(() => { (window as any).alert = (window as any).__xssAlert; });

    const xssPayload = '<script>alert("XSS")<\/script>';
    await createTask(page, 'focus', { what: xssPayload });

    const card = page.locator('[data-group-id="focus"] .tm-task-card').first();
    // Text is rendered as-is (HTML-escaped)
    await expect(card.locator('.tm-task-card__what')).toContainText('<script>');
    expect(xssExecuted).toBe(false);
  });
});
