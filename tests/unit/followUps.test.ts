import { describe, it, expect } from 'vitest';
import {
  MAX_FOLLOW_UPS,
  FOLLOW_UP_TEXT_MAX_LENGTH,
  pendingFollowUps,
  buildFollowUpTask,
  spawnFollowUps,
  revertSpawnedFollowUps,
  finalizeFollowUpDrafts,
  formatFollowUpNotice,
} from '../../src/logic/followUps';
import type { FollowUpDraft } from '../../src/logic/followUps';
import type { Board, FollowUp, Group, PluginData, Task } from '../../src/data/types';
import { GROUP_IDS } from '../../src/data/types';
import { sanitizeFollowUps } from '../../src/data/migration';
import { en } from '../../src/i18n/en';
import { ru } from '../../src/i18n/ru';

const TODAY = '2026-09-11';
const OPTS = { whyPrefix: 'After: ', today: TODAY };

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    taskIds: [],
    wipLimit: null,
    collapsed: false,
    completedRetentionDays: null,
    fullWidth: true,
    title: '',
    ...overrides,
  };
}

function makeBoard(id: string, taskIdsByGroup: Partial<Record<string, string[]>> = {}): Board {
  const groups = Object.fromEntries(
    GROUP_IDS.map(g => [g, makeGroup({ taskIds: [...(taskIdsByGroup[g] ?? [])] })]),
  ) as Board['groups'];
  return {
    id,
    title: 'Board',
    subtitle: '',
    notes: '',
    notesCollapsed: true,
    notesHidden: false,
    hiddenGroups: [],
    groups,
    groupOrder: [...GROUP_IDS],
  };
}

function item(id: string, text: string, createdTaskId = ''): FollowUp {
  return { id, text, createdTaskId };
}

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    what: `Task ${id}`,
    why: '',
    who: '',
    deadline: '',
    createdAt: '2026-01-01',
    completedAt: '',
    priority: 'medium',
    status: 'inProgress',
    followUps: [],
    ...overrides,
  };
}

// Board b1 holds the parent p1 in completed and one unrelated task in backlog; board b2 is empty.
function makeData(parentFollowUps: FollowUp[]): PluginData {
  const parent = makeTask('p1', { what: 'Ship release', followUps: parentFollowUps });
  const other = makeTask('o1');
  return {
    version: 9,
    settings: { language: 'en', defaultPriority: 'high', cardView: 'default', cardLayout: 'single' },
    boards: [makeBoard('b1', { backlog: ['o1'], completed: ['p1'] }), makeBoard('b2')],
    tasks: { p1: parent, o1: other },
  };
}

function draft(id: string, text: string, marked = false, createdTaskId = ''): FollowUpDraft {
  return { id, text, createdTaskId, marked };
}

describe('limits', () => {
  it('exports the shared limits', () => {
    expect(MAX_FOLLOW_UPS).toBe(20);
    expect(FOLLOW_UP_TEXT_MAX_LENGTH).toBe(200);
  });
});

describe('pendingFollowUps', () => {
  it('pendingFollowUps skips created items and keeps order', () => {
    const task = makeTask('t', {
      followUps: [item('a', 'A'), item('b', 'B', 'x1'), item('c', 'C'), item('d', 'D', 'x2'), item('e', 'E')],
    });

    expect(pendingFollowUps(task).map(i => i.id)).toEqual(['a', 'c', 'e']);
  });

  it('pendingFollowUps of a task without followUps is empty', () => {
    const task = makeTask('t') as Partial<Task>;
    delete task.followUps;

    expect(pendingFollowUps(task as Task)).toEqual([]);
  });
});

