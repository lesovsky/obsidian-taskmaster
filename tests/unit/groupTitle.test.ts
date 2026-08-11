import { describe, it, expect } from 'vitest';
import { resolveGroupTitle } from '../../src/ui/groupTitle';

describe('resolveGroupTitle', () => {
  it('empty stored title → default label', () => {
    expect(resolveGroupTitle('', 'Backlog')).toBe('Backlog');
  });

  it('whitespace-only stored title → default label', () => {
    expect(resolveGroupTitle('   ', 'Backlog')).toBe('Backlog');
    expect(resolveGroupTitle('\t', 'Backlog')).toBe('Backlog');
    expect(resolveGroupTitle('\n', 'Backlog')).toBe('Backlog');
    expect(resolveGroupTitle(' \t\n ', 'Backlog')).toBe('Backlog');
  });

  it('non-empty stored title wins over default label', () => {
    expect(resolveGroupTitle('Мои задачи', 'Backlog')).toBe('Мои задачи');
  });

  it('stored title with surrounding whitespace counts as non-empty and is returned as-is', () => {
    expect(resolveGroupTitle('  Мои задачи  ', 'Backlog')).toBe('  Мои задачи  ');
  });

  it('default label is returned unmodified', () => {
    expect(resolveGroupTitle('', 'В работе')).toBe('В работе');
    expect(resolveGroupTitle('', '  Организационные намерения  ')).toBe('  Организационные намерения  ');
  });
});
