<script lang="ts">
  import type { Group, GroupId } from '../data/types';
  import { t, groupLabels } from '../i18n';

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
  <span class="tm-group-header__title">{$groupLabels[groupId]}</span>
  <span class="tm-group-header__counter" class:tm-group-header__counter--over={overLimit}>({counterText})</span>
  <div class="tm-group-header__spacer"></div>
  {#if onSettings}
    <button class="tm-group-header__settings clickable-icon" on:click={onSettings} title={$t('groupHeader.settings')}>&#9881;</button>
  {/if}
  {#if onAdd}
    <button class="tm-group-header__add clickable-icon" on:click={onAdd} title={$t('groupHeader.addTask')}>+</button>
  {/if}
</div>