describe('buildFollowUpTask', () => {
  it('buildFollowUpTask sets exactly the specified fields', () => {
    const parent = makeTask('p', {
      what: 'Parent',
      why: 'parent why',
      who: 'Bob',
      deadline: '2026-12-01',
      completedAt: '2026-09-10',
      status: 'completed',
      followUps: [item('a', 'Call client')],
    });

    const task = buildFollowUpTask(parent.followUps[0], parent, { whyPrefix: 'After: ', priority: 'low', today: TODAY });

    expect(typeof task.id).toBe('string');
    expect(task.id).not.toBe('');
    expect(task.id).not.toBe(parent.id);
    expect(task.id).not.toBe('a');
    expect(task).toEqual({
      id: task.id,
      what: 'Call client',
      why: 'After: Parent',
      who: '',
      deadline: '',
      createdAt: TODAY,
      completedAt: '',
      priority: 'low',
      status: 'new',
      followUps: [],
    });
  });

  it('buildFollowUpTask gives every task a fresh id', () => {
    const parent = makeTask('p', { followUps: [item('a', 'A')] });
    const opts = { whyPrefix: 'After: ', priority: 'low' as const, today: TODAY };

    expect(buildFollowUpTask(parent.followUps[0], parent, opts).id)
      .not.toBe(buildFollowUpTask(parent.followUps[0], parent, opts).id);
  });

  it('buildFollowUpTask caps why at 10000 characters', () => {
    const parent = makeTask('p', { what: 'x'.repeat(10_000) });

    const task = buildFollowUpTask(item('a', 'A'), parent, { whyPrefix: 'After: ', priority: 'low', today: TODAY });

    expect(task.why).toBe(('After: ' + 'x'.repeat(10_000)).slice(0, 10_000));
    expect(task.why.length).toBe(10_000);
  });

  it('buildFollowUpTask does not leave half of a surrogate pair at the cut', () => {
    // 'After: ' is 7 chars, so the pair starting at index 9 999 straddles the cap.
    const parent = makeTask('p', { what: 'x'.repeat(9_992) + '😀' });

    const task = buildFollowUpTask(item('a', 'A'), parent, { whyPrefix: 'After: ', priority: 'low', today: TODAY });

    expect(task.why).toBe('After: ' + 'x'.repeat(9_992));
  });
});

