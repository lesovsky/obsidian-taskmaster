<script lang="ts">
  import { onDestroy } from 'svelte';
  import { t } from '../i18n';
  import { updateBoardNotes, toggleNotesCollapsed } from '../stores/dataStore';

  export let boardId: string;
  export let notes: string;
  export let collapsed: boolean;

  const MAX_LENGTH = 5000;
  let debounceTimer: ReturnType<typeof setTimeout>;

  let localNotes = notes;
  $: localNotes = notes;

  function handleToggle() {
    toggleNotesCollapsed(boardId);
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    localNotes = target.value;

    const targetBoardId = boardId;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updateBoardNotes(targetBoardId, localNotes);
    }, 500);
  }

  onDestroy(() => {
    clearTimeout(debounceTimer);
  });
</script>

<div class="tm-notes-section">
  <button class="tm-notes-section__header" on:click={handleToggle}>
    <span class="tm-notes-section__arrow" class:tm-notes-section__arrow--open={!collapsed}>&#9654;</span>
    <span class="tm-notes-section__title">{$t('notes.title')}</span>
  </button>

  {#if !collapsed}
    <div class="tm-notes-section__body">
      <textarea
        class="tm-notes-section__textarea"
        bind:value={localNotes}
        on:input={handleInput}
        placeholder={$t('notes.placeholder')}
        maxlength={MAX_LENGTH}
      ></textarea>
    </div>
  {/if}
</div>
