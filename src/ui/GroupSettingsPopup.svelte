<script lang="ts">
  import type { Group, GroupId } from '../data/types';
  import { t, groupLabels } from '../i18n';

  export let groupId: GroupId;
  export let group: Group;
  export let onSave: (fields: { wipLimit: number | null; completedRetentionDays: number | null }) => void;
  export let onClose: () => void;

  let wipLimitStr = group.wipLimit !== null ? String(group.wipLimit) : '';
  let retentionStr = group.completedRetentionDays !== null ? String(group.completedRetentionDays) : '';

  function handleSave() {
    const wip = String(wipLimitStr).trim();
    const ret = String(retentionStr).trim();
    const wipLimit = wip === '' ? null : parseInt(wip, 10);
    const completedRetentionDays = ret === '' ? null : parseInt(ret, 10);
    onSave({
      wipLimit: wipLimit !== null && !isNaN(wipLimit) && wipLimit > 0 ? wipLimit : null,
      completedRetentionDays: completedRetentionDays !== null && !isNaN(completedRetentionDays) && completedRetentionDays > 0 ? completedRetentionDays : null,
    });
  }
</script>

<div class="tm-popup-overlay" on:click={onClose} on:keydown role="presentation">
  <div class="tm-popup" on:click|stopPropagation on:keydown|stopPropagation role="dialog">
    <h3 class="tm-popup__title">{$t('groupSettings.heading')} {$groupLabels[groupId]}</h3>

    <div class="tm-popup__field">
      <label class="tm-popup__label" for="tm-wip">{$t('groupSettings.wipLimit')}</label>
      <input id="tm-wip" class="tm-popup__input" type="number" min="1" bind:value={wipLimitStr} placeholder={$t('groupSettings.wipPlaceholder')} />
    </div>

    {#if groupId === 'completed'}
      <div class="tm-popup__field">
        <label class="tm-popup__label" for="tm-retention">{$t('groupSettings.retentionLabel')}</label>
        <input id="tm-retention" class="tm-popup__input" type="number" min="1" bind:value={retentionStr} placeholder="30" />
      </div>
    {/if}

    <div class="tm-popup__actions">
      <button class="tm-popup__btn" on:click={onClose}>{$t('groupSettings.cancel')}</button>
      <button class="tm-popup__btn tm-popup__btn--primary" on:click={handleSave}>{$t('groupSettings.save')}</button>
    </div>
  </div>
</div>
