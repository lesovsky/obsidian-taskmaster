<script lang="ts">
  import { tick } from 'svelte';
  import { t } from '../i18n';
  import { FOLLOW_UP_TEXT_MAX_LENGTH, MAX_FOLLOW_UPS } from '../logic/followUps';
  import type { FollowUpDraft } from '../logic/followUps';

  // The caller owns a copy of the task's list; this component never touches a store.
  export let drafts: FollowUpDraft[];
  export let readOnly = false;

  // No prototype: keys are item ids from data.json, where '__proto__' would pass the load sanitizer.
  const inputs: Record<string, HTMLInputElement | null> = Object.create(null);

  $: atLimit = drafts.length >= MAX_FOLLOW_UPS;

  async function insertAt(index: number) {
    if (drafts.length >= MAX_FOLLOW_UPS) return;
    const draft: FollowUpDraft = { id: crypto.randomUUID(), text: '', createdTaskId: '', marked: false };
    drafts = [...drafts.slice(0, index), draft, ...drafts.slice(index)];
    await tick();
    inputs[draft.id]?.focus();
  }

  function handleKeydown(event: KeyboardEvent, index: number) {
    if (event.key !== 'Enter' || event.isComposing) return;
    // Enter belongs to the editor: it must not reach anything that saves or closes the modal.
    event.preventDefault();
    event.stopPropagation();
    insertAt(index + 1);
  }

  function toggleMarked(id: string) {
    drafts = drafts.map(d => (d.id === id ? { ...d, marked: !d.marked } : d));
  }

  function remove(id: string) {
    drafts = drafts.filter(d => d.id !== id);
    delete inputs[id];
  }
</script>

{#if readOnly}
  {#if drafts.length > 0}
    <div class="tm-follow-ups tm-follow-ups--readonly">
      <div class="tm-follow-ups__title">{$t('followUps.title')}</div>
      {#each drafts as draft (draft.id)}
        <div class="tm-follow-ups__row" class:tm-follow-ups__row--created={draft.createdTaskId !== ''}>
          <span class="tm-follow-ups__text">{draft.text}</span>
          {#if draft.createdTaskId !== ''}
            <span class="tm-follow-ups__created-label">{$t('followUps.created')}</span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
{:else}
  <div class="tm-follow-ups">
    <div class="tm-follow-ups__title">{$t('followUps.title')}</div>
    {#each drafts as draft, index (draft.id)}
      {#if draft.createdTaskId !== ''}
        <div class="tm-follow-ups__row tm-follow-ups__row--created">
          <span class="tm-follow-ups__text">{draft.text}</span>
          <span class="tm-follow-ups__created-label">{$t('followUps.created')}</span>
          <button
            type="button"
            class="tm-follow-ups__remove"
            aria-label={$t('followUps.remove')}
            title={$t('followUps.remove')}
            on:click={() => remove(draft.id)}
          >✕</button>
        </div>
      {:else}
        <div class="tm-follow-ups__row" class:tm-follow-ups__row--marked={draft.marked}>
          <input
            class="tm-follow-ups__input"
            type="text"
            bind:value={draft.text}
            bind:this={inputs[draft.id]}
            maxlength={FOLLOW_UP_TEXT_MAX_LENGTH}
            placeholder={$t('followUps.placeholder')}
            aria-label={$t('followUps.placeholder')}
            on:keydown={(e) => handleKeydown(e, index)}
          />
          <button
            type="button"
            class="tm-follow-ups__to-backlog"
            class:tm-follow-ups__to-backlog--pressed={draft.marked}
            aria-pressed={draft.marked}
            title={$t('followUps.toBacklogHint')}
            on:click={() => toggleMarked(draft.id)}
          >{$t('followUps.toBacklog')}</button>
          <button
            type="button"
            class="tm-follow-ups__remove"
            aria-label={$t('followUps.remove')}
            title={$t('followUps.remove')}
            on:click={() => remove(draft.id)}
          >✕</button>
        </div>
      {/if}
    {/each}
    <button
      type="button"
      class="tm-follow-ups__add"
      disabled={atLimit}
      on:click={() => insertAt(drafts.length)}
    >{$t('followUps.add')}</button>
  </div>
{/if}
