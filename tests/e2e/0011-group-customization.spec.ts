import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  standardBeforeEach,
  resetData,
  createTask,
  expandGroup,
  openBoardSettings,
  saveBoardSettings,
  closeBoardSettings,
  openGroupSettings,
  dragCardToGroup,
} from './helpers';
import { GROUP_IDS } from '../../src/data/types';
import type { GroupId } from '../../src/data/types';
import { en } from '../../src/i18n/en';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await standardBeforeEach(page);
});

// The order a board ships with. Spelled out rather than reusing GROUP_IDS: scenarios assert against
// it, and an assertion that reads its expectation from the value under test proves nothing.
// (Default titles come from `en` above — the harness pins the locale to 'en'. They are imported
// rather than retyped because this very feature edited those strings.)
const DEFAULT_ORDER: GroupId[] = ['backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed'];

// ────────────────────────────────────────────────────────────────────────────────
// Local helpers
//
// Order on the board is carried by the CSS `order` property on the wrappers; the DOM sequence of
// the six blocks in BoardLayout.svelte never changes (Decision 1/12). Everything below therefore
// reads computed styles and geometry — an index-based assertion would pass either way.
// ────────────────────────────────────────────────────────────────────────────────

interface GroupBox {
  id: GroupId;
  order: number;
  domIndex: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/** Computed `order` + geometry of every rendered group wrapper, in DOM sequence. */
async function readGroupBoxes(page: Page): Promise<GroupBox[]> {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[data-group-container]')) as HTMLElement[];
    return els.map((el, domIndex) => {
      const rect = el.getBoundingClientRect();
      return {
        id: el.dataset.groupContainer as string,
        // getComputedStyle().order hands back a string ("3"); '' and '0' both mean "unset".
        order: Number(getComputedStyle(el).order || 0),
        domIndex,
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
      };
    });
  }) as Promise<GroupBox[]>;
}

/**
 * Visible groups in the order they are laid out: sorted by `order`, ties broken by DOM sequence —
 * exactly how a flex/grid container resolves it. Hidden groups are absent because they have no
 * wrapper at all, so the returned sequence doubles as the list of what is on the board.
 *
 * Asserting the whole sequence rather than a pair of positions: a pairwise check is satisfied by
 * any number of unintended moves elsewhere in the list.
 */
async function visibleGroupOrder(page: Page): Promise<string[]> {
  const boxes = await readGroupBoxes(page);
  boxes.sort((a, b) => a.order - b.order || a.domIndex - b.domIndex);
  return boxes.map(box => box.id);
}

/** Geometry of one group wrapper (viewport coordinates). */
async function groupBox(page: Page, groupId: GroupId): Promise<GroupBox> {
  const boxes = await readGroupBoxes(page);
  const box = boxes.find(b => b.id === groupId);
  if (!box) throw new Error(`group container not rendered: ${groupId}`);
  return box;
}

/** Board title of a group — one locator for both the plain and the collapsible header. */
function groupTitleOnBoard(page: Page, groupId: GroupId) {
  return page.locator(
    `[data-group-container="${groupId}"] .tm-group-header__title,` +
    `[data-group-container="${groupId}"] .tm-collapsible-group__title`,
  );
}

/** Empty-state hint of a group, scoped to that group: an unscoped locator matches all six. */
function emptyStateOf(page: Page, groupId: GroupId) {
  return page.locator(`[data-group-container="${groupId}"] .tm-empty-state`);
}

/** Title input inside a settings-popup row. */
function groupTitleInput(page: Page, groupId: GroupId) {
  return page.locator(`[data-settings-group="${groupId}"] .tm-popup__group-title-input`);
}

/**
 * Visibility checkbox of a settings-popup row. A row carries two `.tm-popup__group-toggle`
 * checkboxes — visibility first, full width second — and neither has a class of its own; `.first()`
 * is how the neighbouring suites address it too.
 */
function visibilityToggle(page: Page, groupId: GroupId) {
  return page.locator(`[data-settings-group="${groupId}"] .tm-popup__group-toggle`).first();
}

/** Type a group title into the open settings popup. */
async function setGroupTitle(page: Page, groupId: GroupId, title: string): Promise<void> {
  await groupTitleInput(page, groupId).fill(title);
}

/** Press the up/down arrow of a group row in the open settings popup. */
async function clickMoveArrow(page: Page, groupId: GroupId, direction: 'up' | 'down'): Promise<void> {
  const label = direction === 'up' ? en['boardSettings.moveUp'] : en['boardSettings.moveDown'];
  await page.locator(`[data-settings-group="${groupId}"] .tm-popup__group-move-btn[aria-label="${label}"]`).click();
}