describe('spawnFollowUps', () => {
  it('spawnFollowUps appends one task per pending item to the end of backlog, in list order', () => {
    const data = makeData([item('a', 'First'), item('b', 'Done before', 'old'), item('c', 'Second')]);

    const ids = spawnFollowUps(data, 'b1', 'p1', OPTS);

    const backlog = data.boards[0].groups.backlog.taskIds;
    expect(backlog).toEqual(['o1', ...ids]);
    expect(ids.map(id => data.tasks[id].what)).toEqual(['First', 'Second']);
    expect(data.tasks[ids[0]]).toMatchObject({ why: 'After: Ship release', status: 'new', createdAt: TODAY });
  });

  it('spawnFollowUps writes createdTaskId and returns the new ids in order', () => {
    const data = makeData([item('a', 'First'), item('b', 'Second'), item('c', 'Third')]);

    const ids = spawnFollowUps(data, 'b1', 'p1', OPTS);

    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(data.tasks.p1.followUps.map(i => i.createdTaskId)).toEqual(ids);
    expect(ids.map(id => data.tasks[id].id)).toEqual(ids);
  });

  it('spawnFollowUps skips already created items', () => {
    const data = makeData([item('a', 'First'), item('b', 'Second')]);
    spawnFollowUps(data, 'b1', 'p1', OPTS);
    const tasksBefore = Object.keys(data.tasks).length;
    const backlogBefore = [...data.boards[0].groups.backlog.taskIds];

    const again = spawnFollowUps(data, 'b1', 'p1', OPTS);

    expect(again).toEqual([]);
    expect(Object.keys(data.tasks)).toHaveLength(tasksBefore);
    expect(data.boards[0].groups.backlog.taskIds).toEqual(backlogBefore);
  });

  it('spawnFollowUps with itemIds spawns only those pending items', () => {
    const data = makeData([item('a', 'First'), item('b', 'Done', 'old'), item('c', 'Third'), item('d', 'Fourth')]);

    // 'b' is created, 'zz' is unknown — both are ignored; order follows the list, not itemIds.
    const ids = spawnFollowUps(data, 'b1', 'p1', OPTS, ['d', 'b', 'zz', 'a']);

    expect(ids.map(id => data.tasks[id].what)).toEqual(['First', 'Fourth']);
    expect(data.tasks.p1.followUps.map(i => i.createdTaskId)).toEqual([ids[0], 'old', '', ids[1]]);
  });

  it('spawnFollowUps uses settings.defaultPriority', () => {
    const data = makeData([item('a', 'First')]);
    data.settings.defaultPriority = 'low';

    const [id] = spawnFollowUps(data, 'b1', 'p1', OPTS);

    expect(data.tasks[id].priority).toBe('low');
  });

  it('spawnFollowUps targets the given board only', () => {
    const data = makeData([item('a', 'First')]);
    data.boards[1].groups.backlog.taskIds = ['p1'];
    const boardBefore = structuredClone(data.boards[0]);

    const ids = spawnFollowUps(data, 'b2', 'p1', OPTS);

    expect(data.boards[1].groups.backlog.taskIds).toEqual(['p1', ...ids]);
    expect(data.boards[0]).toEqual(boardBefore);
  });

  it('spawnFollowUps for an unknown parent, unknown board or missing backlog returns [] and changes nothing', () => {
    const cases: Array<[string, (d: PluginData) => void, string, string]> = [
      ['unknown parent', () => {}, 'b1', 'nope'],
      ['inherited property as parent id', () => {}, 'b1', 'constructor'],
      ['unknown board', () => {}, 'zz', 'p1'],
      ['missing backlog', d => { delete (d.boards[0].groups as Partial<Board['groups']>).backlog; }, 'b1', 'p1'],
      ['backlog without taskIds', d => { delete (d.boards[0].groups.backlog as Partial<Group>).taskIds; }, 'b1', 'p1'],
    ];

    for (const [name, damage, boardId, parentId] of cases) {
      const data = makeData([item('a', 'First')]);
      damage(data);
      const before = structuredClone(data);

      expect(spawnFollowUps(data, boardId, parentId, OPTS), name).toEqual([]);
      expect(data, name).toEqual(before);
    }
  });

  it('spawnFollowUps ignores a parent that is only reachable through the prototype of tasks', () => {
    const data = makeData([]);
    const ghost = makeTask('ghost', { followUps: [item('a', 'A')] });
    data.tasks = Object.assign(Object.create({ ghost }), data.tasks);
    const backlogBefore = [...data.boards[0].groups.backlog.taskIds];

    expect(spawnFollowUps(data, 'b1', 'ghost', OPTS)).toEqual([]);
    expect(data.boards[0].groups.backlog.taskIds).toEqual(backlogBefore);
    expect(ghost.followUps[0].createdTaskId).toBe('');
  });

  it('spawnFollowUps for a parent with no followUps field returns [] and changes nothing', () => {
    const data = makeData([]);
    delete (data.tasks.p1 as Partial<Task>).followUps;
    const before = structuredClone(data);

    expect(spawnFollowUps(data, 'b1', 'p1', OPTS)).toEqual([]);
    expect(data).toEqual(before);
  });
});

