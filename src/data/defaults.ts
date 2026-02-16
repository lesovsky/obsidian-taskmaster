import type { Board, Group, GroupId, PluginData, Settings } from './types';
import { GROUP_IDS } from './types';

export function createDefaultGroup(): Group {
  return {
    taskIds: [],
    wipLimit: null,
    collapsed: false,
    completedRetentionDays: null,
  };
}

export function createDefaultBoard(title = 'New board'): Board {
  const groups = {} as Record<GroupId, Group>;
  for (const id of GROUP_IDS) {
    groups[id] = createDefaultGroup();
  }
  groups.backlog.collapsed = true;
  groups.completed.collapsed = true;
  groups.completed.completedRetentionDays = 30;

  return {
    id: crypto.randomUUID(),
    title,
    subtitle: '',
    groups,
  };
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  defaultPriority: 'medium',
  cardView: 'default',
};

export const DEFAULT_DATA: PluginData = {
  version: 2,
  settings: { ...DEFAULT_SETTINGS },
  boards: [createDefaultBoard('My Project')],
  tasks: {},
};