/**
 * Dismiss the *group* settings popup. `closeBoardSettings` would happen to work — both popups label
 * their cancel button "Cancel" — but that is a coincidence of two unrelated i18n keys, not a
 * contract. The selector below relies on GroupSettingsPopup having exactly two buttons, one of them
 * primary; it is deliberately not reused for the board popup, which grows a --danger button.
 */
async function closeGroupSettings(page: Page): Promise<void> {
  await page.locator('.tm-popup .tm-popup__btn:not(.tm-popup__btn--primary)').click();
  await page.waitForSelector('.tm-popup', { state: 'detached', timeout: 2000 });
}

/**
 * Sequence of rows in the open settings popup. Rows are rendered by an `{#each}` over the
 * configured order, so here the DOM sequence *is* the order — unlike on the board.
 */
async function settingsRowOrder(page: Page): Promise<string[]> {
  return page
    .locator('[data-settings-group]')
    .evaluateAll(els => els.map(el => (el as HTMLElement).dataset.settingsGroup as string));
}

/**
 * Snapshot of what the plugin persisted. `persist()` → `saveData()` is async, so waiting for the key
 * to merely exist is not enough — it exists from the first save of the test and the snapshot could
 * predate the edit the scenario just made. Wait until what is stored equals what the store holds.
 */
async function readSavedSnapshot(page: Page): Promise<Record<string, unknown>> {
  await expect
    .poll(() => page.evaluate(() => {
      const raw = localStorage.getItem('tm-test-data');
      return raw !== null && raw === JSON.stringify(window.__test.getDataStore());
    }))
    .toBe(true);
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('tm-test-data') as string));
  return snapshot as Record<string, unknown>;
}

/**
 * Simulate a plugin reload: feed a previously read snapshot back through `resetData`, which runs it
 * through `migrateData` and re-renders. A plain `page.goto('/')` would not do: the harness boots
 * from `migrateData(null)` and never reads localStorage, so a reload would silently wipe the board.
 * The snapshot must be read *before* the call — `resetData` removes the storage key first thing.
 */
async function reloadFromSnapshot(page: Page, snapshot: Record<string, unknown>): Promise<void> {
  await resetData(page, snapshot);
}

/**
 * An element carrying the survival probe. An expando property, not an attribute: Svelte rewrites
 * attributes on re-render, so an attribute would survive a node swap and prove nothing.
 */
type ProbedElement = Element & { __tmProbe?: 1 };

/** Mark every wrapper and every *rendered* body. */
async function markDomNodes(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('[data-group-container]').forEach(el => { (el as ProbedElement).__tmProbe = 1; });
    // Collapsed groups have no body in the DOM at all — querySelectorAll simply skips them.
    document.querySelectorAll('[data-group-id]').forEach(el => { (el as ProbedElement).__tmProbe = 1; });
  });
}

async function readDomProbes(page: Page): Promise<{ containersTotal: number; containersMarked: number; bodiesTotal: number; bodiesMarked: number }> {
  return page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('[data-group-container]')) as ProbedElement[];
    const bodies = Array.from(document.querySelectorAll('[data-group-id]')) as ProbedElement[];
    return {
      containersTotal: containers.length,
      containersMarked: containers.filter(el => el.__tmProbe === 1).length,
      bodiesTotal: bodies.length,
      bodiesMarked: bodies.filter(el => el.__tmProbe === 1).length,
    };
  });
}

function cardsIn(page: Page, groupId: GroupId) {
  return page.locator(`[data-group-id="${groupId}"] [data-task-id]`);
}

/**
 * Everything the open popup *says*, plus how many elements it is built from.
 *
 * The value typed into an input is not part of `textContent` and does not add an element, so this
 * pair cannot move just because a title changed — which is what makes it usable as a "nothing new
 * appeared" probe. A duplicate-name warning would have to add text, an element, or both, whatever
 * class name it chose; asserting `toHaveCount(0)` on a guessed class name would instead pass on any
 * product, working or not.
 */
async function popupShape(page: Page): Promise<{ text: string; elements: number }> {
  return page.evaluate(() => {
    const popup = document.querySelector('.tm-popup') as HTMLElement;
    return { text: popup.textContent ?? '', elements: popup.querySelectorAll('*').length };
  });
}