describe('revertSpawnedFollowUps', () => {
  it('revertSpawnedFollowUps removes spawned tasks from any group and from tasks', () => {
    const data = makeData([item('a', 'First'), item('b', 'Second')]);
    const ids = spawnFollowUps(data, 'b1', 'p1', OPTS);
    // The user dragged the second spawned task into focus within the undo window.
    const groups = data.boards[0].groups;
    groups.backlog.taskIds = groups.backlog.taskIds.filter(id => id !== ids[1]);
    groups.focus.taskIds.push(ids[1]);

    revertSpawnedFollowUps(data, 'b1', 'p1', ids);

    expect(groups.backlog.taskIds).toEqual(['o1']);
    expect(groups.focus.taskIds).toEqual([]);
    expect(Object.keys(data.tasks).sort()).toEqual(['o1', 'p1']);
  });

  it('revertSpawnedFollowUps flips only matching items back to pending', () => {
    const data = makeData([item('a', 'Early', 'early1'), item('b', 'Second')]);
    data.tasks.early1 = makeTask('early1');
    data.boards[0].groups.backlog.taskIds.push('early1');
    const ids = spawnFollowUps(data, 'b1', 'p1', OPTS);

    revertSpawnedFollowUps(data, 'b1', 'p1', ids);

    expect(data.tasks.p1.followUps).toEqual([item('a', 'Early', 'early1'), item('b', 'Second')]);
    expect(data.tasks.early1).toBeDefined();
    expect(data.boards[0].groups.backlog.taskIds).toEqual(['o1', 'early1']);
  });

  it('revertSpawnedFollowUps tolerates a spawned task that was already deleted', () => {
    const data = makeData([item('a', 'First'), item('b', 'Second')]);
    const ids = spawnFollowUps(data, 'b1', 'p1', OPTS);
    // The user deleted the first spawned task and its toast expired.
    data.boards[0].groups.backlog.taskIds = data.boards[0].groups.backlog.taskIds.filter(id => id !== ids[0]);
    delete data.tasks[ids[0]];

    expect(() => revertSpawnedFollowUps(data, 'b1', 'p1', ids)).not.toThrow();

    expect(data.boards[0].groups.backlog.taskIds).toEqual(['o1']);
    expect(Object.keys(data.tasks).sort()).toEqual(['o1', 'p1']);
    expect(data.tasks.p1.followUps.map(i => i.createdTaskId)).toEqual(['', '']);
  });

  it('revertSpawnedFollowUps with no ids changes nothing', () => {
    const data = makeData([item('a', 'First', 'x')]);
    const before = structuredClone(data);

    revertSpawnedFollowUps(data, 'b1', 'p1', []);

    expect(data).toEqual(before);
  });

  it('revertSpawnedFollowUps ignores inherited property names in the ids', () => {
    const data = makeData([item('a', 'First')]);
    const before = structuredClone(data);

    expect(() => revertSpawnedFollowUps(data, 'b1', 'constructor', ['constructor', '__proto__'])).not.toThrow();

    expect(data).toEqual(before);
  });

  it('revertSpawnedFollowUps ignores a parent that is only reachable through the prototype of tasks', () => {
    const data = makeData([]);
    const ghost = makeTask('ghost', { followUps: [item('a', 'A', 'x1')] });
    data.tasks = Object.assign(Object.create({ ghost }), data.tasks);

    revertSpawnedFollowUps(data, 'b1', 'ghost', ['x1']);

    expect(ghost.followUps[0].createdTaskId).toBe('x1');
  });
});

