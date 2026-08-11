import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { dataStore, updateBoard } from '../../src/stores/dataStore';
import { pluginStore } from '../../src/stores/pluginStore';
import { DEFAULT_DATA, createDefaultBoard } from '../../src/data/defaults';
import { GROUP_IDS } from '../../src/data/types';
import type { Plugin } from 'obsidian';
import type { Board, GroupId, PluginData } from '../../src/data/types';

// `persist()` only reaches Obsidian when `pluginStore` holds a plugin, so most tests need no mock;
// the one that checks persistence injects a fake with a `saveData` method and puts `null` back.

type UpdateFields = Parameters<typeof updateBoard>[1];

/**
 * Seeds the store with `count` boards and returns them. The returned objects are the very ones
 * inside the store (the store is a module-level singleton), which is what lets the missing-group
 * test damage a board the way a hand-edited data.json would. `settings` is copied rather than
 * shared with DEFAULT_DATA, so nothing here can leak into the module constant.
 */
function seedBoards(count = 1): Board[] {
  const boards = Array.from({ length: count }, (_, i) => createDefaultBoard(`Board ${i + 1}`));
  dataStore.set({ ...DEFAULT_DATA, settings: { ...DEFAULT_DATA.settings }, boards, tasks: {} });
  return boards;
}

function readBoard(boardId: string): Board {
  const board = get(dataStore).boards.find(b => b.id === boardId);
  if (!board) throw new Error('board disappeared from the store');
  return board;
}

function fields(overrides: Partial<UpdateFields> = {}): UpdateFields {
  return {
    title: 'Board',
    subtitle: '',
    hiddenGroups: [],
    groupFullWidths: Object.fromEntries(GROUP_IDS.map(id => [id, false])) as Record<GroupId, boolean>,
    groupTitles: Object.fromEntries(GROUP_IDS.map(id => [id, ''])) as Record<GroupId, string>,
    groupOrder: [...GROUP_IDS],
    notesHidden: false,
    ...overrides,
  };
}

function titles(overrides: Partial<Record<GroupId, string>>): Record<GroupId, string> {
  return Object.fromEntries(
    GROUP_IDS.map(id => [id, overrides[id] ?? '']),
  ) as Record<GroupId, string>;
}

