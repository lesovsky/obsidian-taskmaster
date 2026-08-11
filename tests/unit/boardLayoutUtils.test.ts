import { describe, it, expect } from 'vitest';
import { computeGroupClasses } from '../../src/ui/boardLayoutUtils';
import type { GroupId } from '../../src/data/types';

function g(id: GroupId, fullWidth: boolean) {
  return { id, fullWidth };
}

describe('computeGroupClasses', () => {
  it('все группы fullWidth:true → все получают --full', () => {
    const input = [
      g('backlog', true), g('focus', true), g('inProgress', true),
      g('orgIntentions', true), g('delegated', true), g('completed', true),
    ];
    const result = computeGroupClasses(input);
    for (const { id } of input) {
      expect(result[id]).toBe('tm-board-layout__group--full');
    }
  });

  it('все 6 групп fullWidth:false → 3 пары --half', () => {
    const input = [
      g('backlog', false), g('focus', false), g('inProgress', false),
      g('orgIntentions', false), g('delegated', false), g('completed', false),
    ];
    const result = computeGroupClasses(input);
    for (const { id } of input) {
      expect(result[id]).toBe('tm-board-layout__group--half');
    }
  });

  it('[half, half, half] → первые два --half, третий --half-alone', () => {
    const input = [g('focus', false), g('inProgress', false), g('orgIntentions', false)];
    const result = computeGroupClasses(input);
    expect(result['focus']).toBe('tm-board-layout__group--half');
    expect(result['inProgress']).toBe('tm-board-layout__group--half');
    expect(result['orgIntentions']).toBe('tm-board-layout__group--half-alone');
  });

  it('[full, half, full, half] → оба half становятся --half-alone', () => {
    const input = [
      g('backlog', true),
      g('focus', false),
      g('orgIntentions', true),
      g('delegated', false),
    ];
    const result = computeGroupClasses(input);
    expect(result['backlog']).toBe('tm-board-layout__group--full');
    expect(result['focus']).toBe('tm-board-layout__group--half-alone');
    expect(result['orgIntentions']).toBe('tm-board-layout__group--full');
    expect(result['delegated']).toBe('tm-board-layout__group--half-alone');
  });

  it('одна видимая группа с fullWidth:false → --half-alone', () => {
    const input = [g('focus', false)];
    const result = computeGroupClasses(input);
    expect(result['focus']).toBe('tm-board-layout__group--half-alone');
  });

  // Ниже — произвольный (недефолтный) порядок групп. Эти случаи закрепляют, что функция
  // считает по позиции в массиве, а не по идентификатору группы: массив приходит уже
  // отсортированным по board.groupOrder, и регрессия «привязаться к идентификатору» здесь падает.
  // Что они НЕ проверяют: что BoardLayout действительно подаёт сюда массив в порядке
  // board.groupOrder — компонент здесь не рендерится (vitest environment: 'node').

  it('произвольный порядок — соседние half образуют пару', () => {
    const input = [
      g('completed', true),
      g('focus', false),
      g('inProgress', false),
      g('backlog', true),
    ];
    const result = computeGroupClasses(input);
    expect(result['completed']).toBe('tm-board-layout__group--full');
    expect(result['focus']).toBe('tm-board-layout__group--half');
    expect(result['inProgress']).toBe('tm-board-layout__group--half');
    expect(result['backlog']).toBe('tm-board-layout__group--full');
  });

  it('перестановка разрывает пару — оба half становятся alone', () => {
    // Те же три группы, что и в дефолтной раскладке, но backlog вклинился между half-парой.
    const input = [g('focus', false), g('backlog', true), g('inProgress', false)];
    const result = computeGroupClasses(input);
    expect(result['focus']).toBe('tm-board-layout__group--half-alone');
    expect(result['backlog']).toBe('tm-board-layout__group--full');
    expect(result['inProgress']).toBe('tm-board-layout__group--half-alone');
  });

  // Документирующий случай, не регрессионный: проверено мутантами — он не убивает ни одного
  // мутанта, которого не убили бы уже существующие кейсы (его вход — хвост случая
  // [full, half, full, half], а ожидание дублирует кейс с одной группой). Оставлен как читаемый
  // пример «половинка последняя в произвольном порядке»; защиту от регрессий за ним не считать.
  it('произвольный порядок — одинокий half в конце', () => {
    const input = [g('completed', true), g('delegated', false)];
    const result = computeGroupClasses(input);
    expect(result['completed']).toBe('tm-board-layout__group--full');
    expect(result['delegated']).toBe('tm-board-layout__group--half-alone');
  });
});