describe('finalizeFollowUpDrafts', () => {
  it('finalizeFollowUpDrafts trims, drops empty and marked-but-empty drafts, keeps order', () => {
    const result = finalizeFollowUpDrafts([
      draft('a', '  First  '),
      draft('b', '   '),
      draft('c', '', true),
      draft('d', 'Second', false, 'x1'),
      draft('e', '\tThird\n', true),
    ]);

    expect(result.followUps).toEqual([
      item('a', 'First'),
      item('d', 'Second', 'x1'),
      item('e', 'Third'),
    ]);
    expect(result.spawnItemIds).toEqual(['e']);
  });

  it('finalizeFollowUpDrafts caps text at 200 and list at 20', () => {
    const drafts = [
      draft('long', 'y'.repeat(250), true),
      draft('empty', '  '),
      ...Array.from({ length: 21 }, (_, i) => draft(`d${i}`, `Item ${i}`, true)),
    ];

    const result = finalizeFollowUpDrafts(drafts);

    expect(result.followUps).toHaveLength(20);
    expect(result.followUps[0].text).toBe('y'.repeat(200));
    // The empty draft does not use up a slot: 'long' + d0..d18 survive, d19 and d20 do not.
    expect(result.followUps.map(i => i.id)).toEqual(['long', ...Array.from({ length: 19 }, (_, i) => `d${i}`)]);
    expect(result.spawnItemIds).toEqual(result.followUps.map(i => i.id));
  });

  it('finalizeFollowUpDrafts does not leave a trailing space or half a surrogate pair at the cut', () => {
    const result = finalizeFollowUpDrafts([
      draft('space', 'z'.repeat(199) + ' tail'),
      draft('emoji', 'z'.repeat(199) + '😀'),
    ]);

    expect(result.followUps.map(i => i.text)).toEqual(['z'.repeat(199), 'z'.repeat(199)]);
  });

  it('finalizeFollowUpDrafts returns ids of marked pending drafts only', () => {
    const result = finalizeFollowUpDrafts([
      draft('a', 'Marked pending', true),
      draft('b', 'Not marked'),
      draft('c', 'Marked but created', true, 'x1'),
      draft('d', 'Marked pending too', true),
    ]);

    expect(result.spawnItemIds).toEqual(['a', 'd']);
    expect(result.followUps.map(i => i.createdTaskId)).toEqual(['', '', 'x1', '']);
  });

  it('finalizeFollowUpDrafts output is left unchanged by the load-time sanitizer', () => {
    const { followUps } = finalizeFollowUpDrafts([
      draft('a', '  padded  '),
      draft('b', 'z'.repeat(199) + ' tail'),
      draft('c', 'z'.repeat(199) + '😀', false, 'x1'),
      draft('d', 'w'.repeat(300)),
    ]);

    expect(sanitizeFollowUps(followUps)).toEqual(followUps);
  });

  it('finalizeFollowUpDrafts does not copy the marked flag into stored items', () => {
    const result = finalizeFollowUpDrafts([draft('a', 'A', true)]);

    expect(Object.keys(result.followUps[0]).sort()).toEqual(['createdTaskId', 'id', 'text']);
  });
});

describe('formatFollowUpNotice', () => {
  const TEMPLATE = 'Tasks created in "{group}": {count}';

  it('formatFollowUpNotice substitutes group and count', () => {
    expect(formatFollowUpNotice(TEMPLATE, 'Backlog', 3, null)).toBe('Tasks created in "Backlog": 3');
  });

  it('formatFollowUpNotice substitutes every occurrence of a placeholder', () => {
    expect(formatFollowUpNotice('{count}/{group}/{count}', 'G', 2, null)).toBe('2/G/2');
  });

  it('formatFollowUpNotice keeps $& in a group title literal', () => {
    expect(formatFollowUpNotice(TEMPLATE, "a$&b$1c$$d$'e$`", 1, null)).toBe('Tasks created in "a$&b$1c$$d$\'e$`": 1');
  });

  it('formatFollowUpNotice keeps {count} and {group} in a group title literal', () => {
    expect(formatFollowUpNotice(TEMPLATE, 'x {count} y {group}', 5, null)).toBe('Tasks created in "x {count} y {group}": 5');
  });

  it('formatFollowUpNotice appends the hidden suffix after one space', () => {
    expect(formatFollowUpNotice(TEMPLATE, 'Backlog', 2, '(group hidden)')).toBe('Tasks created in "Backlog": 2 (group hidden)');
  });

  it('formatFollowUpNotice with the real en and ru templates', () => {
    expect(formatFollowUpNotice(en['followUps.noticeCreated'], en['group.backlog'], 2, null))
      .toBe('Tasks created in "Backlog": 2');
    expect(formatFollowUpNotice(ru['followUps.noticeCreated'], ru['group.backlog'], 2, null))
      .toBe('Заведено задач в «Бэклог»: 2');
    expect(formatFollowUpNotice(ru['followUps.noticeCreated'], ru['group.backlog'], 2, ru['followUps.noticeHidden']))
      .toBe('Заведено задач в «Бэклог»: 2 (группа скрыта)');
  });
});
