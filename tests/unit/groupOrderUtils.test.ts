import { describe, it, expect } from 'vitest';
import { canMoveGroup, moveGroup, moveGroupWithinPresent, sanitizeHiddenGroups } from '../../src/ui/groupOrderUtils';
import type { MoveDirection } from '../../src/ui/groupOrderUtils';
import type { GroupId } from '../../src/data/types';

// Локальный хелпер: массив порядка групп. Порядок в нём произвольный —
// модуль не привязан к дефолтной последовательности GROUP_IDS.
function order(...ids: GroupId[]): GroupId[] {
  return ids;
}

describe('moveGroup — visible row', () => {
  it('visible group moves up by swapping with the nearest visible neighbour', () => {
    // focus видимая, между ней и backlog лежит скрытая inProgress
    const input = order('backlog', 'inProgress', 'focus', 'delegated');
    const hidden: GroupId[] = ['inProgress'];
    const result = moveGroup(input, 'focus', 'up', hidden);
    expect(result).toEqual(['focus', 'inProgress', 'backlog', 'delegated']);
    expect(result.indexOf('inProgress')).toBe(1);
  });

  it('visible group moves down by swapping with the nearest visible neighbour', () => {
    const input = order('backlog', 'inProgress', 'focus', 'delegated');
    const hidden: GroupId[] = ['inProgress'];
    const result = moveGroup(input, 'backlog', 'down', hidden);
    expect(result).toEqual(['focus', 'inProgress', 'backlog', 'delegated']);
    expect(result.indexOf('inProgress')).toBe(1);
  });

  it('visible group with an adjacent visible neighbour swaps with it', () => {
    const input = order('backlog', 'focus', 'inProgress');
    const result = moveGroup(input, 'focus', 'up', []);
    expect(result).toEqual(['focus', 'backlog', 'inProgress']);
  });

  it('visible group steps over several consecutive hidden groups', () => {
    const input = order('backlog', 'inProgress', 'orgIntentions', 'delegated', 'focus');
    const hidden: GroupId[] = ['inProgress', 'orgIntentions', 'delegated'];
    const result = moveGroup(input, 'focus', 'up', hidden);
    expect(result).toEqual(['focus', 'inProgress', 'orgIntentions', 'delegated', 'backlog']);
    expect(result.indexOf('inProgress')).toBe(1);
    expect(result.indexOf('orgIntentions')).toBe(2);
    expect(result.indexOf('delegated')).toBe(3);
  });

  it('visible group steps over several consecutive hidden groups downwards', () => {
    const input = order('focus', 'inProgress', 'orgIntentions', 'delegated', 'backlog');
    const hidden: GroupId[] = ['inProgress', 'orgIntentions', 'delegated'];
    const result = moveGroup(input, 'focus', 'down', hidden);
    expect(result).toEqual(['backlog', 'inProgress', 'orgIntentions', 'delegated', 'focus']);
    expect(result.indexOf('inProgress')).toBe(1);
    expect(result.indexOf('orgIntentions')).toBe(2);
    expect(result.indexOf('delegated')).toBe(3);
  });
});

describe('moveGroup — hidden row', () => {
  it("hidden group swaps with its immediate neighbour regardless of that neighbour's visibility", () => {
    const input = order('backlog', 'focus', 'inProgress');
    const hidden: GroupId[] = ['focus'];
    const result = moveGroup(input, 'focus', 'up', hidden);
    expect(result).toEqual(['focus', 'backlog', 'inProgress']);
  });

  it('hidden group swaps with its immediate hidden neighbour', () => {
    const input = order('backlog', 'focus', 'inProgress');
    const hidden: GroupId[] = ['focus', 'inProgress'];
    const result = moveGroup(input, 'focus', 'down', hidden);
    expect(result).toEqual(['backlog', 'inProgress', 'focus']);
  });

  it('hidden group swaps with its immediate neighbour even when only hidden groups lie that way', () => {
    // Ровно тот случай, где два правила расходятся: по правилу видимой строки
    // цели вверх нет (сверху только скрытая), по правилу скрытой — сосед есть.
    const input = order('inProgress', 'focus', 'backlog');
    const hidden: GroupId[] = ['inProgress', 'focus'];
    expect(canMoveGroup(input, 'focus', 'up', hidden)).toBe(true);
    expect(moveGroup(input, 'focus', 'up', hidden)).toEqual(['focus', 'inProgress', 'backlog']);
  });

  it('moving a hidden group past a visible neighbour keeps the relative order of visible groups', () => {
    const input = order('backlog', 'focus', 'inProgress', 'delegated');
    const hidden: GroupId[] = ['focus'];
    const visibleBefore = input.filter(id => !hidden.includes(id));
    const result = moveGroup(input, 'focus', 'down', hidden);
    // Инвариант из спека: относительный порядок видимых групп не меняется.
    expect(result.filter(id => !hidden.includes(id))).toEqual(visibleBefore);
    // Инвариант выполняется и на no-op реализации, поэтому фиксируем и сам результат.
    expect(result).toEqual(['backlog', 'inProgress', 'focus', 'delegated']);
  });
});

