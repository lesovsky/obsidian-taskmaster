<script lang="ts">
  import type { Board, GroupId, Task } from '../data/types';
  import { t } from '../i18n';
  import { addTask, updateTask, removeTaskFromGroup, restoreTaskToGroup, finalDeleteTask, updateGroupSettings, quickCompleteTask, undoQuickComplete, createFollowUpTasks } from '../stores/dataStore';
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
  import { computeGroupClasses } from './boardLayoutUtils';
  import { showFollowUpNotice } from './followUpNotice';

  export let board: Board;
  export let tasks: Record<string, Task>;

  let settingsGroupId: GroupId | null = null;
  $: hidden = new Set(board.hiddenGroups);

  // Порядок отрисовки берётся из board.groupOrder. Санитайзер в migration.ts гарантирует, что это
  // перестановка известных идентификаторов на каждой загрузке, но не гарантирует, что объект группы
  // существует: доску с вручную удалённым ключом группы миграция не восстанавливает. Такие
  // идентификаторы просто не рисуем — доска открывается без них.
  // Оговорка: на удалённой группе completed это не спасает. cleanupCompletedTasks (cleanup.ts:4)
  // читает board.groups.completed.completedRetentionDays фиксированным путём и падает при загрузке,
  // до всякого рендера. Лечится не здесь.
  // hasOwnProperty, а не просто board.groups[id]: доступ по ключу ходит по цепочке прототипов, и
  // идентификатор вида 'constructor' прошёл бы фильтр, заняв позицию и сдвинув order всех
  // остальных. Сегодня недостижимо — санитайзер такие ключи режет, — но задача 08 добавляет в
  // groupOrder второго писателя, и проверка не должна зависеть от чужой корректности.
  // Не Object.hasOwn: это ES2022, а проект объявляет ES2021 в tsconfig.json и esbuild.config.mjs
  // и не является desktop-only (manifest.json). Гейта на такой промах нет — tsc не читает .svelte.
  $: orderedGroups = board.groupOrder
    .filter(id => !hidden.has(id) && Object.prototype.hasOwnProperty.call(board.groups, id))
    .map(id => ({ id, fullWidth: board.groups[id].fullWidth }));

  // Классы, значения order и признак «группа рисуется» выводятся из одного и того же массива:
  // разъедься они, «кто с кем в паре» перестало бы совпадать с «кто где стоит».
  $: groupClasses = computeGroupClasses(orderedGroups);

  // Визуальный порядок задаётся свойством order на обёртках — DOM-порядок шести блоков ниже
  // остаётся неизменным, иначе Svelte пересоздал бы обёртки и уничтожил инстансы SortableJS
  // внутри них. Нумерация с 1: 0 достаётся элементам без order (см. .tm-board-layout__notes).
  $: groupStyles = Object.fromEntries(
    orderedGroups.map((g, i) => [g.id, `order: ${i + 1}`]),
  ) as Partial<Record<GroupId, string>>;

  // Условие {#if} у каждой из шести обёрток: обёртка рисуется ровно у той группы, которая попала
  // в orderedGroups, а значит получила и класс, и order. Отдельный Set, а не проверка
  // groupStyles[id] на истинность: условие не должно зависеть от формы значения — при переходе на
  // числовой order позиция 0 стала бы falsy и первая группа молча исчезла бы с доски.
  $: renderedGroups = new Set(orderedGroups.map(g => g.id));

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
      (task, spawnItemIds) => {
        addTask(task, groupId);
        spawnMarkedFollowUps(task.id, spawnItemIds);
      },
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
      (updated, spawnItemIds) => {
        updateTask(updated);
        spawnMarkedFollowUps(updated.id, spawnItemIds);
      },
      task,
      () => handleDelete(task.id, groupId),
    ).open();
  }

  // Runs after the task itself is saved: the items marked "→ to backlog" in the form.
  function spawnMarkedFollowUps(taskId: string, itemIds: string[]) {
    if (itemIds.length === 0) return;
    const spawned = createFollowUpTasks(board.id, taskId, itemIds);
    showFollowUpNotice(board.id, spawned.length);
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
          spawnedTaskIds: result.spawnedTaskIds,
        },
      ],
    }));

    showFollowUpNotice(board.id, result.spawnedTaskIds.length);
  }

  function handleUndo(taskId: string) {
    const ui = get(uiStore);
    const toast = ui.toasts.find(t => t.taskId === taskId);
    if (!toast) return;

    clearTimeout(toast.timerId);

    // Tasks whose toasts go away with this one. Undo of a completion also deletes the tasks it
    // spawned; a live delete or complete toast of one of them would push a dangling id back into a
    // group on its own Undo, so those toasts are dismissed too.
    const dismissed = new Set([taskId]);

    if (toast.type === 'delete') {
      restoreTaskToGroup(taskId, toast.groupId, toast.boardId, toast.position);
    } else {
      undoQuickComplete(taskId, toast.groupId, toast.boardId, toast.position, toast.previousStatus, toast.previousCompletedAt, toast.spawnedTaskIds);
      for (const id of toast.spawnedTaskIds) dismissed.add(id);
      for (const other of ui.toasts) {
        if (other !== toast && dismissed.has(other.taskId)) clearTimeout(other.timerId);
      }
    }

    uiStore.update(u => ({
      ...u,
      toasts: u.toasts.filter(t => !dismissed.has(t.taskId)),
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
  {#if renderedGroups.has('backlog')}
    <div class={groupClasses['backlog']} style={groupStyles['backlog']} data-group-container="backlog">
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

  {#if renderedGroups.has('focus')}
    <div class={groupClasses['focus']} style={groupStyles['focus']} data-group-container="focus">
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
    </div>
  {/if}

  {#if renderedGroups.has('inProgress')}
    <div class={groupClasses['inProgress']} style={groupStyles['inProgress']} data-group-container="inProgress">
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
    </div>
  {/if}

  {#if renderedGroups.has('orgIntentions')}
    <div class={groupClasses['orgIntentions']} style={groupStyles['orgIntentions']} data-group-container="orgIntentions">
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

  {#if renderedGroups.has('delegated')}
    <div class={groupClasses['delegated']} style={groupStyles['delegated']} data-group-container="delegated">
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

  {#if renderedGroups.has('completed')}
    <div class={groupClasses['completed']} style={groupStyles['completed']} data-group-container="completed">
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

  {#if !board.notesHidden}
    <div class="tm-board-layout__notes">
      <NotesSection
        boardId={board.id}
        notes={board.notes}
        collapsed={board.notesCollapsed}
      />
    </div>
  {/if}
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
