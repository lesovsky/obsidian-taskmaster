# Быстрые заметки (Quick Notes)

---

# Часть 1: Продуктовая

## Что меняется для пользователя

- Под группой «Завершённые» появляется **сворачиваемая секция «Заметки»** (Notes)
- Внутри — одно текстовое поле (textarea), куда можно записать произвольный текст
- Заметки **привязаны к доске** — у каждой доски свой блокнот
- Текст сохраняется автоматически при вводе (через `persist()`)
- Секция по умолчанию **свёрнута** (как Бэклог и Завершённые)

---

## Зачем это нужно

В течение рабочего дня возникают мысли, ссылки, обрывки информации, которые:

- **Нет времени** оформлять в задачу — нужно быстро записать и вернуться к работе
- **Нет уверенности**, что это станет задачей — может быть удалено позже
- **Нужно выгрузить из головы** — место для «рабочей памяти» рядом с доской задач

Создавать для каждой такой мысли задачу с полями SMART — избыточно. Заметки дают легковесную альтернативу: записал → обработал позже → удалил или вручную создал задачу.

---

## Внешний вид

Секция расположена **под группой «Завершённые»**, визуально аналогична сворачиваемым группам (Бэклог, Завершённые):

```
│─────────────────────────────────────────────│
│  ▶ Завершённые (47)               свёрнут  │
│─────────────────────────────────────────────│
│  ▼ Заметки                                  │
│  ┌─────────────────────────────────────────┐ │
│  │ Позвонить Петрову по поводу бюджета     │ │
│  │ https://link.to/document                │ │
│  │ Идея: переделать отчёт в формате таблицы│ │
│  │                                         │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Элементы секции:**

- **Заголовок** — текст «Заметки» (локализованный) + стрелка сворачивания (▶/▼), аналогично Бэклогу
- **Textarea** — многострочное текстовое поле, видимое когда секция развёрнута
- Высота textarea фиксированная: **6 строк** (≈ `8rem`). Если текста больше — появляется вертикальный скролл
- **Нет** кнопки «+», «...», WIP-лимитов и прочих элементов групп задач — это простой блокнот
- **Placeholder** в пустом поле: «Быстрые заметки, ссылки, мысли...» (локализованный)

---

## Поведение

### Ввод и сохранение

- Пользователь кликает в textarea и начинает набирать текст
- Текст сохраняется через **debounced persist** — через 500мс после последнего нажатия клавиши
- При переключении доски — показывается текст заметок новой доски

### Сворачивание/разворачивание

- По умолчанию секция **свёрнута**
- Состояние collapsed сохраняется в данных доски (аналогично Бэклогу и Завершённым)
- Клик по заголовку — toggle

### Очистка

- Пользователь вручную выделяет текст и удаляет — стандартное поведение textarea
- Нет специальной кнопки «Очистить»

### Преобразование в задачу

- В MVP **нет автоматической конвертации** — пользователь сам копирует текст, создаёт задачу вручную и удаляет заметку
- Конвертация заметки в задачу — кандидат в пост-MVP

---

## Обработка граничных случаев

### Случай 1: Переключение досок

Каждая доска хранит свой текст заметок. При переключении — textarea обновляется текстом выбранной доски.

**Важный нюанс:** при переключении доски во время активного debounce-таймера (пользователь набирал текст < 500мс назад) — таймер очищается через `onDestroy`, несохранённый текст не «утекает» в другую доску. Дополнительно `boardId` захватывается в замыкании таймера в момент ввода, а не в момент срабатывания — защита от race condition.

### Случай 2: Re-render во время набора текста

Если во время набора (до срабатывания debounce) произойдёт обновление `dataStore` (например, истёк toast-таймер) — Svelte перерисует компонент. Чтобы символы, набранные за последние 500мс, не пропали — textarea привязан к **локальной переменной** `localNotes`, которая синхронизируется от prop реактивно, но не сбрасывается при каждом re-render.

### Случай 3: Пустая заметка

Textarea отображает placeholder. Пустая строка `""` не занимает место в `data.json` (сохраняется как пустая строка).

### Случай 4: Очень длинный текст

Textarea имеет фиксированную высоту с вертикальным скроллом. Технический лимит — **5000 символов** (`maxlength` на textarea), чтобы data.json не раздувался.

### Случай 5: Вставка из буфера (Ctrl+V)

Работает стандартно. Вставленный текст обрабатывается как обычный ввод, сохраняется через debounced persist.

---

# Часть 2: Техническая

## Изменения в структуре данных

### `src/data/types.ts` — новое поле в `Board`

```typescript
export interface Board {
  id: string;
  title: string;
  subtitle: string;
  groups: Record<GroupId, Group>;
  notes: string;              // ← новое поле
  notesCollapsed: boolean;    // ← новое поле
}
```

### `src/data/defaults.ts` — значения по умолчанию

В `createDefaultBoard()` добавить поля `notes` и `notesCollapsed` в return-объект:

```typescript
export function createDefaultBoard(title = 'New board'): Board {
  // ... groups setup ...

  return {
    id: crypto.randomUUID(),
    title,
    subtitle: '',
    groups,
    notes: '',              // ← новое поле
    notesCollapsed: true,   // ← новое поле
  };
}
```

Также обновить `DEFAULT_DATA.version` с `2` на `3`.

### `src/data/migration.ts` — миграция

Текущая версия: `2`. Новая версия: **`3`**.

Добавить блок `if (version < 3)` **после** существующего блока `if (version < 2)` и проверки `cardView`, но **перед** `return result`:

```typescript
export function migrateData(data: unknown): PluginData {
  // ... existing code ...

  // Ensure cardView exists (backward compatibility for version 2 without this field)
  if (result.settings.cardView === undefined) {
    result.settings.cardView = DEFAULT_SETTINGS.cardView;
  }

  // ↓ новый блок миграции ↓
  if (version < 3) {
    for (const board of result.boards) {
      if ((board as any).notes === undefined) {
        board.notes = '';
      }
      if ((board as any).notesCollapsed === undefined) {
        board.notesCollapsed = true;
      }
    }
    result.version = 3;
  }

  return result;
}
```

**Примечание:** `(board as any)` нужен, потому что TypeScript-интерфейс `Board` уже содержит `notes: string` (обязательное поле), и прямое сравнение `board.notes === undefined` вызовет ошибку компиляции. Cast через `any` обходит это для миграции legacy-данных.

---

## Изменения в компонентах

### 1. `src/stores/dataStore.ts` — новые функции

**`updateBoardNotes()`** — сохраняет текст заметок:

```typescript
export function updateBoardNotes(boardId: string, notes: string): void {
  dataStore.update(data => {
    const board = data.boards.find(b => b.id === boardId);
    if (!board) return data;
    board.notes = notes;
    return data;
  });
  persist();
}
```

**`toggleNotesCollapsed()`** — сворачивание/разворачивание секции:

```typescript
export function toggleNotesCollapsed(boardId: string): void {
  dataStore.update(data => {
    const board = data.boards.find(b => b.id === boardId);
    if (!board) return data;
    board.notesCollapsed = !board.notesCollapsed;
    return data;
  });
  persist();
}
```

---

### 2. Новый компонент `src/ui/NotesSection.svelte`

Сворачиваемая секция с textarea:

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { t } from '../i18n';
  import { updateBoardNotes, toggleNotesCollapsed } from '../stores/dataStore';

  export let boardId: string;
  export let notes: string;
  export let collapsed: boolean;

  const MAX_LENGTH = 5000;
  let debounceTimer: ReturnType<typeof setTimeout>;

  // Локальная переменная для textarea — защита от потери символов при re-render.
  // Svelte с value={notes} (one-way binding) сбрасывает textarea к последнему
  // сохранённому значению при любом обновлении dataStore. Локальная переменная
  // обновляется от prop реактивно, но не теряет unsaved input.
  let localNotes = notes;
  $: localNotes = notes;

  function handleToggle() {
    toggleNotesCollapsed(boardId);
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    localNotes = target.value;

    // Захватываем boardId в момент ввода — защита от race condition
    // при переключении доски до срабатывания таймера
    const targetBoardId = boardId;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updateBoardNotes(targetBoardId, localNotes);
    }, 500);
  }

  // Очистка таймера при уничтожении компонента (переключение доски, закрытие view)
  onDestroy(() => {
    clearTimeout(debounceTimer);
  });
</script>

<div class="tm-notes-section">
  <button class="tm-notes-section__header" on:click={handleToggle}>
    <span class="tm-notes-section__arrow">{collapsed ? '▶' : '▼'}</span>
    <span class="tm-notes-section__title">{$t('notes.title')}</span>
  </button>

  {#if !collapsed}
    <div class="tm-notes-section__body">
      <textarea
        class="tm-notes-section__textarea"
        bind:value={localNotes}
        on:input={handleInput}
        placeholder={$t('notes.placeholder')}
        maxlength={MAX_LENGTH}
      ></textarea>
    </div>
  {/if}
</div>
```

