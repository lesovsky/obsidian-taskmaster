# План: Group Visibility Settings

**Спецификация:** [docs/specs/0006-feat-group-visibility.md](../specs/0006-feat-group-visibility.md)
**Общая оценка:** 4.5h

---

## Фаза 1: Слой данных

### 1.1 Типы, дефолты, миграция
**Оценка:** 30min
**Зависимости:** нет
**Файлы:**
- `src/data/types.ts`
- `src/data/defaults.ts`
- `src/data/migration.ts`

**Шаги:**

1. `types.ts` — добавить поле в интерфейс `Board`:
   ```typescript
   hiddenGroups: GroupId[];   // список скрытых групп, default: []
   ```

2. `defaults.ts` — добавить поле в `createDefaultBoard()`:
   ```typescript
   hiddenGroups: [],
   ```

3. `migration.ts` — добавить блок миграции version 3→4:
   ```typescript
   if (version < 4) {
     for (const board of result.boards) {
       if ((board as any).hiddenGroups === undefined) {
         (board as any).hiddenGroups = [];
       }
     }
     result.version = 4;
   }
   ```
   Обновить `DEFAULT_DATA.version` до `4` в `defaults.ts`.

**Done when:**
- [ ] TypeScript компилируется без ошибок (`npx tsc --noEmit`)
- [ ] `createDefaultBoard()` возвращает объект с `hiddenGroups: []`
- [ ] `DEFAULT_DATA.version` в `defaults.ts` обновлён до `4`
- [ ] Миграция существующих данных (version=3) добавляет `hiddenGroups: []`

---

## Фаза 2: Локализация

### 2.1 Новые ключи EN + RU
**Оценка:** 15min
**Зависимости:** нет (параллельно с фазой 1)
**Файлы:**
- `src/i18n/types.ts`
- `src/i18n/en.ts`
- `src/i18n/ru.ts`

**Шаги:**

1. `types.ts` — зарегистрировать новые ключи в `TranslationKey` (строка 17, после существующих `boardSettings.*`):
   ```typescript
   | 'boardSettings.groupVisibility' | 'boardSettings.groupVisibilityDesc'
   | 'boardSettings.cannotHideLastGroup'
   ```
   ⚠️ Без этого шага вызов `$t('boardSettings.groupVisibility')` не скомпилируется.

2. `en.ts` и `ru.ts` — добавить в секцию `boardSettings`:
   ```typescript
   'boardSettings.groupVisibility': 'Group Visibility',            // RU: 'Видимость групп'
   'boardSettings.groupVisibilityDesc': 'Show or hide groups on this board', // RU: 'Показывать или скрывать группы на этой доске'
   'boardSettings.cannotHideLastGroup': 'At least one group must be visible', // RU: 'Хотя бы одна группа должна быть видима'
   ```

**Done when:**
- [ ] `TranslationKey` в `types.ts` содержит все 3 новых ключа
- [ ] `en.ts` и `ru.ts` содержат все 3 новых ключа
- [ ] `npx tsc --noEmit` проходит без ошибок типизации i18n

---

## Фаза 3: Store + BoardHeader

### 3.1 Обновить `updateBoard()` и его вызывающий код
**Оценка:** 30min
**Зависимости:** Фаза 1
**Файлы:**
- `src/stores/dataStore.ts`
- `src/ui/BoardHeader.svelte`

**Шаги:**

1. `dataStore.ts` — расширить сигнатуру `updateBoard()`:
   ```typescript
   // было
   export function updateBoard(boardId: string, fields: { title: string; subtitle: string }): void

   // стало
   export function updateBoard(boardId: string, fields: { title: string; subtitle: string; hiddenGroups: GroupId[] }): void
   ```
   В теле функции добавить сохранение `hiddenGroups` наряду с `title` и `subtitle`.

2. `BoardHeader.svelte` — обновить `saveSettings()`:
   ```typescript
   // было
   function saveSettings(fields: { title: string; subtitle: string }) {
     updateBoard(board.id, fields);

   // стало
   function saveSettings(fields: { title: string; subtitle: string; hiddenGroups: GroupId[] }) {
     updateBoard(board.id, fields);
   ```
   Добавить импорт `GroupId` из `../data/types`.

**Done when:**
- [ ] `updateBoard()` принимает и сохраняет `hiddenGroups`
- [ ] TypeScript компилируется без ошибок

---

## Фаза 4: UI — BoardSettingsPopup

