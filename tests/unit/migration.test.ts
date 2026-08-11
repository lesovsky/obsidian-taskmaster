import { describe, it, expect } from 'vitest';
import { migrateData, sanitizeGroupOrder, sanitizeGroupTitle } from '../../src/data/migration';
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
  it('null → default data (version=8)', () => {
    const result = migrateData(null);
    expect(result.version).toBe(8);
    expect(result.boards.length).toBeGreaterThanOrEqual(1);
    expect(result.tasks).toBeDefined();
    for (const id of GROUP_IDS) {
      expect(result.boards[0].groups[id].title).toBe('');
    }
  });

  it('{} → default data (version=8)', () => {
    const result = migrateData({});
    expect(result.version).toBe(8);
  });

  // v1: language block uses original version var → ALL migrations apply
  it('v1 → v8: all fields are migrated in one pass', () => {
    const input = { version: 1, settings: {}, boards: [makeBoard()], tasks: {} };
    const result = migrateData(input);

    expect(result.version).toBe(8);
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
  });

  it('v2 → v8: notes, hiddenGroups, fullWidth, cardLayout, notesHidden, title, groupOrder added', () => {
    const input = { version: 2, settings: { language: 'en' }, boards: [makeBoard()], tasks: {} };
    const result = migrateData(input);
    expect(result.version).toBe(8);
    expect(result.boards[0].notes).toBe('');
    expect(result.boards[0].hiddenGroups).toEqual([]);
    expect(result.settings.cardLayout).toBe('single');
    expect(result.boards[0].notesHidden).toBe(false);
    expect(result.boards[0].groups.focus.title).toBe('');
    expect(result.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('v3 → v8: hiddenGroups, fullWidth, cardLayout, notesHidden, title, groupOrder added', () => {
    const input = {
      version: 3,
      settings: { language: 'en' },
      boards: [{ ...makeBoard(), notes: 'existing note', notesCollapsed: false }],
      tasks: {},
    };
    const result = migrateData(input);
    expect(result.version).toBe(8);
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

  it('v4 → v8: fullWidth, cardLayout, notesHidden, title, groupOrder added', () => {
    const input = {
      version: 4,
      settings: { language: 'en' },
      boards: [{ ...makeBoard(), notes: '', notesCollapsed: true, hiddenGroups: [] }],
      tasks: {},
    };
    const result = migrateData(input);
    expect(result.version).toBe(8);
    for (const id of GROUP_IDS) {
      expect(typeof result.boards[0].groups[id].fullWidth).toBe('boolean');
    }
    expect(result.settings.cardLayout).toBe('single');
    expect(result.boards[0].notesHidden).toBe(false);
    expect(result.boards[0].groups.focus.title).toBe('');
    expect(result.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('v5 → v8: cardLayout, notesHidden, title, groupOrder added', () => {
    const input = {
      version: 5,
      settings: { language: 'en' },
      boards: [{ ...makeBoard(), notes: '', notesCollapsed: true, hiddenGroups: [], groups: fullWidthGroups() }],
      tasks: {},
    };
    const result = migrateData(input);
    expect(result.version).toBe(8);
    expect(result.settings.cardLayout).toBe('single');
    expect(result.boards[0].notesHidden).toBe(false);
    expect(result.boards[0].groups.focus.title).toBe('');
    expect(result.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('v6 → v8: notesHidden, title, groupOrder added', () => {
    const input = {
      version: 6,
      settings: { language: 'en', cardLayout: 'single' },
      boards: [{ ...makeBoard(), notes: '', notesCollapsed: true, hiddenGroups: [], groups: fullWidthGroups() }],
      tasks: {},
    };
    const result = migrateData(input);
    expect(result.version).toBe(8);
    expect(result.boards[0].notesHidden).toBe(false);
    expect(result.boards[0].groups.focus.title).toBe('');
    expect(result.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('v7 → v8: every group gets an empty title', () => {
    const result = migrateData(makeV7Data());
    expect(result.version).toBe(8);
    for (const id of GROUP_IDS) {
      expect(result.boards[0].groups[id].title).toBe('');
    }
  });

  it('v7 → v8: every board gets the default group order', () => {
    const result = migrateData(makeV7Data());
    expect(result.boards[0].groupOrder).toEqual(DEFAULT_ORDER);
  });

  it('v7 → v8: tasks are untouched', () => {
    const tasks = {
      t1: {
        id: 't1', what: 'Do it', why: 'Because', who: 'me',
        deadline: '2026-01-01', createdAt: '2025-12-01', completedAt: '',
        priority: 'high', status: 'inProgress',
      },
    };
    const before = JSON.stringify(tasks);
    const result = migrateData(makeV7Data({ tasks }));
    expect(result.tasks).toEqual(JSON.parse(before));
    expect(JSON.stringify(result.tasks)).toBe(before);
  });

  it('v8 → v8: data unchanged (idempotent)', () => {
    // Start with v8 data (result of migrateData(null))
    const v8data: PluginData = migrateData(null);
    const before = JSON.stringify(v8data);
    const result = migrateData(v8data);
    expect(result.version).toBe(8);
    // Structure should remain the same
    expect(JSON.stringify(result)).toBe(before);
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

  it('groupOrder is sanitized on already-migrated v8 data', () => {
    // Sanitization must sit outside the version branch: this input never enters a migration block.
    const result = migrateData(makeV8Data({ groupOrder: ['completed', 'completed', 'archive'] }));
    expect(result.version).toBe(8);
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

  it('title is sanitized on already-migrated v8 data', () => {
    const data = makeV8Data();
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
function makeV8Data(boardOverrides: object = {}): { version: number; settings: object; boards: object[]; tasks: object } {
  const data = makeV7Data();
  data.version = 8;
  data.boards = [{ ...data.boards[0], ...boardOverrides }];
  return data;
}
