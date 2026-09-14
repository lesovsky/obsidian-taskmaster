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

/** How long SortableJS animates an insertion (`animation: 150` in useSortable.ts) plus slack. */
const SORTABLE_SETTLE_MS = 250;
/** Re-aim attempts before giving up. Two suffice in practice; the rest is headroom. */
const DRAG_AIM_ATTEMPTS = 5;

/**
 * Real mouse drag of a card into a group body — through SortableJS, not through the store.
 *
 * Two things make a single `mouse.move` insufficient. The library needs a small initial
 * displacement before it recognises the gesture at all. And every list the pointer crosses accepts
 * the card on the way, which pulls it out of its previous list and reflows the whole board — so the
 * target keeps sliding out from under the pointer. Hence the loop: aim at the target's current
 * centre, let the insertion animation settle, then check whether the pointer is still inside the
 * target. Only when it is has the drag actually arrived.
 */
export async function dragCardToGroup(page: Page, taskId: string, toGroupId: GroupId): Promise<void> {
  const card = page.locator(`[data-task-id="${taskId}"]`);
  const target = page.locator(`[data-group-id="${toGroupId}"]`);
  const cardBox = await card.boundingBox();
  if (!cardBox) throw new Error(`cannot drag ${taskId}: card is not laid out`);

  // Left third of the card: the delete button sits on the right and is in SortableJS `filter`.
  const startX = cardBox.x + cardBox.width * 0.3;
  const startY = cardBox.y + cardBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Gesture recognition: the library ignores a press that never moves, and a native drag only
  // starts once the browser has seen enough displacement.
  await page.mouse.move(startX + 10, startY + 10, { steps: 5 });
  await page.mouse.move(startX + 30, startY + 30, { steps: 10 });
  // The ghost class is SortableJS acknowledging the gesture. Without this wait a drag that never
  // started would be reported as "the card refused to land", pointing at the wrong end of the problem.
  await page
    .locator(`[data-task-id="${taskId}"].tm-sortable-ghost`)
    .waitFor({ state: 'attached', timeout: 2000 })
    .catch(() => { throw new Error(`SortableJS never picked up card ${taskId}`); });

  // Where the card currently sits in the DOM answers "where would this drop land" directly:
  // SortableJS moves the real node into the receiving list while the drag is still in flight.
  const cardIsInTarget = () => page
    .locator(`[data-group-id="${toGroupId}"] [data-task-id="${taskId}"]`)
    .count()
    .then(n => n > 0);

  let landed = false;
  for (let attempt = 0; attempt < DRAG_AIM_ATTEMPTS && !landed; attempt++) {
    const box = await target.boundingBox();
    if (!box) break;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x - 1, y - 1, { steps: 5 });
    // A one-pixel nudge: without a position change there is no fresh dragover, and the library
    // would keep the decision it made while the board was still reflowing.
    await page.mouse.move(x, y);

    // Believe the arrival only after the insertion animation and the reflow it causes: `dragover`
    // keeps firing under a motionless pointer, so a target that slid away takes the card back out.
    await page.waitForTimeout(SORTABLE_SETTLE_MS);
    landed = await cardIsInTarget();
  }
  if (!landed) throw new Error(`drag of ${taskId} never settled over ${toGroupId}`);

  await page.mouse.up();
}

// ─── Group helpers ─────────────────────────────────────────────────────────────

/**
 * Expand a collapsible group (backlog, completed) if it is collapsed.
 * Reaches the header through [data-group-container] on the wrapper: it is present in both
 * states, unlike [data-group-id], which lives in the body and is absent when collapsed.
 */
export async function expandGroup(page: Page, groupId: GroupId): Promise<void> {
  const body = page.locator(`[data-group-id="${groupId}"]`);
  const isVisible = await body.isVisible().catch(() => false);
  if (!isVisible) {
    await page.locator(`[data-group-container="${groupId}"] .tm-collapsible-group__header`).click();
    await page.waitForSelector(`[data-group-id="${groupId}"]`, { timeout: 2000 });
  }
}

/** Return the add-task button locator for a group. */
export function groupAddButton(page: Page, groupId: GroupId): Locator {
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
