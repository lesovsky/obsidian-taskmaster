import { writable } from 'svelte/store';
import type { GroupId, Status } from '../data/types';

type DeleteToast = {
  type: 'delete';
  taskId: string;
  groupId: GroupId;
  boardId: string;
  position: number;
  timerId: ReturnType<typeof setTimeout>;
  expiresAt: number;
};

type CompleteToast = {
  type: 'complete';
  taskId: string;
  groupId: GroupId;
  boardId: string;
  position: number;
  timerId: ReturnType<typeof setTimeout>;
  expiresAt: number;
  previousStatus: Status;
  previousCompletedAt: string;
};

export type Toast = DeleteToast | CompleteToast;

interface UiState {
  activeBoardId: string;
  toasts: Toast[];
}

export const uiStore = writable<UiState>({
  activeBoardId: '',
  toasts: [],
});
