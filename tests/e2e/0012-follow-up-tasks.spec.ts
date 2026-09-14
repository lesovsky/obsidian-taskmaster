import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  standardBeforeEach,
  resetData,
  createTask,
  expandGroup,
  moveTask,
  groupAddButton,
  dragCardToGroup,
} from './helpers';
import type { GroupId, Priority } from '../../src/data/types';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await standardBeforeEach(page);
});

// AC-13 (both languages) is not covered here: the harness pins the locale to 'en' on every reset and
// has no way to switch it. It is proven by the typed dictionaries and the unit test of the notice text.
//
// Expected texts are spelled out rather than read from `en`: the notice wording and the "After: "
// prefix are exactly what this feature added, and an assertion that reads its expectation from the
// value under test proves nothing.

// ────────────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────────────

interface SeedItem {
  text: string;
  /** '' (default) = pending; otherwise the id of the task spawned from it. */
  createdTaskId?: string;
}

interface SeedTask {
  id: string;
  group: GroupId;
  what: string;
  deadline?: string;
  priority?: Priority;
  followUps?: SeedItem[];
}

interface SeedOptions {
  hiddenGroups?: GroupId[];
  backlogTitle?: string;
  defaultPriority?: Priority;
}

/**
 * Load a board with the given tasks through a versioned (v9) snapshot, i.e. through the same
 * `migrateData` path a real load takes. Tasks are appended to their groups in the order given.
 * Item ids are `<task id>-f<index>`, so scenarios can address a single item.
 */
async function seed(page: Page, tasks: SeedTask[], options: SeedOptions = {}): Promise<void> {
  await page.evaluate(({ tasks, options }) => {
    const data = JSON.parse(JSON.stringify(window.__test.getDataStore()));
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const board = data.boards[0];
    for (const t of tasks) {
      data.tasks[t.id] = {
        id: t.id,
        what: t.what,
        why: '',
        who: '',
        deadline: t.deadline ?? '',
        createdAt: today,
        // Today, so no retention rule could ever consider it expired.
        completedAt: t.group === 'completed' ? today : '',
        priority: t.priority ?? 'medium',
        status: t.group === 'backlog' ? 'new' : t.group === 'completed' ? 'completed' : 'inProgress',
        followUps: (t.followUps ?? []).map((f, i) => ({
          id: `${t.id}-f${i}`,
          text: f.text,
          createdTaskId: f.createdTaskId ?? '',
        })),
      };
      board.groups[t.group].taskIds.push(t.id);
    }
    if (options.hiddenGroups) board.hiddenGroups = options.hiddenGroups;
    if (options.backlogTitle !== undefined) board.groups.backlog.title = options.backlogTitle;
    if (options.defaultPriority) data.settings.defaultPriority = options.defaultPriority;
    window.__test.resetData(data);
  }, { tasks, options });
  await page.waitForSelector('.tm-app', { timeout: 3000 });
}

// ────────────────────────────────────────────────────────────────────────────────
// Local helpers
// ────────────────────────────────────────────────────────────────────────────────

const store = (page: Page) => page.evaluate(() => window.__test.getDataStore());

function card(page: Page, taskId: string) {
  return page.locator(`[data-task-id="${taskId}"]`);
}

/** Every notice currently on screen (the mock renders Obsidian's DOM shape). */
function notices(page: Page) {
  return page.locator('.notice-container > .notice');
}

async function openForm(page: Page, taskId: string): Promise<void> {
  await card(page, taskId).click();
  await page.waitForSelector('.tm-test-modal-overlay', { timeout: 3000 });
}

async function saveForm(page: Page): Promise<void> {
  await page.click('.tm-task-form__btn--primary');
  await page.waitForSelector('.tm-test-modal-overlay', { state: 'detached', timeout: 3000 });
}

async function escapeForm(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForSelector('.tm-test-modal-overlay', { state: 'detached', timeout: 3000 });
}

const itemInputs = (page: Page) => page.locator('.tm-follow-ups__input');

/** "+ Add item" appends at the end of the list, so the new field is the last one. */
async function addItem(page: Page, text: string): Promise<void> {
  await page.click('.tm-follow-ups__add');
  await itemInputs(page).last().fill(text);
}

/** Press "→ to backlog" on the pending row whose input value is `text`. */
async function markItem(page: Page, text: string): Promise<void> {
  const row = page.locator('.tm-follow-ups__row').filter({ has: page.locator(`.tm-follow-ups__input`) });
  const count = await row.count();
  for (let i = 0; i < count; i++) {
    if ((await row.nth(i).locator('.tm-follow-ups__input').inputValue()) === text) {
      await row.nth(i).locator('.tm-follow-ups__to-backlog').click();
      return;
    }
  }
  throw new Error(`no pending row with text "${text}"`);
}

