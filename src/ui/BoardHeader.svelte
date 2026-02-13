<script lang="ts">
  import type { Board } from '../data/types';
  import { uiStore } from '../stores/uiStore';
  import { createBoard, updateBoard, deleteBoard } from '../stores/dataStore';
  import BoardSettingsPopup from './BoardSettingsPopup.svelte';

  export let board: Board;
  export let boards: Board[];

  let showSettings = false;

  function onBoardChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    uiStore.update(ui => ({ ...ui, activeBoardId: select.value }));
  }

  function onCreateBoard() {
    createBoard();
  }

  function saveSettings(fields: { title: string; subtitle: string }) {
    updateBoard(board.id, fields);
    showSettings = false;
  }

  function handleDeleteBoard() {
    deleteBoard(board.id);
    showSettings = false;
  }
</script>

<div class="tm-board-header">
  <div class="tm-board-header__top">
    <select class="tm-board-header__select" value={board.id} on:change={onBoardChange}>
      {#each boards as b (b.id)}
        <option value={b.id}>{b.title}</option>
      {/each}
    </select>
    <button class="tm-board-header__icon clickable-icon" on:click={() => showSettings = true} title="Настройки доски">&#9881;</button>
    <button class="tm-board-header__icon clickable-icon" on:click={onCreateBoard} title="Создать доску">+</button>
  </div>
  {#if board.subtitle}
    <div class="tm-board-header__subtitle">{board.subtitle}</div>
  {/if}
</div>

{#if showSettings}
  <BoardSettingsPopup
    {board}
    canDelete={boards.length > 1}
    onSave={saveSettings}
    onDelete={handleDeleteBoard}
    onClose={() => showSettings = false}
  />
{/if}