### 4.1 Секция видимости групп
**Оценка:** 1.5h
**Зависимости:** Фазы 1, 2, 3
**Файлы:**
- `src/stores/dataStore.ts` *(перенесено из фазы 3 — см. примечание)*
- `src/ui/BoardHeader.svelte` *(перенесено из фазы 3 — см. примечание)*
- `src/ui/BoardSettingsPopup.svelte`
- `src/styles.css`

> ⚠️ **Примечание о порядке изменений.** Фазы 3 и 4 меняют сигнатуру одного вызова (`onSave`/`updateBoard`) с двух сторон. Если коммитить фазу 3 отдельно — TypeScript будет сломан до фазы 4. Поэтому `dataStore.ts` и `BoardHeader.svelte` включены в этот коммит, а не в отдельный.

**Шаги:**

1. **`dataStore.ts`** — расширить сигнатуру `updateBoard()`:
   ```typescript
   export function updateBoard(boardId: string, fields: { title: string; subtitle: string; hiddenGroups: GroupId[] }): void
   ```
   В теле функции добавить сохранение `hiddenGroups` наряду с `title` и `subtitle`.

2. **`BoardHeader.svelte`** — обновить `saveSettings()`:
   ```typescript
   function saveSettings(fields: { title: string; subtitle: string; hiddenGroups: GroupId[] }) {
     updateBoard(board.id, fields);
   }
   ```
   Добавить импорт `GroupId` из `../data/types`.

3. **`BoardSettingsPopup.svelte`** — обновить пропы и добавить импорты:
   ```typescript
   import { GROUP_IDS, type GroupId } from '../data/types';
   import { groupLabels } from '../i18n';  // Record<GroupId, string> — типобезопасно

   export let onSave: (fields: { title: string; subtitle: string; hiddenGroups: GroupId[] }) => void;
   ```

4. **Добавить локальное состояние** под `let subtitle`:
   ```typescript
   let hiddenGroups: GroupId[] = [...board.hiddenGroups]; // копия, не ссылка
   $: visibleCount = GROUP_IDS.filter(id => !hiddenGroups.includes(id)).length;
   ```

5. **Обновить `handleSave()`:**
   ```typescript
   function handleSave() {
     if (!canSave) return;
     onSave({ title: title.trim(), subtitle: subtitle.trim(), hiddenGroups });
   }
   ```

6. **Добавить секцию в шаблон** между блоком `description` и `tm-popup__actions`:
   ```svelte
   <div class="tm-popup__section">
     <div class="tm-popup__section-title">{$t('boardSettings.groupVisibility')}</div>
     <div class="tm-popup__section-desc">{$t('boardSettings.groupVisibilityDesc')}</div>
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
             if (isVisible) {
               hiddenGroups = [...hiddenGroups, groupId];
             } else {
               hiddenGroups = hiddenGroups.filter(id => id !== groupId);
             }
           }}
         />
       </div>
     {/each}
   </div>
   ```
   > `$groupLabels[groupId]` вместо `` $t(`group.${groupId}`) `` — шаблонный литерал не проходит TypeScript strict mode, `groupLabels` возвращает `Record<GroupId, string>` и типобезопасен.

5. **Добавить CSS** в `src/styles.css` в секцию Popup:
   ```css
   .tm-popup__section {
     margin-bottom: 1rem;
   }
   .tm-popup__section-title {
     font-size: 0.8rem;
     font-weight: 600;
     text-transform: uppercase;
     letter-spacing: 0.05em;
     color: var(--text-muted);
     margin-bottom: 0.25rem;
   }
   .tm-popup__section-desc {
     font-size: 0.8rem;
     color: var(--text-muted);
     margin-bottom: 0.5rem;
   }
   .tm-popup__group-row {
     display: flex;
     align-items: center;
     justify-content: space-between;
     padding: 0.35rem 0;
     border-bottom: 1px solid var(--background-modifier-border);
   }
   .tm-popup__group-row:last-child {
     border-bottom: none;
   }
   .tm-popup__group-name {
     font-size: 0.9rem;
     color: var(--text-normal);
   }
   .tm-popup__group-count {
     color: var(--text-muted);
     font-size: 0.85rem;
   }
   .tm-popup__group-toggle:disabled {
     opacity: 0.4;
     cursor: not-allowed;
   }
   ```

**Done when:**
- [ ] Секция "Group Visibility" отображается в попапе настроек доски
- [ ] Рядом с названием группы показывается счётчик задач (если > 0)
- [ ] Переключение свитчеров обновляет локальный `hiddenGroups`
- [ ] Последняя видимая группа задизейблена, `title` на строке показывает пояснение
- [ ] Cancel не сохраняет изменения (локальный `hiddenGroups` не коммитится)
- [ ] Save передаёт `hiddenGroups` в `onSave`