/** Rendered opacity of a settings row — the dimming the user actually sees, not the class name. */
async function settingsRowOpacity(page: Page, groupId: GroupId): Promise<number> {
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-settings-group="${id}"]`) as HTMLElement;
    return Number(getComputedStyle(el).opacity);
  }, groupId);
}

/** Board ids in the order the header select lists them (= data.boards order). */
async function boardIds(page: Page): Promise<string[]> {
  return page
    .locator('.tm-board-header__select option')
    .evaluateAll(els => els.map(el => (el as HTMLOptionElement).value));
}

// ────────────────────────────────────────────────────────────────────────────────
// Titles
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.1 renamed group shows everywhere and survives a reload', async ({ page }) => {
  await openBoardSettings(page);
  await setGroupTitle(page, 'focus', 'Sprint focus');
  await setGroupTitle(page, 'backlog', 'Someday maybe');
  await saveBoardSettings(page);

  // Plain group header
  await expect(groupTitleOnBoard(page, 'focus')).toHaveText('Sprint focus');
  // Collapsible group header — backlog is collapsed by default, its title lives in the header
  await expect(groupTitleOnBoard(page, 'backlog')).toHaveText('Someday maybe');

  // Group settings popup of that very group
  await openGroupSettings(page, 'focus');
  await expect(page.locator('.tm-popup .tm-popup__title')).toContainText('Sprint focus');
  await closeGroupSettings(page);

  const snapshot = await readSavedSnapshot(page);
  await reloadFromSnapshot(page, snapshot);

  await expect(groupTitleOnBoard(page, 'focus')).toHaveText('Sprint focus');
  await expect(groupTitleOnBoard(page, 'backlog')).toHaveText('Someday maybe');
});

test('Сц.2 title field holds the raw stored value; clearing it restores the default', async ({ page }) => {
  // 1. Never renamed — the field is empty and the default is only a placeholder (Decision 4).
  await openBoardSettings(page);
  await expect(groupTitleInput(page, 'delegated')).toHaveValue('');
  await expect(groupTitleInput(page, 'delegated')).toHaveAttribute('placeholder', en['group.delegated']);
  await closeBoardSettings(page);

  // 2. Renamed — the field shows the stored title.
  await openBoardSettings(page);
  await setGroupTitle(page, 'delegated', 'Handed over');
  await saveBoardSettings(page);
  await expect(groupTitleOnBoard(page, 'delegated')).toHaveText('Handed over');

  await openBoardSettings(page);
  await expect(groupTitleInput(page, 'delegated')).toHaveValue('Handed over');

  // 3. Cleared — board falls back to the default, the field is empty again.
  await setGroupTitle(page, 'delegated', '');
  await saveBoardSettings(page);
  await expect(groupTitleOnBoard(page, 'delegated')).toHaveText(en['group.delegated']);

  await openBoardSettings(page);
  await expect(groupTitleInput(page, 'delegated')).toHaveValue('');
  await expect(groupTitleInput(page, 'delegated')).toHaveAttribute('placeholder', en['group.delegated']);
  await closeBoardSettings(page);
});

test('Сц.16 two groups may carry the same name — no warning, nothing broken', async ({ page }) => {
  const SHARED = 'Same name';

  await openBoardSettings(page);

  // Baseline taken while the two names are still *different*, so the only thing that changes
  // between the two probes below is the second title becoming a duplicate of the first.
  await setGroupTitle(page, 'focus', SHARED);
  await setGroupTitle(page, 'delegated', 'Another name');
  const before = await popupShape(page);

  await setGroupTitle(page, 'delegated', SHARED);
  const after = await popupShape(page);

  // No warning of any shape: not a word of new text, not a single new element.
  expect(after.text).toBe(before.text);
  expect(after.elements).toBe(before.elements);
  // …and the popup did not react by locking the way out.
  await expect(page.locator('.tm-popup .tm-popup__btn--primary')).toBeEnabled();

  // `saveBoardSettings` waits for the popup to detach — a refused save would fail right here.
  await saveBoardSettings(page);

  // Both groups are still on the board, in their places, and both show the shared name.
  expect(await visibleGroupOrder(page)).toEqual(DEFAULT_ORDER);
  await expect(groupTitleOnBoard(page, 'focus')).toHaveText(SHARED);
  await expect(groupTitleOnBoard(page, 'delegated')).toHaveText(SHARED);

  // Stored as two independent titles — neither group silently lost its own, and no other group
  // was dragged along.
  const data = await page.evaluate(() => window.__test.getDataStore());
  const board = data.boards[0]; // single board in this scenario
  expect(board.groups.focus.title).toBe(SHARED);
  expect(board.groups.delegated.title).toBe(SHARED);
  for (const groupId of GROUP_IDS) {
    if (groupId === 'focus' || groupId === 'delegated') continue;
    expect(board.groups[groupId].title, `group ${groupId}`).toBe('');
  }

  // Reopening shows the duplicate back in both fields, still without a warning.
  await openBoardSettings(page);
  await expect(groupTitleInput(page, 'focus')).toHaveValue(SHARED);
  await expect(groupTitleInput(page, 'delegated')).toHaveValue(SHARED);
  expect((await popupShape(page)).elements).toBe(before.elements);
  await closeBoardSettings(page);
});

// ────────────────────────────────────────────────────────────────────────────────
// Order
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.3 arrows reorder groups on the board; notes stay below them', async ({ page }) => {
  expect(await visibleGroupOrder(page)).toEqual(DEFAULT_ORDER);

  await openBoardSettings(page);
  await clickMoveArrow(page, 'delegated', 'up');
  await saveBoardSettings(page);

  // Computed order, not DOM index — and the whole sequence, so a group cannot drift unnoticed
  expect(await visibleGroupOrder(page)).toEqual([
    'backlog', 'focus', 'inProgress', 'delegated', 'orgIntentions', 'completed',
  ]);

  // On-screen geometry: both groups are full width, so they sit in different rows
  const delegatedBox = await groupBox(page, 'delegated');
  const orgBox = await groupBox(page, 'orgIntentions');
  expect(delegatedBox.top).toBeLessThan(orgBox.top);

  // Notes section keeps its explicit high order value and stays under every group (Decision 2)
  const notes = await page.evaluate(() => {
    const el = document.querySelector('.tm-board-layout__notes') as HTMLElement | null;
    if (!el) return null;
    const groups = Array.from(document.querySelectorAll('[data-group-container]')) as HTMLElement[];
    return {
      order: Number(getComputedStyle(el).order || 0),
      maxGroupOrder: Math.max(...groups.map(g => Number(getComputedStyle(g).order || 0))),
      top: el.getBoundingClientRect().top,
      maxGroupBottom: Math.max(...groups.map(g => g.getBoundingClientRect().bottom)),
    };
  });
  expect(notes).not.toBeNull();
  expect(notes!.order).toBeGreaterThan(notes!.maxGroupOrder);
  expect(notes!.top).toBeGreaterThanOrEqual(notes!.maxGroupBottom);
});

test('Сц.4 a visible group jumps over a hidden one on the first click', async ({ page }) => {
  // Hide inProgress, which sits between focus and orgIntentions
  await openBoardSettings(page);
  await visibilityToggle(page, 'inProgress').click();
  await saveBoardSettings(page);

  expect(await visibleGroupOrder(page)).toEqual([
    'backlog', 'focus', 'orgIntentions', 'delegated', 'completed',
  ]);

  // Exactly one press — a visible group must step over the hidden neighbour, not into it
  await openBoardSettings(page);
  await clickMoveArrow(page, 'focus', 'down');
  await saveBoardSettings(page);

  // focus and orgIntentions swapped; nothing else moved, and inProgress is still hidden
  expect(await visibleGroupOrder(page)).toEqual([
    'backlog', 'orgIntentions', 'focus', 'delegated', 'completed',
  ]);
});

/**
 * Not in the task's list of fourteen — added after the test review. The logic behind it is covered
 * by unit tests on `moveGroupWithinPresent`, but the second half of the user-spec criterion ("after
 * being made visible again the group appears on the board where it was put") is a wiring claim that
 * no unit test can make and no other scenario here reaches.
 */
test('Сц.15 a hidden row moves by its literal neighbours and returns to the chosen position', async ({ page }) => {
  // Two *adjacent* groups hidden. With only one hidden row every literal neighbour is visible and
  // both arrow branches produce the same list — the scenario would pass with the hidden-row branch
  // deleted. A hidden neighbour is what tells the two apart.
  await openBoardSettings(page);
  await visibilityToggle(page, 'inProgress').click();
  await visibilityToggle(page, 'orgIntentions').click();
  await saveBoardSettings(page);
  expect(await visibleGroupOrder(page)).toEqual(['backlog', 'focus', 'delegated', 'completed']);

  await openBoardSettings(page);
  await expect(page.locator('[data-settings-group="inProgress"]')).toHaveClass(/tm-popup__group-row--hidden/);
  await expect(page.locator('[data-settings-group="orgIntentions"]')).toHaveClass(/tm-popup__group-row--hidden/);

  // A hidden row swaps with its immediate list neighbour whatever its visibility: orgIntentions
  // lands on the hidden inProgress. A visible row would have stepped over it onto focus.
  await clickMoveArrow(page, 'orgIntentions', 'up');
  expect(await settingsRowOrder(page)).toEqual([
    'backlog', 'focus', 'orgIntentions', 'inProgress', 'delegated', 'completed',
  ]);

  // Once more, now onto a visible neighbour — still a literal swap
  await clickMoveArrow(page, 'orgIntentions', 'up');
  expect(await settingsRowOrder(page)).toEqual([
    'backlog', 'orgIntentions', 'focus', 'inProgress', 'delegated', 'completed',
  ]);

  // Make it visible again in the same session and save: it must appear where it was put, not back
  // in its default slot and not appended at the end.
  await visibilityToggle(page, 'orgIntentions').click();
  await saveBoardSettings(page);

  expect(await visibleGroupOrder(page)).toEqual([
    'backlog', 'orgIntentions', 'focus', 'delegated', 'completed',
  ]);
});

test('Сц.6 reopening the popup keeps the row order, hidden rows included', async ({ page }) => {
  await openBoardSettings(page);
  await visibilityToggle(page, 'inProgress').click();
  await clickMoveArrow(page, 'delegated', 'up');
  await saveBoardSettings(page);

  // The hide really took effect — without this the expected sequence below is byte-identical to
  // what an unhidden board produces, and the scenario would not notice a lost hidden row.
  expect(await visibleGroupOrder(page)).toEqual([
    'backlog', 'focus', 'delegated', 'orgIntentions', 'completed',
  ]);

  await openBoardSettings(page);
  // Hidden inProgress stays on its own position instead of sinking to the end of the list
  expect(await settingsRowOrder(page)).toEqual([
    'backlog', 'focus', 'inProgress', 'delegated', 'orgIntentions', 'completed',
  ]);
  await closeBoardSettings(page);
});

// ────────────────────────────────────────────────────────────────────────────────
// Drag & drop
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.5 drag & drop works right after reordering, without a reload', async ({ page }) => {
  // backlog is collapsed by default — expand before creating anything in it
  await expandGroup(page, 'backlog');
  await createTask(page, 'backlog', { what: 'Backlog task' });
  const focusTaskId = await createTask(page, 'focus', { what: 'Focus task' });

  await markDomNodes(page);

  // Reorder — and then drag immediately. No goto, no resetData, no reload in between: after a
  // reload SortableJS re-initialises on the already-correct order and the check proves nothing.
  await openBoardSettings(page);
  await clickMoveArrow(page, 'focus', 'up');
  await saveBoardSettings(page);

  expect(await visibleGroupOrder(page)).toEqual([
    'focus', 'backlog', 'inProgress', 'orgIntentions', 'delegated', 'completed',
  ]);

  // Decision 1: reordering must not recreate the wrappers, nor the bodies that carry SortableJS
  const probes = await readDomProbes(page);
  expect(probes.containersTotal).toBe(6);
  expect(probes.containersMarked).toBe(probes.containersTotal);
  expect(probes.bodiesTotal).toBe(5); // completed stays collapsed → no body
  expect(probes.bodiesMarked).toBe(probes.bodiesTotal);

  // focus → backlog (real mouse input through SortableJS)
  await dragCardToGroup(page, focusTaskId, 'backlog');
  await expect(cardsIn(page, 'backlog')).toHaveCount(2);
  await expect(cardsIn(page, 'focus')).toHaveCount(0);

  // backlog → focus, the same card back
  await dragCardToGroup(page, focusTaskId, 'focus');
  await expect(cardsIn(page, 'focus')).toHaveCount(1);
  await expect(cardsIn(page, 'backlog')).toHaveCount(1);
});

// ────────────────────────────────────────────────────────────────────────────────
// Discarding changes
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.7 Cancel discards an unsaved title and an unsaved order', async ({ page }) => {
  await openBoardSettings(page);
  await setGroupTitle(page, 'delegated', 'Should not stick');
  await clickMoveArrow(page, 'delegated', 'up');
  await closeBoardSettings(page);

  await expect(groupTitleOnBoard(page, 'delegated')).toHaveText(en['group.delegated']);
  expect(await visibleGroupOrder(page)).toEqual(DEFAULT_ORDER);

  await openBoardSettings(page);
  await expect(groupTitleInput(page, 'delegated')).toHaveValue('');
  expect(await settingsRowOrder(page)).toEqual(DEFAULT_ORDER);
  await closeBoardSettings(page);
});

test('Сц.8 clicking outside the popup discards the same', async ({ page }) => {
  await openBoardSettings(page);
  await setGroupTitle(page, 'delegated', 'Should not stick either');
  await clickMoveArrow(page, 'delegated', 'up');
  await page.locator('.tm-popup-overlay').click({ position: { x: 10, y: 10 } });
  await page.waitForSelector('.tm-popup', { state: 'detached' });

  await expect(groupTitleOnBoard(page, 'delegated')).toHaveText(en['group.delegated']);
  expect(await visibleGroupOrder(page)).toEqual(DEFAULT_ORDER);

  await openBoardSettings(page);
  await expect(groupTitleInput(page, 'delegated')).toHaveValue('');
  expect(await settingsRowOrder(page)).toEqual(DEFAULT_ORDER);
  await closeBoardSettings(page);
});

// ────────────────────────────────────────────────────────────────────────────────
// Multiple boards
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.9 two boards keep independent titles and order', async ({ page }) => {
  const ORDER_A: string[] = ['backlog', 'focus', 'inProgress', 'delegated', 'orgIntentions', 'completed'];
  const ORDER_B: string[] = ['focus', 'backlog', 'inProgress', 'orgIntentions', 'delegated', 'completed'];

  // Board A
  await openBoardSettings(page);
  await setGroupTitle(page, 'focus', 'A focus');
  await clickMoveArrow(page, 'delegated', 'up');
  await saveBoardSettings(page);

  await page.locator('.tm-board-header__icon[title="Create board"]').click();
  await expect(page.locator('.tm-board-header__select option')).toHaveCount(2);
  const [boardA, boardB] = await boardIds(page);

  // Board B starts from the defaults — nothing leaked from A
  await expect(groupTitleOnBoard(page, 'focus')).toHaveText(en['group.focus']);
  expect(await visibleGroupOrder(page)).toEqual(DEFAULT_ORDER);

  await openBoardSettings(page);
  await setGroupTitle(page, 'focus', 'B focus');
  await clickMoveArrow(page, 'backlog', 'down');
  await saveBoardSettings(page);

  expect(await visibleGroupOrder(page)).toEqual(ORDER_B);

  // Back to A — its own settings, untouched
  await page.selectOption('.tm-board-header__select', boardA);
  await expect(groupTitleOnBoard(page, 'focus')).toHaveText('A focus');
  expect(await visibleGroupOrder(page)).toEqual(ORDER_A);

  // Reload: both boards keep their own settings. resetData switches to the first board, so the
  // board under test is selected explicitly rather than assumed.
  const snapshot = await readSavedSnapshot(page);
  await reloadFromSnapshot(page, snapshot);

  await page.selectOption('.tm-board-header__select', boardB);
  await expect(groupTitleOnBoard(page, 'focus')).toHaveText('B focus');
  expect(await visibleGroupOrder(page)).toEqual(ORDER_B);

  await page.selectOption('.tm-board-header__select', boardA);
  await expect(groupTitleOnBoard(page, 'focus')).toHaveText('A focus');
  expect(await visibleGroupOrder(page)).toEqual(ORDER_A);
});

// ────────────────────────────────────────────────────────────────────────────────
// Edge cases
// ────────────────────────────────────────────────────────────────────────────────

test('Сц.10 a 40-character title does not break the header line', async ({ page }) => {
  // Narrow enough that 40 characters cannot fit into a half-width column, still above the 600px
  // media query that would collapse the layout to a single column.
  await page.setViewportSize({ width: 700, height: 720 });
  await expect(groupTitleOnBoard(page, 'focus')).toBeVisible();

  const measure = () => page.evaluate(() => {
    const container = document.querySelector('[data-group-container="focus"]') as HTMLElement;
    const header = container.querySelector('.tm-group-header') as HTMLElement;
    const title = container.querySelector('.tm-group-header__title') as HTMLElement;
    return {
      height: title.getBoundingClientRect().height,
      scrollWidth: title.scrollWidth,
      clientWidth: title.clientWidth,
      headerScrollWidth: header.scrollWidth,
      headerClientWidth: header.clientWidth,
    };
  });

  const before = await measure();

  // 40 characters, no spaces — the field's maxlength and the widest thing a user can enter
  const longTitle = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn';
  expect(longTitle).toHaveLength(40);

  await openBoardSettings(page);
  await setGroupTitle(page, 'focus', longTitle);
  await saveBoardSettings(page);
  await expect(groupTitleOnBoard(page, 'focus')).toHaveText(longTitle);

  const after = await measure();

  // No wrap onto a second line. Sub-pixel tolerance, not toBeCloseTo(…, 1) — that would allow
  // ±0.05px, which is tighter than layout rounding, and reads as if it allowed a pixel.
  expect(Math.abs(after.height - before.height)).toBeLessThan(1);
  // Truncated rather than shown in full
  expect(after.scrollWidth).toBeGreaterThan(after.clientWidth);
  // The title absorbed the length instead of pushing the header row past the group. Measured on the
  // header's own overflow, not on the title's right edge: the title is the first item in the row, so
  // its box can never stick out on the right and such a check would pass whatever the styles do.
  expect(after.headerScrollWidth).toBeLessThanOrEqual(after.headerClientWidth + 1);
});

/**
 * The other half of the same criterion as Сц.10. Сц.10 covers the board header (truncated with an
 * ellipsis); this one covers the settings field, where the requirement is the opposite — the text
 * must stay reachable by scrolling *inside* the field instead of widening it.
 */
test('Сц.18 a 40-character title scrolls inside the settings field instead of stretching the row', async ({ page }) => {
  // The popup is capped at 420px, so the field is far too narrow for 40 characters whatever the
  // viewport; the narrow viewport only keeps the board behind it in its one-column shape.
  await page.setViewportSize({ width: 700, height: 720 });
  await expect(page.locator('.tm-board-layout')).toBeVisible();

  await openBoardSettings(page);

  // `cell` is the grid cell the field is given (`.tm-popup__group-name`); measuring containment
  // against it rather than against the whole row is what makes the check falsifiable — a field that
  // grows first spills over its own column and only much later past the row.
  const measure = () => page.evaluate(() => {
    const row = document.querySelector('[data-settings-group="focus"]') as HTMLElement;
    const cell = row.querySelector('.tm-popup__group-name') as HTMLElement;
    const input = row.querySelector('.tm-popup__group-title-input') as HTMLInputElement;
    const popup = document.querySelector('.tm-popup') as HTMLElement;
    return {
      rowScrollWidth: row.scrollWidth,
      rowClientWidth: row.clientWidth,
      cellScrollWidth: cell.scrollWidth,
      cellClientWidth: cell.clientWidth,
      cellRight: cell.getBoundingClientRect().right,
      inputClientWidth: input.clientWidth,
      inputScrollWidth: input.scrollWidth,
      inputRight: input.getBoundingClientRect().right,
      popupClientWidth: popup.clientWidth,
      popupScrollWidth: popup.scrollWidth,
    };
  });

  // Baseline with the field empty: nothing overflows yet, so the overflow measured after typing is
  // caused by the title and not by something the popup does anyway.
  const before = await measure();
  expect(before.inputScrollWidth).toBe(before.inputClientWidth);

  // Same 40 characters as Сц.10: no spaces, and the widest thing the field's own `maxlength` admits.
  const longTitle = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn';
  expect(longTitle).toHaveLength(40);
  await setGroupTitle(page, 'focus', longTitle);
  await expect(groupTitleInput(page, 'focus')).toHaveValue(longTitle);

  const after = await measure();

  // The text does not fit into the field — so there is something to scroll in the first place.
  expect(after.inputScrollWidth).toBeGreaterThan(after.inputClientWidth);

  // And it genuinely scrolls inside the field. Reset to 0 first: `fill` leaves the caret at the
  // end, so the field may already sit at its maximum scroll and a bare "scroll further" would
  // report no movement on a perfectly working product.
  const scrolled = await page.evaluate(() => {
    const input = document.querySelector(
      '[data-settings-group="focus"] .tm-popup__group-title-input',
    ) as HTMLInputElement;
    input.scrollLeft = 0;
    const startLeft = input.scrollLeft;
    input.scrollLeft = 1000;
    return { startLeft, endLeft: input.scrollLeft };
  });
  expect(scrolled.endLeft).toBeGreaterThan(scrolled.startLeft);

  // Scrolling instead of stretching: the field stayed inside the cell it was given …
  expect(after.cellScrollWidth).toBeLessThanOrEqual(after.cellClientWidth + 1);
  // … so it cannot be lying across the visibility and full-width columns to its right …
  expect(after.inputRight).toBeLessThanOrEqual(after.cellRight + 1);
  // … the row was not pushed wider than the space it has …
  expect(after.rowScrollWidth).toBeLessThanOrEqual(after.rowClientWidth + 1);
  // … and the popup did not start overflowing sideways either.
  expect(after.popupScrollWidth).toBeLessThanOrEqual(after.popupClientWidth + 1);

  await closeBoardSettings(page);
});

test('Сц.11 toggling visibility changes arrow behaviour before saving', async ({ page }) => {
  await openBoardSettings(page);
  // Hide inProgress and — without saving — move focus down once
  await visibilityToggle(page, 'inProgress').click();
  await clickMoveArrow(page, 'focus', 'down');

  // The arrow acted on the unsaved state: focus stepped over the just-hidden inProgress.
  // Checked in the popup — the board still shows the saved state at this point.
  expect(await settingsRowOrder(page)).toEqual([
    'backlog', 'orgIntentions', 'inProgress', 'focus', 'delegated', 'completed',
  ]);

  await saveBoardSettings(page);
  expect(await visibleGroupOrder(page)).toEqual([
    'backlog', 'orgIntentions', 'focus', 'delegated', 'completed',
  ]);
});

/**
 * Сц.15 also asserts the dimming class, but only after a save and a reopen — i.e. on the *saved*
 * state. This one is about the moment in between: the row must change the instant the checkbox is
 * clicked, with nothing persisted yet.
 */
test('Сц.17 toggling visibility dims the row immediately, before any save', async ({ page }) => {
  await openBoardSettings(page);
  const row = page.locator('[data-settings-group="inProgress"]');
  const control = page.locator('[data-settings-group="delegated"]');

  await expect(row).not.toHaveClass(/tm-popup__group-row--hidden/);
  expect(await settingsRowOpacity(page, 'inProgress')).toBe(1);

  await visibilityToggle(page, 'inProgress').click();

  // Immediately: no save, no reopen, nothing in between.
  await expect(row).toHaveClass(/tm-popup__group-row--hidden/);
  // The class is not decoration — the row is actually rendered faded …
  expect(await settingsRowOpacity(page, 'inProgress')).toBeLessThan(1);
  // … and only that row, so "the whole popup went pale" cannot pass for a hit.
  await expect(control).not.toHaveClass(/tm-popup__group-row--hidden/);
  expect(await settingsRowOpacity(page, 'delegated')).toBe(1);

  // Nothing was saved: the board behind the popup still shows all six groups and the stored board
  // still hides none. Without this the scenario could not tell "immediately" from "on save".
  expect(await visibleGroupOrder(page)).toEqual(DEFAULT_ORDER);
  expect(await page.evaluate(() => window.__test.getDataStore().boards[0].hiddenGroups)).toEqual([]);

  // Toggling back restores the row just as immediately.
  await visibilityToggle(page, 'inProgress').click();
  await expect(row).not.toHaveClass(/tm-popup__group-row--hidden/);
  expect(await settingsRowOpacity(page, 'inProgress')).toBe(1);

  await closeBoardSettings(page);
});

test('Сц.12 popup with a full row list stays on screen and its body scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 400 });
  await expect(page.locator('.tm-board-layout')).toBeVisible();

  await openBoardSettings(page);
  await expect(page.locator('[data-settings-group]')).toHaveCount(6);

  const viewport = page.viewportSize()!;
  const box = await page.locator('.tm-popup').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);

  // Find the scrollable container by fact, not by a guessed class name
  const scrollable = await page.evaluate(() => {
    const popup = document.querySelector('.tm-popup') as HTMLElement;
    const candidates = [popup, ...Array.from(popup.querySelectorAll('*'))] as HTMLElement[];
    const el = candidates.find(c => c.scrollHeight > c.clientHeight + 1);
    if (!el) return null;
    const startTop = el.scrollTop;
    el.scrollTop = startTop + 50;
    return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, startTop, endTop: el.scrollTop };
  });
  // Not `scrollHeight > clientHeight` again — that is the predicate the element was selected by,
  // and restating it inside the test cannot fail. `not.toBeNull()` is the assertion that carries it.
  expect(scrollable).not.toBeNull();
  expect(scrollable!.endTop).toBeGreaterThan(scrollable!.startTop);

  await closeBoardSettings(page);
});

test('Сц.13 empty-group hint depends on whether the group was renamed', async ({ page }) => {
  // After standardBeforeEach all six groups are empty. focus gets renamed, delegated does not.
  await openBoardSettings(page);
  await setGroupTitle(page, 'focus', 'Sprint focus');
  await saveBoardSettings(page);

  await expect(emptyStateOf(page, 'focus')).toHaveText(en['emptyState.renamed']);
  await expect(emptyStateOf(page, 'delegated')).toHaveText(en['emptyState.delegated']);

  // Clearing the title brings the original hint back
  await openBoardSettings(page);
  await setGroupTitle(page, 'focus', '');
  await saveBoardSettings(page);

  await expect(emptyStateOf(page, 'focus')).toHaveText(en['emptyState.focus']);
  await expect(emptyStateOf(page, 'delegated')).toHaveText(en['emptyState.delegated']);
});

test('Сц.14 saving without editing titles does not freeze the defaults into explicit titles', async ({ page }) => {
  await openBoardSettings(page);
  await saveBoardSettings(page);

  // 1. Cause: every stored title is still empty — the state in which the resolver returns the
  //    localized default. The literal "switch language and see headers translate" check is out of
  //    reach in E2E: the harness pins locale to 'en' and exposes no way to change it.
  const data = await page.evaluate(() => window.__test.getDataStore());
  const board = data.boards[0]; // single board in this scenario
  for (const groupId of GROUP_IDS) {
    expect(board.groups[groupId].title, `group ${groupId}`).toBe('');
  }

  // 2. Observable consequence: hints did not flip to the neutral one, i.e. no group counts as renamed
  await expect(emptyStateOf(page, 'delegated')).toHaveText(en['emptyState.delegated']);
  await expect(emptyStateOf(page, 'focus')).toHaveText(en['emptyState.focus']);

  // 3. Headers still show the default names
  for (const groupId of GROUP_IDS) {
    await expect(groupTitleOnBoard(page, groupId)).toHaveText(en[`group.${groupId}` as const]);
  }
});
