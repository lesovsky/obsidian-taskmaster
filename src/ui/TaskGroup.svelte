<script lang="ts">
  import type { Group, GroupId, Task } from '../data/types';
  import { useSortable } from './useSortable';
  import GroupHeader from './GroupHeader.svelte';
  import EmptyState from './EmptyState.svelte';
  import TaskCard from './TaskCard.svelte';

  export let groupId: GroupId;
  export let group: Group;
  export let tasks: Record<string, Task>;
  export let onAdd: () => void;
  export let onCardClick: (task: Task) => void;
  export let onCardDelete: (taskId: string) => void;
  export let onSettings: (() => void) | null = null;

  $: groupTasks = group.taskIds
    .map(id => tasks[id])
    .filter((t): t is Task => !!t);
</script>

<div class="tm-task-group">
  <GroupHeader {groupId} {group} {onAdd} {onSettings} />
  <div class="tm-task-group__body" data-group-id={groupId} use:useSortable={{ groupId }}>
    {#if groupTasks.length === 0}
      <EmptyState {groupId} />
    {:else}
      {#each groupTasks as task (task.id)}
        <TaskCard
          {task}
          onClick={() => onCardClick(task)}
          onDelete={() => onCardDelete(task.id)}
        />
      {/each}
    {/if}
  </div>
</div>
