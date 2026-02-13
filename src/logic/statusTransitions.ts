import type { GroupId, Task } from '../data/types';
import { formatDate } from '../utils/dateFormat';

export function applyStatusTransition(task: Task, fromGroup: GroupId, toGroup: GroupId): void {
  if (toGroup === 'completed') {
    task.status = 'completed';
    task.completedAt = formatDate(new Date());
  } else if (toGroup === 'backlog') {
    // при перемещении в бэклог статус не меняется
  } else if (fromGroup === 'backlog' && task.status === 'new') {
    task.status = 'inProgress';
  } else if (fromGroup === 'completed') {
    task.status = 'inProgress';
    task.completedAt = '';
  }
}
