import Sortable from 'sortablejs';
import { get } from 'svelte/store';
import { moveTask } from '../stores/dataStore';
import { uiStore } from '../stores/uiStore';
import { showFollowUpNotice } from './followUpNotice';
import type { GroupId } from '../data/types';

/**
 * Moves a task on the active board and shows the follow-up notice when the move spawned tasks.
 * The Sortable drop handler and the test harness both go through here, so E2E covers the notice.
 */
export function moveTaskAndNotify(taskId: string, fromGroupId: GroupId, toGroupId: GroupId, newIndex: number): void {
  const spawned = moveTask(taskId, fromGroupId, toGroupId, newIndex);
  showFollowUpNotice(get(uiStore).activeBoardId, spawned.length);
}

interface SortableOptions {
  groupId: GroupId;
  disabled?: boolean;
}

export function useSortable(node: HTMLElement, opts: SortableOptions) {
  let sortable: Sortable | null = null;

  function create(options: SortableOptions) {
    try {
      sortable = new Sortable(node, {
        group: 'taskmaster',
        animation: 150,
        ghostClass: 'tm-sortable-ghost',
        chosenClass: 'tm-sortable-chosen',
        dragClass: 'tm-sortable-drag',
        draggable: '[data-task-id]',
        filter: '.tm-task-card__delete',
        preventOnFilter: false,
        disabled: options.disabled ?? false,
        onEnd(evt) {
          const fromGroupId = evt.from.dataset.groupId as GroupId;
          const toGroupId = evt.to.dataset.groupId as GroupId;
          const oldIndex = evt.oldIndex ?? 0;
          const newIndex = evt.newIndex ?? 0;
          const taskId = evt.item.dataset.taskId;
          if (!taskId) return;
          if (fromGroupId === toGroupId && oldIndex === newIndex) return;

          // Revert DOM — let Svelte re-render
          evt.item.remove();
          const ref = evt.from.children[oldIndex];
          if (ref) {
            evt.from.insertBefore(evt.item, ref);
          } else {
            evt.from.appendChild(evt.item);
          }

          moveTaskAndNotify(taskId, fromGroupId, toGroupId, newIndex);
        },
      });
    } catch (e) {
      console.error('TaskMaster: Failed to initialize SortableJS', e);
    }
  }

  create(opts);

  return {
    update(newOpts: SortableOptions) {
      if (sortable) { sortable.destroy(); sortable = null; }
      create(newOpts);
    },
    destroy() {
      if (sortable) { sortable.destroy(); sortable = null; }
    },
  };
}
