<script lang="ts">
  import type { Task } from '../data/types';

  export let task: Task;
  export let onClick: () => void;
  export let onDelete: () => void;

  const priorityIcons: Record<string, string> = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  };

  const statusIcons: Record<string, string> = {
    new: '📋',
    inProgress: '🛠️',
    waiting: '⏳',
    completed: '✅',
  };

  $: icon = priorityIcons[task.priority] ?? '';
  $: statusIcon = statusIcons[task.status] ?? '';
  $: isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
</script>

<div
  class="tm-task-card"
  class:tm-task-card--overdue={isOverdue}
  data-task-id={task.id}
  on:click={onClick}
  on:keydown={(e) => e.key === 'Enter' && onClick()}
  role="button"
  tabindex="0"
>
  <div class="tm-task-card__top">
    <span class="tm-task-card__priority">{icon}</span>
    <span class="tm-task-card__status">{statusIcon}</span>
    {#if task.deadline}
      <span class="tm-task-card__deadline" class:tm-task-card__deadline--overdue={isOverdue}>
        📅 {task.deadline}
      </span>
    {/if}
  </div>
  <div class="tm-task-card__what">{task.what}</div>
  {#if task.who}
    <div class="tm-task-card__who">👤 {task.who}</div>
  {/if}
  <button
    class="tm-task-card__delete clickable-icon"
    on:click|stopPropagation={onDelete}
    title="Удалить задачу"
  >✕</button>
</div>
