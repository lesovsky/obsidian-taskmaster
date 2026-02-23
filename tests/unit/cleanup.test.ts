import { describe, it, expect } from 'vitest';
import { cleanupCompletedTasks, cleanupOrphanedTasks } from '../../src/data/cleanup';
import type { Board, Task, PluginData, Group } from '../../src/data/types';
import { GROUP_IDS } from '../../src/data/types';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    taskIds: [],
    wipLimit: null,
    collapsed: false,
    completedRetentionDays: null,
    fullWidth: true,
    ...overrides,
  };
}

function makeBoard(completedTaskIds: string[] = [], retentionDays: number | null = 30): Board {
  const groups = Object.fromEntries(
    GROUP_IDS.map(id => [id, makeGroup()]),
  ) as Board['groups'];
  groups.completed = makeGroup({ taskIds: [...completedTaskIds], completedRetentionDays: retentionDays });
  return {
    id: 'b1',
    title: 'Board',
    subtitle: '',
    notes: '',
    notesCollapsed: true,
    notesHidden: false,
    hiddenGroups: [],
    groups,
  };
}

function makeTask(id: string, completedAt: string): Task {
  return {
    id,
    what: 'Task',
    why: '',
    who: '',
    deadline: '',
    createdAt: '2026-01-01',
    completedAt,
    priority: 'medium',
    status: 'completed',
  };
}

describe('cleanupCompletedTasks', () => {
  it('срок истёк: retention=30, completedAt=31 день назад → задача удалена', () => {
    const taskId = 't1';
    const board = makeBoard([taskId], 30);
    const tasks = { [taskId]: makeTask(taskId, daysAgo(31)) };

    cleanupCompletedTasks(board, tasks);

    expect(board.groups.completed.taskIds).not.toContain(taskId);
    expect(tasks[taskId]).toBeUndefined();
  });

  it('срок не истёк: retention=30, completedAt=5 дней назад → задача осталась', () => {
    const taskId = 't2';
    const board = makeBoard([taskId], 30);
    const tasks = { [taskId]: makeTask(taskId, daysAgo(5)) };

    cleanupCompletedTasks(board, tasks);

    expect(board.groups.completed.taskIds).toContain(taskId);
    expect(tasks[taskId]).toBeDefined();
  });

  it('нет completedAt: задача не удалена', () => {
    const taskId = 't3';
    const board = makeBoard([taskId], 30);
    const tasks = { [taskId]: makeTask(taskId, '') };

    cleanupCompletedTasks(board, tasks);

    expect(board.groups.completed.taskIds).toContain(taskId);
    expect(tasks[taskId]).toBeDefined();
  });

  it('retention=null: дефолт 30 дней — свежая задача (5 дней) остаётся', () => {
    const taskId = 't4';
    const board = makeBoard([taskId], null);
    const tasks = { [taskId]: makeTask(taskId, daysAgo(5)) };

    cleanupCompletedTasks(board, tasks);

    expect(board.groups.completed.taskIds).toContain(taskId);
    expect(tasks[taskId]).toBeDefined();
  });

  it('retention=null: дефолт 30 дней — старая задача (31 день) удаляется', () => {
    const taskId = 't5';
    const board = makeBoard([taskId], null);
    const tasks = { [taskId]: makeTask(taskId, daysAgo(31)) };

    cleanupCompletedTasks(board, tasks);

    expect(board.groups.completed.taskIds).not.toContain(taskId);
    expect(tasks[taskId]).toBeUndefined();
  });
});

describe('cleanupOrphanedTasks', () => {
  function makeData(boards: Board[], tasks: Record<string, Task>): PluginData {
    return {
      version: 7,
      settings: { language: 'en', defaultPriority: 'medium', cardView: 'default', cardLayout: 'single' },
      boards,
      tasks,
    };
  }

  it('orphan task: taskId не в taskIds → задача удалена из tasks', () => {
    const board = makeBoard([]);
    const tasks = { orphan: makeTask('orphan', '') };
    const data = makeData([board], tasks);

    cleanupOrphanedTasks(data);

    expect(data.tasks['orphan']).toBeUndefined();
  });

  it('referenced task: taskId в taskIds → задача осталась', () => {
    const board = makeBoard(['t1']);
    board.groups.focus.taskIds.push('t2');
    const tasks = { t1: makeTask('t1', ''), t2: makeTask('t2', '') };
    const data = makeData([board], tasks);

    cleanupOrphanedTasks(data);

    expect(data.tasks['t1']).toBeDefined();
    expect(data.tasks['t2']).toBeDefined();
  });

  it('multi-board: задача в board A не является orphan из-за board B', () => {
    const boardA = makeBoard(['t1']);
    const boardB = makeBoard([]);
    boardB.id = 'b2';
    const tasks = { t1: makeTask('t1', '') };
    const data = makeData([boardA, boardB], tasks);

    cleanupOrphanedTasks(data);

    expect(data.tasks['t1']).toBeDefined();
  });
});