describe('canMoveGroup — arrow enabled state', () => {
  it('up is disabled for a visible group with no visible group above it', () => {
    const input = order('inProgress', 'orgIntentions', 'focus', 'delegated');
    const hidden: GroupId[] = ['inProgress', 'orgIntentions'];
    expect(canMoveGroup(input, 'focus', 'up', hidden)).toBe(false);
    expect(canMoveGroup(input, 'focus', 'down', hidden)).toBe(true);
  });

  it('down is disabled for a visible group with no visible group below it', () => {
    const input = order('backlog', 'focus', 'inProgress', 'orgIntentions');
    const hidden: GroupId[] = ['inProgress', 'orgIntentions'];
    expect(canMoveGroup(input, 'focus', 'down', hidden)).toBe(false);
    expect(canMoveGroup(input, 'focus', 'up', hidden)).toBe(true);
  });

  it('up is disabled for a hidden group at the first position', () => {
    const input = order('focus', 'backlog', 'inProgress');
    const hidden: GroupId[] = ['focus'];
    expect(canMoveGroup(input, 'focus', 'up', hidden)).toBe(false);
    expect(canMoveGroup(input, 'focus', 'down', hidden)).toBe(true);
    // на промежуточной позиции — обе стрелки активны
    const middle = order('backlog', 'focus', 'inProgress');
    expect(canMoveGroup(middle, 'focus', 'up', hidden)).toBe(true);
    expect(canMoveGroup(middle, 'focus', 'down', hidden)).toBe(true);
  });

  it('down is disabled for a hidden group at the last position', () => {
    const input = order('backlog', 'inProgress', 'focus');
    const hidden: GroupId[] = ['focus'];
    expect(canMoveGroup(input, 'focus', 'down', hidden)).toBe(false);
    expect(canMoveGroup(input, 'focus', 'up', hidden)).toBe(true);
  });

  it('the only visible group has both arrows disabled', () => {
    const input = order('backlog', 'inProgress', 'focus', 'orgIntentions', 'delegated', 'completed');
    const hidden: GroupId[] = ['backlog', 'inProgress', 'orgIntentions', 'delegated', 'completed'];
    expect(canMoveGroup(input, 'focus', 'up', hidden)).toBe(false);
    expect(canMoveGroup(input, 'focus', 'down', hidden)).toBe(false);
    expect(moveGroup(input, 'focus', 'up', hidden)).toEqual(input);
    expect(moveGroup(input, 'focus', 'down', hidden)).toEqual(input);
  });

  it('empty order and single-element order report both arrows disabled', () => {
    expect(canMoveGroup([], 'focus', 'up', [])).toBe(false);
    expect(canMoveGroup([], 'focus', 'down', [])).toBe(false);
    expect(canMoveGroup(order('focus'), 'focus', 'up', [])).toBe(false);
    expect(canMoveGroup(order('focus'), 'focus', 'down', [])).toBe(false);
    expect(canMoveGroup(order('focus'), 'focus', 'up', ['focus'])).toBe(false);
    expect(canMoveGroup(order('focus'), 'focus', 'down', ['focus'])).toBe(false);
    expect(moveGroup([], 'focus', 'up', [])).toEqual([]);
    expect(moveGroup(order('focus'), 'focus', 'down', [])).toEqual(['focus']);
  });

  it('ids in hiddenGroups that are absent from the order are ignored', () => {
    const input = order('backlog', 'focus');
    const hidden: GroupId[] = ['completed', 'delegated'];
    expect(canMoveGroup(input, 'focus', 'up', hidden)).toBe(true);
    expect(moveGroup(input, 'focus', 'up', hidden)).toEqual(['focus', 'backlog']);
  });
});

