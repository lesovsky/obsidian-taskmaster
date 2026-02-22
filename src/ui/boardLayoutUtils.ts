import type { GroupId } from '../data/types';

// ВАЖНО: зависит от фиксированного порядка групп.
// При появлении настраиваемого порядка — переработать.
export function computeGroupClasses(groups: { id: GroupId; fullWidth: boolean }[]): Record<GroupId, string> {
  const classes: Record<GroupId, string> = {} as Record<GroupId, string>;
  let i = 0;
  while (i < groups.length) {
    const g = groups[i];
    if (g.fullWidth) {
      classes[g.id] = 'tm-board-layout__group--full';
      i++;
    } else {
      const next = groups[i + 1];
      if (next && !next.fullWidth) {
        classes[g.id] = 'tm-board-layout__group--half';
        classes[next.id] = 'tm-board-layout__group--half';
        i += 2;
      } else {
        classes[g.id] = 'tm-board-layout__group--half-alone';
        i++;
      }
    }
  }
  return classes;
}
