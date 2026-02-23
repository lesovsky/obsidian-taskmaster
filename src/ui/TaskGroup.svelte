<script lang="ts">
  import type { Group, GroupId, Task } from '../data/types';
  import { useSortable } from './useSortable';
  import { dataStore } from '../stores/dataStore';
  import GroupHeader from './GroupHeader.svelte';
  import EmptyState from './EmptyState.svelte';
  import TaskCard from './TaskCard.svelte';

  export let groupId: GroupId;
  export let group: Group;
  export let tasks: Record<string, Task>;
  export let onAdd: () => void;
  export let onCardClick: (task: Task) => void;
  export let onCardDelete: (taskId: string) => void;
  export let onCardComplete: ((taskId: string) => void) | null = null;
  export let onSettings: (() => void) | null = null;

  $: groupTasks = group.taskIds
    .map(id => tasks[id])
    .filter((t): t is Task => !!t);
  $: cardLayout = $dataStore.settings.cardLayout;
  $: isMulti = cardLayout === 'multi';
  $: columns = isMulti ? (group.fullWidth ? 4 : 2) : 1;
</script>

<div class="tm-task-group">
  <GroupHeader {groupId} {group} {onAdd} {onSettings} />
  <div
    class="tm-task-group__body"
    class:tm-task-group__body--multi={isMulti}
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
          onClick={() => onCardClick(task)}
          onDelete={() => onCardDelete(task.id)}
          onComplete={() => onCardComplete && onCardComplete(task.id)}
          isInCompletedGroup={groupId === 'completed'}
        />
      {/each}
    {/if}
  </div>
</div>
