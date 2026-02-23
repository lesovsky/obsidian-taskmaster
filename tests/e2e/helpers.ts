import type { Page, Locator } from '@playwright/test';
import type { GroupId } from '../../src/data/types';

// ─── Data helpers ──────────────────────────────────────────────────────────────

/** Reset all stores to clean state. Closes open modals first. */
export async function standardBeforeEach(page: Page, partial?: object): Promise<void> {
  // Close any leftover modal overlays from previous test
  await page.evaluate(() => {
    document.querySelectorAll('.tm-test-modal-overlay').forEach(el => el.remove());
  });
  await resetData(page, partial);
}

/** Reset stores to fresh clean state (optionally merge partial data). */
export async function resetData(page: Page, partial?: object): Promise<void> {
  await page.evaluate((p) => window.__test.resetData(p ?? undefined), partial ?? null);
  // Wait for Svelte reactivity to settle
  await page.waitForSelector('.tm-app', { timeout: 3000 });
}

// ─── Task helpers ──────────────────────────────────────────────────────────────

export interface TaskData {
  what: string;
  why?: string;
  who?: string;
  deadline?: string;
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Open the add-task modal for the given group, fill the form, save.
 * For collapsible groups (backlog, completed) that might be collapsed,
 * pass `expand: true` to expand them first.
 */
export async function createTask(
  page: Page,
  groupId: GroupId,
  data: TaskData,
  options: { expand?: boolean } = {},
): Promise<string> {
  if (options.expand) {
    await expandGroup(page, groupId);
  }

  const addBtn = groupAddButton(page, groupId);
  await addBtn.click();
  await page.waitForSelector('.tm-test-modal-overlay', { timeout: 3000 });

  await fillTaskForm(page, data);

  await page.click('.tm-task-form__btn--primary');
  await page.waitForSelector('.tm-test-modal-overlay', { state: 'detached', timeout: 3000 });

  // Return the task id from the last card in the group
  const cards = await page.locator(`[data-group-id="${groupId}"] [data-task-id]`).all();
  const lastCard = cards[cards.length - 1];
  return (await lastCard.getAttribute('data-task-id')) ?? '';
}

/** Fill task form fields. Only fills non-undefined fields. */
export async function fillTaskForm(page: Page, data: TaskData): Promise<void> {
  await page.fill('#tm-what', data.what);
  if (data.why !== undefined) await page.fill('#tm-why', data.why);
  if (data.who !== undefined) await page.fill('#tm-who', data.who);
  if (data.deadline !== undefined) await page.fill('#tm-deadline', data.deadline);
  if (data.priority !== undefined) await page.selectOption('#tm-priority', data.priority);
}

// ─── Move task ─────────────────────────────────────────────────────────────────

/** Move a task programmatically via window.__test.moveTask (bypasses SortableJS). */
export async function moveTask(
  page: Page,
  taskId: string,
  from: GroupId,
  to: GroupId,
  index = 0,
): Promise<void> {
  await page.evaluate(
    ([tid, f, t, i]) => window.__test.moveTask(tid as any, f as any, t as any, i as number),
    [taskId, from, to, index] as const,
  );
}

// ─── Group helpers ─────────────────────────────────────────────────────────────

// EN labels for collapsible groups (backlog and completed)
const COLLAPSIBLE_GROUP_LABELS: Partial<Record<GroupId, string>> = {
  backlog: 'Backlog',
  completed: 'Completed',
};

/**
 * Expand a collapsible group (backlog, completed) if it is collapsed.
 * Uses title text to find the header since [data-group-id] is only in the body (when expanded).
 */
export async function expandGroup(page: Page, groupId: GroupId): Promise<void> {
  const body = page.locator(`[data-group-id="${groupId}"]`);
  const isVisible = await body.isVisible().catch(() => false);
  if (!isVisible) {
    const label = COLLAPSIBLE_GROUP_LABELS[groupId] ?? groupId;
    await page.locator('.tm-collapsible-group__header').filter({ hasText: label }).click();
    await page.waitForSelector(`[data-group-id="${groupId}"]`, { timeout: 2000 });
  }
}

/** Return the add-task button locator for a group. */
function groupAddButton(page: Page, groupId: GroupId): Locator {
  // For non-collapsible groups: .tm-task-group contains data-group-id body
  // For collapsible groups: .tm-collapsible-group
  // Both have an add button (+) in the header
  // We find the group container whose body has data-group-id=groupId
  return page.locator(`.tm-task-group:has([data-group-id="${groupId}"]) .tm-group-header__add,` +
    `.tm-collapsible-group:has([data-group-id="${groupId}"]) .tm-collapsible-group__add`);
}

// ─── Toast helpers ─────────────────────────────────────────────────────────────

/** Wait for the first toast to appear and return its locator. */
export async function waitForToast(page: Page): Promise<Locator> {
  await page.waitForSelector('.tm-toast', { timeout: 3000 });
  return page.locator('.tm-toast').first();
}

// ─── Board settings popup ─────────────────────────────────────────────────────

/** Open board settings popup via the ⚙ button (title "Board settings"). */
export async function openBoardSettings(page: Page): Promise<void> {
  await page.locator('.tm-board-header__icon[title="Board settings"]').click();
  await page.waitForSelector('.tm-popup', { timeout: 2000 });
}

/** Save board settings popup. */
export async function saveBoardSettings(page: Page): Promise<void> {
  await page.locator('.tm-popup .tm-popup__btn--primary').click();
  await page.waitForSelector('.tm-popup', { state: 'detached', timeout: 2000 });
}

/** Close (cancel) board settings popup. */
export async function closeBoardSettings(page: Page): Promise<void> {
  await page.locator('.tm-popup .tm-popup__btn').filter({ hasText: 'Cancel' }).click();
  await page.waitForSelector('.tm-popup', { state: 'detached', timeout: 2000 });
}

/** Open group settings popup for the given group. */
export async function openGroupSettings(page: Page, groupId: GroupId): Promise<void> {
  const settingsBtn = page.locator(
    `.tm-task-group:has([data-group-id="${groupId}"]) .tm-group-header__settings,` +
    `.tm-collapsible-group:has([data-group-id="${groupId}"]) .tm-collapsible-group__settings`,
  );
  await settingsBtn.click();
  await page.waitForSelector('.tm-popup', { timeout: 2000 });
}

/** Save group settings popup. */
export async function saveGroupSettings(page: Page): Promise<void> {
  await page.locator('.tm-popup .tm-popup__btn--primary').click();
  await page.waitForSelector('.tm-popup', { state: 'detached', timeout: 2000 });
}
