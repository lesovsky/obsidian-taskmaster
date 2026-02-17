<script lang="ts">
  import type { Task, Priority, GroupId } from '../data/types';
  import { formatDate } from '../utils/dateFormat';
  import { t } from '../i18n';

  export let task: Task | null = null;
  export let groupId: GroupId;
  export let defaultPriority: Priority = 'medium';
  export let onSave: (task: Task) => void;
  export let onDelete: (() => void) | null = null;

  const isEdit = !!task;

  let what = task?.what ?? '';
  let why = task?.why ?? '';
  let who = task?.who ?? '';
  let deadline = task?.deadline ?? '';
  let priority: Priority = task?.priority ?? defaultPriority;
  let status = task?.status ?? (groupId === 'backlog' ? 'new' : 'inProgress');

  $: canSave = what.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    const saved: Task = {
      id: task?.id ?? crypto.randomUUID(),
      what: what.trim(),
      why: why.trim(),
      who: who.trim(),
      deadline,
      createdAt: task?.createdAt ?? formatDate(new Date()),
      completedAt: task?.completedAt ?? '',
      priority,
      status,
    };
    onSave(saved);
  }
</script>

<div class="tm-task-form">
  <div class="tm-task-form__field">
    <label class="tm-task-form__label" for="tm-what">{$t('form.whatLabel')}</label>
    <textarea
      id="tm-what"
      class="tm-task-form__textarea"
      bind:value={what}
      maxlength="10000"
      rows="3"
      placeholder={$t('form.whatPlaceholder')}
    ></textarea>
  </div>

  <div class="tm-task-form__field">
    <label class="tm-task-form__label" for="tm-why">{$t('form.whyLabel')}</label>
    <textarea
      id="tm-why"
      class="tm-task-form__textarea"
      bind:value={why}
      maxlength="10000"
      rows="2"
      placeholder={$t('form.whyPlaceholder')}
    ></textarea>
  </div>

  <div class="tm-task-form__row">
    <div class="tm-task-form__field tm-task-form__field--half">
      <label class="tm-task-form__label" for="tm-who">{$t('form.whoLabel')}</label>
      <input
        id="tm-who"
        class="tm-task-form__input"
        type="text"
        bind:value={who}
        maxlength="200"
        placeholder={$t('form.whoPlaceholder')}
      />
    </div>
    <div class="tm-task-form__field tm-task-form__field--half">
      <label class="tm-task-form__label" for="tm-deadline">{$t('form.whenLabel')}</label>
      <input
        id="tm-deadline"
        class="tm-task-form__input"
        type="date"
        bind:value={deadline}
      />
    </div>
  </div>

  <div class="tm-task-form__row">
    <div class="tm-task-form__field tm-task-form__field--half">
      <label class="tm-task-form__label" for="tm-priority">{$t('form.priorityLabel')}</label>
      <select id="tm-priority" class="tm-task-form__select" bind:value={priority}>
        <option value="low">{$t('priority.low')}</option>
        <option value="medium">{$t('priority.medium')}</option>
        <option value="high">{$t('priority.high')}</option>
      </select>
    </div>
    <div class="tm-task-form__field tm-task-form__field--half">
      <label class="tm-task-form__label" for="tm-status">{$t('form.statusLabel')}</label>
      <select id="tm-status" class="tm-task-form__select" bind:value={status}>
        <option value="new">{$t('status.new')}</option>
        <option value="inProgress">{$t('status.inProgress')}</option>
        <option value="waiting">{$t('status.waiting')}</option>
        <option value="meeting">{$t('status.meeting')}</option>
        <option value="completed">{$t('status.completed')}</option>
      </select>
    </div>
  </div>

  {#if isEdit && task}
    <div class="tm-task-form__meta">
      <span>{$t('form.createdAt')} {task.createdAt}</span>
      {#if task.completedAt}
        <span>{$t('form.completedAt')} {task.completedAt}</span>
      {/if}
    </div>
  {/if}

  <div class="tm-task-form__actions">
    {#if isEdit && onDelete}
      <button class="tm-task-form__btn tm-task-form__btn--danger" on:click={onDelete}>
        {$t('form.delete')}
      </button>
    {/if}
    <div class="tm-task-form__spacer"></div>
    <button
      class="tm-task-form__btn tm-task-form__btn--primary"
      disabled={!canSave}
      on:click={handleSave}
    >
      {$t('form.save')}
    </button>
  </div>
</div>
