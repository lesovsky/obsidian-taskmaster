import { writable, get } from 'svelte/store';
import type { PluginData, Task, GroupId, Board, Settings, Status } from '../data/types';
import { DEFAULT_DATA, createDefaultBoard } from '../data/defaults';
import { pluginStore } from './pluginStore';
import { uiStore } from './uiStore';
import { formatDate } from '../utils/dateFormat';
import { applyStatusTransition } from '../logic/statusTransitions';
import { t } from '../i18n';

export const dataStore = writable<PluginData>({ ...DEFAULT_DATA });

async function persist(): Promise<void> {
  const plugin = get(pluginStore) as any;
  if (plugin?.saveData) {
    await plugin.saveData(get(dataStore));
  }
}

export function addTask(task: Task, groupId: GroupId): void {
  dataStore.update(data => {
    data.tasks[task.id] = task;
    const board = getActiveBoard(data);
    if (board) {
      board.groups[groupId].taskIds.push(task.id);
    }
    return data;
  });
  persist();
}

export function updateTask(task: Task): void {
  dataStore.update(data => {
    data.tasks[task.id] = task;
    return data;
  });
  persist();
}

export function removeTaskFromGroup(taskId: string, groupId: GroupId, boardId: string): { position: number } | null {
  let result: { position: number } | null = null;
  dataStore.update(data => {
    const board = data.boards.find(b => b.id === boardId);
    if (!board) return data;
    const arr = board.groups[groupId].taskIds;
    const idx = arr.indexOf(taskId);
    if (idx === -1) return data;
    arr.splice(idx, 1);
    result = { position: idx };
    return data;
  });
  persist();
  return result;
}

export function restoreTaskToGroup(taskId: string, groupId: GroupId, boardId: string, position: number): void {
  dataStore.update(data => {
    const board = data.boards.find(b => b.id === boardId);
    if (!board) return data;
    const arr = board.groups[groupId].taskIds;
    arr.splice(position, 0, taskId);
    return data;
  });
  persist();
}

export function finalDeleteTask(taskId: string): void {
  dataStore.update(data => {
    delete data.tasks[taskId];
    return data;
  });
  persist();
}

export function quickCompleteTask(
  taskId: string,
  sourceGroupId: GroupId,
  boardId: string,
): { position: number; previousStatus: Status; previousCompletedAt: string } | null {
  let result: { position: number; previousStatus: Status; previousCompletedAt: string } | null = null;

  dataStore.update(data => {
    const board = data.boards.find(b => b.id === boardId);
    if (!board) return data;

    const sourceArr = board.groups[sourceGroupId].taskIds;
    const idx = sourceArr.indexOf(taskId);
    if (idx === -1) return data;

    const task = data.tasks[taskId];
    if (!task) return data;

    result = {
      position: idx,
      previousStatus: task.status,
      previousCompletedAt: task.completedAt,
    };

    sourceArr.splice(idx, 1);
    board.groups.completed.taskIds.unshift(taskId);

    task.status = 'completed';
    task.completedAt = formatDate(new Date());

    return data;
  });

  persist();
  return result;
}

export function undoQuickComplete(
  taskId: string,
  sourceGroupId: GroupId,
  boardId: string,
  position: number,
  previousStatus: Status,
  previousCompletedAt: string,
): void {
  dataStore.update(data => {
    const board = data.boards.find(b => b.id === boardId);
    if (!board) return data;

    const completedArr = board.groups.completed.taskIds;
    const completedIdx = completedArr.indexOf(taskId);
    if (completedIdx !== -1) completedArr.splice(completedIdx, 1);

    board.groups[sourceGroupId].taskIds.splice(position, 0, taskId);

    const task = data.tasks[taskId];
    if (task) {
      task.status = previousStatus;
      task.completedAt = previousCompletedAt;
    }

    return data;
  });

  persist();
}

export function moveTask(taskId: string, fromGroupId: GroupId, toGroupId: GroupId, newIndex: number): void {
  dataStore.update(data => {
    const board = getActiveBoard(data);
    if (!board) return data;

    const fromArr = board.groups[fromGroupId].taskIds;
    const fromIdx = fromArr.indexOf(taskId);
    if (fromIdx === -1) return data;
    fromArr.splice(fromIdx, 1);

    const toArr = board.groups[toGroupId].taskIds;
    toArr.splice(newIndex, 0, taskId);

    const task = data.tasks[taskId];
    if (task) {
      applyStatusTransition(task, fromGroupId, toGroupId);
    }

    return data;
  });
  persist();
}

export function toggleGroupCollapsed(boardId: string, groupId: GroupId): void {
  dataStore.update(data => {
    const board = data.boards.find(b => b.id === boardId);
    if (board) {
      board.groups[groupId].collapsed = !board.groups[groupId].collapsed;
    }
    return data;
  });
  persist();
}

export function updateGroupSettings(boardId: string, groupId: GroupId, fields: { wipLimit: number | null; completedRetentionDays: number | null }): void {
  dataStore.update(data => {
    const board = data.boards.find(b => b.id === boardId);
    if (board) {
      board.groups[groupId].wipLimit = fields.wipLimit;
      board.groups[groupId].completedRetentionDays = fields.completedRetentionDays;
    }
    return data;
  });
  persist();
}

export function createBoard(): void {
  const tr = get(t);
  const board = createDefaultBoard(tr('board.newBoard'));
  dataStore.update(data => {
    data.boards.push(board);
    return data;
  });
  uiStore.update(ui => ({ ...ui, activeBoardId: board.id }));
  persist();
}

export function updateBoard(boardId: string, fields: { title: string; subtitle: string; hiddenGroups: GroupId[] }): void {
  dataStore.update(data => {
    const board = data.boards.find(b => b.id === boardId);
    if (board) {
      board.title = fields.title;
      board.subtitle = fields.subtitle;
      board.hiddenGroups = fields.hiddenGroups;
    }
    return data;
  });
  persist();
}

export function deleteBoard(boardId: string): void {
  dataStore.update(data => {
    if (data.boards.length <= 1) return data;
    const board = data.boards.find(b => b.id === boardId);
    if (board) {
      for (const group of Object.values(board.groups)) {
        for (const taskId of group.taskIds) {
          delete data.tasks[taskId];
        }
      }
    }
    data.boards = data.boards.filter(b => b.id !== boardId);
    return data;
  });

  const data = get(dataStore);
  uiStore.update(ui => ({ ...ui, activeBoardId: data.boards[0]?.id ?? '' }));
  persist();
}

export function updateBoardNotes(boardId: string, notes: string): void {
  dataStore.update(data => {
    const board = data.boards.find(b => b.id === boardId);
    if (!board) return data;
    board.notes = notes;
    return data;
  });
  persist();
}

export function toggleNotesCollapsed(boardId: string): void {
  dataStore.update(data => {
    const board = data.boards.find(b => b.id === boardId);
    if (!board) return data;
    board.notesCollapsed = !board.notesCollapsed;
    return data;
  });
  persist();
}

export function updateSettings(newSettings: Partial<Settings>): void {
  dataStore.update(data => {
    data.settings = { ...data.settings, ...newSettings };
    return data;
  });
  persist();
}

function getActiveBoard(data: PluginData): Board | undefined {
  const ui = get(uiStore);
  return data.boards.find(b => b.id === ui.activeBoardId);
}
