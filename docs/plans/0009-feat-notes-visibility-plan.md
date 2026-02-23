# План: Notes Visibility Settings

**Спецификация:** [docs/specs/0009-feat-notes-visibility.md](../specs/0009-feat-notes-visibility.md)
**Общая оценка:** 2.5 часа

## Задачи

### Фаза 1: Слой данных

#### 1.1 Типы, дефолты, миграция
**Оценка:** 30 мин
**Зависимости:** нет
**Файлы:**
- `src/data/types.ts`
- `src/data/defaults.ts`
- `src/data/migration.ts`

**Шаги:**
1. В `types.ts` добавить `notesHidden: boolean` в интерфейс `Board` (после `notesCollapsed`)
2. В `defaults.ts`:
   - В `createDefaultBoard()` добавить `notesHidden: false`
   - Поднять `DEFAULT_DATA.version` с `6` до `7`
3. В `migration.ts` добавить блок **между `result.version = 6;` и `return result;`** (не после `return`):
   ```typescript
   if (version < 7) {
     for (const board of result.boards) {
       if ((board as any).notesHidden === undefined) {
         (board as any).notesHidden = false;
       }
     }
     result.version = 7;
   }
   ```

**Done when:**
- [ ] TypeScript не выдаёт ошибок при компиляции
- [ ] `Board` содержит `notesHidden: boolean`
- [ ] `createDefaultBoard()` возвращает объект с `notesHidden: false`
- [ ] `DEFAULT_DATA.version === 7`
- [ ] Блок миграции `version < 7` присутствует с проверкой `=== undefined`

---

### Фаза 2: Хранилище

#### 2.1 Обновить updateBoard в dataStore
**Оценка:** 20 мин
**Зависимости:** 1.1
**Файлы:**
- `src/stores/dataStore.ts`

**Шаги:**
1. В сигнатуре `updateBoard()` добавить `notesHidden: boolean` в тип `fields`
2. В теле функции добавить `board.notesHidden = fields.notesHidden;`

**Done when:**
- [ ] `updateBoard` принимает `notesHidden` и записывает его в store
- [ ] TypeScript не выдаёт ошибок

---

### Фаза 3: UI

#### 3.1 BoardSettingsPopup — тогл Notes
**Оценка:** 30 мин
**Зависимости:** 1.1, 2.1
**Файлы:**
- `src/ui/BoardSettingsPopup.svelte`

**Шаги:**
1. Перед кодингом проверить в `src/styles.css` CSS-правила `.tm-popup__group-row` — Grid или Flexbox. Если Grid с тремя колонками, строка Notes требует пустого `<span>` для третьей колонки (fullWidth); если Flexbox — пустой span не нужен.
2. Добавить локальную переменную:
   ```typescript
   let notesHidden: boolean = board.notesHidden;
   ```
3. Обновить сигнатуру пропа `onSave`: добавить `notesHidden: boolean`
4. В `handleSave()` передать `notesHidden` в вызов `onSave`
5. В шаблоне, после `{#each GROUP_IDS}`, добавить:
   - `<div class="tm-popup__divider">` — разделитель
   - Строку с тоглом Notes по паттерну `tm-popup__group-row`:
     ```svelte
     <div class="tm-popup__group-row">
       <span class="tm-popup__group-name">{$t('boardSettings.notes')}</span>
       <input
         type="checkbox"
         class="tm-popup__group-toggle"
         checked={!notesHidden}
         on:change={() => { notesHidden = !notesHidden; }}
       />
       <span></span>
     </div>
     ```
   > Пустой `<span>` для выравнивания по колонке fullWidth (третья колонка), как у групп

**Done when:**
- [ ] В попапе после списка групп появляется разделитель и строка Notes
- [ ] Тогл Notes инициализируется из `board.notesHidden`
- [ ] Переключение тогла меняет локальную переменную
- [ ] Save передаёт `notesHidden` в `onSave`
- [ ] Cancel (через `onClose`) не сохраняет изменения — локальная переменная сбрасывается при повторном открытии

#### 3.2 BoardHeader — прокинуть notesHidden
**Оценка:** 15 мин
**Зависимости:** 3.1, 2.1
**Файлы:**
- `src/ui/BoardHeader.svelte`

