<script lang="ts">
  import type { GroupId } from '../data/types';
  import type { TranslationKey } from '../i18n/types';
  import { t } from '../i18n';

  export let groupId: GroupId;
  /** Сохранённое название группы (не boolean): признак переименования вычисляется здесь и только здесь. */
  export let groupTitle = '';

  // Та же проверка пустоты, что и в resolveGroupTitle(), — иначе название и подсказка могли бы разойтись.
  $: key = groupTitle.trim() !== ''
    ? 'emptyState.renamed'
    : (`emptyState.${groupId}` as TranslationKey);
</script>

<div class="tm-empty-state">
  {$t(key)}
</div>
