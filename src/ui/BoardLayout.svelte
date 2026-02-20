<script lang="ts">
  import type { Board, GroupId, Task } from '../data/types';
  import { t } from '../i18n';
  import { addTask, updateTask, removeTaskFromGroup, restoreTaskToGroup, finalDeleteTask, updateGroupSettings, quickCompleteTask, undoQuickComplete } from '../stores/dataStore';
  import { dataStore } from '../stores/dataStore';
  import { uiStore } from '../stores/uiStore';
  import { pluginStore } from '../stores/pluginStore';
  import { TaskModal } from '../modals/TaskModal';
  import { get } from 'svelte/store';
  import TaskGroup from './TaskGroup.svelte';
  import CollapsibleGroup from './CollapsibleGroup.svelte';
  import DeleteToast from './DeleteToast.svelte';
  import GroupSettingsPopup from './GroupSettingsPopup.svelte';
  import NotesSection from './NotesSection.svelte';

  export let board: Board;
  export let tasks: Record<string, Task>;

  let settingsGroupId: GroupId | null = null;
  $: hidden = new Set(board.hiddenGroups);

  function openGroupSettings(groupId: GroupId) {
    settingsGroupId = groupId;
  }

  function closeGroupSettings() {
    settingsGroupId = null;
  }

  function saveGroupSettings(fields: { wipLimit: number | null; completedRetentionDays: number | null }) {
    if (!settingsGroupId) return;
    updateGroupSettings(board.id, settingsGroupId, fields);
    settingsGroupId = null;
  }

  const MAX_TOASTS = 3;

  function openCreateModal(groupId: GroupId) {
    const plugin = get(pluginStore);
    if (!plugin) return;
    const data = get(dataStore);
    new TaskModal(
      plugin.app,
      groupId,
      data.settings.defaultPriority,
      (task) => addTask(task, groupId),
    ).open();
  }

  function openEditModal(task: Task, groupId: GroupId) {
    const plugin = get(pluginStore);
    if (!plugin) return;
    const data = get(dataStore);
    new TaskModal(
      plugin.app,
      groupId,
      data.settings.defaultPriority,
      (updated) => updateTask(updated),
      task,
      () => handleDelete(task.id, groupId),
    ).open();
  }

  function evictOldestToastIfNeeded(): void {
    uiStore.update(ui => {
      if (ui.toasts.length >= MAX_TOASTS) {
        const oldest = ui.toasts[0];
        clearTimeout(oldest.timerId);
        if (oldest.type === 'delete') {
          finalDeleteTask(oldest.taskId);
        }
        ui.toasts = ui.toasts.slice(1);
      }
      return ui;
    });
  }

  function handleDelete(taskId: string, groupId: GroupId) {
    const result = removeTaskFromGroup(taskId, groupId, board.id);
    if (!result) return;

    evictOldestToastIfNeeded();

    const expiresAt = Date.now() + 7000;
    const timerId = setTimeout(() => {
      finalDeleteTask(taskId);
      uiStore.update(ui => ({
        ...ui,
        toasts: ui.toasts.filter(t => t.taskId !== taskId),
      }));
    }, 7000);

    uiStore.update(ui => ({
      ...ui,
      toasts: [
        ...ui.toasts,
        {
          type: 'delete',
          taskId,
          groupId,
          boardId: board.id,
          position: result.position,
          timerId,
          expiresAt,
        },
      ],
    }));
  }

  function handleComplete(taskId: string, sourceGroupId: GroupId) {
    if (sourceGroupId === 'completed') return;

    const result = quickCompleteTask(taskId, sourceGroupId, board.id);
    if (!result) return;

    evictOldestToastIfNeeded();

    const expiresAt = Date.now() + 7000;
    const timerId = setTimeout(() => {
      uiStore.update(ui => ({
        ...ui,
        toasts: ui.toasts.filter(t => t.taskId !== taskId),
      }));
    }, 7000);

    uiStore.update(ui => ({
      ...ui,
      toasts: [
        ...ui.toasts,
        {
          type: 'complete',
          taskId,
          groupId: sourceGroupId,
          boardId: board.id,
          position: result.position,
          timerId,
          expiresAt,
          previousStatus: result.previousStatus,
          previousCompletedAt: result.previousCompletedAt,
        },
      ],
    }));
  }

  function handleUndo(taskId: string) {
    const ui = get(uiStore);
    const toast = ui.toasts.find(t => t.taskId === taskId);
    if (!toast) return;

    clearTimeout(toast.timerId);

    if (toast.type === 'delete') {
      restoreTaskToGroup(taskId, toast.groupId, toast.boardId, toast.position);
    } else {
      undoQuickComplete(taskId, toast.groupId, toast.boardId, toast.position, toast.previousStatus, toast.previousCompletedAt);
    }

    uiStore.update(u => ({
      ...u,
      toasts: u.toasts.filter(t => t.taskId !== taskId),
    }));
  }

  function handleToastExpire(taskId: string) {
    uiStore.update(ui => ({
      ...ui,
      toasts: ui.toasts.filter(t => t.taskId !== taskId),
    }));
  }
