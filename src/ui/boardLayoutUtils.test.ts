import { describe, it, expect } from 'vitest';
import { computeGroupClasses } from './boardLayoutUtils';
import type { GroupId } from '../data/types';

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
});