describe('updateBoard', () => {
  let board: Board;

  beforeEach(() => {
    board = seedBoards()[0];
  });

  afterEach(() => {
    pluginStore.set(null);
  });

  it('trims surrounding whitespace from group titles', () => {
    updateBoard(board.id, fields({ groupTitles: titles({ focus: '  Долгострой  ' }) }));

    expect(readBoard(board.id).groups.focus.title).toBe('Долгострой');
  });

  it('stores a whitespace-only title as empty', () => {
    updateBoard(board.id, fields({ groupTitles: titles({ focus: '   ' }) }));

    expect(readBoard(board.id).groups.focus.title).toBe('');
  });

  it('caps a group title at 40 characters, keeping the first 40', () => {
    // Head and tail differ on purpose, so the assertion pins *which* 40 survive: a cap written
    // as slice(-40) would keep the tail and show users the end of their name. A repeating
    // pattern would not catch that — its last 40 characters look exactly like its first 40.
    const long = 'A'.repeat(30) + 'B'.repeat(30);

    updateBoard(board.id, fields({ groupTitles: titles({ focus: long }) }));

    expect(readBoard(board.id).groups.focus.title).toBe('A'.repeat(30) + 'B'.repeat(10));
  });

  it('keeps an empty group title empty', () => {
    // The store boundary never substitutes a localized default: an untouched popup must not
    // freeze the current language into data.json.
    updateBoard(board.id, fields());

    for (const id of GROUP_IDS) {
      expect(readBoard(board.id).groups[id].title).toBe('');
    }
  });

  it('clears a previously stored title when an empty name is saved', () => {
    board.groups.focus.title = 'Старое название';

    updateBoard(board.id, fields());

    // "Clearing a name returns the group to its default localized name" — the store side of it.
    // A defensive `?? existing` here would keep the old name and break that rule silently.
    expect(readBoard(board.id).groups.focus.title).toBe('');
  });

  it('writes each name onto its own group', () => {
    updateBoard(board.id, fields({ groupTitles: titles({ focus: 'Фокус', delegated: 'Кому-то' }) }));

    const saved = readBoard(board.id);
    expect(saved.groups.focus.title).toBe('Фокус');
    expect(saved.groups.delegated.title).toBe('Кому-то');
    expect(saved.groups.backlog.title).toBe('');
  });

  it('stores the supplied group order', () => {
    const order: GroupId[] = ['completed', 'delegated', 'orgIntentions', 'inProgress', 'focus', 'backlog'];

    updateBoard(board.id, fields({ groupOrder: order }));

    expect(readBoard(board.id).groupOrder).toEqual(order);
  });

  it('stores the group order verbatim, without sanitizing it', () => {
    // Decision 6: the order sanitizer lives at load time only. Repeating it here would create a
    // second source of truth, so an incomplete order must survive the write untouched.
    updateBoard(board.id, fields({ groupOrder: ['focus', 'backlog'] }));

    expect(readBoard(board.id).groupOrder).toEqual(['focus', 'backlog']);
  });

  it('still writes the pre-existing fields', () => {
    updateBoard(board.id, fields({
      title: 'Renamed board',
      subtitle: 'Subtitle',
      hiddenGroups: ['delegated'],
      notesHidden: true,
      groupFullWidths: Object.fromEntries(
        GROUP_IDS.map(id => [id, id === 'focus']),
      ) as Record<GroupId, boolean>,
    }));

    const saved = readBoard(board.id);
    expect(saved.title).toBe('Renamed board');
    expect(saved.subtitle).toBe('Subtitle');
    expect(saved.hiddenGroups).toEqual(['delegated']);
    expect(saved.notesHidden).toBe(true);
    expect(saved.groups.focus.fullWidth).toBe(true);
    expect(saved.groups.backlog.fullWidth).toBe(false);
  });

  it('writes to the board named by boardId and leaves the others alone', () => {
    const [first, second] = seedBoards(2);

    updateBoard(second.id, fields({ title: 'Second', groupTitles: titles({ focus: 'Второй' }) }));

    expect(readBoard(second.id).title).toBe('Second');
    expect(readBoard(first.id).title).toBe('Board 1');
    expect(readBoard(first.id).groups.focus.title).toBe('');
  });

  it('ignores an unknown boardId instead of throwing', () => {
    // A settings save racing a board deletion must not blow up inside a store update.
    expect(() => updateBoard('no-such-board', fields({ title: 'Ghost' }))).not.toThrow();
    expect(readBoard(board.id).title).toBe('Board 1');
  });

  it('persists the board after writing it', () => {
    const saved: PluginData[] = [];
    // Снимок, а не ссылка: стор мутируется на месте, и сохранённый по ссылке объект показывал бы
    // состояние на момент проверки, а не на момент вызова saveData.
    pluginStore.set({
      saveData: (data: PluginData) => { saved.push(JSON.parse(JSON.stringify(data))); },
    } as unknown as Plugin);

    updateBoard(board.id, fields({ title: 'Persisted' }));

    expect(saved).toHaveLength(1);
    expect(saved[0].boards[0].title).toBe('Persisted');
  });

  it('stores a missing full-width flag as false instead of undefined', () => {
    const incomplete = { focus: true } as Record<GroupId, boolean>;

    updateBoard(board.id, fields({ groupFullWidths: incomplete }));

    expect(readBoard(board.id).groups.focus.fullWidth).toBe(true);
    expect(readBoard(board.id).groups.backlog.fullWidth).toBe(false);
  });

  it('does not throw on a null group value', () => {
    // A key present with a null value passes an own-key check and would throw mid-write,
    // leaving the board half-updated and persist() unreached. Scope note: such a board does not
    // reach this function today — migration.ts dereferences every group value on load and throws
    // first — so this pins the guard, not end-to-end survival of a nulled group.
    (board.groups as Record<string, unknown>).delegated = null;

    expect(() => updateBoard(board.id, fields({ title: 'Still saved' }))).not.toThrow();
    expect(readBoard(board.id).title).toBe('Still saved');
  });

  it('survives a board whose group object was removed by hand', () => {
    delete (board.groups as Partial<Board['groups']>).delegated;

    expect(() => updateBoard(board.id, fields({ groupTitles: titles({ focus: 'Fokus' }) }))).not.toThrow();
    expect(readBoard(board.id).groups.focus.title).toBe('Fokus');
  });
});
