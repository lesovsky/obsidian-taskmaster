# Notes Visibility Settings

**Статус:** Draft
**Дата:** 2026-02-23

## 1. Контекст и проблема

### Текущая ситуация

В TaskMaster секция заметок (Notes) отображается на каждой доске всегда. Пользователь может **свернуть** её (collapse — секция видна, контент скрыт), но не может убрать её полностью с доски. При этом группы задач можно скрыть через настройки доски (реализовано в спеке 0006).

### Цель

Дать пользователю возможность **полностью скрыть секцию Notes** через настройки доски — по аналогии с группами задач. Контент заметок при этом сохраняется.

### Различие между «скрыть» и «свернуть»

| Действие | Где | Результат в DOM | Данные |
|----------|-----|-----------------|--------|
| Свернуть (collapse) | Стрелка в заголовке NotesSection | Секция в DOM, контент скрыт | `notesCollapsed: true` |
| Скрыть (hide) | BoardSettingsPopup | Секция не рендерится совсем | `notesHidden: true` |

### Метрики успеха

- Пользователь может скрыть секцию Notes в 2 клика (настройки доски → тогл)
- Контент заметок не теряется при скрытии и возвращается при показе
- Настройка независима для каждой доски

---

## 2. Требования

### Функциональные

- [ ] [FR-1] Пользователь может скрыть/показать секцию Notes через настройки доски
- [ ] [FR-2] Настройка видимости Notes задаётся **per-board**
- [ ] [FR-3] Скрытая Notes не отображается на доске (секция полностью убрана из DOM)
- [ ] [FR-4] Контент заметок сохраняется при скрытии и восстанавливается при показе
- [ ] [FR-5] Состояние `notesCollapsed` (свёрнута/развёрнута) сохраняется независимо от `notesHidden` — при показе обратно секция принимает то же collapsed-состояние, что было до скрытия
- [ ] [FR-6] По умолчанию Notes видима (обратная совместимость)
- [ ] [FR-7] Нажатие Cancel в попапе настроек отменяет несохранённые изменения видимости Notes

### Нефункциональные

- [ ] [NFR-1] Настройка сохраняется через стандартный `persist()` вместе с данными доски
- [ ] [NFR-2] После миграции `version 6 → 7` у каждого `Board` появляется `notesHidden: false`; поведение не изменяется
- [ ] [NFR-3] Переключение видимости не требует перезагрузки плагина — реактивное обновление

---

## 3. User Stories

### US-1: Скрыть секцию Notes

**Как** пользователь, который не ведёт заметки на доске
**Хочу** убрать секцию Notes с доски
**Чтобы** интерфейс был чище

**Критерии приёмки:**
- В настройках доски в секции видимости есть тогл для Notes
- После выключения тогла секция Notes исчезает с доски полностью
- Контент заметок не удаляется
- После включения тогла обратно секция Notes возвращается с тем же контентом
- Нажатие **Cancel** отменяет изменение — тогл возвращается к исходному состоянию

### US-2: Независимость досок

**Как** пользователь с несколькими досками
**Хочу** скрыть Notes на одной доске, но оставить на другой
**Чтобы** каждая доска имела свою конфигурацию

**Критерии приёмки:**
- Скрытие Notes на доске A не влияет на видимость Notes на доске B
- Настройка сохраняется при переключении между досками

---

## 4. Границы (Scope)

### В scope

- Управление видимостью Notes в `BoardSettingsPopup` (тогл в той же секции, что и группы)
- Per-board хранение (`Board.notesHidden: boolean`)
- Миграция данных (version 6 → 7)
- Локализация новых строк (EN + RU)

### Вне scope

- Изменение поведения collapse/expand (стрелка в заголовке Notes)
- Удаление контента заметок при скрытии
- Перенос Notes в другое место интерфейса

---

## 5. Технический дизайн

### Изменения типов (`src/data/types.ts`)

```typescript
export interface Board {
  id: string;
  title: string;
  subtitle: string;
  groups: Record<GroupId, Group>;
  notes: string;
  notesCollapsed: boolean;
  notesHidden: boolean;      // NEW — скрыть секцию Notes полностью, default: false
  hiddenGroups: GroupId[];
}
```

