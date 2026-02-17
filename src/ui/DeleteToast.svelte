<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { t } from '../i18n';

  export let message: string;
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
  <span class="tm-toast__text">{message}</span>
  <span class="tm-toast__timer">{remaining}{$t('toast.seconds')}</span>
  <button class="tm-toast__undo" on:click={onUndo}>{$t('toast.undo')}</button>
</div>
