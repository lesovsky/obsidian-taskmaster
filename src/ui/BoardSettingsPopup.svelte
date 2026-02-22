<script lang="ts">
  import type { Board, GroupId } from '../data/types';
  import { GROUP_IDS } from '../data/types';
  import { t, groupLabels } from '../i18n';

  export let board: Board;
  export let canDelete: boolean;
  export let onSave: (fields: { title: string; subtitle: string; hiddenGroups: GroupId[]; fullWidths: Record<GroupId, boolean> }) => void;
  export let onDelete: () => void;
  export let onClose: () => void;

  let title = board.title;
  let subtitle = board.subtitle;
  let hiddenGroups: GroupId[] = [...board.hiddenGroups];
  let fullWidths: Record<GroupId, boolean> = Object.fromEntries(
    GROUP_IDS.map(id => [id, board.groups[id].fullWidth])
  ) as Record<GroupId, boolean>;
  let confirmDelete = false;

  $: canSave = title.trim().length > 0;
  $: visibleCount = GROUP_IDS.filter(id => !hiddenGroups.includes(id)).length;

  function handleSave() {
    if (!canSave) return;
    onSave({ title: title.trim(), subtitle: subtitle.trim(), hiddenGroups, fullWidths });
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

    <div class="tm-popup__section">
      <div class="tm-popup__section-title">{$t('boardSettings.groupVisibility')}</div>
      <div class="tm-popup__section-desc">{$t('boardSettings.groupVisibilityDesc')}</div>
      <div class="tm-popup__group-header">
        <span class="tm-popup__group-header-name"></span>
        <span class="tm-popup__group-header-col">{$t('boardSettings.groupVisibility')}</span>
        <span class="tm-popup__group-header-col">{$t('boardSettings.fullWidth')}</span>
      </div>
      {#each GROUP_IDS as groupId}
        {@const count = board.groups[groupId].taskIds.length}
        {@const isVisible = !hiddenGroups.includes(groupId)}
        {@const isLastVisible = visibleCount === 1 && isVisible}
        <div
          class="tm-popup__group-row"
          title={isLastVisible ? $t('boardSettings.cannotHideLastGroup') : ''}
        >
          <span class="tm-popup__group-name">
            {$groupLabels[groupId]}
            {#if count > 0}
              <span class="tm-popup__group-count">({count})</span>
            {/if}
          </span>
          <input
            type="checkbox"
            class="tm-popup__group-toggle"
            checked={isVisible}
            disabled={isLastVisible}
            on:change={() => {
              if (isVisible && !hiddenGroups.includes(groupId)) {
                hiddenGroups = [...hiddenGroups, groupId];
              } else {
                hiddenGroups = hiddenGroups.filter(id => id !== groupId);
              }
            }}
          />
          <input
            type="checkbox"
            class="tm-popup__group-toggle"
            bind:checked={fullWidths[groupId]}
            disabled={!isVisible}
            title={$t('boardSettings.fullWidthTooltip')}
          />
        </div>
      {/each}
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