</script>

<div class="tm-board-layout">
  {#if !hidden.has('backlog')}
    <div class="tm-board-layout__collapsible">
      <CollapsibleGroup
        groupId="backlog"
        group={board.groups.backlog}
        boardId={board.id}
        {tasks}
        onAdd={() => openCreateModal('backlog')}
        onCardClick={(task) => openEditModal(task, 'backlog')}
        onCardDelete={(taskId) => handleDelete(taskId, 'backlog')}
        onCardComplete={(taskId) => handleComplete(taskId, 'backlog')}
        onSettings={() => openGroupSettings('backlog')}
      />
    </div>
  {/if}

  {#if !hidden.has('focus') || !hidden.has('inProgress')}
    <!-- show row if at least one is visible; --two only when both are visible -->
    <div
      class="tm-board-layout__row"
      class:tm-board-layout__row--two={!hidden.has('focus') && !hidden.has('inProgress')}
    >
      {#if !hidden.has('focus')}
        <TaskGroup
          groupId="focus"
          group={board.groups.focus}
          {tasks}
          onAdd={() => openCreateModal('focus')}
          onCardClick={(task) => openEditModal(task, 'focus')}
          onCardDelete={(taskId) => handleDelete(taskId, 'focus')}
          onCardComplete={(taskId) => handleComplete(taskId, 'focus')}
          onSettings={() => openGroupSettings('focus')}
        />
      {/if}
      {#if !hidden.has('inProgress')}
        <TaskGroup
          groupId="inProgress"
          group={board.groups.inProgress}
          {tasks}
          onAdd={() => openCreateModal('inProgress')}
          onCardClick={(task) => openEditModal(task, 'inProgress')}
          onCardDelete={(taskId) => handleDelete(taskId, 'inProgress')}
          onCardComplete={(taskId) => handleComplete(taskId, 'inProgress')}
          onSettings={() => openGroupSettings('inProgress')}
        />
      {/if}
    </div>
  {/if}

  {#if !hidden.has('orgIntentions')}
    <div class="tm-board-layout__row">
      <TaskGroup
        groupId="orgIntentions"
        group={board.groups.orgIntentions}
        {tasks}
        onAdd={() => openCreateModal('orgIntentions')}
        onCardClick={(task) => openEditModal(task, 'orgIntentions')}
        onCardDelete={(taskId) => handleDelete(taskId, 'orgIntentions')}
        onCardComplete={(taskId) => handleComplete(taskId, 'orgIntentions')}
        onSettings={() => openGroupSettings('orgIntentions')}
      />
    </div>
  {/if}

  {#if !hidden.has('delegated')}
    <div class="tm-board-layout__row">
      <TaskGroup
        groupId="delegated"
        group={board.groups.delegated}
        {tasks}
        onAdd={() => openCreateModal('delegated')}
        onCardClick={(task) => openEditModal(task, 'delegated')}
        onCardDelete={(taskId) => handleDelete(taskId, 'delegated')}
        onCardComplete={(taskId) => handleComplete(taskId, 'delegated')}
        onSettings={() => openGroupSettings('delegated')}
      />
    </div>
  {/if}

  {#if !hidden.has('completed')}
    <div class="tm-board-layout__collapsible">
      <CollapsibleGroup
        groupId="completed"
        group={board.groups.completed}
        boardId={board.id}
        {tasks}
        onAdd={null}
        onCardClick={(task) => openEditModal(task, 'completed')}
        onCardDelete={(taskId) => handleDelete(taskId, 'completed')}
        onCardComplete={(taskId) => handleComplete(taskId, 'completed')}
        onSettings={() => openGroupSettings('completed')}
      />
    </div>
  {/if}

  <div class="tm-board-layout__collapsible">
    <NotesSection
      boardId={board.id}
      notes={board.notes}
      collapsed={board.notesCollapsed}
    />
  </div>
</div>

{#if $uiStore.toasts.length > 0}
  <div class="tm-toasts">
    {#each $uiStore.toasts as toast (toast.taskId)}
      <DeleteToast
        message={toast.type === 'delete'
          ? `${$t('toast.deleted')} ${tasks[toast.taskId]?.what ?? $t('fallback.task')}`
          : `${$t('toast.completed')} ${tasks[toast.taskId]?.what ?? $t('fallback.task')}`}
        expiresAt={toast.expiresAt}
        onUndo={() => handleUndo(toast.taskId)}
        onExpire={() => handleToastExpire(toast.taskId)}
      />
    {/each}
  </div>
{/if}

{#if settingsGroupId}
  <GroupSettingsPopup
    groupId={settingsGroupId}
    group={board.groups[settingsGroupId]}
    onSave={saveGroupSettings}
    onClose={closeGroupSettings}
  />
{/if}
