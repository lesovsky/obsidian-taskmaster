<script lang="ts">
  import { dataStore } from '../stores/dataStore';
  import { uiStore } from '../stores/uiStore';
  import BoardHeader from './BoardHeader.svelte';
  import BoardLayout from './BoardLayout.svelte';
  import type { Board } from '../data/types';

  $: boards = $dataStore.boards;
  $: activeBoard = boards.find(b => b.id === $uiStore.activeBoardId) as Board | undefined;
</script>

{#if activeBoard}
  <div class="tm-app">
    <BoardHeader board={activeBoard} {boards} />
    <BoardLayout board={activeBoard} tasks={$dataStore.tasks} />
  </div>
{/if}
