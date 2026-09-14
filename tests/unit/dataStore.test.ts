import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
  dataStore,
  updateBoard,
  updateTask,
  quickCompleteTask,
  undoQuickComplete,
  moveTask,
  createFollowUpTasks,
} from '../../src/stores/dataStore';
import { pluginStore } from '../../src/stores/pluginStore';
import { uiStore } from '../../src/stores/uiStore';
import { locale } from '../../src/i18n';
import { DEFAULT_DATA, createDefaultBoard } from '../../src/data/defaults';
import { GROUP_IDS } from '../../src/data/types';
import type { Plugin } from 'obsidian';
import type { Board, GroupId, PluginData, Task } from '../../src/data/types';

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

describe('follow-up spawning', () => {
  let board: Board;

  /** Puts a task with follow-up items `texts` (all pending) at the end of `groupId`. */
  function seedTask(groupId: GroupId, texts: string[], what = 'Parent'): Task {
    const task: Task = {
      id: crypto.randomUUID(),
      what,
      why: '',
      who: '',
      deadline: '',
      createdAt: '2026-01-01',
      completedAt: groupId === 'completed' ? '2026-01-02' : '',
      priority: 'high',
      status: groupId === 'completed' ? 'completed' : 'inProgress',
      followUps: texts.map(text => ({ id: crypto.randomUUID(), text, createdTaskId: '' })),
    };
    dataStore.update(data => {
      data.tasks[task.id] = task;
      data.boards.find(b => b.id === board.id)!.groups[groupId].taskIds.push(task.id);
      return data;
    });
    return task;
  }

  function stored(taskId: string): Task {
    return get(dataStore).tasks[taskId];
  }

  function backlogIds(): string[] {
    return readBoard(board.id).groups.backlog.taskIds;
  }

  beforeEach(() => {
    board = seedBoards()[0];
    // moveTask resolves its board through the active board id.
    uiStore.update(ui => ({ ...ui, activeBoardId: board.id }));
  });

  it('quickCompleteTask spawns pending items into backlog and returns their ids', () => {
    const parent = seedTask('focus', ['Call client', 'Send invoice']);

    const result = quickCompleteTask(parent.id, 'focus', board.id);

    expect(result).not.toBeNull();
    expect(result!.spawnedTaskIds).toHaveLength(2);
    expect(backlogIds()).toEqual(result!.spawnedTaskIds);
    expect(result!.spawnedTaskIds.map(id => stored(id).what)).toEqual(['Call client', 'Send invoice']);
    expect(stored(parent.id).followUps.map(item => item.createdTaskId)).toEqual(result!.spawnedTaskIds);
    expect(readBoard(board.id).groups.completed.taskIds).toEqual([parent.id]);
  });

  it('quickCompleteTask on a task without pending items returns an empty spawnedTaskIds', () => {
    const parent = seedTask('focus', []);

    const result = quickCompleteTask(parent.id, 'focus', board.id);

    expect(result!.spawnedTaskIds).toEqual([]);
    expect(backlogIds()).toEqual([]);
  });

  it('undoQuickComplete with spawnedTaskIds removes those tasks and returns items to pending', () => {
    const parent = seedTask('focus', ['Call client', 'Send invoice']);
    const result = quickCompleteTask(parent.id, 'focus', board.id)!;

    undoQuickComplete(
      parent.id, 'focus', board.id, result.position,
      result.previousStatus, result.previousCompletedAt, result.spawnedTaskIds,
    );

    expect(backlogIds()).toEqual([]);
    for (const id of result.spawnedTaskIds) {
      expect(get(dataStore).tasks).not.toHaveProperty(id);
    }
    expect(stored(parent.id).followUps.map(item => item.createdTaskId)).toEqual(['', '']);
    expect(readBoard(board.id).groups.focus.taskIds).toEqual([parent.id]);
    expect(stored(parent.id).status).toBe('inProgress');
  });

  it('undoQuickComplete leaves an item created earlier via the form untouched', () => {
    const parent = seedTask('focus', ['Early', 'Late']);
    const [early, late] = parent.followUps.map(item => item.id);
    const [earlyTaskId] = createFollowUpTasks(board.id, parent.id, [early]);
    const result = quickCompleteTask(parent.id, 'focus', board.id)!;

    undoQuickComplete(
      parent.id, 'focus', board.id, result.position,
      result.previousStatus, result.previousCompletedAt, result.spawnedTaskIds,
    );

    const items = stored(parent.id).followUps;
    expect(items.find(item => item.id === early)!.createdTaskId).toBe(earlyTaskId);
    expect(items.find(item => item.id === late)!.createdTaskId).toBe('');
    expect(backlogIds()).toEqual([earlyTaskId]);
    expect(stored(earlyTaskId).what).toBe('Early');
  });

  it('moveTask into completed from a working group spawns and returns ids', () => {
    const parent = seedTask('inProgress', ['Retro']);

    const spawned = moveTask(parent.id, 'inProgress', 'completed', 0);

    expect(spawned).toHaveLength(1);
    expect(backlogIds()).toEqual(spawned);
    expect(stored(spawned[0]).what).toBe('Retro');
    expect(stored(parent.id).followUps[0].createdTaskId).toBe(spawned[0]);
  });

  it('moveTask inside completed spawns nothing', () => {
    // Decision 4: applyStatusTransition runs for in-group reorders too, so only `from` tells them apart.
    seedTask('completed', []);
    const parent = seedTask('completed', ['Would be spawned by mistake']);

    const spawned = moveTask(parent.id, 'completed', 'completed', 0);

    expect(spawned).toEqual([]);
    expect(backlogIds()).toEqual([]);
    expect(stored(parent.id).followUps[0].createdTaskId).toBe('');
    expect(readBoard(board.id).groups.completed.taskIds[0]).toBe(parent.id);
  });

  it('moveTask between working groups spawns nothing', () => {
    const parent = seedTask('focus', ['Not yet']);

    const spawned = moveTask(parent.id, 'focus', 'delegated', 0);

    expect(spawned).toEqual([]);
    expect(backlogIds()).toEqual([]);
    expect(stored(parent.id).followUps[0].createdTaskId).toBe('');
  });

  it('completing again after moving back out creates no duplicates', () => {
    const parent = seedTask('focus', ['Once']);
    const first = moveTask(parent.id, 'focus', 'completed', 0);

    moveTask(parent.id, 'completed', 'focus', 0);
    const byDrag = moveTask(parent.id, 'focus', 'completed', 0);
    moveTask(parent.id, 'completed', 'focus', 0);
    const byButton = quickCompleteTask(parent.id, 'focus', board.id)!;

    expect(first).toHaveLength(1);
    expect(byDrag).toEqual([]);
    expect(byButton.spawnedTaskIds).toEqual([]);
    expect(backlogIds()).toEqual(first);
  });

  it('createFollowUpTasks spawns only the given items and returns their ids', () => {
    const parent = seedTask('focus', ['A', 'B', 'C']);
    const [a, b, c] = parent.followUps.map(item => item.id);

    const spawned = createFollowUpTasks(board.id, parent.id, [c, a]);

    // List order, not the order of itemIds.
    expect(spawned.map(id => stored(id).what)).toEqual(['A', 'C']);
    expect(backlogIds()).toEqual(spawned);
    const items = stored(parent.id).followUps;
    expect(items.find(item => item.id === b)!.createdTaskId).toBe('');
    expect(readBoard(board.id).groups.focus.taskIds).toEqual([parent.id]);
  });

  it('createFollowUpTasks persists the spawn', () => {
    const parent = seedTask('focus', ['A']);
    const saved: PluginData[] = [];
    pluginStore.set({
      saveData: (data: PluginData) => { saved.push(JSON.parse(JSON.stringify(data))); },
    } as unknown as Plugin);

    try {
      const [spawned] = createFollowUpTasks(board.id, parent.id, [parent.followUps[0].id]);

      expect(saved).toHaveLength(1);
      expect(saved[0].tasks[spawned].what).toBe('A');
    } finally {
      pluginStore.set(null);
    }
  });

  it('updateTask with status completed spawns nothing', () => {
    const parent = seedTask('focus', ['Stays pending']);

    updateTask({ ...parent, status: 'completed' });

    expect(backlogIds()).toEqual([]);
    expect(stored(parent.id).followUps[0].createdTaskId).toBe('');
    expect(readBoard(board.id).groups.focus.taskIds).toEqual([parent.id]);
  });

  it('spawned task why uses the locale prefix', () => {
    const parent = seedTask('focus', ['Follow up'], 'Ship release');

    const { spawnedTaskIds } = quickCompleteTask(parent.id, 'focus', board.id)!;

    expect(stored(spawnedTaskIds[0]).why).toBe('After: Ship release');
  });

  it('spawned task why follows the current locale', () => {
    // Without this a hard-coded 'After: ' would pass the en-only test above.
    const parent = seedTask('focus', ['Follow up'], 'Ship release');
    locale.set('ru');

    try {
      const { spawnedTaskIds } = quickCompleteTask(parent.id, 'focus', board.id)!;

      expect(stored(spawnedTaskIds[0]).why).toBe('После: Ship release');
    } finally {
      locale.set('en');
    }
  });

  it('quickCompleteTask and createFollowUpTasks spawn into the board they are given, not the active one', () => {
    const [active, other] = seedBoards(2);
    uiStore.update(ui => ({ ...ui, activeBoardId: active.id }));
    board = other;
    const first = seedTask('focus', ['By button']);
    const second = seedTask('focus', ['From form']);

    const { spawnedTaskIds } = quickCompleteTask(first.id, 'focus', other.id)!;
    const created = createFollowUpTasks(other.id, second.id, [second.followUps[0].id]);

    expect(readBoard(other.id).groups.backlog.taskIds).toEqual([...spawnedTaskIds, ...created]);
    expect(readBoard(active.id).groups.backlog.taskIds).toEqual([]);
  });
});
