<script lang="ts">
  import type { GroupId } from '../data/types';
  import type { TranslationKey } from '../i18n/types';
  import { t } from '../i18n';

  export let groupId: GroupId;

  $: key = `emptyState.${groupId}` as TranslationKey;
</script>

<div class="tm-empty-state">
  {$t(key)}
</div>
