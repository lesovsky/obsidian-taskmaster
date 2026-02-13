<script lang="ts">
  import type { Board } from '../data/types';
  import { t } from '../i18n';

  export let board: Board;
  export let canDelete: boolean;
  export let onSave: (fields: { title: string; subtitle: string }) => void;
  export let onDelete: () => void;
  export let onClose: () => void;

  let title = board.title;
  let subtitle = board.subtitle;
  let confirmDelete = false;

  $: canSave = title.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    onSave({ title: title.trim(), subtitle: subtitle.trim() });
  }
</script>

<div class="tm-popup-overlay" on:click={onClose} on:keydown role="presentation">
  <div class="tm-popup" on:click|stopPropagation on:keydown|stopPropagation role="dialog">
    <h3 class="tm-popup__title">{$t('boardSettings.heading')}</h3>

    <div class="tm-popup__field">
      <label class="tm-popup__label" for="tm-board-title">{$t('boardSettings.title')}</label>
      <input id="tm-board-title" class="tm-popup__input" type="text" bind:value={title} maxlength="200" />
    </div>

    <div class="tm-popup__field">
      <label class="tm-popup__label" for="tm-board-subtitle">{$t('boardSettings.description')}</label>
      <textarea id="tm-board-subtitle" class="tm-popup__textarea" bind:value={subtitle} maxlength="500" rows="2"></textarea>
    </div>

    <div class="tm-popup__actions">
      {#if canDelete}
        {#if !confirmDelete}
          <button class="tm-popup__btn tm-popup__btn--danger" on:click={() => confirmDelete = true}>{$t('boardSettings.deleteBoard')}</button>
        {:else}
          <button class="tm-popup__btn tm-popup__btn--danger" on:click={onDelete}>{$t('boardSettings.confirmDelete')}</button>
          <button class="tm-popup__btn" on:click={() => confirmDelete = false}>{$t('boardSettings.no')}</button>
        {/if}
      {/if}
      <div class="tm-popup__spacer"></div>
      <button class="tm-popup__btn" on:click={onClose}>{$t('boardSettings.cancel')}</button>
      <button class="tm-popup__btn tm-popup__btn--primary" disabled={!canSave} on:click={handleSave}>{$t('boardSettings.save')}</button>
    </div>
  </div>
</div>