### Defaults (`src/data/defaults.ts`)

```typescript
export function createDefaultBoard(title = 'New board'): Board {
  return {
    // ... existing fields ...
    notesHidden: false,   // NEW
  };
}
```

### Миграция (`src/data/migration.ts`)

Текущая версия данных: `6`. Новая версия: `7`.

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

**Поведение при миграции:** добавляется `notesHidden: false`, секция Notes остаётся видимой — пользователь не заметит изменений. Проверка `=== undefined` защищает от перезаписи, если поле уже присутствует в данных.

### UI: BoardSettingsPopup (`src/ui/BoardSettingsPopup.svelte`)

Тогл для Notes добавляется в секцию "Group Visibility" **после** списка групп:

```
┌─────────────────────────────────┐
│ Board Settings                  │
├─────────────────────────────────┤
│ Title: [___________________]    │
│ Description: [______________]   │
├─────────────────────────────────┤
│ Group Visibility                │
│ Backlog (5)          [ON ]      │
│ Focus (1)            [ON ]      │
│ In Progress (3)      [ON ]      │
│ Org Intentions (2)   [OFF]      │
│ Delegated            [ON ]      │
│ Completed (12)       [ON ]      │
│ ─────────────────────────────── │
│ Notes                [ON ]      │  ← NEW
├─────────────────────────────────┤
│ [Delete]      [Cancel] [Save]   │
└─────────────────────────────────┘
```

Логика тогла Notes:
- Видимость Notes = `!notesHidden`; если `notesHidden=true` — тогл отображается в состоянии OFF
- При переключении: обновляется локальная переменная `notesHidden: boolean`
- Счётчик задач рядом с Notes **не отображается** — Notes является текстовым полем, а не группой задач
- Изменения применяются только при нажатии **Save** (не live)
- Нажатие **Cancel** и клик по overlay одинаково сбрасывают `notesHidden` к значению `board.notesHidden` на момент открытия — оба вызывают `onClose` без сохранения

Инициализация локального состояния (копия создаётся один раз при открытии попапа; обновление пропа `board` извне пока попап открыт не предусмотрено):
```typescript
let notesHidden: boolean = board.notesHidden;
```

Разделитель между списком групп и строкой Notes реализуется как `<div class="tm-popup__divider">` с новым CSS-правилом в `src/styles.css`. Новый класс, описывающий горизонтальную линию-разделитель внутри секции попапа.

Попап реализован как кастомный div-оверлей (не Obsidian Modal), поэтому нажатие **Escape** по умолчанию не обрабатывается — закрытие происходит только через **Cancel** или клик по overlay.

Изменение сигнатуры `onSave`:
```typescript
// было
onSave: (fields: { title: string; subtitle: string; hiddenGroups: GroupId[]; fullWidths: Record<GroupId, boolean> }) => void

// стало
onSave: (fields: { title: string; subtitle: string; hiddenGroups: GroupId[]; fullWidths: Record<GroupId, boolean>; notesHidden: boolean }) => void
```

> `fullWidths` (настройка ширины групп) — существующее поле, появилось в спеке 0007. Здесь только добавляется `notesHidden`.

### Рендеринг: BoardLayout (`src/ui/BoardLayout.svelte`)

Текущий код (строки 273–279):
```svelte
<div class="tm-board-layout__notes">
  <NotesSection ... />
</div>
```

`{#if}` должен обернуть весь блок включая обёртку `<div>`, иначе пустой div останется в DOM:
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

`NotesSection.svelte` **не изменяется** — только условие рендеринга в `BoardLayout`.

### Хранилище: dataStore (`src/stores/dataStore.ts`)

Обновить функцию `updateBoard()` — добавить `notesHidden` в аргументы и обновлять поле. Параметр `groupFullWidths` уже существует (добавлен в спеке 0007), изменяется только добавление `notesHidden`:

