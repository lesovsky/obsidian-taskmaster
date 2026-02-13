<script lang="ts">
  import type { Group, GroupId } from '../data/types';
  import { GROUP_LABELS } from '../data/types';

  export let groupId: GroupId;
  export let group: Group;
  export let onAdd: (() => void) | null = null;
  export let onSettings: (() => void) | null = null;

  $: taskCount = group.taskIds.length;
  $: wipLimit = group.wipLimit;
  $: overLimit = wipLimit !== null && taskCount > wipLimit;
  $: counterText = wipLimit !== null ? `${taskCount}/${wipLimit}` : `${taskCount}`;
</script>

<div class="tm-group-header" class:tm-group-header--over={overLimit}>
  <span class="tm-group-header__title">{GROUP_LABELS[groupId]}</span>
  <span class="tm-group-header__counter" class:tm-group-header__counter--over={overLimit}>({counterText})</span>
  <div class="tm-group-header__spacer"></div>
  {#if onSettings}
    <button class="tm-group-header__settings clickable-icon" on:click={onSettings} title="Настройки группы">&#9881;</button>
  {/if}
  {#if onAdd}
    <button class="tm-group-header__add clickable-icon" on:click={onAdd} title="Добавить задачу">+</button>
  {/if}
</div>
