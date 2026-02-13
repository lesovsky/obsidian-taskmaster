import { writable } from 'svelte/store';

interface Toast {
  taskId: string;
  groupId: string;
  boardId: string;
  position: number;
  timerId: ReturnType<typeof setTimeout>;
  expiresAt: number;
}

interface UiState {
  activeBoardId: string;
  toasts: Toast[];
}

export const uiStore = writable<UiState>({
  activeBoardId: '',
  toasts: [],
});