**Ключевые решения:**

- **`localNotes`** вместо прямого `value={notes}` — предотвращает потерю набранных символов при re-render (когда dataStore обновляется из-за toast-таймера или другого события, Svelte перерисовывает компонент; one-way binding сбросил бы textarea к последнему persist-значению)
- **`$: localNotes = notes`** — реактивная синхронизация от parent при переключении доски (новый `notes` prop → обновляется localNotes → textarea показывает текст новой доски)
- **`bind:value={localNotes}`** — двустороннее связывание с локальной переменной
- **`targetBoardId` в замыкании** — захват boardId в момент ввода, не в момент срабатывания debounce
- **`onDestroy`** — очистка pending-таймера при переключении доски или закрытии view

---

### 3. `src/ui/BoardLayout.svelte` — подключение

**Новый импорт:**

```typescript
import NotesSection from './NotesSection.svelte';
```

**В шаблоне** — добавить после блока `tm-board-layout__collapsible` с «Завершёнными»:

```svelte
  <!-- Completed group -->
  <div class="tm-board-layout__collapsible">
    <CollapsibleGroup groupId="completed" ... />
  </div>

  <!-- Notes section -->
  <div class="tm-board-layout__collapsible">
    <NotesSection
      boardId={board.id}
      notes={board.notes}
      collapsed={board.notesCollapsed}
    />
  </div>
</div>
```