---

## Фаза 5: Рендеринг — BoardLayout

### 5.1 Условный рендер групп
**Оценка:** 1h
**Зависимости:** Фаза 1
**Файлы:**
- `src/ui/BoardLayout.svelte`

**Шаги:**

1. Добавить реактивную переменную:
   ```typescript
   $: hidden = new Set(board.hiddenGroups);
   ```

2. Обернуть `backlog` секцию:
   ```svelte
   {#if !hidden.has('backlog')}
     <div class="tm-board-layout__collapsible">
       <CollapsibleGroup groupId="backlog" ... />
     </div>
   {/if}
   ```

3. Для `focus` + `inProgress` — учесть динамику 2-колонного лэйаута:
   ```svelte
   {#if !hidden.has('focus') || !hidden.has('inProgress')}
     <div
       class="tm-board-layout__row"
       class:tm-board-layout__row--two={!hidden.has('focus') && !hidden.has('inProgress')}
     >
       {#if !hidden.has('focus')}
         <TaskGroup groupId="focus" ... />
       {/if}
       {#if !hidden.has('inProgress')}
         <TaskGroup groupId="inProgress" ... />
       {/if}
     </div>
   {/if}
   ```

4. Обернуть `orgIntentions` секцию:
   ```svelte
   {#if !hidden.has('orgIntentions')}
     <div class="tm-board-layout__row">
       <TaskGroup groupId="orgIntentions" ... />
     </div>
   {/if}
   ```

5. Обернуть `delegated` секцию:
   ```svelte
   {#if !hidden.has('delegated')}
     <div class="tm-board-layout__row">
       <TaskGroup groupId="delegated" ... />
     </div>
   {/if}
   ```

6. Обернуть `completed` секцию:
   ```svelte
   {#if !hidden.has('completed')}
     <div class="tm-board-layout__collapsible">
       <CollapsibleGroup groupId="completed" ... />
     </div>
   {/if}
   ```

**Done when:**
- [ ] Скрытая группа не отображается на доске
- [ ] Скрыть `focus` → `inProgress` занимает полную ширину
- [ ] Скрыть `inProgress` → `focus` занимает полную ширину
- [ ] После включения группы обратно она появляется со своими задачами
- [ ] Drag & drop работает корректно после скрытия/показа групп

---

## Фаза 6: Финальная проверка

### 6.1 Сборка и ручное тестирование
**Оценка:** 45min
**Зависимости:** Все предыдущие фазы
**Файлы:** нет изменений

**Шаги:**

1. Запустить `npx tsc --noEmit` — убедиться, что нет TypeScript ошибок
2. Запустить `npm run build` — убедиться, что сборка проходит
3. Пройти чеклист из спецификации (секция 7):

**Основные сценарии:**
- [ ] Скрыть группу → исчезает с доски, задачи в данных на месте
- [ ] Показать обратно → задачи возвращаются
- [ ] Завершить задачу при скрытой `completed` → улетает без ошибок
- [ ] Перетащить задачу в группу, скрыть её → задача остаётся в данных
- [ ] Скрыть последнюю группу → свитчер задизейблен, tooltip на строке
- [ ] Настройки независимы для разных досок
- [ ] Cancel не применяет изменения; overlay-клик — то же

**Миграция:**
- [ ] Открыть плагин с существующими данными (version=3) → все группы видимы

**Счётчики:**
- [ ] Группа с задачами → счётчик `(N)`; без задач → без счётчика
- [ ] Многократное переключение до Save → нет дублей в `hiddenGroups`

**Автоматизации:**
- [ ] Скрыть `backlog` → Add task доступен в другой группе

**Визуально:**
- [ ] Light и dark тема

---

## Порядок коммитов

| # | Коммит | Файлы |
|---|--------|-------|
| 1 | `feat: add hiddenGroups field to Board type and migration v3→v4` | `types.ts`, `defaults.ts`, `migration.ts` |
| 2 | `feat: add group visibility localization keys (EN + RU)` | `i18n/types.ts`, `en.ts`, `ru.ts` |
| 3 | `feat: add group visibility UI to BoardSettingsPopup` | `dataStore.ts`, `BoardHeader.svelte`, `BoardSettingsPopup.svelte`, `styles.css` |
| 4 | `feat: conditionally render groups by hiddenGroups in BoardLayout` | `BoardLayout.svelte` |
