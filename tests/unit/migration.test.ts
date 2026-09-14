import { describe, it, expect } from 'vitest';
import { migrateData, sanitizeFollowUps, sanitizeGroupOrder, sanitizeGroupTitle } from '../../src/data/migration';
import type { PluginData } from '../../src/data/types';
import { GROUP_IDS } from '../../src/data/types';
import { DEFAULT_DATA, createDefaultBoard } from '../../src/data/defaults';

// Written out literally on purpose: asserting against GROUP_IDS alone would still pass
// if a bug mutated the exported constant itself.
const DEFAULT_ORDER = ['backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed'];

// Minimal board stub compatible with v1+ structure
function makeBoard(overrides: object = {}): object {
  return {
    id: 'b1',
    title: 'Board',
    subtitle: '',
    groups: Object.fromEntries(
      GROUP_IDS.map(id => [id, { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null }]),
    ),
    ...overrides,
  };
}

describe('migrateData', () => {
  it('null → default data (version=9)', () => {
    const result = migrateData(null);
    expect(result.version).toBe(9);
    expect(result.boards.length).toBeGreaterThanOrEqual(1);
    expect(result.tasks).toBeDefined();
    for (const id of GROUP_IDS) {
      expect(result.boards[0].groups[id].title).toBe('');
    }
  });

  it('{} → default data (version=9)', () => {
    const result = migrateData({});
    expect(result.version).toBe(9);
  });

  // v1: language block uses original version var → ALL migrations apply
  it('v1 → v9: all fields are migrated in one pass', () => {
    const input = { version: 1, settings: {}, boards: [makeBoard()], tasks: { t1: makeTask('t1') } };
    const result = migrateData(input);

    expect(result.version).toBe(9);
    // v2: language
    expect(result.settings.language).toBe('auto');
    // v3: notes/notesCollapsed on boards
    expect(result.boards[0].notes).toBe('');
    // v4: hiddenGroups
    expect(result.boards[0].hiddenGroups).toEqual([]);
    // v5: fullWidth on all groups
    for (const id of GROUP_IDS) {
      expect(typeof result.boards[0].groups[id].fullWidth).toBe('boolean');
    }
    // v6: cardLayout
    expect(result.settings.cardLayout).toBe('single');
    // v7: notesHidden
    expect(result.boards[0].notesHidden).toBe(false);
    // v8: group titles and group order
    for (const id of GROUP_IDS) {
      expect(result.boards[0].groups[id].title).toBe('');
    }
    expect(result.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
    // v9: follow-up list on every task
    expect(result.tasks.t1.followUps).toEqual([]);
  });

  it('v2 → v9: notes, hiddenGroups, fullWidth, cardLayout, notesHidden, title, groupOrder added', () => {
    const input = { version: 2, settings: { language: 'en' }, boards: [makeBoard()], tasks: {} };
    const result = migrateData(input);
    expect(result.version).toBe(9);
    expect(result.boards[0].notes).toBe('');
    expect(result.boards[0].hiddenGroups).toEqual([]);
    expect(result.settings.cardLayout).toBe('single');
    expect(result.boards[0].notesHidden).toBe(false);
    expect(result.boards[0].groups.focus.title).toBe('');
    expect(result.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('v3 → v9: hiddenGroups, fullWidth, cardLayout, notesHidden, title, groupOrder added', () => {
    const input = {
      version: 3,
      settings: { language: 'en' },
      boards: [{ ...makeBoard(), notes: 'existing note', notesCollapsed: false }],
      tasks: {},
    };
    const result = migrateData(input);
    expect(result.version).toBe(9);
    // notes pre-existing should be preserved
    expect(result.boards[0].notes).toBe('existing note');
    expect(result.boards[0].hiddenGroups).toEqual([]);
    for (const id of GROUP_IDS) {
      expect(typeof result.boards[0].groups[id].fullWidth).toBe('boolean');
    }
    expect(result.settings.cardLayout).toBe('single');
    expect(result.boards[0].notesHidden).toBe(false);
    expect(result.boards[0].groups.focus.title).toBe('');
    expect(result.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('v4 → v9: fullWidth, cardLayout, notesHidden, title, groupOrder added', () => {
    const input = {
      version: 4,
      settings: { language: 'en' },
      boards: [{ ...makeBoard(), notes: '', notesCollapsed: true, hiddenGroups: [] }],
      tasks: {},
    };
    const result = migrateData(input);
    expect(result.version).toBe(9);
    for (const id of GROUP_IDS) {
      expect(typeof result.boards[0].groups[id].fullWidth).toBe('boolean');
    }
    expect(result.settings.cardLayout).toBe('single');
    expect(result.boards[0].notesHidden).toBe(false);
    expect(result.boards[0].groups.focus.title).toBe('');
    expect(result.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('v5 → v9: cardLayout, notesHidden, title, groupOrder added', () => {
    const input = {
      version: 5,
      settings: { language: 'en' },
      boards: [{ ...makeBoard(), notes: '', notesCollapsed: true, hiddenGroups: [], groups: fullWidthGroups() }],
      tasks: {},
    };
    const result = migrateData(input);
    expect(result.version).toBe(9);
    expect(result.settings.cardLayout).toBe('single');
    expect(result.boards[0].notesHidden).toBe(false);
    expect(result.boards[0].groups.focus.title).toBe('');
    expect(result.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('v6 → v9: notesHidden, title, groupOrder added', () => {
    const input = {
      version: 6,
      settings: { language: 'en', cardLayout: 'single' },
      boards: [{ ...makeBoard(), notes: '', notesCollapsed: true, hiddenGroups: [], groups: fullWidthGroups() }],
      tasks: {},
    };
    const result = migrateData(input);
    expect(result.version).toBe(9);
    expect(result.boards[0].notesHidden).toBe(false);
    expect(result.boards[0].groups.focus.title).toBe('');
    expect(result.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('v7 → v9: every group gets an empty title', () => {
    const result = migrateData(makeV7Data());
    expect(result.version).toBe(9);
    for (const id of GROUP_IDS) {
      expect(result.boards[0].groups[id].title).toBe('');
    }
  });

  it('v7 → v9: every board gets the default group order', () => {
    const result = migrateData(makeV7Data());
    expect(result.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('v7 → v9: tasks only gain an empty followUps list', () => {
    const tasks = {
      t1: {
        id: 't1', what: 'Do it', why: 'Because', who: 'me',
        deadline: '2026-01-01', createdAt: '2025-12-01', completedAt: '',
        priority: 'high', status: 'inProgress',
      },
    };
    const before = JSON.parse(JSON.stringify(tasks));
    const result = migrateData(makeV7Data({ tasks }));
    expect(result.tasks).toEqual({ t1: { ...before.t1, followUps: [] } });
  });

  it('v8 → v9: every task gets an empty followUps list', () => {
    const result = migrateData(makeV8Data({}, { t1: makeTask('t1'), t2: makeTask('t2', { status: 'completed' }) }));
    expect(result.version).toBe(9);
    expect(result.tasks.t1.followUps).toEqual([]);
    expect(result.tasks.t2.followUps).toEqual([]);
    // each task owns its list — a shared array would let one task's edit show up on another
    expect(result.tasks.t1.followUps).not.toBe(result.tasks.t2.followUps);
  });

  it('v8 → v9: other task fields are unchanged', () => {
    const tasks = { t1: makeTask('t1'), t2: makeTask('t2', { what: 'Other', priority: 'low', completedAt: '2026-02-02' }) };
    const before = JSON.parse(JSON.stringify(tasks));
    const result = migrateData(makeV8Data({}, tasks));
    expect(Object.keys(result.tasks)).toEqual(['t1', 't2']);
    for (const id of ['t1', 't2']) {
      const { followUps, ...rest } = result.tasks[id];
      expect(followUps).toEqual([]);
      expect(rest).toEqual(before[id]);
    }
  });

  it('v9 → v9: data unchanged (idempotent)', () => {
    const data = makeV9Data({
      t1: makeTask('t1', {
        followUps: [
          { id: 'f1', text: 'Send the report', createdTaskId: '' },
          { id: 'f2', text: 'Отправить отчёт 😀', createdTaskId: 't2' },
        ],
      }),
      t2: makeTask('t2', { followUps: [] }),
    });
    const before = JSON.stringify(data);
    const result = migrateData(data);
    expect(result.version).toBe(9);
    // byte-identical: valid ids are kept, nothing is regenerated
    expect(JSON.stringify(result)).toBe(before);
    // and a second pass over the result is still identical
    expect(JSON.stringify(migrateData(result))).toBe(before);
  });

  it('default data → default data (idempotent)', () => {
    const defaults: PluginData = migrateData(null);
    const before = JSON.stringify(defaults);
    expect(JSON.stringify(migrateData(defaults))).toBe(before);
  });
});

describe('sanitizeGroupOrder', () => {
  it('groupOrder missing → default order', () => {
    const result = migrateData(makeV8Data());
    expect(result.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('groupOrder null → default order', () => {
    expect(() => sanitizeGroupOrder(null)).not.toThrow();
    expect(sanitizeGroupOrder(null)).toEqual(DEFAULT_ORDER);
    expect(sanitizeGroupOrder(undefined)).toEqual(DEFAULT_ORDER);
    // the fallback must allocate, not hand out the exported constant
    expect(sanitizeGroupOrder(null)).not.toBe(GROUP_IDS);
    expect(sanitizeGroupOrder(null)).not.toBe(sanitizeGroupOrder(undefined));
    const result = migrateData(makeV8Data({ groupOrder: null }));
    expect(result.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('two boards with a null groupOrder get independent default arrays', () => {
    // The v7 two-board test cannot reach this path — there the order comes from the migration block
    const data = makeV8Data({ groupOrder: null });
    data.boards = [data.boards[0], { ...data.boards[0], id: 'b2', groups: fullWidthGroups() }];
    const result = migrateData(data);
    expect(result.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
    expect(result.boards[0].groupOrder).not.toBe(result.boards[1].groupOrder);
    result.boards[0].groupOrder.reverse();
    expect(result.boards[1].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('groupOrder not an array → default order', () => {
    expect(sanitizeGroupOrder('focus')).toEqual(DEFAULT_ORDER);
    expect(sanitizeGroupOrder({ 0: 'focus' })).toEqual(DEFAULT_ORDER);
    expect(sanitizeGroupOrder(42)).toEqual(DEFAULT_ORDER);
    expect(migrateData(makeV8Data({ groupOrder: 'focus' })).boards[0].groupOrder).toEqual(DEFAULT_ORDER);
    expect(migrateData(makeV8Data({ groupOrder: { a: 1 } })).boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('groupOrder empty array → default order', () => {
    expect(sanitizeGroupOrder([])).toEqual(DEFAULT_ORDER);
  });

  it('groupOrder with an unknown id → unknown id dropped', () => {
    expect(sanitizeGroupOrder(['archive', ...DEFAULT_ORDER])).toEqual(DEFAULT_ORDER);
    expect(sanitizeGroupOrder(['focus', 'archive', 'backlog'])).toEqual([
      'focus', 'backlog', 'inProgress', 'orgIntentions', 'delegated', 'completed',
    ]);
    // non-string members are ignored the same way
    expect(sanitizeGroupOrder([null, 7, {}, 'focus'])).toEqual([
      'focus', 'backlog', 'inProgress', 'orgIntentions', 'delegated', 'completed',
    ]);
  });

  it('groupOrder with a duplicate id → duplicate collapsed', () => {
    const input = ['completed', 'completed', 'nope'];
    expect(sanitizeGroupOrder(input)).toEqual([
      'completed', 'backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated',
    ]);
    // pure on the branch that actually rewrites the array: the caller's input is untouched
    expect(input).toEqual(['completed', 'completed', 'nope']);
  });

  it('groupOrder missing ids → missing ids appended in default order', () => {
    expect(sanitizeGroupOrder(['completed', 'focus'])).toEqual([
      'completed', 'focus', 'backlog', 'inProgress', 'orgIntentions', 'delegated',
    ]);
  });

  it('groupOrder already valid and non-default → preserved as is', () => {
    const custom = ['completed', 'delegated', 'orgIntentions', 'inProgress', 'focus', 'backlog'];
    const input = [...custom];
    expect(sanitizeGroupOrder(input)).toEqual(custom);
    // pure: the caller's array is neither reordered nor returned
    expect(input).toEqual(custom);
    expect(sanitizeGroupOrder(input)).not.toBe(input);
    const result = migrateData(makeV8Data({ groupOrder: [...custom] }));
    expect(result.boards[0].groupOrder).toEqual(custom);
  });

  it('groupOrder is sanitized on already-migrated v9 data', () => {
    // Sanitization must sit outside the version branch: this input never enters a migration block.
    const result = migrateData(makeV9Data({}, { groupOrder: ['completed', 'completed', 'archive'] }));
    expect(result.version).toBe(9);
    expect(result.boards[0].groupOrder).toEqual([
      'completed', 'backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated',
    ]);
  });

  it('damaged fields on the second board are repaired too', () => {
    // The sanitization block must cover every board, not only boards[0]
    const data = makeV8Data();
    const second = { ...data.boards[0], id: 'b2', groups: fullWidthGroups(), groupOrder: ['completed', 'completed', 'archive'] } as any;
    second.groups.focus.title = '  ' + 'z'.repeat(45) + '  ';
    data.boards = [data.boards[0], second];
    const result = migrateData(data);
    expect(result.boards[1].groupOrder).toEqual([
      'completed', 'backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated',
    ]);
    expect(result.boards[1].groups.focus.title).toBe('z'.repeat(40));
  });

  it('a board missing a group does not throw (the missing group is not recreated)', () => {
    // The block iterates the groups that exist: a GROUP_IDS loop would throw here and,
    // since migrateData runs before the first render, leave the user with no board at all
    const groups = fullWidthGroups() as any;
    delete groups.orgIntentions;
    const data = makeV8Data({ groups, groupOrder: ['completed'] });
    let result!: PluginData;
    expect(() => { result = migrateData(data); }).not.toThrow();
    expect(result.boards[0].groupOrder).toEqual([
      'completed', 'backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated',
    ]);
    // Documented residual: the order is always a full permutation, but migrateData never
    // recreates a missing group — so an id in groupOrder can name a group that does not exist
    expect(result.boards[0].groups.orgIntentions).toBeUndefined();
    expect(result.boards[0].groupOrder).toContain('orgIntentions');
  });

  it('two boards get independent groupOrder arrays', () => {
    const input = {
      version: 7,
      settings: { language: 'en' },
      boards: [makeBoard({ id: 'b1' }), makeBoard({ id: 'b2' })],
      tasks: {},
    };
    const result = migrateData(input);
    expect(result.boards[0].groupOrder).not.toBe(result.boards[1].groupOrder);
    result.boards[0].groupOrder.reverse();
    expect(result.boards[1].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('default data gets its own groupOrder array', () => {
    // Early-return path: it never reaches the migration or the sanitization block.
    const first = migrateData(null);
    const second = migrateData(null);
    expect(first.boards[0].groupOrder).not.toBe(DEFAULT_DATA.boards[0].groupOrder);
    first.boards[0].groupOrder.reverse();
    expect(second.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
    expect(DEFAULT_DATA.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('{} → default data also gets its own groupOrder array', () => {
    const first = migrateData({});
    const second = migrateData({});
    expect(first.boards[0].groupOrder).not.toBe(DEFAULT_DATA.boards[0].groupOrder);
    first.boards[0].groupOrder.reverse();
    expect(second.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
    expect(DEFAULT_DATA.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('createDefaultBoard gives every board its own groupOrder array', () => {
    const a = createDefaultBoard('A');
    const b = createDefaultBoard('B');
    expect(a.groupOrder).toEqual(DEFAULT_ORDER);
    expect(a.groupOrder).not.toBe(GROUP_IDS);
    expect(a.groupOrder).not.toBe(b.groupOrder);
  });
});

describe('sanitizeGroupTitle', () => {
  it('title whitespace-only → empty string', () => {
    expect(sanitizeGroupTitle('   ')).toBe('');
    expect(sanitizeGroupTitle('\t\n ')).toBe('');
  });

  it('title is trimmed', () => {
    expect(sanitizeGroupTitle('  Focus now  ')).toBe('Focus now');
  });

  it('title longer than 40 characters → capped at 40', () => {
    const long = 'a'.repeat(41);
    expect(sanitizeGroupTitle(long)).toBe('a'.repeat(40));
    // trimming happens before the cap, so padding does not eat real characters
    expect(sanitizeGroupTitle(`  ${'b'.repeat(40)}  `)).toBe('b'.repeat(40));
    // the cap counts characters, not bytes — group names are routinely Cyrillic here
    expect(sanitizeGroupTitle('я'.repeat(41))).toBe('я'.repeat(40));
    expect(sanitizeGroupTitle('я'.repeat(40))).toBe('я'.repeat(40));
  });

  it('the cap never leaves a lone surrogate behind', () => {
    // 'a' * 39 + emoji is 41 code units: cutting at 40 would split the pair
    expect(sanitizeGroupTitle('a'.repeat(39) + '😀')).toBe('a'.repeat(39));
    // a pair that fits stays intact
    expect(sanitizeGroupTitle('a'.repeat(38) + '😀')).toBe('a'.repeat(38) + '😀');
  });

  it('title of exactly 40 characters → unchanged', () => {
    const exact = 'c'.repeat(40);
    expect(sanitizeGroupTitle(exact)).toBe(exact);
  });

  it('title not a string → empty string', () => {
    expect(() => sanitizeGroupTitle(undefined)).not.toThrow();
    expect(sanitizeGroupTitle(undefined)).toBe('');
    expect(sanitizeGroupTitle(null)).toBe('');
    expect(sanitizeGroupTitle(42)).toBe('');
    expect(sanitizeGroupTitle({ title: 'x' })).toBe('');
    expect(sanitizeGroupTitle(['x'])).toBe('');
  });

  it('title is sanitized on already-migrated v9 data', () => {
    const data = makeV9Data();
    (data.boards[0] as any).groups.focus.title = '  ' + 'z'.repeat(45) + '  ';
    (data.boards[0] as any).groups.backlog.title = null;
    const result = migrateData(data);
    expect(result.boards[0].groups.focus.title).toBe('z'.repeat(40));
    expect(result.boards[0].groups.backlog.title).toBe('');
  });

  it('valid title survives migration', () => {
    const data = makeV8Data();
    (data.boards[0] as any).groups.focus.title = 'Today';
    const result = migrateData(data);
    expect(result.boards[0].groups.focus.title).toBe('Today');
  });
});

describe('sanitizeFollowUps', () => {
  const item = (id: string, text: string, createdTaskId = '') => ({ id, text, createdTaskId });

  it('followUps not an array → []', () => {
    expect(() => sanitizeFollowUps(null)).not.toThrow();
    expect(sanitizeFollowUps(null)).toEqual([]);
    expect(sanitizeFollowUps(undefined)).toEqual([]);
    expect(sanitizeFollowUps('Send the report')).toEqual([]);
    expect(sanitizeFollowUps({ 0: item('f1', 'Send the report') })).toEqual([]);
    expect(sanitizeFollowUps(42)).toEqual([]);
    const result = migrateData(makeV9Data({
      t1: makeTask('t1', { followUps: null }),
      t2: makeTask('t2', { followUps: 'broken' }),
      t3: makeTask('t3', { followUps: { a: 1 } }),
    }));
    expect(result.tasks.t1.followUps).toEqual([]);
    expect(result.tasks.t2.followUps).toEqual([]);
    expect(result.tasks.t3.followUps).toEqual([]);
  });

  it('followUps item that is not an object is dropped', () => {
    expect(sanitizeFollowUps([null, 5, 'Call Bob', undefined, item('f1', 'Keep me')])).toEqual([
      item('f1', 'Keep me'),
    ]);
  });

  it('followUps item with non-string text is dropped', () => {
    const input = [
      { id: 'f1', text: 42, createdTaskId: '' },
      { id: 'f2', text: null, createdTaskId: '' },
      { id: 'f3', createdTaskId: '' },
      { id: 'f4', text: { value: 'x' }, createdTaskId: '' },
      ['f5', 'array item'],
      item('f6', 'Keep me'),
    ];
    expect(sanitizeFollowUps(input)).toEqual([item('f6', 'Keep me')]);
  });

  it('followUps item with whitespace-only text is dropped', () => {
    expect(sanitizeFollowUps([item('f1', ''), item('f2', '   '), item('f3', '\t\n '), item('f4', 'Keep me')])).toEqual([
      item('f4', 'Keep me'),
    ]);
  });

  it('followUps text is trimmed and capped at 200', () => {
    expect(sanitizeFollowUps([item('f1', '  Call Bob  ')])).toEqual([item('f1', 'Call Bob')]);
    // 201 characters with distinct head and tail: the first 200 survive, the tail is cut
    const long = 'a' + 'b'.repeat(199) + 'c';
    expect(sanitizeFollowUps([item('f1', long)])).toEqual([item('f1', 'a' + 'b'.repeat(199))]);
    const exact = 'x' + 'y'.repeat(198) + 'z';
    expect(sanitizeFollowUps([item('f1', exact)])).toEqual([item('f1', exact)]);
    // trimming happens before the cap, so padding does not eat real characters
    expect(sanitizeFollowUps([item('f1', `  ${exact}  `)])).toEqual([item('f1', exact)]);
    // the cap counts characters, not bytes
    expect(sanitizeFollowUps([item('f1', 'я'.repeat(201))])).toEqual([item('f1', 'я'.repeat(200))]);
    // a cut right after a space leaves no trailing whitespace, so the next load changes nothing
    const cutAfterSpace = sanitizeFollowUps([item('f1', 'a'.repeat(199) + ' tail')]);
    expect(cutAfterSpace).toEqual([item('f1', 'a'.repeat(199))]);
    expect(sanitizeFollowUps(cutAfterSpace)).toEqual(cutAfterSpace);
  });

  it('followUps text cap does not leave a lone high surrogate', () => {
    // 'a' * 199 + emoji is 201 code units: cutting at 200 would split the pair
    expect(sanitizeFollowUps([item('f1', 'a'.repeat(199) + '😀')])).toEqual([item('f1', 'a'.repeat(199))]);
    // a pair that fits stays intact
    expect(sanitizeFollowUps([item('f1', 'a'.repeat(198) + '😀')])).toEqual([item('f1', 'a'.repeat(198) + '😀')]);
    // a lone surrogate hidden behind a space the cut exposes is dropped too, in one pass
    const hidden = sanitizeFollowUps([item('f1', 'a'.repeat(198) + '\uD83D' + ' tail')]);
    expect(hidden).toEqual([item('f1', 'a'.repeat(198))]);
    expect(sanitizeFollowUps(hidden)).toEqual(hidden);
  });

  it("followUps non-string createdTaskId becomes ''", () => {
    const input = [
      { id: 'f1', text: 'one', createdTaskId: 42 },
      { id: 'f2', text: 'two', createdTaskId: null },
      { id: 'f3', text: 'three' },
      { id: 'f4', text: 'four', createdTaskId: { id: 't9' } },
      { id: 'f5', text: 'five', createdTaskId: 't9' },
    ];
    expect(sanitizeFollowUps(input)).toEqual([
      item('f1', 'one'), item('f2', 'two'), item('f3', 'three'), item('f4', 'four'), item('f5', 'five', 't9'),
    ]);
  });

  it('followUps missing or duplicate id gets a fresh unique id', () => {
    const input = [
      { id: 'x', text: 'first', createdTaskId: '' },
      { id: 'x', text: 'second', createdTaskId: '' },
      { text: 'no id', createdTaskId: '' },
      { id: '', text: 'empty id', createdTaskId: '' },
      { id: 7, text: 'number id', createdTaskId: '' },
      { id: 'y', text: 'unique', createdTaskId: 't2' },
    ];
    const result = sanitizeFollowUps(input);
    expect(result.map(f => f.text)).toEqual(['first', 'second', 'no id', 'empty id', 'number id', 'unique']);
    const ids = result.map(f => f.id);
    for (const id of ids) {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    }
    expect(new Set(ids).size).toBe(ids.length);
    // the first of two duplicates keeps its id; valid ids are never regenerated
    expect(ids[0]).toBe('x');
    expect(ids[1]).not.toBe('x');
    expect(ids[5]).toBe('y');
    expect(result[5].createdTaskId).toBe('t2');
  });

  it('followUps longer than 20 items is cut to the first 20', () => {
    const many = Array.from({ length: 25 }, (_, i) => item(`f${i}`, `item ${i}`));
    const result = sanitizeFollowUps(many);
    expect(result).toHaveLength(20);
    expect(result.map(f => f.text)).toEqual(Array.from({ length: 20 }, (_, i) => `item ${i}`));
    // dropped entries do not count toward the limit
    expect(sanitizeFollowUps([null, item('bad', ' '), ...many]).map(f => f.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => `f${i}`),
    );
  });

  it('sanitizeFollowUps does not mutate its input', () => {
    const input = [
      { id: 'x', text: '  padded  ', createdTaskId: 5 },
      { id: 'x', text: 'dup', createdTaskId: '' },
      null,
      ...Array.from({ length: 25 }, (_, i) => item(`f${i}`, `item ${i}`)),
    ];
    const before = JSON.parse(JSON.stringify(input));
    sanitizeFollowUps(input);
    expect(input).toEqual(before);
  });

  it('followUps is sanitized on already-migrated v9 data', () => {
    // Sanitization must sit outside the version branch: this input never enters a migration block.
    const result = migrateData(makeV9Data({
      t1: makeTask('t1', { followUps: [null, { id: 'f1', text: '  keep  ', createdTaskId: 5 }, item('f2', '   ')] }),
    }));
    expect(result.version).toBe(9);
    expect(result.tasks.t1.followUps).toEqual([item('f1', 'keep')]);
  });

  it('a task entry that is not an object does not throw', () => {
    for (const version of [8, 9]) {
      const data = makeV9Data({
        t1: null,
        t2: 'broken',
        t3: 5,
        t4: [],
        t5: makeTask('t5', version === 9 ? { followUps: 'broken' } : {}),
      });
      data.version = version;
      let result!: PluginData;
      expect(() => { result = migrateData(data); }, `v${version}`).not.toThrow();
      expect(result.version).toBe(9);
      // damaged entries are skipped, not repaired or removed here
      expect((result.tasks as any).t1).toBeNull();
      expect((result.tasks as any).t2).toBe('broken');
      expect((result.tasks as any).t3).toBe(5);
      expect((result.tasks as any).t4).toEqual([]);
      expect(result.tasks.t5.followUps).toEqual([]);
    }
  });

  it('tasks that is not an object does not throw', () => {
    for (const version of [8, 9]) {
      for (const tasks of [null, 'broken', 42]) {
        const data = makeV9Data() as any;
        data.version = version;
        data.tasks = tasks;
        let result!: PluginData;
        expect(() => { result = migrateData(data); }, `v${version} tasks=${String(tasks)}`).not.toThrow();
        expect(result.version).toBe(9);
        // left alone: wider load hardening is TD-01
        expect(result.tasks as unknown).toBe(tasks);
      }
      // an array is not a task dictionary either: its elements are not touched
      const data = makeV9Data() as any;
      data.version = version;
      const tasks = [makeTask('t1')];
      data.tasks = tasks;
      const result = migrateData(data);
      expect(result.tasks as unknown).toBe(tasks);
      expect(tasks[0]).not.toHaveProperty('followUps');
    }
  });
});

function makeTask(id: string, overrides: object = {}): Record<string, unknown> {
  // v8 shape: no followUps unless the test passes it
  return {
    id, what: `Task ${id}`, why: 'Because', who: 'me',
    deadline: '2026-01-01', createdAt: '2025-12-01', completedAt: '',
    priority: 'high', status: 'inProgress',
    ...overrides,
  };
}

function fullWidthGroups(): object {
  return Object.fromEntries(
    GROUP_IDS.map(id => [id, { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null, fullWidth: true }]),
  );
}

// Patches the top level of the data object (version, settings, boards, tasks)
function makeV7Data(dataOverrides: object = {}): { version: number; settings: object; boards: object[]; tasks: object } {
  return {
    version: 7,
    settings: { language: 'en', cardLayout: 'single' },
    boards: [{ ...makeBoard(), notes: '', notesCollapsed: true, notesHidden: false, hiddenGroups: [], groups: fullWidthGroups() }],
    tasks: {},
    ...dataOverrides,
  };
}

// Patches boards[0], NOT the top level — unlike makeV7Data above
function makeV8Data(boardOverrides: object = {}, tasks: object = {}): { version: number; settings: object; boards: object[]; tasks: object } {
  const data = makeV7Data({ tasks });
  data.version = 8;
  data.boards = [{ ...data.boards[0], ...boardOverrides }];
  return data;
}

// Fully valid v9 data: nothing in it is rewritten by migrateData, so it can be compared byte for byte.
// Takes tasks first, then boards[0] overrides.
function makeV9Data(tasks: object = {}, boardOverrides: object = {}): { version: number; settings: object; boards: object[]; tasks: object } {
  const groups = Object.fromEntries(
    GROUP_IDS.map(id => [id, { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null, fullWidth: true, title: '' }]),
  );
  return {
    version: 9,
    settings: { language: 'en', defaultPriority: 'medium', cardView: 'default', cardLayout: 'single' },
    boards: [{
      ...makeBoard(), notes: '', notesCollapsed: true, notesHidden: false, hiddenGroups: [], groups,
      groupOrder: [...DEFAULT_ORDER], ...boardOverrides,
    }],
    tasks,
  };
}
