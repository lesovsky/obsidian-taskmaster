<script lang="ts">
  import type { Task } from '../data/types';
  import { t } from '../i18n';
  import { dataStore } from '../stores/dataStore';
  import { formatDeadlineShort } from '../utils/dateFormat';

  export let task: Task;
  export let onClick: () => void;
  export let onDelete: () => void;
  export let onComplete: () => void;
  export let isInCompletedGroup: boolean = false;

  const priorityIcons: Record<string, string> = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  };

  const statusIcons: Record<string, string> = {
    new: '📋',
    inProgress: '🛠️',
    waiting: '⏳',
    meeting: '📞',
    completed: '✅',
  };

  $: icon = priorityIcons[task.priority] ?? '';
  $: statusIcon = statusIcons[task.status] ?? '';
  $: isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
  $: isCompact = $dataStore.settings.cardView === 'compact';
</script>

{#if isCompact}
  <div
    class="tm-task-card tm-task-card--compact"
    class:tm-task-card--overdue={isOverdue}
    data-task-id={task.id}
    on:click={onClick}
    on:keydown={(e) => e.key === 'Enter' && onClick()}
    role="button"
    tabindex="0"
  >
    <div class="tm-task-card__icons">
      <span class="tm-task-card__priority">{icon}</span>
      <span class="tm-task-card__status">{statusIcon}</span>
    </div>
    {#if task.who}
      <div class="tm-task-card__who-compact" title={task.who}>{task.who}</div>
    {/if}
    <div class="tm-task-card__what-compact" title={task.what}>{task.what}</div>
    {#if task.deadline}
      <span class="tm-task-card__deadline-compact" class:tm-task-card__deadline--overdue={isOverdue}>
        📅 {formatDeadlineShort(task.deadline)}
      </span>
    {/if}
    <button
      class="tm-task-card__complete-compact clickable-icon"
      class:tm-task-card__complete--done={isInCompletedGroup}
      on:click|stopPropagation={onComplete}
      disabled={isInCompletedGroup}
      title={isInCompletedGroup ? $t('taskCard.alreadyCompleted') : $t('taskCard.completeTask')}
    >☑</button>
    <button
      class="tm-task-card__delete-compact clickable-icon"
      on:click|stopPropagation={onDelete}
      title={$t('taskCard.deleteTask')}
    >✕</button>
  </div>
{:else}
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
      class="tm-task-card__complete clickable-icon"
      class:tm-task-card__complete--done={isInCompletedGroup}
      on:click|stopPropagation={onComplete}
      disabled={isInCompletedGroup}
      title={isInCompletedGroup ? $t('taskCard.alreadyCompleted') : $t('taskCard.completeTask')}
    >☑</button>
    <button
      class="tm-task-card__delete clickable-icon"
      on:click|stopPropagation={onDelete}
      title={$t('taskCard.deleteTask')}
    >✕</button>
  </div>
{/if}