describe('groupOrderUtils — consistency and robustness', () => {
  it('the predicate is true exactly when the move changes the order', () => {
    // Инвариант из What-to-do §5. Ожидание выводится из moveGroup, а не задаётся
    // руками, поэтому тест ловит любое расхождение двух функций — включая случай,
    // когда предикат начнёт применять правило видимой строки к скрытой.
    // Область действия — массивы без дубликатов: на дубликатах обмен двух
    // одинаковых значений даёт равный массив при активной стрелке. Дубликаты
    // отсекает sanitizeGroupOrder до вызова этих функций.
    const fixtures: { o: GroupId[]; h: GroupId[] }[] = [
      { o: order('backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed'), h: [] },
      { o: order('backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed'), h: ['inProgress'] },
      { o: order('backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed'), h: ['inProgress', 'orgIntentions'] },
      { o: order('backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed'), h: ['focus'] },
      { o: order('backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed'), h: ['focus', 'inProgress'] },
      { o: order('backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed'), h: ['backlog', 'inProgress', 'orgIntentions', 'delegated', 'completed'] },
      // Дискриминирующая пара: скрытая группа, выше которой только скрытая.
      { o: order('inProgress', 'focus', 'backlog'), h: ['inProgress', 'focus'] },
      { o: order('focus'), h: [] },
      // Пустой порядок сюда не кладём: тело цикла по id не выполнилось бы ни разу
      // и фикстура не дала бы ни одного утверждения. Он покрыт отдельным тестом.
    ];
    const directions: MoveDirection[] = ['up', 'down'];

    for (const { o, h } of fixtures) {
      for (const id of o) {
        for (const direction of directions) {
          const moved = moveGroup(o, id, direction, h);
          const changed = JSON.stringify(moved) !== JSON.stringify(o);
          expect(
            canMoveGroup(o, id, direction, h),
            `${id} ${direction} in [${o.join(',')}] hidden [${h.join(',')}]`
          ).toBe(changed);
        }
      }
    }
  });

  it('move returns the order unchanged whenever the arrow is disabled', () => {
    // видимая строка: сверху только скрытые
    const visibleCase = order('inProgress', 'orgIntentions', 'focus');
    const visibleHidden: GroupId[] = ['inProgress', 'orgIntentions'];
    expect(canMoveGroup(visibleCase, 'focus', 'up', visibleHidden)).toBe(false);
    expect(moveGroup(visibleCase, 'focus', 'up', visibleHidden)).toEqual(visibleCase);

    // скрытая строка: край списка
    const hiddenCase = order('focus', 'backlog');
    const hiddenHidden: GroupId[] = ['focus'];
    expect(canMoveGroup(hiddenCase, 'focus', 'up', hiddenHidden)).toBe(false);
    expect(moveGroup(hiddenCase, 'focus', 'up', hiddenHidden)).toEqual(hiddenCase);
  });

  it('move does not mutate its input array', () => {
    const input = order('backlog', 'inProgress', 'focus');
    const snapshot = [...input];
    const hiddenInput: GroupId[] = ['inProgress'];
    const hiddenSnapshot = [...hiddenInput];

    const result = moveGroup(input, 'focus', 'up', hiddenInput);

    expect(input).toEqual(snapshot);
    expect(hiddenInput).toEqual(hiddenSnapshot);
    expect(result).not.toBe(input);
  });

  it('move returns a new array even when the move is not possible', () => {
    const input = order('focus');
    const result = moveGroup(input, 'focus', 'up', []);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('neither function throws when the order or the hidden set is not an array', () => {
    // data.json правится руками (Decision 6); санация hiddenGroups живёт в Task 03,
    // но этот модуль обязан не падать сам по себе.
    const junk = [null, undefined, {}, 'focus', 42];
    for (const bad of junk) {
      const badOrder = bad as unknown as GroupId[];
      expect(canMoveGroup(badOrder, 'focus', 'up', [])).toBe(false);
      expect(canMoveGroup(badOrder, 'focus', 'down', [])).toBe(false);
      expect(moveGroup(badOrder, 'focus', 'up', [])).toEqual([]);

      const badHidden = bad as unknown as GroupId[];
      const good = order('backlog', 'focus');
      expect(canMoveGroup(good, 'focus', 'up', badHidden)).toBe(false);
      expect(moveGroup(good, 'focus', 'up', badHidden)).toEqual(good);
    }
  });

  it('an id absent from the order cannot move and leaves the order unchanged', () => {
    const input = order('backlog', 'focus', 'inProgress');
    expect(canMoveGroup(input, 'completed', 'up', [])).toBe(false);
    expect(canMoveGroup(input, 'completed', 'down', [])).toBe(false);
    expect(moveGroup(input, 'completed', 'up', [])).toEqual(input);
    expect(moveGroup(input, 'completed', 'down', ['completed'])).toEqual(input);
  });
});

describe('sanitizeHiddenGroups', () => {
  it('keeps a valid list as an array of the same ids', () => {
    expect(sanitizeHiddenGroups(['focus', 'completed'])).toEqual(['focus', 'completed']);
  });

  it('returns an empty list for anything that is not an array', () => {
    // Ровно те значения, на которых спред в попапе настроек падал бы до всякой логики стрелок.
    for (const bad of [null, undefined, {}, 'focus', 42, true]) {
      expect(sanitizeHiddenGroups(bad)).toEqual([]);
    }
  });

  it('collapses duplicates', () => {
    expect(sanitizeHiddenGroups(['focus', 'focus', 'backlog', 'focus'])).toEqual(['focus', 'backlog']);
  });

  it('drops ids that are not known groups', () => {
    expect(sanitizeHiddenGroups(['focus', 'nope', 42, null, '__proto__', 'constructor'])).toEqual(['focus']);
  });

  it('returns a new array, never the input instance', () => {
    const input: unknown[] = ['focus'];
    expect(sanitizeHiddenGroups(input)).not.toBe(input);
  });
});

describe('moveGroupWithinPresent', () => {
  const ALL = order('backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed');

  it('behaves exactly like moveGroup when every id is present', () => {
    for (const id of ALL) {
      for (const dir of ['up', 'down'] as MoveDirection[]) {
        const hidden: GroupId[] = ['inProgress'];
        expect(moveGroupWithinPresent(ALL, ALL, id, dir, hidden))
          .toEqual(moveGroup(ALL, id, dir, hidden));
      }
    }
  });

  it('a visible row steps over a slot with no row, which keeps its position', () => {
    // delegated есть в порядке, но объекта группы нет — строки у него не будет.
    const present = order('backlog', 'focus', 'inProgress', 'orgIntentions', 'completed');
    const result = moveGroupWithinPresent(ALL, present, 'orgIntentions', 'down', []);
    expect(result).toEqual(['backlog', 'focus', 'inProgress', 'completed', 'delegated', 'orgIntentions']);
    expect(result.indexOf('delegated')).toBe(4);
  });

  it('a hidden row also steps over a slot with no row', () => {
    // Без этого первое нажатие менялось бы местами с ненарисованным слотом и выглядело мёртвым.
    const present = order('backlog', 'focus', 'inProgress', 'orgIntentions', 'completed');
    const result = moveGroupWithinPresent(ALL, present, 'orgIntentions', 'down', ['orgIntentions']);
    expect(result).toEqual(['backlog', 'focus', 'inProgress', 'completed', 'delegated', 'orgIntentions']);
  });

  it('returns an unchanged copy when there is nowhere to move', () => {
    const result = moveGroupWithinPresent(ALL, ALL, 'backlog', 'up', []);
    expect(result).toEqual(ALL);
    expect(result).not.toBe(ALL);
  });
});