---

### 4. `src/i18n/types.ts` — новые ключи

Добавить в `TranslationKey`:

```typescript
| 'notes.title'
| 'notes.placeholder'
```

### 5. `src/i18n/en.ts` — английские переводы

```typescript
'notes.title': 'Notes',
'notes.placeholder': 'Quick notes, links, thoughts...',
```

### 6. `src/i18n/ru.ts` — русские переводы

```typescript
'notes.title': 'Заметки',
'notes.placeholder': 'Быстрые заметки, ссылки, мысли...',
```

---

### 7. `src/styles.css` — новые классы

```css
/* ─── Notes Section ─── */

.tm-notes-section {
  margin-top: 0.5rem;
}

.tm-notes-section__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: none;
  background: var(--background-secondary);
  color: var(--text-normal);
  cursor: pointer;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
}

.tm-notes-section__header:hover {
  background: var(--background-modifier-hover);
}

.tm-notes-section__arrow {
  font-size: 0.65rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.tm-notes-section__title {
  color: var(--text-muted);
}

.tm-notes-section__body {
  margin-top: 0.25rem;
}

.tm-notes-section__textarea {
  width: 100%;
  height: 8rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-primary);
  color: var(--text-normal);
  font-family: inherit;
  font-size: 0.85rem;
  line-height: 1.4;
  resize: vertical;
  box-sizing: border-box;
}

.tm-notes-section__textarea::placeholder {
  color: var(--text-faint);
}

.tm-notes-section__textarea:focus {
  outline: none;
  border-color: var(--interactive-accent);
  box-shadow: 0 0 0 2px var(--interactive-accent-hover);
}
```

---

## Миграция данных

**Версия:** `2` → `3`.

**Что делает миграция:** добавляет `notes: ''` и `notesCollapsed: true` ко всем существующим доскам. Миграция идемпотентна — проверяет наличие поля через `=== undefined`.

**Файлы, затронутые версией:**
- `src/data/defaults.ts` — `DEFAULT_DATA.version` с `2` на `3`
- `src/data/migration.ts` — новый блок `if (version < 3)`

