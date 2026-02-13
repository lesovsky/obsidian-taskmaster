import type { Board, PluginData, Task } from './types';

export function cleanupCompletedTasks(board: Board, tasks: Record<string, Task>): void {
  const retentionDays = board.groups.completed.completedRetentionDays ?? 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  board.groups.completed.taskIds = board.groups.completed.taskIds.filter(taskId => {
    const task = tasks[taskId];
    if (!task) return false;
    if (!task.completedAt) return true;
    if (new Date(task.completedAt) < cutoff) {
      delete tasks[taskId];
      return false;
    }
    return true;
  });
}

export function cleanupOrphanedTasks(data: PluginData): void {
  const usedIds = new Set<string>();
  for (const board of data.boards) {
    for (const group of Object.values(board.groups)) {
      group.taskIds.forEach(id => usedIds.add(id));
    }
  }
  for (const taskId of Object.keys(data.tasks)) {
    if (!usedIds.has(taskId)) {
      delete data.tasks[taskId];
    }
  }
}
