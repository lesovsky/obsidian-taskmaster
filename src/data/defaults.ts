import type { Board, Group, GroupId, PluginData, Settings } from './types';
import { GROUP_IDS } from './types';

export const DEFAULT_FULL_WIDTH: Record<GroupId, boolean> = {
  backlog: true,
  focus: false,
  inProgress: false,
  orgIntentions: true,
  delegated: true,
  completed: true,
};

export function createDefaultGroup(groupId: GroupId): Group {
  return {
    taskIds: [],
    wipLimit: null,
    collapsed: false,
    completedRetentionDays: null,
    fullWidth: DEFAULT_FULL_WIDTH[groupId],
  };
}

export function createDefaultBoard(title = 'New board'): Board {
  const groups = {} as Record<GroupId, Group>;
  for (const id of GROUP_IDS) {
    groups[id] = createDefaultGroup(id);
  }
  groups.backlog.collapsed = true;
  groups.completed.collapsed = true;
  groups.completed.completedRetentionDays = 30;

  return {
    id: crypto.randomUUID(),
    title,
    subtitle: '',
    groups,
    notes: '',
    notesCollapsed: true,
    hiddenGroups: [],
  };
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  defaultPriority: 'medium',
  cardView: 'default',
};

export const DEFAULT_DATA: PluginData = {
  version: 5,
  settings: { ...DEFAULT_SETTINGS },
  boards: [createDefaultBoard('My Project')],
  tasks: {},
};