/** Texts of the task's stored follow-up items with their state. */
async function storedItems(page: Page, taskId: string): Promise<Array<{ text: string; created: boolean }>> {
  const data = await store(page);
  return data.tasks[taskId].followUps.map(f => ({ text: f.text, created: f.createdTaskId !== '' }));
}

async function backlogIds(page: Page): Promise<string[]> {
  return (await store(page)).boards[0].groups.backlog.taskIds;
}

/**
 * Simulate a plugin restart from what was actually persisted: wait until storage has caught up with
 * the store (`saveData` is async), then feed it back through `resetData` → `migrateData`. A plain
 * `goto` would not do — the harness boots from fresh data and never reads storage.
 */
async function reloadFromStorage(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => {
      const raw = localStorage.getItem('tm-test-data');
      return raw !== null && raw === JSON.stringify(window.__test.getDataStore());
    }))
    .toBe(true);
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('tm-test-data') as string));
  await resetData(page, snapshot);
}

function todayInPage(page: Page): Promise<string> {
  return page.evaluate(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// AC-1 / AC-2 — editing the list in the form
// ────────────────────────────────────────────────────────────────────────────────

test('AC-1 items are added by button and Enter, removed by ✕, saved and restored after a reload', async ({ page }) => {
  const taskId = await createTask(page, 'focus', { what: 'Ship release' });

  await openForm(page, taskId);
  // Empty list: only the add button.
  await expect(itemInputs(page)).toHaveCount(0);
  await expect(page.locator('.tm-follow-ups__add')).toBeVisible();

  await addItem(page, 'Run retro');
  // Enter inserts a new field right after the current one and moves the focus into it.
  await itemInputs(page).nth(0).press('Enter');
  await expect(itemInputs(page)).toHaveCount(2);
  await expect(itemInputs(page).nth(1)).toBeFocused();
  await page.keyboard.type('Temporary');
  await page.keyboard.press('Enter');
  await expect(itemInputs(page).nth(2)).toBeFocused();
  await page.keyboard.type('Send release notes');
  // Enter on the first field inserts between the first and the second, not at the end.
  await itemInputs(page).nth(0).press('Enter');
  await expect(itemInputs(page)).toHaveCount(4);
  await expect(itemInputs(page).nth(1)).toHaveValue('');
  await expect(itemInputs(page).nth(1)).toBeFocused();

  // ✕ on "Temporary" (now third) — the empty inserted field is left for the save to drop.
  await page.locator('.tm-follow-ups__row').nth(2).locator('.tm-follow-ups__remove').click();
  await expect(itemInputs(page)).toHaveCount(3);

  // Nothing is written before Save.
  expect(await storedItems(page, taskId)).toEqual([]);
  await saveForm(page);

  expect(await storedItems(page, taskId)).toEqual([
    { text: 'Run retro', created: false },
    { text: 'Send release notes', created: false },
  ]);

  await openForm(page, taskId);
  await expect(itemInputs(page)).toHaveCount(2);
  await expect(itemInputs(page).nth(0)).toHaveValue('Run retro');
  await expect(itemInputs(page).nth(1)).toHaveValue('Send release notes');
  await escapeForm(page);

  await reloadFromStorage(page);
  expect(await storedItems(page, taskId)).toEqual([
    { text: 'Run retro', created: false },
    { text: 'Send release notes', created: false },
  ]);
  await expect(card(page, taskId).locator('.tm-task-card__follow-ups')).toHaveText('↪ 2');
});

test('AC-1 Escape discards edits, additions and removals of the list', async ({ page }) => {
  await seed(page, [{
    id: 't1', group: 'focus', what: 'Ship release',
    followUps: [{ text: 'Run retro' }, { text: 'Send release notes' }],
  }]);
  const before = (await store(page)).tasks.t1.followUps;

  await openForm(page, 't1');
  await itemInputs(page).nth(0).fill('Edited text');
  await page.locator('.tm-follow-ups__row').nth(1).locator('.tm-follow-ups__remove').click();
  await addItem(page, 'Added and discarded');
  await escapeForm(page);

  expect((await store(page)).tasks.t1.followUps).toEqual(before);

  // The form starts from the stored list again, not from the discarded drafts.
  await openForm(page, 't1');
  await expect(itemInputs(page)).toHaveCount(2);
  await expect(itemInputs(page).nth(0)).toHaveValue('Run retro');
  await expect(itemInputs(page).nth(1)).toHaveValue('Send release notes');
  await escapeForm(page);
});

test('AC-2 blank items are dropped, text is capped at 200, trimmed on save', async ({ page }) => {
  await seed(page, [{ id: 't1', group: 'focus', what: 'Ship release' }]);

  await openForm(page, 't1');
  await addItem(page, '   ');
  await page.click('.tm-follow-ups__add');
  // Typed key by key: the field itself must refuse characters past the limit.
  await itemInputs(page).last().pressSequentially('a'.repeat(250));
  await expect(itemInputs(page).last()).toHaveValue('a'.repeat(200));
  await addItem(page, '  Padded item  ');
  await saveForm(page);

  expect(await storedItems(page, 't1')).toEqual([
    { text: 'a'.repeat(200), created: false },
    { text: 'Padded item', created: false },
  ]);
});

test('AC-2 no more than 20 items: the add button and Enter stop at the limit', async ({ page }) => {
  await seed(page, [{
    id: 't1', group: 'focus', what: 'Busy task',
    followUps: Array.from({ length: 19 }, (_, i) => ({ text: `Item ${i + 1}` })),
  }]);

  await openForm(page, 't1');
  await expect(itemInputs(page)).toHaveCount(19);
  await expect(page.locator('.tm-follow-ups__add')).toBeEnabled();

  await addItem(page, 'Item 20');
  await expect(itemInputs(page)).toHaveCount(20);
  await expect(page.locator('.tm-follow-ups__add')).toBeDisabled();

  // Enter at the limit does nothing either.
  await itemInputs(page).nth(5).press('Enter');
  await expect(itemInputs(page)).toHaveCount(20);

  await saveForm(page);
  expect(await storedItems(page, 't1')).toHaveLength(20);
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-3 — card marker
// ────────────────────────────────────────────────────────────────────────────────

test('AC-3 marker counts pending items in both view modes, with and without a deadline', async ({ page }) => {
  await seed(page, [
    { id: 'spawned', group: 'backlog', what: 'Already spawned' },
    {
      id: 'withDeadline', group: 'focus', what: 'Has a deadline', deadline: '2099-12-31',
      followUps: [{ text: 'Run retro' }, { text: 'Old one', createdTaskId: 'spawned' }, { text: 'Send notes' }],
    },
    {
      id: 'noDeadline', group: 'focus', what: 'No deadline',
      followUps: [{ text: 'First' }, { text: 'Second' }],
    },
    {
      id: 'allCreated', group: 'focus', what: 'Everything spawned',
      followUps: [{ text: 'Done already', createdTaskId: 'spawned' }],
    },
    { id: 'empty', group: 'focus', what: 'No items' },
  ]);

  // Default mode: "↪ N", created items are not counted and not listed.
  const marker = card(page, 'withDeadline').locator('.tm-task-card__follow-ups');
  await expect(marker).toHaveText('↪ 2');
  await expect(marker).toHaveAttribute('title', 'Run retro\nSend notes');
  // Left of the deadline, in the same top row.
  const markerBox = await marker.boundingBox();
  const deadlineBox = await card(page, 'withDeadline').locator('.tm-task-card__deadline').boundingBox();
  expect(markerBox!.x + markerBox!.width).toBeLessThanOrEqual(deadlineBox!.x + 1);
  expect(Math.abs(markerBox!.y - deadlineBox!.y)).toBeLessThan(10);

  await expect(card(page, 'noDeadline').locator('.tm-task-card__follow-ups')).toHaveText('↪ 2');
  await expect(card(page, 'noDeadline').locator('.tm-task-card__follow-ups')).toHaveAttribute('title', 'First\nSecond');
  // N = 0: no marker at all, whether the items are all created or there are none.
  await expect(card(page, 'allCreated').locator('.tm-task-card__follow-ups')).toHaveCount(0);
  await expect(card(page, 'empty').locator('.tm-task-card__follow-ups')).toHaveCount(0);

  // Compact mode: "↪N", same count and tooltip.
  await page.evaluate(() => window.__test.updateSettings({ cardView: 'compact' }));
  const compact = card(page, 'withDeadline').locator('.tm-task-card__follow-ups-compact');
  await expect(compact).toHaveText('↪2');
  await expect(compact).toHaveAttribute('title', 'Run retro\nSend notes');
  await expect(card(page, 'noDeadline').locator('.tm-task-card__follow-ups-compact')).toHaveText('↪2');
  await expect(card(page, 'allCreated').locator('.tm-task-card__follow-ups-compact')).toHaveCount(0);
  await expect(card(page, 'empty').locator('.tm-task-card__follow-ups-compact')).toHaveCount(0);
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-4 / AC-5 / AC-6 / AC-8 — what counts as completion
// ────────────────────────────────────────────────────────────────────────────────

test('AC-4 ☑ spawns pending items at the end of the backlog, marks them created, one notice', async ({ page }) => {
  await seed(page, [
    { id: 'existing', group: 'backlog', what: 'Was here before' },
    {
      id: 'parent', group: 'focus', what: 'Ship release', priority: 'low',
      followUps: [{ text: 'Run retro' }, { text: 'Send release notes' }],
    },
  ], { defaultPriority: 'high' });
  const today = await todayInPage(page);

  await card(page, 'parent').locator('.tm-task-card__complete').click();
  await expect(page.locator('.tm-toast')).toHaveCount(1);

  const data = await store(page);
  const backlog = data.boards[0].groups.backlog.taskIds;
  expect(backlog).toHaveLength(3);
  expect(backlog[0]).toBe('existing');
  const spawned = backlog.slice(1).map(id => data.tasks[id]);
  expect(spawned.map(t => t.what)).toEqual(['Run retro', 'Send release notes']);
  for (const t of spawned) {
    expect(t).toMatchObject({
      why: 'After: Ship release',
      who: '',
      deadline: '',
      status: 'new',
      priority: 'high', // settings default, not the parent's 'low'
      createdAt: today,
      completedAt: '',
      followUps: [],
    });
  }

  // The parent's items now point at exactly those tasks.
  expect(data.tasks.parent.followUps.map(f => f.createdTaskId)).toEqual(backlog.slice(1));
  expect(data.boards[0].groups.completed.taskIds).toEqual(['parent']);

  await expect(notices(page)).toHaveCount(1);
  await expect(notices(page)).toHaveText('Tasks created in "Backlog": 2');

  // Backlog is not expanded automatically; once expanded, the new cards are there.
  await expect(page.locator('[data-group-id="backlog"]')).toHaveCount(0);
  await expandGroup(page, 'backlog');
  await expect(page.locator('[data-group-id="backlog"] [data-task-id]')).toHaveCount(3);

  // The completed parent shows no marker any more.
  await expandGroup(page, 'completed');
  await expect(card(page, 'parent')).toBeVisible();
  await expect(card(page, 'parent').locator('.tm-task-card__follow-ups')).toHaveCount(0);
});

test('AC-4 ☑ on a task without pending items spawns nothing and shows no notice', async ({ page }) => {
  await seed(page, [
    { id: 'spawned', group: 'backlog', what: 'Already spawned' },
    { id: 'plain', group: 'focus', what: 'No items' },
    { id: 'allCreated', group: 'focus', what: 'All created', followUps: [{ text: 'Old', createdTaskId: 'spawned' }] },
  ]);

  await card(page, 'plain').locator('.tm-task-card__complete').click();
  await card(page, 'allCreated').locator('.tm-task-card__complete').click();
  await expect(page.locator('.tm-toast')).toHaveCount(2);

  expect(await backlogIds(page)).toEqual(['spawned']);
  await expect(notices(page)).toHaveCount(0);
});

test('AC-5 dragging into completed spawns like ☑; reordering inside completed does not', async ({ page }) => {
  // Tall enough that the expanded completed group is on screen for the mouse drag.
  await page.setViewportSize({ width: 1280, height: 1400 });
  await seed(page, [
    {
      id: 'parent', group: 'focus', what: 'Ship release',
      followUps: [{ text: 'Run retro' }, { text: 'Send release notes' }],
    },
    // Pending items inside completed can only come from hand-edited or badly synced data (no app
    // path leaves them there); they are exactly what a reorder would wrongly spawn.
    { id: 'doneA', group: 'completed', what: 'Done A', followUps: [{ text: 'Should stay pending' }] },
    { id: 'doneB', group: 'completed', what: 'Done B' },
  ]);

  // Reorder inside completed first, while nothing else has spawned.
  await moveTask(page, 'doneA', 'completed', 'completed', 1);
  let data = await store(page);
  expect(data.boards[0].groups.completed.taskIds).toEqual(['doneB', 'doneA']); // the move happened
  expect(data.boards[0].groups.backlog.taskIds).toEqual([]);
  expect(await storedItems(page, 'doneA')).toEqual([{ text: 'Should stay pending', created: false }]);
  await expect(notices(page)).toHaveCount(0);

  // Entry from another group — a real mouse drag through SortableJS and its drop handler.
  // (The programmatic `__test.moveTask` path into completed is exercised by AC-8 and AC-10.)
  await expandGroup(page, 'completed');
  await dragCardToGroup(page, 'parent', 'completed');
  await expect(page.locator('[data-group-id="completed"] [data-task-id="parent"]')).toHaveCount(1);
  data = await store(page);
  const backlog = data.boards[0].groups.backlog.taskIds;
  expect(backlog.map(id => data.tasks[id].what)).toEqual(['Run retro', 'Send release notes']);
  expect(backlog.map(id => data.tasks[id].why)).toEqual(['After: Ship release', 'After: Ship release']);
  expect(data.tasks.parent.followUps.map(f => f.createdTaskId)).toEqual(backlog);
  await expect(notices(page)).toHaveCount(1);
  await expect(notices(page)).toHaveText('Tasks created in "Backlog": 2');
});

test('AC-6 choosing status "Completed" in the form spawns nothing', async ({ page }) => {
  await seed(page, [{
    id: 't1', group: 'focus', what: 'Ship release',
    followUps: [{ text: 'Run retro' }, { text: 'Send release notes' }],
  }]);

  await openForm(page, 't1');
  await page.selectOption('#tm-status', 'completed');
  await saveForm(page);

  const data = await store(page);
  expect(data.tasks.t1.status).toBe('completed'); // the save itself went through
  expect(data.boards[0].groups.focus.taskIds).toEqual(['t1']);
  expect(data.boards[0].groups.backlog.taskIds).toEqual([]);
  expect(await storedItems(page, 't1')).toEqual([
    { text: 'Run retro', created: false },
    { text: 'Send release notes', created: false },
  ]);
  await expect(notices(page)).toHaveCount(0);
  await expect(card(page, 't1').locator('.tm-task-card__follow-ups')).toHaveText('↪ 2');
});

test('AC-8 completing again after moving out creates no duplicates', async ({ page }) => {
  await seed(page, [{
    id: 'parent', group: 'focus', what: 'Ship release',
    followUps: [{ text: 'Run retro' }, { text: 'Send release notes' }],
  }]);

  await moveTask(page, 'parent', 'focus', 'completed', 0);
  const afterFirst = await store(page);
  const firstBacklog = afterFirst.boards[0].groups.backlog.taskIds;
  expect(firstBacklog).toHaveLength(2);
  await expect(notices(page)).toHaveCount(1);
  // Clear the first notice, so the check below is about the second completion alone and does not
  // depend on the notice's own timeout.
  await page.evaluate(() => document.querySelectorAll('.notice-container').forEach(el => el.remove()));

  await moveTask(page, 'parent', 'completed', 'focus', 0);
  await moveTask(page, 'parent', 'focus', 'completed', 0);

  const afterSecond = await store(page);
  expect(afterSecond.boards[0].groups.completed.taskIds).toEqual(['parent']); // really completed again
  expect(afterSecond.boards[0].groups.backlog.taskIds).toEqual(firstBacklog);
  expect(Object.keys(afterSecond.tasks).sort()).toEqual(Object.keys(afterFirst.tasks).sort());
  // The second completion had nothing to announce.
  await expect(notices(page)).toHaveCount(0);
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-7 — Undo of a quick completion
// ────────────────────────────────────────────────────────────────────────────────

test('AC-7 Undo removes the spawned tasks and returns their items to pending; earlier ones stay', async ({ page }) => {
  await seed(page, [
    { id: 'early', group: 'backlog', what: 'Spawned from the form earlier' },
    { id: 'other', group: 'focus', what: 'Unrelated' },
    {
      id: 'parent', group: 'focus', what: 'Ship release',
      followUps: [{ text: 'Update roadmap', createdTaskId: 'early' }, { text: 'Run retro' }, { text: 'Send release notes' }],
    },
  ]);
  await expect(card(page, 'parent').locator('.tm-task-card__follow-ups')).toHaveText('↪ 2');

  await card(page, 'parent').locator('.tm-task-card__complete').click();
  const spawned = (await backlogIds(page)).slice(1);
  expect(spawned).toHaveLength(2);

  // Within the 7 seconds one spawned task is moved to another group — Undo still removes it.
  await moveTask(page, spawned[0], 'backlog', 'focus', 0);

  await page.locator('.tm-toast__undo').click();
  await expect(page.locator('.tm-toast')).toHaveCount(0);

  const data = await store(page);
  const groups = data.boards[0].groups;
  expect(groups.backlog.taskIds).toEqual(['early']);
  expect(groups.focus.taskIds).toEqual(['other', 'parent']); // parent back on its place
  expect(groups.completed.taskIds).toEqual([]);
  for (const id of spawned) expect(data.tasks[id]).toBeUndefined();
  expect(data.tasks.early).toBeDefined();
  expect(data.tasks.parent.status).toBe('inProgress');
  expect(data.tasks.parent.followUps.map(f => f.createdTaskId)).toEqual(['early', '', '']);

  await expect(card(page, 'parent').locator('.tm-task-card__follow-ups')).toHaveText('↪ 2');
});

test('AC-7 Undo skips a spawned task deleted meanwhile and dismisses its delete toast', async ({ page }) => {
  await seed(page, [{
    id: 'parent', group: 'focus', what: 'Ship release',
    followUps: [{ text: 'Run retro' }, { text: 'Send release notes' }],
  }]);

  await card(page, 'parent').locator('.tm-task-card__complete').click();
  const spawned = await backlogIds(page);
  expect(spawned).toHaveLength(2);

  // Within the 7 seconds one spawned task is deleted: its own delete toast joins the complete toast.
  await expandGroup(page, 'backlog');
  await card(page, spawned[0]).locator('.tm-task-card__delete').click();
  await expect(page.locator('.tm-toast')).toHaveCount(2);
  expect(await backlogIds(page)).toEqual([spawned[1]]);

  await page.locator('.tm-toast').filter({ hasText: 'Ship release' }).locator('.tm-toast__undo').click();

  // Both toasts are gone: a surviving delete toast would push a dangling id back on its own Undo.
  await expect(page.locator('.tm-toast')).toHaveCount(0);
  const data = await store(page);
  expect(data.boards[0].groups.backlog.taskIds).toEqual([]);
  expect(data.boards[0].groups.focus.taskIds).toEqual(['parent']);
  for (const id of spawned) expect(data.tasks[id]).toBeUndefined();
  expect(data.tasks.parent.followUps.map(f => f.createdTaskId)).toEqual(['', '']);
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-9 — "→ to backlog" in the form
// ────────────────────────────────────────────────────────────────────────────────

test('AC-9 marking in the edit form spawns on Save with a notice; unmarking cancels the mark', async ({ page }) => {
  await seed(page, [{
    id: 'parent', group: 'focus', what: 'Ship release',
    followUps: [{ text: 'Run retro' }, { text: 'Send release notes' }],
  }]);

  await openForm(page, 'parent');
  // Toggle: first press marks, the second one unmarks.
  await markItem(page, 'Run retro');
  const retroToggle = page.locator('.tm-follow-ups__row').nth(0).locator('.tm-follow-ups__to-backlog');
  await expect(retroToggle).toHaveAttribute('aria-pressed', 'true');
  await markItem(page, 'Run retro');
  await expect(retroToggle).toHaveAttribute('aria-pressed', 'false');
  await markItem(page, 'Send release notes');

  // Marking alone creates nothing.
  expect(await backlogIds(page)).toEqual([]);
  await saveForm(page);

  const data = await store(page);
  const backlog = data.boards[0].groups.backlog.taskIds;
  expect(backlog).toHaveLength(1);
  expect(data.tasks[backlog[0]]).toMatchObject({ what: 'Send release notes', why: 'After: Ship release', status: 'new' });
  expect(data.tasks.parent.followUps.map(f => f.createdTaskId)).toEqual(['', backlog[0]]);
  await expect(notices(page)).toHaveText('Tasks created in "Backlog": 1');
  await expect(card(page, 'parent').locator('.tm-task-card__follow-ups')).toHaveText('↪ 1');

  // Reopened: the spawned item is shown as created and is no longer editable.
  await openForm(page, 'parent');
  await expect(itemInputs(page)).toHaveCount(1);
  const createdRow = page.locator('.tm-follow-ups__row--created');
  await expect(createdRow).toHaveCount(1);
  await expect(createdRow.locator('.tm-follow-ups__text')).toHaveText('Send release notes');
  await expect(createdRow.locator('.tm-follow-ups__created-label')).toHaveText('✓ created');
  await expect(createdRow.locator('.tm-follow-ups__to-backlog')).toHaveCount(0);
  await escapeForm(page);

  // Later completion spawns only the remaining item.
  await card(page, 'parent').locator('.tm-task-card__complete').click();
  const after = await store(page);
  expect(after.boards[0].groups.backlog.taskIds.map(id => after.tasks[id].what)).toEqual(['Send release notes', 'Run retro']);
});

test('AC-9 marking in the create form creates both the new task and the spawned one', async ({ page }) => {
  await groupAddButton(page, 'focus').click();
  await page.waitForSelector('.tm-test-modal-overlay', { timeout: 3000 });
  await page.fill('#tm-what', 'Ship release');
  await addItem(page, 'Run retro');
  await addItem(page, 'Send release notes');
  await markItem(page, 'Run retro');
  await saveForm(page);

  const data = await store(page);
  const [parentId] = data.boards[0].groups.focus.taskIds;
  expect(parentId).toBeDefined();
  const parent = data.tasks[parentId];
  expect(parent.what).toBe('Ship release');

  const backlog = data.boards[0].groups.backlog.taskIds;
  expect(backlog).toHaveLength(1);
  expect(data.tasks[backlog[0]]).toMatchObject({ what: 'Run retro', why: 'After: Ship release' });
  expect(parent.followUps.map(f => [f.text, f.createdTaskId])).toEqual([
    ['Run retro', backlog[0]],
    ['Send release notes', ''],
  ]);
  await expect(notices(page)).toHaveText('Tasks created in "Backlog": 1');
  await expect(card(page, parentId).locator('.tm-task-card__follow-ups')).toHaveText('↪ 1');
});

test('AC-9 a mark discarded with Escape creates nothing', async ({ page }) => {
  await seed(page, [{
    id: 'parent', group: 'focus', what: 'Ship release',
    followUps: [{ text: 'Run retro' }],
  }]);
  const before = await store(page);

  await openForm(page, 'parent');
  await markItem(page, 'Run retro');
  await expect(page.locator('.tm-follow-ups__row--marked')).toHaveCount(1);
  await escapeForm(page);

  const after = await store(page);
  expect(after.boards[0].groups.backlog.taskIds).toEqual([]);
  expect(Object.keys(after.tasks)).toEqual(Object.keys(before.tasks));
  expect(after.tasks.parent.followUps).toEqual(before.tasks.parent.followUps);
  await expect(notices(page)).toHaveCount(0);
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-10 — hidden and renamed backlog; literal output
// ────────────────────────────────────────────────────────────────────────────────

test('AC-10 hidden backlog still receives the tasks; the notice says it is hidden', async ({ page }) => {
  await seed(page, [{
    id: 'parent', group: 'focus', what: 'Ship release',
    followUps: [{ text: 'Run retro' }],
  }], { hiddenGroups: ['backlog'] });
  await expect(page.locator('[data-group-container="backlog"]')).toHaveCount(0); // really hidden

  await card(page, 'parent').locator('.tm-task-card__complete').click();

  const data = await store(page);
  expect(data.boards[0].groups.backlog.taskIds.map(id => data.tasks[id].what)).toEqual(['Run retro']);
  await expect(notices(page)).toHaveText('Tasks created in "Backlog": 1 (group hidden)');
});

test('AC-10 the notice uses the current name of a renamed backlog', async ({ page }) => {
  await seed(page, [{
    id: 'parent', group: 'focus', what: 'Ship release',
    followUps: [{ text: 'Run retro' }, { text: 'Send release notes' }],
  }], { backlogTitle: 'Someday' });

  await moveTask(page, 'parent', 'focus', 'completed', 0);
  await expect(notices(page)).toHaveText('Tasks created in "Someday": 2');
});

test('AC-10 markup in the backlog name and in item text renders literally', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', d => { dialogs.push(d.message()); void d.dismiss(); });

  const markupTitle = '<img src=x onerror=alert(1)>';
  const markupItem = '<b>bold</b><img src=y onerror=alert(2)>';
  await seed(page, [{
    id: 'parent', group: 'focus', what: 'Ship release',
    followUps: [{ text: markupItem }],
  }], { backlogTitle: markupTitle });

  // Tooltip of the marker: the text itself, and the card grew no element from it.
  const marker = card(page, 'parent').locator('.tm-task-card__follow-ups');
  await expect(marker).toHaveAttribute('title', markupItem);
  await expect(card(page, 'parent').locator('b, img')).toHaveCount(0);

  await card(page, 'parent').locator('.tm-task-card__complete').click();

  await expect(notices(page)).toHaveText(`Tasks created in "${markupTitle}": 1`);
  await expect(notices(page).locator('*')).toHaveCount(0);
  expect(await page.locator('img').count()).toBe(0);
  expect(dialogs).toEqual([]);
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-11 — loading older and damaged data
// ────────────────────────────────────────────────────────────────────────────────

function groupsV8(taskIds: Partial<Record<GroupId, string[]>>, titles: Partial<Record<GroupId, string>> = {}) {
  const g = (id: GroupId, collapsed: boolean, fullWidth: boolean, retention: number | null = null) => ({
    taskIds: taskIds[id] ?? [], wipLimit: null, collapsed, completedRetentionDays: retention, fullWidth, title: titles[id] ?? '',
  });
  return {
    backlog: g('backlog', true, true),
    focus: g('focus', false, false),
    inProgress: g('inProgress', false, false),
    orgIntentions: g('orgIntentions', false, true),
    delegated: g('delegated', false, true),
    completed: g('completed', true, true, 30),
  };
}

function taskV8(id: string, what: string, status: string) {
  return { id, what, why: 'Because', who: 'Ann', deadline: '', createdAt: '2026-01-01', completedAt: '', priority: 'medium', status };
}

test('AC-11 a v8 snapshot loads with empty lists and an unchanged board', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', e => pageErrors.push(e.message));

  const order: GroupId[] = ['focus', 'backlog', 'inProgress', 'orgIntentions', 'delegated', 'completed'];
  await resetData(page, {
    version: 8,
    boards: [{
      id: 'b1', title: 'Board', subtitle: '', notes: '', notesCollapsed: true, notesHidden: false,
      hiddenGroups: [], groupOrder: order,
      groups: groupsV8({ focus: ['t1', 't2'], backlog: ['t3'] }, { focus: 'Sprint' }),
    }],
    tasks: {
      t1: taskV8('t1', 'First', 'inProgress'),
      t2: taskV8('t2', 'Second', 'waiting'),
      t3: taskV8('t3', 'Third', 'new'),
    },
    settings: { language: 'en', defaultPriority: 'medium', cardView: 'default', cardLayout: 'single' },
  });

  const data = await store(page);
  expect(data.version).toBe(9);
  for (const id of ['t1', 't2', 't3']) expect(data.tasks[id].followUps).toEqual([]);
  // Everything else survived the migration untouched.
  expect(data.tasks.t2).toMatchObject({ what: 'Second', why: 'Because', who: 'Ann', status: 'waiting' });
  expect(data.boards[0].groupOrder).toEqual(order);
  expect(data.boards[0].groups.focus.title).toBe('Sprint');

  await expect(page.locator('[data-group-id="focus"] [data-task-id]')).toHaveCount(2);
  await expect(page.locator('[data-group-container="focus"] .tm-group-header__title')).toHaveText('Sprint');
  await expect(page.locator('.tm-task-card__follow-ups')).toHaveCount(0);

  // The form of a migrated task starts with an empty, editable list.
  await openForm(page, 't1');
  await expect(itemInputs(page)).toHaveCount(0);
  await expect(page.locator('.tm-follow-ups__add')).toBeEnabled();
  await escapeForm(page);

  expect(pageErrors).toEqual([]);
});

test('AC-11 a v9 snapshot with a damaged list still loads and renders', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', e => pageErrors.push(e.message));

  await resetData(page, {
    version: 9,
    boards: [{
      id: 'b1', title: 'Board', subtitle: '', notes: '', notesCollapsed: true, notesHidden: false,
      hiddenGroups: [], groupOrder: ['backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed'],
      groups: groupsV8({ focus: ['notArray', 'badItems', 'tooMany'] }),
    }],
    tasks: {
      notArray: { ...taskV8('notArray', 'Not an array', 'inProgress'), followUps: 'garbage' },
      badItems: {
        ...taskV8('badItems', 'Bad items', 'inProgress'),
        followUps: [null, 42, 'text', { text: 5 }, { text: '   ' }, { id: 'ok', text: '  Valid item ', createdTaskId: '' }, { text: 'x'.repeat(250) }],
      },
      tooMany: {
        ...taskV8('tooMany', 'Too many', 'inProgress'),
        followUps: Array.from({ length: 25 }, (_, i) => ({ id: `i${i}`, text: `Item ${i + 1}`, createdTaskId: '' })),
      },
    },
    settings: { language: 'en', defaultPriority: 'medium', cardView: 'default', cardLayout: 'single' },
  });

  await expect(page.locator('[data-group-id="focus"] [data-task-id]')).toHaveCount(3);

  expect(await storedItems(page, 'notArray')).toEqual([]);
  expect(await storedItems(page, 'badItems')).toEqual([
    { text: 'Valid item', created: false },
    { text: 'x'.repeat(200), created: false },
  ]);
  const tooMany = await storedItems(page, 'tooMany');
  expect(tooMany).toHaveLength(20);
  expect(tooMany[19].text).toBe('Item 20');

  await expect(card(page, 'notArray').locator('.tm-task-card__follow-ups')).toHaveCount(0);
  await expect(card(page, 'badItems').locator('.tm-task-card__follow-ups')).toHaveText('↪ 2');
  await expect(card(page, 'tooMany').locator('.tm-task-card__follow-ups')).toHaveText('↪ 20');

  expect(pageErrors).toEqual([]);
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-12 — read-only block for a completed task
// ────────────────────────────────────────────────────────────────────────────────

test('AC-12 the form of a completed task shows the list read-only, or nothing when empty', async ({ page }) => {
  await seed(page, [
    { id: 'a', group: 'backlog', what: 'Spawned A' },
    { id: 'b', group: 'backlog', what: 'Spawned B' },
    {
      id: 'done', group: 'completed', what: 'Ship release',
      followUps: [{ text: 'Run retro', createdTaskId: 'a' }, { text: 'Send release notes', createdTaskId: 'b' }],
    },
    { id: 'doneEmpty', group: 'completed', what: 'Nothing after' },
  ]);
  const before = (await store(page)).tasks.done.followUps;
  await expandGroup(page, 'completed');

  await openForm(page, 'done');
  const block = page.locator('.tm-follow-ups--readonly');
  await expect(block).toBeVisible();
  await expect(block.locator('.tm-follow-ups__text')).toHaveText(['Run retro', 'Send release notes']);
  await expect(block.locator('.tm-follow-ups__created-label')).toHaveCount(2);
  // Nothing to add, edit, remove or mark with.
  await expect(page.locator('.tm-follow-ups input, .tm-follow-ups button')).toHaveCount(0);
  // Saving the form keeps the list exactly as it was.
  await saveForm(page);
  expect((await store(page)).tasks.done.followUps).toEqual(before);

  await openForm(page, 'doneEmpty');
  await expect(page.locator('#tm-what')).toHaveValue('Nothing after'); // the form did open
  await expect(page.locator('.tm-follow-ups')).toHaveCount(0);
  await escapeForm(page);
});
