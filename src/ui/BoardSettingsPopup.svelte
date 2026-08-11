<script lang="ts">
  import type { Board, GroupId } from '../data/types';
  import { GROUP_IDS } from '../data/types';
  import { t, groupLabels } from '../i18n';
  import { canMoveGroup, moveGroupWithinPresent, sanitizeHiddenGroups } from './groupOrderUtils';
  import type { MoveDirection } from './groupOrderUtils';

  export let board: Board;
  export let canDelete: boolean;
  export let onSave: (fields: { title: string; subtitle: string; hiddenGroups: GroupId[]; fullWidths: Record<GroupId, boolean>; groupTitles: Record<GroupId, string>; groupOrder: GroupId[]; notesHidden: boolean }) => void;
  export let onDelete: () => void;
  export let onClose: () => void;

  // Тот же предел, что и у санитайзера названия в migration.ts. Здесь он охраняет набор текста,
  // там — файл данных, правленный руками; настоящая точка контроля — граница стора (Decision 7).
  const GROUP_TITLE_MAX_LENGTH = 40;

  let title = board.title;
  let subtitle = board.subtitle;
  // hiddenGroups — единственное поле доски с идентификаторами групп, которое загрузка не санирует
  // (в отличие от groupOrder, см. Decision 6), поэтому приводим его к массиву здесь.
  let hiddenGroups: GroupId[] = sanitizeHiddenGroups(board.hiddenGroups);
  let notesHidden: boolean = board.notesHidden;
  let fullWidths: Record<GroupId, boolean> = Object.fromEntries(
    GROUP_IDS.map(id => [id, board.groups[id]?.fullWidth ?? false])
  ) as Record<GroupId, boolean>;
  // Сырое сохранённое название, а не отображаемое: resolveGroupTitle здесь неприменим (Decision 4).
  // Пустая строка означает «пользователь не переименовывал» — дефолт живёт в placeholder, иначе
  // сохранение без правок записало бы текущие локализованные названия шести группам явно.
  let groupTitles: Record<GroupId, string> = Object.fromEntries(
    GROUP_IDS.map(id => [id, board.groups[id]?.title ?? ''])
  ) as Record<GroupId, string>;
  let groupOrder: GroupId[] = [...board.groupOrder];
  let confirmDelete = false;

  $: canSave = title.trim().length > 0;
  // Объект группы может отсутствовать после ручной правки data.json — санитайзер порядка
  // восстанавливает идентификатор в списке, но не саму группу. Такие строки не рисуем.
  // Проверяются и ключ, и значение: hasOwnProperty истинен для `"focus": null`, и строка упала бы
  // на чтении taskIds; сам по себе доступ по ключу ходил бы по цепочке прототипов.
  $: presentGroups = groupOrder.filter(
    id => Object.prototype.hasOwnProperty.call(board.groups, id) && Boolean(board.groups[id]),
  );
  $: visibleCount = presentGroups.filter(id => !hiddenGroups.includes(id)).length;

  function handleMove(groupId: GroupId, direction: MoveDirection) {
    groupOrder = moveGroupWithinPresent(groupOrder, presentGroups, groupId, direction, hiddenGroups);
  }

  function handleSave() {
    if (!canSave) return;
    onSave({ title: title.trim(), subtitle: subtitle.trim(), hiddenGroups, fullWidths, groupTitles, groupOrder, notesHidden });
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
        <!-- Пустая ячейка над колонкой стрелок: сетка заголовка повторяет сетку строки группы. -->
        <span></span>
        <span class="tm-popup__group-header-name">{$t('boardSettings.groupName')}</span>
        <span class="tm-popup__group-header-col">{$t('boardSettings.groupVisibility')}</span>
        <span class="tm-popup__group-header-col">{$t('boardSettings.fullWidth')}</span>
      </div>
      {#each presentGroups as groupId (groupId)}
        {@const count = board.groups[groupId].taskIds.length}
        {@const isVisible = !hiddenGroups.includes(groupId)}
        {@const isLastVisible = visibleCount === 1 && isVisible}
        <div
          class="tm-popup__group-row"
          class:tm-popup__group-row--hidden={!isVisible}
          data-settings-group={groupId}
          title={isLastVisible ? $t('boardSettings.cannotHideLastGroup') : ''}
        >
          <span class="tm-popup__group-move">
            <button
              class="tm-popup__group-move-btn"
              type="button"
              aria-label={$t('boardSettings.moveUp')}
              title={$t('boardSettings.moveUp')}
              disabled={!canMoveGroup(presentGroups, groupId, 'up', hiddenGroups)}
              on:click={() => handleMove(groupId, 'up')}
            >&#9650;</button>
            <button
              class="tm-popup__group-move-btn"
              type="button"
              aria-label={$t('boardSettings.moveDown')}
              title={$t('boardSettings.moveDown')}
              disabled={!canMoveGroup(presentGroups, groupId, 'down', hiddenGroups)}
              on:click={() => handleMove(groupId, 'down')}
            >&#9660;</button>
          </span>
          <span class="tm-popup__group-name">
            <input
              type="text"
              class="tm-popup__group-title-input"
              bind:value={groupTitles[groupId]}
              placeholder={$groupLabels[groupId]}
              maxlength={GROUP_TITLE_MAX_LENGTH}
              aria-label={$groupLabels[groupId]}
            />
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
      <div class="tm-popup__divider"></div>
      <div class="tm-popup__group-row">
        <!-- Пустая ячейка под колонку стрелок: строка заметок делит сетку со строками групп,
             и без неё переключатель видимости уехал бы в колонку названия. -->
        <span></span>
        <span class="tm-popup__group-name">{$t('boardSettings.notes')}</span>
        <input
          type="checkbox"
          class="tm-popup__group-toggle"
          checked={!notesHidden}
          on:change={() => { notesHidden = !notesHidden; }}
        />
        <span></span>
      </div>
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
