import type { FollowUp, GroupId, PluginData } from './types';
import { GROUP_IDS } from './types';
import { DEFAULT_DATA, DEFAULT_SETTINGS, DEFAULT_FULL_WIDTH } from './defaults';

// The stored group name is limited to the same length as the input field in board settings.
// Both limits exist on purpose: the input guards fresh typing, this one guards hand-edited files.
const GROUP_TITLE_MAX_LENGTH = 40;

// Load-side limits of a task's follow-up list; the form enforces the same values while typing.
export const FOLLOW_UP_TEXT_MAX_LENGTH = 200;
export const MAX_FOLLOW_UPS = 20;

// All sanitizers take `unknown` and never throw: migrateData runs before the board is rendered,
// so an exception on hand-edited data would leave the user with no board at all.

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// The task entries that can safely receive a field. A damaged `tasks` value or entry is skipped,
// not repaired — wider load hardening is TD-01.
function taskObjects(tasks: unknown): Record<string, unknown>[] {
  return isObject(tasks) ? Object.values(tasks).filter(isObject) : [];
}

/**
 * Always returns a valid list: at most MAX_FOLLOW_UPS items, each with a unique non-empty id,
 * a trimmed non-empty text of at most FOLLOW_UP_TEXT_MAX_LENGTH characters and a string
 * createdTaskId. Items without usable text are dropped; a bad id is replaced, since the text is
 * the user's content and the id only an implementation detail. Valid input comes back equal, ids
 * included. The input is never mutated.
 */
export function sanitizeFollowUps(value: unknown): FollowUp[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const list: FollowUp[] = [];
  for (const item of value as unknown[]) {
    if (list.length >= MAX_FOLLOW_UPS) break;
    if (!isObject(item) || typeof item.text !== 'string') continue;
    // Same cap as sanitizeGroupTitle, but trailing whitespace and lone high surrogates are stripped
    // together: the cut may land after a space, and a surrogate may hide behind one. A valid pair
    // ends with a low surrogate, so whole emoji survive. A second load then changes nothing.
    const text = item.text
      .trim()
      .slice(0, FOLLOW_UP_TEXT_MAX_LENGTH)
      .replace(/[\s\uD800-\uDBFF]+$/, '');
    if (text === '') continue;
    const id = typeof item.id === 'string' && item.id !== '' && !seen.has(item.id) ? item.id : crypto.randomUUID();
    seen.add(id);
    list.push({ id, text, createdTaskId: typeof item.createdTaskId === 'string' ? item.createdTaskId : '' });
  }
  return list;
}

/**
 * Always returns a permutation of GROUP_IDS: unknown ids are dropped, duplicates collapse onto
 * their first position, and ids that are missing are appended in default order.
 */
export function sanitizeGroupOrder(value: unknown): GroupId[] {
  if (!Array.isArray(value)) {
    return [...GROUP_IDS];
  }

  const seen = new Set<GroupId>();
  const order: GroupId[] = [];
  for (const item of value as unknown[]) {
    const id = item as GroupId;
    if (!GROUP_IDS.includes(id) || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  for (const id of GROUP_IDS) {
    if (!seen.has(id)) {
      order.push(id);
    }
  }
  return order;
}

/** Always returns a string of at most GROUP_TITLE_MAX_LENGTH characters. '' means "use the default name". */
export function sanitizeGroupTitle(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  // Trim first, so padding around a full-length name does not eat real characters.
  // The trailing replace drops a lone high surrogate left behind when the cap cuts through a
  // surrogate pair — otherwise a broken glyph would be written back to data.json.
  return value.trim().slice(0, GROUP_TITLE_MAX_LENGTH).replace(/[\uD800-\uDBFF]$/, '');
}

// Both early returns hand back the built-in default. groupOrder is copied explicitly: the shallow
// spread would otherwise share the array instance owned by DEFAULT_DATA, and these paths return
// before the sanitization block that would replace it.
function freshDefaultData(): PluginData {
  return {
    ...DEFAULT_DATA,
    boards: [{ ...DEFAULT_DATA.boards[0], groupOrder: [...DEFAULT_DATA.boards[0].groupOrder] }],
  };
}

export function migrateData(data: unknown): PluginData {
  if (!data || typeof data !== 'object') {
    return freshDefaultData();
  }

  const raw = data as Record<string, unknown>;
  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version < 1) {
    return freshDefaultData();
  }

  let result = data as PluginData;

  if (version < 2) {
    result = {
      ...result,
      version: 2,
      settings: {
        ...DEFAULT_SETTINGS,
        ...result.settings,
        language: 'auto',
      },
    };
  }

  // Ensure cardView exists (backward compatibility for version 2 without this field)
  if (result.settings.cardView === undefined) {
    result.settings.cardView = DEFAULT_SETTINGS.cardView;
  }

  if (version < 3) {
    for (const board of result.boards) {
      if ((board as any).notes === undefined) {
        board.notes = '';
      }
      if ((board as any).notesCollapsed === undefined) {
        board.notesCollapsed = true;
      }
    }
    result.version = 3;
  }

  if (version < 4) {
    for (const board of result.boards) {
      if ((board as any).hiddenGroups === undefined) {
        (board as any).hiddenGroups = [];
      }
    }
    result.version = 4;
  }

  if (version < 5) {
    for (const board of result.boards) {
      for (const id of GROUP_IDS) {
        if (board.groups[id].fullWidth === undefined) {
          (board.groups[id] as any).fullWidth = DEFAULT_FULL_WIDTH[id];
        }
      }
    }
    result.version = 5;
  }

  if (version < 6) {
    if (result.settings.cardLayout === undefined) {
      result.settings.cardLayout = 'single';
    }
    result.version = 6;
  }

  if (version < 7) {
    for (const board of result.boards) {
      if ((board as any).notesHidden === undefined) {
        (board as any).notesHidden = false;
      }
    }
    result.version = 7;
  }

  if (version < 8) {
    for (const board of result.boards) {
      for (const group of Object.values(board.groups)) {
        if ((group as any).title === undefined) {
          (group as any).title = '';
        }
      }
      if ((board as any).groupOrder === undefined) {
        (board as any).groupOrder = [...GROUP_IDS];
      }
    }
    result.version = 8;
  }

  if (version < 9) {
    // The first block that iterates tasks: it skips damaged entries exactly like the loop below.
    for (const task of taskObjects(result.tasks)) {
      if (task.followUps === undefined) {
        task.followUps = [];
      }
    }
    result.version = 9;
  }

  // Sanitization deliberately sits outside every version branch, so data damaged after the
  // migration already ran is repaired too. Iterating the groups that exist (rather than
  // GROUP_IDS) keeps a board with a missing group from throwing on every load.
  for (const board of result.boards) {
    board.groupOrder = sanitizeGroupOrder(board.groupOrder);
    for (const group of Object.values(board.groups)) {
      group.title = sanitizeGroupTitle(group.title);
    }
  }
  for (const task of taskObjects(result.tasks)) {
    task.followUps = sanitizeFollowUps(task.followUps);
  }

  return result;
}
