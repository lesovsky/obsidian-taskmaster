import type { LanguageSetting } from '../i18n/types';

export type Priority = 'low' | 'medium' | 'high';
export type Status = 'new' | 'inProgress' | 'waiting' | 'meeting' | 'completed';
export type GroupId = 'backlog' | 'focus' | 'inProgress' | 'orgIntentions' | 'delegated' | 'completed';
export type CardView = 'default' | 'compact';
export type CardLayout = 'single' | 'multi';

export const GROUP_IDS: GroupId[] = ['backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed'];

export interface FollowUp {
  id: string; // UUID of the item itself
  text: string; // trimmed, 1..200 characters
  createdTaskId: string; // '' = pending; otherwise the id of the task spawned from this item
}

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
  followUps: FollowUp[]; // at most 20 items
}

export interface Group {
  taskIds: string[];
  wipLimit: number | null;
  collapsed: boolean;
  completedRetentionDays: number | null;
  fullWidth: boolean; // true = полная ширина, false = половина
  title: string; // user-defined name of this group on this board (not Board.title); '' = use the default localized name
}

export interface Board {
  id: string;
  title: string;
  subtitle: string;
  groups: Record<GroupId, Group>;
  notes: string;
  notesCollapsed: boolean;
  notesHidden: boolean;
  hiddenGroups: GroupId[];
  groupOrder: GroupId[]; // render order of the groups on this board; always a permutation of GROUP_IDS
}

export interface Settings {
  language: LanguageSetting;
  defaultPriority: Priority;
  cardView: CardView;
  cardLayout: CardLayout;
}

export interface PluginData {
  version: number;
  settings: Settings;
  boards: Board[];
  tasks: Record<string, Task>;
}
