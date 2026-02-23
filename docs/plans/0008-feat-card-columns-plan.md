# План: Мультиколоночный лейаут карточек

**Спецификация:** [docs/specs/0008-feat-card-columns.md](../specs/0008-feat-card-columns.md)
**Общая оценка:** 3.5h

---

## Фаза 1: Слой данных

### 1.1 Типы и схема данных
**Оценка:** 30min
**Зависимости:** нет
**Файлы:**
- `src/data/types.ts`
- `src/data/defaults.ts`
- `src/data/migration.ts`

**Шаги:**

**`src/data/types.ts`** — добавить после `CardView`:
```typescript
export type CardLayout = 'single' | 'multi';
```
И в `Settings` после `cardView`:
```typescript
cardLayout: CardLayout;
```

**`src/data/defaults.ts`** — два изменения:
1. В `DEFAULT_SETTINGS` после `cardView: 'default'` добавить:
   ```typescript
   cardLayout: 'single',
   ```
2. Изменить версию в `DEFAULT_DATA`:
   ```typescript
   version: 6, // было: 5
   ```

**`src/data/migration.ts`** — добавить новый блок **перед `return result`** (после блока `version < 5`, строка 68):
```typescript
if (version < 6) {
  if (!result.settings.cardLayout) {
    result.settings.cardLayout = 'single';
  }
  result.version = 6;
}
```

**Done when:**
- [ ] `tsc --noEmit` не выдаёт ошибок (типы совместимы)
- [ ] `DEFAULT_DATA.version === 6`
- [ ] Блок миграции `version < 6` присутствует в `migration.ts`

---

## Фаза 2: Локализация

### 2.1 i18n — типы и переводы
**Оценка:** 20min
**Зависимости:** 1.1 (нужен TypeScript-тип)
**Файлы:**
- `src/i18n/types.ts`
- `src/i18n/en.ts`
- `src/i18n/ru.ts`

**Шаги:**

**`src/i18n/types.ts`** — добавить 4 ключа в `TranslationKey` после строки `'settings.cardViewCompact'`:
```typescript
| 'settings.cardLayout' | 'settings.cardLayoutDesc'
| 'settings.cardLayoutSingle' | 'settings.cardLayoutMulti'
```

**`src/i18n/en.ts`** — добавить после `'settings.cardViewCompact': 'Compact (1 line)',`:
```typescript
'settings.cardLayout': 'Card layout',
'settings.cardLayoutDesc': 'Number of cards per row in each group',
'settings.cardLayoutSingle': 'Single column',
'settings.cardLayoutMulti': 'Multi-column (4 / 2)',
```

**`src/i18n/ru.ts`** — добавить после `'settings.cardViewCompact': 'Компактный (1 строка)',`:
```typescript
'settings.cardLayout': 'Лейаут карточек',
'settings.cardLayoutDesc': 'Количество карточек в строке',
'settings.cardLayoutSingle': 'Одна колонка',
'settings.cardLayoutMulti': 'Несколько колонок (4 / 2)',
```

**Done when:**
- [ ] `tsc --noEmit` без ошибок (`Translations` — полный объект)
- [ ] Все 4 ключа присутствуют в обоих файлах переводов

---

## Фаза 3: Settings UI

### 3.1 Dropdown в настройках плагина
**Оценка:** 20min
**Зависимости:** 2.1 (ключи переводов)
**Файлы:**
- `src/settings.ts`

**Шаги:**

В `settings.ts` добавить новый блок `new Setting(...)` **после** блока `cardView` (после строки 57, до блока `defaultPriority`):

```typescript
new Setting(containerEl)
  .setName(tr('settings.cardLayout'))
  .setDesc(tr('settings.cardLayoutDesc'))
  .addDropdown(dd =>
    dd
      .addOptions({
        single: tr('settings.cardLayoutSingle'),
        multi:  tr('settings.cardLayoutMulti'),
      })
      .setValue(this.plugin.data.settings.cardLayout)
      .onChange(async (value) => {
        this.plugin.data.settings.cardLayout = value as 'single' | 'multi';
        dataStore.set(this.plugin.data);
        await this.plugin.savePluginData();
      })
  );
```

