import type { GroupId } from '../data/types';
import { GROUP_IDS } from '../data/types';

/** 'up' — в сторону индекса 0, 'down' — в сторону конца массива. */
export type MoveDirection = 'up' | 'down';

/**
 * Список скрытых групп в любом виде → массив известных идентификаторов.
 *
 * Загрузка санирует `groupOrder`, но не `hiddenGroups` (см. migration.ts), а попап настроек
 * копирует это поле в локальное состояние спредом: на `null` из правленного руками data.json
 * копирование упало бы раньше, чем управление дошло бы до логики стрелок. Живёт здесь, а не
 * внутри компонента, потому что в `.svelte` логика не покрывается unit-тестами (Decision 11).
 */
export function sanitizeHiddenGroups(value: unknown): GroupId[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<GroupId>();
  for (const item of value as unknown[]) {
    const id = item as GroupId;
    // Дубликаты схлопываются, как и в sanitizeGroupOrder: попап сохраняет этот список обратно
    // в data.json, и повторы жили бы в файле вечно.
    if (GROUP_IDS.includes(id)) seen.add(id);
  }
  return [...seen];
}

/** Пара позиций для обмена. */
type Swap = { from: number; to: number };

/**
 * Позиции групп, которые меняются местами. `null` — движение невозможно.
 *
 * Обе экспортируемые функции построены на этом хелпере: «цель найдена» ⇔ «стрелка активна»,
 * поэтому предикат и сам перенос не могут разойтись. По той же причине хелпер отдаёт обе
 * позиции сразу: повторный поиск `from` в вызывающем коде был бы вторым источником правды.
 */
function findSwap(
  order: GroupId[],
  groupId: GroupId,
  direction: MoveDirection,
  hiddenGroups: GroupId[]
): Swap | null {
  // data.json правится руками (Decision 6), а санация приходит отдельным слоем.
  // Без этой проверки строковый hiddenGroups молча перешёл бы на подстроки,
  // а null уронил бы попап настроек. Отказ fail-closed: на мусорном входе обе
  // стрелки гаснут — это заметно и безопасно, в отличие от перестановки,
  // построенной на неизвестно чём.
  if (!Array.isArray(order) || !Array.isArray(hiddenGroups)) return null;

  const from = order.indexOf(groupId);
  if (from === -1) return null;

  const step = direction === 'up' ? -1 : 1;

  // Скрытая строка двигается буквально — по соседству в списке, независимо от
  // видимости соседа: иначе нельзя выбрать позицию, на которой группа появится
  // после возврата видимости.
  if (hiddenGroups.includes(groupId)) {
    const to = from + step;
    return to >= 0 && to < order.length ? { from, to } : null;
  }

  // Видимая строка перешагивает скрытые: обмен со скрытым соседом не дал бы
  // видимого изменения на доске и читался бы как сломанная кнопка.
  for (let i = from + step; i >= 0 && i < order.length; i += step) {
    if (!hiddenGroups.includes(order[i])) return { from, to: i };
  }
  return null;
}

/** Активна ли стрелка `direction` у группы `groupId`. */
export function canMoveGroup(
  order: GroupId[],
  groupId: GroupId,
  direction: MoveDirection,
  hiddenGroups: GroupId[]
): boolean {
  return findSwap(order, groupId, direction, hiddenGroups) !== null;
}

/**
 * Новый массив порядка после нажатия стрелки. Если движение невозможно —
 * возвращается копия исходного порядка. Входные массивы не мутируются.
 *
 * Исключение: если `order` пришёл не массивом, вернётся пустой массив — копировать
 * нечего. В этом единственном случае результат не равен входу, хотя предикат
 * говорит `false`, поэтому вызывающий код должен записывать результат только
 * когда `canMoveGroup` вернул `true`.
 */
export function moveGroup(
  order: GroupId[],
  groupId: GroupId,
  direction: MoveDirection,
  hiddenGroups: GroupId[]
): GroupId[] {
  const next = Array.isArray(order) ? [...order] : [];
  const swap = findSwap(order, groupId, direction, hiddenGroups);
  if (swap === null) return next;

  // Именно обмен двух позиций, а не splice: элементы между ними остаются
  // на своих индексах — это и есть семантика «перешагнуть скрытые».
  next[swap.from] = order[swap.to];
  next[swap.to] = order[swap.from];
  return next;
}

/**
 * Перестановка для попапа настроек, где часть идентификаторов может не иметь объекта группы
 * (правленный руками data.json) и потому не рисоваться строкой.
 *
 * Перестановка идёт только между нарисованными строками — слот без строки не позиция, в которую
 * пользователь может целиться, — а отсутствующие идентификаторы сохраняют свои абсолютные места
 * в порядке. Без этого стрелка у соседа такого слота выглядела бы мёртвой: обмен происходил бы,
 * а список строк не менялся. На здоровых данных `presentGroups` совпадает с `order`, и функция
 * ведёт себя ровно как `moveGroup`.
 *
 * Предикат для состояния стрелки — `canMoveGroup(presentGroups, ...)`: тот же аргумент, что
 * получает перестановка внутри, поэтому «стрелка активна» и «перенос состоялся» не разойдутся.
 *
 * Предусловие: `presentGroups` — подпоследовательность `order`. Единственный вызывающий получает
 * его фильтрацией самого `order`; на произвольной паре массивов обратная запись по слотам молча
 * потеряла бы идентификаторы.
 */
export function moveGroupWithinPresent(
  order: GroupId[],
  presentGroups: GroupId[],
  groupId: GroupId,
  direction: MoveDirection,
  hiddenGroups: GroupId[]
): GroupId[] {
  const next = Array.isArray(order) ? [...order] : [];
  if (!canMoveGroup(presentGroups, groupId, direction, hiddenGroups)) return next;

  const moved = moveGroup(presentGroups, groupId, direction, hiddenGroups);
  let i = 0;
  for (let k = 0; k < next.length; k++) {
    if (presentGroups.includes(next[k])) {
      next[k] = moved[i];
      i += 1;
    }
  }
  return next;
}
