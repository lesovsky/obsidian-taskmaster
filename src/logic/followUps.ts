import type { FollowUp, PluginData, Priority, Task } from '../data/types';
import { FOLLOW_UP_TEXT_MAX_LENGTH, MAX_FOLLOW_UPS } from '../data/migration';

// The load-side sanitizer owns the limits; the editor imports them from here.
export { FOLLOW_UP_TEXT_MAX_LENGTH, MAX_FOLLOW_UPS };

// Same limit as the maxlength of the "Why" field in the task form.
const WHY_MAX_LENGTH = 10_000;

/** A row of the form's follow-up editor; `marked` = "→ to backlog" was pressed. Not persisted. */
export interface FollowUpDraft {
  id: string;
  text: string;
  createdTaskId: string;
  marked: boolean;
}

// Ids read from data may be hand-edited: 'constructor' must not resolve to an inherited property.
function hasTask(data: PluginData, id: string): boolean {
  return Object.prototype.hasOwnProperty.call(data.tasks, id);
}

/** Items not yet spawned, in list order. A task without the field has none. */
export function pendingFollowUps(task: Pick<Task, 'followUps'>): FollowUp[] {
  return Array.isArray(task.followUps) ? task.followUps.filter(item => item.createdTaskId === '') : [];
}

export function buildFollowUpTask(
  item: FollowUp,
  parent: Task,
  opts: { whyPrefix: string; priority: Priority; today: string },
): Task {
  return {
    id: crypto.randomUUID(),
    what: item.text,
    // Cutting through a surrogate pair would leave a broken glyph; drop the lone high half.
    why: (opts.whyPrefix + parent.what).slice(0, WHY_MAX_LENGTH).replace(/[\uD800-\uDBFF]$/, ''),
    who: '',
    deadline: '',
    createdAt: opts.today,
    completedAt: '',
    priority: opts.priority,
    status: 'new',
    followUps: [],
  };
}

/**
 * Creates a task for every pending item of the parent (or only for the pending items in `itemIds`),
 * appends them to the end of the board's backlog in list order and records `createdTaskId`.
 * Mutates `data`; returns the new task ids in order. Changes nothing and returns [] when the board,
 * the parent or the backlog group is missing.
 */
export function spawnFollowUps(
  data: PluginData,
  boardId: string,
  parentTaskId: string,
  opts: { whyPrefix: string; today: string },
  itemIds?: string[],
): string[] {
  const board = data.boards.find(b => b.id === boardId);
  const backlog = board?.groups?.backlog;
  if (!backlog || !Array.isArray(backlog.taskIds) || !hasTask(data, parentTaskId)) {
    return [];
  }

  const parent = data.tasks[parentTaskId];
  const wanted = itemIds ? new Set(itemIds) : null;
  const spawned: string[] = [];
  for (const item of pendingFollowUps(parent)) {
    if (wanted && !wanted.has(item.id)) continue;
    const task = buildFollowUpTask(item, parent, {
      whyPrefix: opts.whyPrefix,
      priority: data.settings.defaultPriority,
      today: opts.today,
    });
    data.tasks[task.id] = task;
    backlog.taskIds.push(task.id);
    item.createdTaskId = task.id;
    spawned.push(task.id);
  }
  return spawned;
}

/**
 * Undoes one spawn: removes the spawned tasks from every group of the board (the user may have
 * moved them) and from `tasks`, and turns the parent's items that point at them back to pending.
 * Items spawned earlier by other calls keep their `createdTaskId`. Mutates `data`.
 */
export function revertSpawnedFollowUps(
  data: PluginData,
  boardId: string,
  parentTaskId: string,
  spawnedTaskIds: string[],
): void {
  if (spawnedTaskIds.length === 0) return;
  const spawned = new Set(spawnedTaskIds);

  const board = data.boards.find(b => b.id === boardId);
  if (board?.groups) {
    for (const group of Object.values(board.groups)) {
      if (group && Array.isArray(group.taskIds)) {
        group.taskIds = group.taskIds.filter(id => !spawned.has(id));
      }
    }
  }

  for (const id of spawned) {
    if (hasTask(data, id)) {
      delete data.tasks[id];
    }
  }

  if (hasTask(data, parentTaskId) && Array.isArray(data.tasks[parentTaskId].followUps)) {
    for (const item of data.tasks[parentTaskId].followUps) {
      if (spawned.has(item.createdTaskId)) {
        item.createdTaskId = '';
      }
    }
  }
}

/**
 * Turns the editor rows into the stored list: texts trimmed and capped, empty rows dropped (marked
 * ones too), order kept, at most MAX_FOLLOW_UPS items. `spawnItemIds` lists the kept rows that are
 * marked and still pending.
 */
export function finalizeFollowUpDrafts(drafts: FollowUpDraft[]): { followUps: FollowUp[]; spawnItemIds: string[] } {
  const followUps: FollowUp[] = [];
  const spawnItemIds: string[] = [];
  for (const draft of drafts) {
    if (followUps.length >= MAX_FOLLOW_UPS) break;
    // Same normalization as sanitizeFollowUps, so the next load leaves the saved text unchanged.
    const text = draft.text
      .trim()
      .slice(0, FOLLOW_UP_TEXT_MAX_LENGTH)
      .replace(/[\s\uD800-\uDBFF]+$/, '');
    if (text === '') continue;
    followUps.push({ id: draft.id, text, createdTaskId: draft.createdTaskId });
    if (draft.marked && draft.createdTaskId === '') {
      spawnItemIds.push(draft.id);
    }
  }
  return { followUps, spawnItemIds };
}

/**
 * Fills `{group}` and `{count}` in one pass with a function replacer, so a user-defined group title
 * is inserted literally: no `$&`-style expansion and no second pass over placeholders it contains.
 * The hidden suffix, when given, is appended after one space.
 */
export function formatFollowUpNotice(
  template: string,
  groupTitle: string,
  count: number,
  hiddenSuffix: string | null,
): string {
  const text = template.replace(/\{(group|count)\}/g, (_match, key: string) =>
    key === 'group' ? groupTitle : String(count),
  );
  return hiddenSuffix === null ? text : `${text} ${hiddenSuffix}`;
}