**Done when:**
- [ ] В Settings tab виден dropdown "Card layout" с двумя опциями
- [ ] Переключение сохраняется в `data.json` (поле `settings.cardLayout`)
- [ ] `tsc --noEmit` без ошибок

---

## Фаза 4: Компоненты

### 4.1 TaskGroup.svelte
**Оценка:** 20min
**Зависимости:** 1.1 (тип `CardLayout`)
**Файлы:**
- `src/ui/TaskGroup.svelte`

**Шаги:**

В блоке `<script>`:
1. Добавить импорт `dataStore` (после существующих импортов):
   ```typescript
   import { dataStore } from '../stores/dataStore';
   ```
2. Добавить реактивные переменные (после `$: groupTasks = ...`):
   ```typescript
   $: cardLayout = $dataStore.settings.cardLayout;
   $: isMulti = cardLayout === 'multi';
   $: columns = isMulti ? (group.fullWidth ? 4 : 2) : 1;
   ```

В шаблоне заменить `<div class="tm-task-group__body" ...>`:
```svelte
<div
  class="tm-task-group__body"
  class:tm-task-group__body--multi={isMulti}
  data-group-id={groupId}
  use:useSortable={{ groupId }}
  style="--tm-card-columns: {columns}"
>
```

**Done when:**
- [ ] При `cardLayout: 'multi'` на div появляется класс `tm-task-group__body--multi` и CSS-переменная `--tm-card-columns`
- [ ] При `cardLayout: 'single'` поведение неотличимо от текущего

### 4.2 CollapsibleGroup.svelte
**Оценка:** 20min
**Зависимости:** 1.1 (тип), 4.1 (аналогичный паттерн)
**Файлы:**
- `src/ui/CollapsibleGroup.svelte`

**Шаги:**

Аналогично 4.1 — в блоке `<script>`:
1. Добавить импорт:
   ```typescript
   import { dataStore } from '../stores/dataStore';
   ```
2. Добавить реактивные переменные:
   ```typescript
   $: cardLayout = $dataStore.settings.cardLayout;
   $: isMulti = cardLayout === 'multi';
   $: columns = isMulti ? (group.fullWidth ? 4 : 2) : 1;
   ```

В шаблоне заменить строку 61 (`<div class="tm-collapsible-group__body" ...>`):
```svelte
<div
  class="tm-collapsible-group__body"
  class:tm-collapsible-group__body--multi={isMulti}
  data-group-id={groupId}
  use:useSortable={{ groupId }}
  style="--tm-card-columns: {columns}"
>
```

**Done when:**
- [ ] `tm-collapsible-group__body--multi` появляется при `cardLayout: 'multi'`
- [ ] Группы backlog и completed реагируют на переключение

### 4.3 TaskCard.svelte — tooltip для FR-7
**Оценка:** 5min
**Зависимости:** нет
**Файлы:**
- `src/ui/TaskCard.svelte`

**Шаги:**

Найти строку 88 (`<div class="tm-task-card__what">{task.what}</div>`) и добавить атрибут `title`:
```svelte
<div class="tm-task-card__what" title={task.what}>{task.what}</div>
```

> Compact-вариант (`tm-task-card__what-compact`, строка 50) уже имеет `title={task.what}` — не трогать.

**Done when:**
- [ ] При наведении на поле «Что» в default-карточке появляется tooltip с полным текстом

---

## Фаза 5: CSS

### 5.1 Стили — CSS Grid и multi-режим
**Оценка:** 30min
**Зависимости:** нет (стили независимы от JS)
**Файлы:**
- `src/styles.css`

**Шаги:**

**Заменить блок `.tm-task-group__body`** (строки 108–117) на полный итоговый вариант:
```css
.tm-task-group__body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: grid;
  grid-template-columns: repeat(var(--tm-card-columns, 1), minmax(0, 1fr));
  align-content: start;
  gap: 0.35rem;
  padding: 0.35rem;
  min-height: 2rem;
}

.tm-task-group__body > .tm-empty-state {
  grid-column: 1 / -1;
}
```

