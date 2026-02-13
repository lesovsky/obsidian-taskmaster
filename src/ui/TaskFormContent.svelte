<script lang="ts">
  import type { Task, Priority, GroupId } from '../data/types';
  import { formatDate } from '../utils/dateFormat';

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
    <label class="tm-task-form__label" for="tm-what">Что нужно сделать *</label>
    <textarea
      id="tm-what"
      class="tm-task-form__textarea"
      bind:value={what}
      maxlength="10000"
      rows="3"
      placeholder="Описание задачи"
    ></textarea>
  </div>

  <div class="tm-task-form__field">
    <label class="tm-task-form__label" for="tm-why">Зачем</label>
    <textarea
      id="tm-why"
      class="tm-task-form__textarea"
      bind:value={why}
      maxlength="10000"
      rows="2"
      placeholder="Цель задачи"
    ></textarea>
  </div>

  <div class="tm-task-form__row">
    <div class="tm-task-form__field tm-task-form__field--half">
      <label class="tm-task-form__label" for="tm-who">Кто</label>
      <input
        id="tm-who"
        class="tm-task-form__input"
        type="text"
        bind:value={who}
        maxlength="200"
        placeholder="Исполнитель"
      />
    </div>
    <div class="tm-task-form__field tm-task-form__field--half">
      <label class="tm-task-form__label" for="tm-deadline">Когда</label>
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
      <label class="tm-task-form__label" for="tm-priority">Приоритет</label>
      <select id="tm-priority" class="tm-task-form__select" bind:value={priority}>
        <option value="low">Низкий</option>
        <option value="medium">Средний</option>
        <option value="high">Высокий</option>
      </select>
    </div>
    <div class="tm-task-form__field tm-task-form__field--half">
      <label class="tm-task-form__label" for="tm-status">Статус</label>
      <select id="tm-status" class="tm-task-form__select" bind:value={status}>
        <option value="new">Новая</option>
        <option value="inProgress">В работе</option>
        <option value="waiting">Ожидание</option>
        <option value="completed">Завершена</option>
      </select>
    </div>
  </div>

  {#if isEdit && task}
    <div class="tm-task-form__meta">
      <span>Создана: {task.createdAt}</span>
      {#if task.completedAt}
        <span>Завершена: {task.completedAt}</span>
      {/if}
    </div>
  {/if}

  <div class="tm-task-form__actions">
    {#if isEdit && onDelete}
      <button class="tm-task-form__btn tm-task-form__btn--danger" on:click={onDelete}>
        Удалить
      </button>
    {/if}
    <div class="tm-task-form__spacer"></div>
    <button
      class="tm-task-form__btn tm-task-form__btn--primary"
      disabled={!canSave}
      on:click={handleSave}
    >
      Сохранить
    </button>
  </div>
</div>