## Осознанные решения

### Нет настройки «показать/скрыть заметки»

Секция «Заметки» доступна всегда — нет toggle в Settings. Обоснование:
- Сворачивание секции (collapsed по умолчанию) уже достаточно скрывает её от тех, кому она не нужна
- Добавление настройки усложняет код (условный рендеринг, ещё одно поле в Settings) без значимой пользы
- Если в будущем появится запрос — можно добавить в пост-MVP

---

## Тестирование

### Функциональные сценарии

1. **Базовый ввод**
   - Развернуть секцию «Заметки»
   - Набрать текст → подождать 1 сек
   - Перезагрузить Obsidian → текст на месте

2. **Вставка из буфера**
   - Скопировать многострочный текст → Ctrl+V в textarea
   - Проверить: текст сохранился

3. **Переключение досок**
   - Написать заметку на Доске 1
   - Переключиться на Доску 2 → textarea пустой (или с текстом Доски 2)
   - Вернуться на Доску 1 → заметка на месте

4. **Race condition: быстрое переключение доски**
   - Начать набирать текст на Доске 1
   - **Немедленно** (< 500мс) переключиться на Доску 2
   - Подождать 1 сек
   - Проверить: Доска 2 не содержит текст Доски 1
   - Вернуться на Доску 1 → текст, набранный до переключения, может быть потерян (debounce-таймер очищен при destroy) — **ожидаемое поведение**, данные Доски 2 не повреждены

5. **Сворачивание**
   - Свернуть секцию → перезагрузить → секция свёрнута
   - Развернуть → перезагрузить → секция развёрнута

6. **Лимит символов**
   - Вставить текст > 5000 символов → textarea обрезает до 5000

7. **Новая доска**
   - Создать новую доску → секция «Заметки» присутствует, свёрнута, textarea пустой

8. **Миграция**
   - Загрузить плагин с data.json без полей `notes`/`notesCollapsed`
   - Проверить: секция появилась, свёрнута, пустая

9. **Темы**
   - Проверить в светлой теме: textarea читабелен, border видим
   - Проверить в тёмной теме: textarea читабелен, placeholder видим

10. **Локализация**
    - EN: заголовок «Notes», placeholder «Quick notes, links, thoughts...»
    - RU: заголовок «Заметки», placeholder «Быстрые заметки, ссылки, мысли...»

11. **Re-render во время набора**
    - Начать набирать текст в заметках
    - Пока debounce не сработал — удалить какую-нибудь задачу (вызывает обновление dataStore)
    - Проверить: текст в textarea не сбросился к предыдущему сохранённому значению

---

## Производительность

- Debounced persist (500мс) предотвращает запись в файл на каждое нажатие клавиши
- Textarea рендерится только когда секция развёрнута (`{#if !collapsed}`)
- Один `string` в `Board` — минимальный overhead в `data.json`

---

## Известные ограничения

1. **Только plain text** — без форматирования, markdown-разметки, ссылок. Для структурированных записей есть задачи
2. **Нет конвертации в задачу** — пользователь вручную копирует текст и создаёт задачу. Автоконвертация — кандидат в пост-MVP
3. **Нет множественных заметок** — одно текстовое поле на доску. Если нужна структура — создавайте задачи
4. **Потеря последних символов при быстром переключении доски** — если пользователь набирает текст и переключает доску до срабатывания debounce (< 500мс), последние символы не сохранятся. Debounce-таймер очищается при destroy компонента, чтобы не записать текст в чужую доску. Это осознанный компромисс: целостность данных важнее потери нескольких символов
5. **Высота textarea не сохраняется** — пользователь может менять высоту через `resize: vertical`, но при перезагрузке она сбрасывается к 8rem. Персистенция высоты — возможное пост-MVP улучшение

---

## Дальнейшие улучшения (пост-MVP)

1. **Конвертация в задачу** — кнопка на заметке, открывающая модалку создания задачи с предзаполненным полем «Что»
2. **Список заметок** — вместо одного textarea — несколько отдельных заметок с возможностью удаления каждой
3. **Markdown-рендеринг** — отображение ссылок как кликабельных, базовое форматирование