Найти блок `.tm-collapsible-group__body` в `styles.css` и заменить на полный итоговый вариант (добавить grid-свойства, сохранить `max-height: 50vh`):
```css
.tm-collapsible-group__body {
  padding: 0.35rem;
  max-height: 50vh;
  overflow-y: auto;
  overflow-x: hidden;
  display: grid;
  grid-template-columns: repeat(var(--tm-card-columns, 1), minmax(0, 1fr));
  align-content: start;
  gap: 0.35rem;
  min-height: 2rem;
}

.tm-collapsible-group__body > .tm-empty-state {
  grid-column: 1 / -1;
}
```

**Добавить** в конец секции CollapsibleGroup (или в раздел медиазапросов) **три новых блока**:

```css
/* Мобильные: принудительно 1 колонка */
@media (max-width: 600px) {
  .tm-task-group__body,
  .tm-collapsible-group__body {
    grid-template-columns: 1fr;
  }
}

/* Multi-режим: поле «Что» обрезается в одну строку.
   Базовый .tm-task-card__what имеет display:-webkit-box и -webkit-line-clamp:3,
   несовместимые с white-space:nowrap — сбрасываем явно. */
.tm-task-group__body--multi .tm-task-card__what,
.tm-collapsible-group__body--multi .tm-task-card__what {
  display: block;             /* сброс -webkit-box */
  -webkit-line-clamp: unset;  /* сброс 3-строчного clamp */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

**Done when:**
- [ ] `src/styles.css` отслеживается git (`git ls-files src/styles.css` — файл в индексе)
- [ ] В single-режиме карточки 100% ширины (grid с 1 колонкой визуально = flex)
- [ ] В multi-режиме full-width группа — 4 колонки, half-width — 2
- [ ] Empty State занимает всю ширину в обоих body-классах
- [ ] На <600px — 1 колонка независимо от настройки
- [ ] Поле «Что» в --multi обрезается с ellipsis

---

## Фаза 6: Тестирование

### 6.1 Ручное тестирование по чеклисту
**Оценка:** 60min
**Зависимости:** 1.1–5.1 (все изменения)
**Файлы:** нет

Выполнить все тест-кейсы из спецификации (раздел 6):

- [ ] TC-1: Дефолтное состояние — карточки в 1 колонку (single)
- [ ] TC-2: Переключить в Multi — все группы мгновенно 4/2 колонки
- [ ] TC-3: Переключить обратно в Single — 1 колонка
- [ ] TC-4: Full-width, 8 задач, multi — 2 строки по 4
- [ ] TC-5: Half-width, 8 задач, multi — 4 строки по 2
- [ ] TC-6: Full-width, 5 задач, multi — 4 + 1 карточка (25% ширины, не растягивается)
- [ ] TC-7: Empty State в multi — занимает 100% ширины группы
- [ ] TC-8: Drag-and-drop внутри группы в multi — корректно
- [ ] TC-9: Drag-and-drop между 4-колоночной и 2-колоночной группами
- [ ] TC-10: Compact + Multi — compact-карточки в 4/2 колонки (desktop)
- [ ] TC-11: Default + Multi, длинный заголовок — обрезается с «…», tooltip полный текст
- [ ] TC-12: Default + Multi, короткий заголовок — без обрезки
- [ ] TC-13: Переключение fullWidth группы в multi — 4→2 без перезагрузки
- [ ] TC-14: Перезапуск Obsidian — настройка `multi` сохраняется
- [ ] TC-15: Миграция data.json без `cardLayout` — загружается, 1 колонка
- [ ] TC-16: Узкий экран (<600px) — 1 колонка независимо от настройки
- [ ] TC-17: Смена языка — подписи в dropdown переключаются корректно

**Done when:**
- [ ] Все 17 тест-кейсов пройдены
- [ ] Регрессий в режиме `single` нет

---

## Порядок коммитов

| # | Фаза | Сообщение |
|---|------|-----------|
| 1 | 1.1 | `feat: add CardLayout type and data migration to version 6` |
| 2 | 2.1 | `feat: add i18n keys for cardLayout setting` |
| 3 | 3.1 | `feat: add Card layout dropdown to settings tab` |
| 4 | 4.1–4.3 | `feat: add multi-column support to TaskGroup, CollapsibleGroup, TaskCard` |
| 5 | 5.1 | `feat: apply CSS Grid layout and multi-column styles` |
