<script lang="ts">
  import type { Group, GroupId, Task } from '../data/types';
  import { t, groupLabels } from '../i18n';
  import { toggleGroupCollapsed, dataStore } from '../stores/dataStore';
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
  export let onCardComplete: ((taskId: string) => void) | null = null;
  export let onSettings: (() => void) | null = null;

  $: collapsed = group.collapsed;
  $: taskCount = group.taskIds.length;
  $: wipLimit = group.wipLimit;
  $: overLimit = wipLimit !== null && taskCount > wipLimit;
  $: counterText = wipLimit !== null ? `${taskCount}/${wipLimit}` : `${taskCount}`;
  $: groupTasks = group.taskIds
    .map(id => tasks[id])
    .filter((t): t is Task => !!t);
  $: cardLayout = $dataStore.settings.cardLayout;
  $: isMulti = cardLayout === 'multi';
  $: columns = isMulti ? (group.fullWidth ? 4 : 2) : 1;

  function toggle() {
    toggleGroupCollapsed(boardId, groupId);
  }
</script>

<div class="tm-collapsible-group">
  <button class="tm-collapsible-group__header" class:tm-collapsible-group__header--over={overLimit} on:click={toggle}>
    <span class="tm-collapsible-group__arrow" class:tm-collapsible-group__arrow--open={!collapsed}>&#9654;</span>
    <span class="tm-collapsible-group__title">{$groupLabels[groupId]}</span>
    <span class="tm-collapsible-group__count" class:tm-collapsible-group__count--over={overLimit}>({counterText})</span>
    <div class="tm-collapsible-group__spacer"></div>
    {#if onSettings}
      <span
        class="tm-collapsible-group__settings clickable-icon"
        on:click|stopPropagation={onSettings}
        on:keydown|stopPropagation
        role="button"
        tabindex="0"
        title={$t('groupHeader.settings')}
      >&#9881;</span>
    {/if}
    {#if onAdd}
      <span
        class="tm-collapsible-group__add clickable-icon"
        on:click|stopPropagation={onAdd}
        on:keydown|stopPropagation
        role="button"
        tabindex="0"
        title={$t('groupHeader.addTask')}
      >+</span>
    {/if}
  </button>
  {#if !collapsed}
    <div
      class="tm-collapsible-group__body"
      class:tm-collapsible-group__body--multi={isMulti}
      data-group-id={groupId}
      use:useSortable={{ groupId }}
      style="--tm-card-columns: {columns}"
    >
      {#if groupTasks.length === 0}
        <EmptyState {groupId} />
      {:else}
        {#each groupTasks as task (task.id)}
          <TaskCard
            {task}
            onClick={() => onCardClick && onCardClick(task)}
            onDelete={() => onCardDelete && onCardDelete(task.id)}
            onComplete={() => onCardComplete && onCardComplete(task.id)}
            isInCompletedGroup={groupId === 'completed'}
          />
        {/each}
      {/if}
    </div>
  {/if}
</div>
