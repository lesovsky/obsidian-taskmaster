import type { LanguageSetting } from '../i18n/types';

export type Priority = 'low' | 'medium' | 'high';
export type Status = 'new' | 'inProgress' | 'waiting' | 'meeting' | 'completed';
export type GroupId = 'backlog' | 'focus' | 'inProgress' | 'orgIntentions' | 'delegated' | 'completed';
export type CardView = 'default' | 'compact';

export const GROUP_IDS: GroupId[] = ['backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed'];

export interface Task {
  id: string;
  what: string;
  why: string;
  who: string;
  deadline: string;
  createdAt: string;
  completedAt: string;
  priority: Priority;
  status: Status;
}

export interface Group {
  taskIds: string[];
  wipLimit: number | null;
  collapsed: boolean;
  completedRetentionDays: number | null;
  fullWidth: boolean; // true = полная ширина, false = половина
}

export interface Board {
  id: string;
  title: string;
  subtitle: string;
  groups: Record<GroupId, Group>;
  notes: string;
  notesCollapsed: boolean;
  hiddenGroups: GroupId[];
}

export interface Settings {
  language: LanguageSetting;
  defaultPriority: Priority;
  cardView: CardView;
}

export interface PluginData {
  version: number;
  settings: Settings;
  boards: Board[];
  tasks: Record<string, Task>;
}