**Шаги:**
1. В сигнатуре `saveSettings` добавить `notesHidden: boolean` в тип `fields`:
   ```typescript
   function saveSettings(fields: {
     title: string;
     subtitle: string;
     hiddenGroups: GroupId[];
     fullWidths: Record<GroupId, boolean>;
     notesHidden: boolean;   // NEW
   }) { ... }
   ```
2. Тело функции не меняется — `notesHidden` уже попадает в `updateBoard` через `{ ...fields, groupFullWidths }`

**Done when:**
- [ ] TypeScript не выдаёт ошибок на несоответствие типов между попапом и хэдером
- [ ] `notesHidden` корректно передаётся в `updateBoard`

#### 3.3 BoardLayout — условный рендер
**Оценка:** 10 мин
**Зависимости:** 1.1
**Файлы:**
- `src/ui/BoardLayout.svelte`

**Шаги:**
1. Найти блок (строки 273–279):
   ```svelte
   <div class="tm-board-layout__notes">
     <NotesSection ... />
   </div>
   ```
2. Обернуть в `{#if !board.notesHidden}`:
   ```svelte
   {#if !board.notesHidden}
     <div class="tm-board-layout__notes">
       <NotesSection
         boardId={board.id}
         notes={board.notes}
         collapsed={board.notesCollapsed}
       />
     </div>
   {/if}
   ```

**Done when:**
- [ ] При `board.notesHidden === true` блок `.tm-board-layout__notes` отсутствует в DOM
- [ ] При `board.notesHidden === false` блок присутствует как прежде

---

### Фаза 4: Локализация и стили

#### 4.1 i18n — новый ключ
**Оценка:** 10 мин
**Зависимости:** нет
**Файлы:**
- `src/i18n/en.ts`
- `src/i18n/ru.ts`

**Шаги:**
1. В `en.ts` в секцию `boardSettings` добавить:
   ```typescript
   notes: 'Notes',
   ```
2. В `ru.ts` в секцию `boardSettings` добавить:
   ```typescript
   notes: 'Заметки',
   ```

**Done when:**
- [ ] `$t('boardSettings.notes')` возвращает `'Notes'` для EN и `'Заметки'` для RU
- [ ] TypeScript не выдаёт ошибок об отсутствующих ключах

#### 4.2 CSS — стиль разделителя
**Оценка:** 10 мин
**Зависимости:** нет
**Файлы:**
- `src/styles.css`

**Шаги:**
1. Добавить CSS-класс `.tm-popup__divider` — горизонтальная линия внутри секции попапа. Ориентироваться на существующие переменные темы Obsidian (например, `--color-base-30`) для совместимости с light/dark темой:
   ```css
   .tm-popup__divider {
     height: 1px;
     background-color: var(--color-base-30);
     margin: 8px 0;
   }
   ```

**Done when:**
- [ ] Разделитель визуально отделяет группы от тогла Notes
- [ ] Выглядит корректно в light и dark теме

---

### Фаза 5: Сборка и ручное тестирование

#### 5.1 Сборка
**Оценка:** 5 мин
**Зависимости:** все предыдущие
**Файлы:** —

**Шаги:**
1. Запустить `npm run build` (или `node esbuild.config.mjs`)
2. Убедиться, что нет TypeScript-ошибок и предупреждений

**Done when:**
- [ ] Сборка завершается без ошибок
- [ ] `main.js` и `styles.css` обновлены

#### 5.2 Ручное тестирование
**Оценка:** 30 мин
**Зависимости:** 5.1
**Файлы:** —

Проверить по чеклисту из спеки (раздел 7):

**Основные сценарии:**
- [ ] Скрыть Notes → секция исчезает с доски, контент сохраняется
- [ ] Показать Notes обратно → контент возвращается, collapsed-состояние сохранено
- [ ] Cancel не применяет изменения; клик по overlay — то же самое
- [ ] Настройки видимости Notes независимы для разных досок
- [ ] Новая доска: Notes видима по умолчанию

**Миграция:**
- [ ] Симулировать `version=6` в `data.json` (вручную убрать `notesHidden`) → после перезагрузки Obsidian поле появляется, Notes видима
- [ ] `notesHidden: true` в `data.json` → Notes скрыта при загрузке

**Взаимодействие с collapse:**
- [ ] Свернуть → скрыть → показать → Notes свёрнута
- [ ] Развернуть → скрыть → показать → Notes развёрнута

**Визуальные:**
- [ ] Разделитель виден и аккуратен
- [ ] Light и dark тема
