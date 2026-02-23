import { describe, it, expect } from 'vitest';
import { migrateData } from '../../src/data/migration';
import type { PluginData } from '../../src/data/types';
import { GROUP_IDS } from '../../src/data/types';

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
  it('null → default data (version=7)', () => {
    const result = migrateData(null);
    expect(result.version).toBe(7);
    expect(result.boards.length).toBeGreaterThanOrEqual(1);
    expect(result.tasks).toBeDefined();
  });

  it('{} → default data (version=7)', () => {
    const result = migrateData({});
    expect(result.version).toBe(7);
  });

  // v1: language block uses original version var → ALL migrations apply
  it('v1 → v7: all fields are migrated in one pass', () => {
    const input = { version: 1, settings: {}, boards: [makeBoard()], tasks: {} };
    const result = migrateData(input);

    expect(result.version).toBe(7);
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
  });

  it('v2 → v7: notes, hiddenGroups, fullWidth, cardLayout, notesHidden added', () => {
    const input = { version: 2, settings: { language: 'en' }, boards: [makeBoard()], tasks: {} };
    const result = migrateData(input);
    expect(result.version).toBe(7);
    expect(result.boards[0].notes).toBe('');
    expect(result.boards[0].hiddenGroups).toEqual([]);
    expect(result.settings.cardLayout).toBe('single');
    expect(result.boards[0].notesHidden).toBe(false);
  });

  it('v3 → v7: hiddenGroups, fullWidth, cardLayout, notesHidden added', () => {
    const input = {
      version: 3,
      settings: { language: 'en' },
      boards: [{ ...makeBoard(), notes: 'existing note', notesCollapsed: false }],
      tasks: {},
    };
    const result = migrateData(input);
    expect(result.version).toBe(7);
    // notes pre-existing should be preserved
    expect(result.boards[0].notes).toBe('existing note');
    expect(result.boards[0].hiddenGroups).toEqual([]);
    for (const id of GROUP_IDS) {
      expect(typeof result.boards[0].groups[id].fullWidth).toBe('boolean');
    }
    expect(result.settings.cardLayout).toBe('single');
    expect(result.boards[0].notesHidden).toBe(false);
  });

  it('v4 → v7: fullWidth, cardLayout, notesHidden added', () => {
    const input = {
      version: 4,
      settings: { language: 'en' },
      boards: [{ ...makeBoard(), notes: '', notesCollapsed: true, hiddenGroups: [] }],
      tasks: {},
    };
    const result = migrateData(input);
    expect(result.version).toBe(7);
    for (const id of GROUP_IDS) {
      expect(typeof result.boards[0].groups[id].fullWidth).toBe('boolean');
    }
    expect(result.settings.cardLayout).toBe('single');
    expect(result.boards[0].notesHidden).toBe(false);
  });

  it('v5 → v7: cardLayout and notesHidden added', () => {
    const input = {
      version: 5,
      settings: { language: 'en' },
      boards: [{ ...makeBoard(), notes: '', notesCollapsed: true, hiddenGroups: [], groups: fullWidthGroups() }],
      tasks: {},
    };
    const result = migrateData(input);
    expect(result.version).toBe(7);
    expect(result.settings.cardLayout).toBe('single');
    expect(result.boards[0].notesHidden).toBe(false);
  });

  it('v6 → v7: notesHidden added', () => {
    const input = {
      version: 6,
      settings: { language: 'en', cardLayout: 'single' },
      boards: [{ ...makeBoard(), notes: '', notesCollapsed: true, hiddenGroups: [], groups: fullWidthGroups() }],
      tasks: {},
    };
    const result = migrateData(input);
    expect(result.version).toBe(7);
    expect(result.boards[0].notesHidden).toBe(false);
  });

  it('v7 → v7: data unchanged (idempotent)', () => {
    // Start with v7 data (result of migrateData(null))
    const v7data: PluginData = migrateData(null);
    const before = JSON.stringify(v7data);
    const result = migrateData(v7data);
    expect(result.version).toBe(7);
    // Structure should remain the same
    expect(JSON.stringify(result)).toBe(before);
  });
});

function fullWidthGroups(): object {
  return Object.fromEntries(
    GROUP_IDS.map(id => [id, { taskIds: [], wipLimit: null, collapsed: false, completedRetentionDays: null, fullWidth: true }]),
  );
}