```typescript
export function updateBoard(
  boardId: string,
  fields: {
    title: string;
    subtitle: string;
    hiddenGroups: GroupId[];
    groupFullWidths: Record<GroupId, boolean>;  // существующее поле
    notesHidden: boolean;                        // NEW
  }
): void {
  dataStore.update(data => {
    const board = data.boards.find(b => b.id === boardId);
    if (board) {
      board.title = fields.title;
      board.subtitle = fields.subtitle;
      board.hiddenGroups = fields.hiddenGroups;
      board.notesHidden = fields.notesHidden;   // NEW
      for (const id of GROUP_IDS) {
        board.groups[id].fullWidth = fields.groupFullWidths[id];
      }
    }
    return data;
  });
  persist();
}
```

### Промежуточный слой: BoardHeader (`src/ui/BoardHeader.svelte`)

`BoardHeader` является промежуточным звеном между попапом и стором. Функция `saveSettings` принимает `fullWidths` из попапа, переименовывает в `groupFullWidths` для `updateBoard`, и теперь должна также передавать `notesHidden`:

```typescript
// было
function saveSettings(fields: { title: string; subtitle: string; hiddenGroups: GroupId[]; fullWidths: Record<GroupId, boolean> }) {
  const groupFullWidths = Object.fromEntries(GROUP_IDS.map(id => [id, fields.fullWidths[id]])) as Record<GroupId, boolean>;
  updateBoard(board.id, { ...fields, groupFullWidths });
  showSettings = false;
}

// стало
function saveSettings(fields: { title: string; subtitle: string; hiddenGroups: GroupId[]; fullWidths: Record<GroupId, boolean>; notesHidden: boolean }) {
  const groupFullWidths = Object.fromEntries(GROUP_IDS.map(id => [id, fields.fullWidths[id]])) as Record<GroupId, boolean>;
  updateBoard(board.id, { ...fields, groupFullWidths });  // notesHidden прокидывается через spread
  showSettings = false;
}
```

> `notesHidden` автоматически попадает в `updateBoard` через `{ ...fields, groupFullWidths }`, если сигнатура `updateBoard` его принимает. Достаточно обновить сигнатуру `saveSettings`.

### Версия данных: defaults (`src/data/defaults.ts`)

Константа `DEFAULT_DATA.version` должна быть поднята с `6` до `7`. Это гарантирует, что новые установки плагина сразу получат корректную версию и миграция 7 при первом запуске не будет запускаться избыточно:

```typescript
// было
version: 6,

// стало
version: 7,
```

---

## 6. Локализация

Новые ключи для `src/i18n/en.ts` и `src/i18n/ru.ts`:

| Ключ | EN | RU |
|------|----|----|
| `boardSettings.notes` | `Notes` | `Заметки` |

> Секция уже имеет ключ `notes.title` — его переиспользовать нельзя, т.к. он используется в заголовке самой секции NotesSection. Для тогла в настройках нужен отдельный ключ в пространстве `boardSettings`.

---

## 7. Тестирование

**Основные сценарии:**
- [ ] Скрыть Notes → секция исчезает с доски, контент сохраняется в данных
- [ ] Показать Notes обратно → контент возвращается, collapsed-состояние сохранено
- [ ] Cancel не применяет изменения; клик по overlay — то же самое
- [ ] Настройки видимости Notes независимы для разных досок
- [ ] Новая установка: Notes видима по умолчанию

**Миграция:**
- [ ] Данные с `version=6`: `notesHidden` добавляется как `false`, Notes остаётся видимой
- [ ] Данные с `version < 6`: поле добавляется через цепочку миграций
- [ ] Если `notesHidden` уже присутствует в данных (ручная правка или повторный прогон) — значение не перезаписывается (проверка `=== undefined`)

**Взаимодействие с collapse:**
- [ ] Свернуть Notes → скрыть в настройках → показать обратно → Notes должна быть свёрнута (collapsed-состояние не сбрасывается)
- [ ] Развернуть Notes → скрыть в настройках → показать обратно → Notes должна быть развёрнута

**Визуальные:**
- [ ] Разделитель между списком групп и тоглом Notes визуально разделяет секции
- [ ] Проверить в light и dark теме

---

## 8. Риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Пользователь скроет Notes с контентом и забудет о нём | Низкая | Низкое | Принятое поведение: данные не удаляются, секция восстанавливается включением тогла |

---

## 9. Открытые вопросы

Нет открытых вопросов.
