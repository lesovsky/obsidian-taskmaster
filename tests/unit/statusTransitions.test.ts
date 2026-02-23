import { describe, it, expect } from 'vitest';
import { applyStatusTransition } from '../../src/logic/statusTransitions';
import type { Task } from '../../src/data/types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    what: 'Test task',
    why: '',
    who: '',
    deadline: '',
    createdAt: '2026-01-01',
    completedAt: '',
    priority: 'medium',
    status: 'new',
    ...overrides,
  };
}

describe('applyStatusTransition', () => {
  it('backlog→focus: status=new → becomes inProgress', () => {
    const task = makeTask({ status: 'new' });
    applyStatusTransition(task, 'backlog', 'focus');
    expect(task.status).toBe('inProgress');
  });

  it('backlog→focus: status=waiting → unchanged', () => {
    const task = makeTask({ status: 'waiting' });
    applyStatusTransition(task, 'backlog', 'focus');
    expect(task.status).toBe('waiting');
  });

  it('backlog→inProgress: status=new → becomes inProgress', () => {
    const task = makeTask({ status: 'new' });
    applyStatusTransition(task, 'backlog', 'inProgress');
    expect(task.status).toBe('inProgress');
  });

  it('any→completed: status=completed, completedAt set', () => {
    const task = makeTask({ status: 'inProgress' });
    applyStatusTransition(task, 'focus', 'completed');
    expect(task.status).toBe('completed');
    expect(task.completedAt).not.toBe('');
  });

  it('completed→focus: status=inProgress, completedAt cleared', () => {
    const task = makeTask({ status: 'completed', completedAt: '2026-01-10' });
    applyStatusTransition(task, 'completed', 'focus');
    expect(task.status).toBe('inProgress');
    expect(task.completedAt).toBe('');
  });

  it('focus→delegated: working status unchanged', () => {
    const task = makeTask({ status: 'inProgress' });
    applyStatusTransition(task, 'focus', 'delegated');
    expect(task.status).toBe('inProgress');
  });

  it('any→backlog: status unchanged', () => {
    const task = makeTask({ status: 'inProgress' });
    applyStatusTransition(task, 'focus', 'backlog');
    expect(task.status).toBe('inProgress');
  });

  it('completed→backlog: status unchanged (backlog rule wins)', () => {
    const task = makeTask({ status: 'completed', completedAt: '2026-01-10' });
    applyStatusTransition(task, 'completed', 'backlog');
    // backlog rule takes priority — status stays as-is, completedAt not cleared
    expect(task.status).toBe('completed');
    expect(task.completedAt).toBe('2026-01-10');
  });
});
