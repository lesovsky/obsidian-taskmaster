<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let taskName: string;
  export let expiresAt: number;
  export let onUndo: () => void;
  export let onExpire: () => void;

  let remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  let interval: ReturnType<typeof setInterval>;

  onMount(() => {
    interval = setInterval(() => {
      remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      if (remaining <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 250);
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });
</script>

<div class="tm-toast">
  <span class="tm-toast__text">Удалено: {taskName}</span>
  <span class="tm-toast__timer">{remaining}с</span>
  <button class="tm-toast__undo" on:click={onUndo}>Отменить</button>
</div>
