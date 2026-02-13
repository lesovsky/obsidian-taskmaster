<script lang="ts">
  import type { Group, GroupId, Task } from '../data/types';
  import { GROUP_LABELS } from '../data/types';
  import { toggleGroupCollapsed } from '../stores/dataStore';
  import { useSortable } from './useSortable';
  import EmptyState from './EmptyState.svelte';
  import TaskCard from './TaskCard.svelte';

  export let groupId: GroupId;
  export let group: Group;
  export let boardId: string;
  export let tasks: Record<string, Task>;
  export let onAdd: (() => void) | null = null;
  export let onCardClick: ((task: Task) => void) | null = null;
  export let onCardDelete: ((taskId: string) => void) | null = null;
  export let onSettings: (() => void) | null = null;

  $: collapsed = group.collapsed;
  $: taskCount = group.taskIds.length;
  $: wipLimit = group.wipLimit;
  $: overLimit = wipLimit !== null && taskCount > wipLimit;
  $: counterText = wipLimit !== null ? `${taskCount}/${wipLimit}` : `${taskCount}`;
  $: groupTasks = group.taskIds
    .map(id => tasks[id])
    .filter((t): t is Task => !!t);

  function toggle() {
    toggleGroupCollapsed(boardId, groupId);
  }
</script>

<div class="tm-collapsible-group">
  <button class="tm-collapsible-group__header" class:tm-collapsible-group__header--over={overLimit} on:click={toggle}>
    <span class="tm-collapsible-group__arrow" class:tm-collapsible-group__arrow--open={!collapsed}>&#9654;</span>
    <span class="tm-collapsible-group__title">{GROUP_LABELS[groupId]}</span>
    <span class="tm-collapsible-group__count" class:tm-collapsible-group__count--over={overLimit}>({counterText})</span>
    <div class="tm-collapsible-group__spacer"></div>
    {#if onSettings}
      <span
        class="tm-collapsible-group__settings clickable-icon"
        on:click|stopPropagation={onSettings}
        on:keydown|stopPropagation
        role="button"
        tabindex="0"
        title="Настройки группы"
      >&#9881;</span>
    {/if}
    {#if onAdd}
      <span
        class="tm-collapsible-group__add clickable-icon"
        on:click|stopPropagation={onAdd}
        on:keydown|stopPropagation
        role="button"
        tabindex="0"
        title="Добавить задачу"
      >+</span>
    {/if}
  </button>
  {#if !collapsed}
    <div class="tm-collapsible-group__body" data-group-id={groupId} use:useSortable={{ groupId }}>
      {#if groupTasks.length === 0}
        <EmptyState {groupId} />
      {:else}
        {#each groupTasks as task (task.id)}
          <TaskCard
            {task}
            onClick={() => onCardClick && onCardClick(task)}
            onDelete={() => onCardDelete && onCardDelete(task.id)}
          />
        {/each}
      {/if}
    </div>
  {/if}
</div>
