# Obsidian TaskMaster — техническая спецификация

## Стек технологий

| Компонент | Технология | Обоснование |
|-----------|-----------|-------------|
| **Язык** | TypeScript | Стандарт для Obsidian-плагинов, типизация снижает количество ошибок |
| **UI-фреймворк** | Svelte | Компилируется в чистый JS (нет runtime), реактивность из коробки, популярен в экосистеме Obsidian |
| **Drag-and-drop** | SortableJS | Framework-agnostic, touch-поддержка, сортировка + перемещение между группами, ~10KB gzipped |
| **Сборка** | esbuild | Стандарт для Obsidian-плагинов, быстрая сборка |
| **Мин. версия Obsidian** | 1.0.0 | Стабильный API: ItemView, loadData/saveData, Command Palette, ribbon |

---

## Структура данных

### data.json — корневая структура

```json
{
  "version": 7,
  "settings": {
    "defaultPriority": "medium",
    "cardLayout": "single"
  },
  "boards": [
    {
      "id": "uuid-board-1",
      "title": "Проект Alpha",
      "subtitle": "Разработка MVP таск-менеджера для Obsidian",
      "hiddenGroups": [],
      "notesHidden": false,
      "groups": {
        "backlog": {
          "taskIds": ["uuid-task-5", "uuid-task-8"],
          "wipLimit": null,
          "collapsed": true,
          "completedRetentionDays": null
        },
        "focus": {
          "taskIds": ["uuid-task-1"],
          "wipLimit": 5,
          "collapsed": false,
          "completedRetentionDays": null
        },
        "inProgress": {
          "taskIds": ["uuid-task-2", "uuid-task-3"],
          "wipLimit": 3,
          "collapsed": false,
          "completedRetentionDays": null
        },
        "orgIntentions": {
          "taskIds": ["uuid-task-4"],
          "wipLimit": null,
          "collapsed": false,
          "completedRetentionDays": null
        },
        "delegated": {
          "taskIds": [],
          "wipLimit": null,
          "collapsed": false,
          "completedRetentionDays": null
        },
        "completed": {
          "taskIds": ["uuid-task-6", "uuid-task-7"],
          "wipLimit": null,
          "collapsed": true,
          "completedRetentionDays": 30
        }
      }
    }
  ],
  "tasks": {
    "uuid-task-1": {
      "id": "uuid-task-1",
      "what": "Подготовить отчёт для совета директоров",
      "why": "Нужен для принятия решения о бюджете Q2",
      "who": "Иванов А.",
      "deadline": "2026-03-24",
      "createdAt": "2026-02-10",
      "completedAt": "",
      "priority": "high",
      "status": "inProgress"
    }
  }
}
```

### Типы данных (TypeScript)

```typescript
// Приоритеты
type Priority = 'low' | 'medium' | 'high';

// Статусы
type Status = 'new' | 'inProgress' | 'waiting' | 'completed';

// Идентификаторы групп
type GroupId = 'backlog' | 'focus' | 'inProgress' | 'orgIntentions' | 'delegated' | 'completed';

// Режим отображения карточек
type CardView = 'default' | 'compact';

// Лейаут карточек (количество колонок)
type CardLayout = 'single' | 'multi';

// Задача
interface Task {
  id: string;           // UUID
  what: string;         // Описание задачи (многострочный текст, обязательное поле, макс. 10 000 символов)
  why: string;          // Цель (многострочный текст, макс. 10 000 символов)
  who: string;          // Исполнитель (свободный текст, макс. 200 символов)
  deadline: string;     // Дедлайн, формат "YYYY-MM-DD", пустая строка если не задан
  createdAt: string;    // Дата создания, формат "YYYY-MM-DD", заполняется автоматически
  completedAt: string;  // Дата завершения, формат "YYYY-MM-DD", пустая строка если не завершена
  priority: Priority;   // Приоритет, по умолчанию берётся из глобальных настроек
  status: Status;       // Статус
}

// Группа
interface Group {
  taskIds: string[];              // Упорядоченный массив UUID задач
  wipLimit: number | null;        // WIP-лимит, null = без лимита
  collapsed: boolean;             // Свёрнута ли группа (для backlog и completed)
  completedRetentionDays: number | null; // Срок хранения завершённых (только для completed)
}

// Доска
interface Board {
  id: string;                     // UUID
  title: string;                  // Название доски
  subtitle: string;               // Подзаголовок (может быть пустым)
  hiddenGroups: GroupId[];        // Список скрытых групп (по умолчанию [])
  notesHidden: boolean;           // Скрыть секцию Notes полностью (по умолчанию false)
  groups: Record<GroupId, Group>; // 6 фиксированных групп
}

// Глобальные настройки
interface Settings {
  language: LanguageSetting;      // Язык интерфейса ('auto' | 'en' | 'ru')
  defaultPriority: Priority;      // Приоритет по умолчанию
  cardView: CardView;             // Режим отображения карточек
  cardLayout: CardLayout;         // Лейаут карточек: одна колонка или мультиколоночный
}

// Корневая структура data.json
interface PluginData {
  version: number;                // Версия схемы данных для миграций
  settings: Settings;
  boards: Board[];
  tasks: Record<string, Task>;    // Плоский словарь всех задач всех досок
}
```

### Хранение задач — плоский словарь

Все задачи всех досок хранятся в одном плоском объекте `tasks` (ключ — UUID). Группы ссылаются на задачи через массивы `taskIds`.

**Почему не вложенные в доски:**
- Перемещение между группами — изменение только массивов `taskIds`, объект задачи не трогается
- Нет дублирования данных
- Простой доступ к задаче по ID: `data.tasks[taskId]`

---

## Архитектура компонентов

### Obsidian-слой

```
TaskMasterPlugin (extends Plugin)
├── onload()          — регистрация View, команд, ribbon-иконки
├── onunload()        — очистка
├── loadPluginData()  — загрузка data.json + миграция + очистка
├── savePluginData()  — сохранение data.json
└── TaskMasterView (extends ItemView)
    ├── onOpen()      — монтирование Svelte-приложения
    └── onClose()     — размонтирование
```

### Svelte-компоненты

```
App.svelte                    — корневой компонент
├── BoardHeader.svelte        — селектор досок, заголовок, подзаголовок, кнопка "+"
├── BoardLayout.svelte        — CSS Grid раскладка доски (рендерит только видимые группы и Notes если не скрыта)
│   ├── CollapsibleGroup.svelte  — сворачиваемая группа (Бэклог, Завершённые)
│   └── TaskGroup.svelte         — рабочая группа (Фокус, В работе, Орг. намерения, Делегировано)
│       ├── GroupHeader.svelte    — заголовок группы, счётчик, WIP-индикация, меню "..."
│       ├── TaskCard.svelte       — компактная карточка задачи
│       └── EmptyState.svelte     — текст-подсказка для пустой группы
├── TaskFormContent.svelte    — содержимое модального окна (форма задачи), монтируется в Obsidian Modal
├── GroupSettingsPopup.svelte  — popup настроек группы (WIP-лимит, автоочистка)
├── BoardSettingsPopup.svelte — popup настроек доски (переименование, удаление, видимость групп, видимость Notes)
└── DeleteToast.svelte        — toast-уведомление при удалении с кнопкой «Отменить»
```

### Модальные окна

Модальные окна используют стандартный Obsidian `Modal` (закрытие по Escape, клик вне окна, стили темы). Внутрь монтируется Svelte-компонент с формой:

```typescript
class TaskModal extends Modal {
  onOpen() {
    new TaskFormContent({
      target: this.contentEl,
      props: { task, onSave, onDelete }
    });
  }
}
```

Аналогично для popup'ов настроек группы и доски.

---

## Управление состоянием (Svelte Stores)

Три store для разделения ответственности:

| Store | Содержимое | Сохраняется в файл? |
|-------|-----------|---------------------|
| **dataStore** | Доски, задачи, настройки — все данные из data.json | Да, при каждом изменении |
| **uiStore** | Активная доска, открытые модалки, очередь toast'ов | Нет |
| **pluginStore** | Ссылка на экземпляр плагина (доступ к saveData(), Modal API) | Нет |

---

## Drag-and-drop: синхронизация SortableJS и Svelte

SortableJS манипулирует DOM напрямую, Svelte управляет DOM через реактивность. Чтобы избежать конфликтов, используется стратегия «отмена + обновление»:

1. SortableJS ловит жест перетаскивания и определяет: откуда, куда, на какую позицию
2. DOM-изменения SortableJS **отменяются** (элемент возвращается на исходное место)
3. Обновляется `dataStore` (массивы `taskIds` в группах)
4. Svelte реагирует на изменение store и **сам перерисовывает** доску в правильном порядке

SortableJS — «уши» (слушает перетаскивание), Svelte — «руки» (рисует результат).

---

## Создание задачи

Нажатие «+» в группе → открывается Obsidian Modal с формой:

**Предзаполненные автоматически:**
- ID → `crypto.randomUUID()`
- Статус → `new` (бэклог) или `inProgress` (рабочие группы) — по правилам переходов
- Приоритет → из глобальных настроек (по умолчанию `medium`)
- Дата создания → сегодня (`YYYY-MM-DD`)

**Заполняет пользователь:**
- **Что** — обязательное поле, кнопка «Сохранить» неактивна пока пустое
- **Зачем** — необязательное
- **Кто** — необязательное
- **Когда** (дедлайн) — необязательное

Задача добавляется в конец массива `taskIds` той группы, где нажали «+».

---

## Удаление задачи (Toast-механизм)

1. Пользователь нажимает «Удалить»
2. UUID задачи убирается из `taskIds` группы → `saveData()` → задача исчезает с доски
3. Объект задачи **остаётся** в словаре `tasks` (временно осиротевший)
4. Появляется toast (7 секунд с обратным таймером)
5. **Отмена** → UUID возвращается в `taskIds` на прежнюю позицию → `saveData()`
6. **Таймер истёк** → объект удаляется из `tasks` → `saveData()`

Если Obsidian закрыли за эти 7 секунд — задача останется осиротевшей и будет удалена функцией очистки при следующем запуске.

**Toast-стакинг:**

- Максимум **3 toast'а** одновременно на экране
- Новые появляются снизу, старые сдвигаются вверх
- Если удалить 4-ю задачу при 3 активных toast'ах — самый старый toast исчезает (задача удаляется окончательно), освобождая место для нового

---

## Удаление доски

- Показывается стандартный диалог подтверждения: «Удалить доску "Проект Alpha" и все её задачи?»
- При подтверждении: удаляется доска из массива `boards`, все её задачи удаляются из `tasks`
- Нельзя удалить последнюю доску — хотя бы одна должна существовать всегда

---

## Создание доски

Нажатие «+» в заголовке:

1. Создаётся новая доска с `title: "Новая доска"`, пустым `subtitle`, `hiddenGroups: []`, `notesHidden: false`, 6 пустыми группами с дефолтными настройками
2. `saveData()`
3. Активная доска переключается на новую

---

## Очистка данных при загрузке

При каждой загрузке плагина последовательно выполняются:

1. **Миграция данных** (`migrateData()`) — обновление схемы при необходимости
2. **Автоочистка завершённых** — удаление задач старше `completedRetentionDays` из группы «Завершённые»
3. **Очистка осиротевших задач** — сбор всех `taskIds` из всех групп всех досок, удаление из `tasks` записей, которые не упоминаются ни в одной группе

```typescript
function cleanupOrphanedTasks(data: PluginData): void {
  const usedIds = new Set<string>();
  for (const board of data.boards) {
    for (const group of Object.values(board.groups)) {
      group.taskIds.forEach(id => usedIds.add(id));
    }
  }
  for (const taskId of Object.keys(data.tasks)) {
    if (!usedIds.has(taskId)) {
      delete data.tasks[taskId];
    }
  }
}
```

---

## Сохранение данных

Сохранение через стандартный Obsidian API: `loadData()` / `saveData()`.

**Когда сохраняется:**

| Действие | Момент сохранения |
|----------|-------------------|
| Создание/редактирование задачи | При закрытии модального окна (кнопка «Сохранить») |
| Удаление задачи | Сразу при удалении + повторно через 7 сек (финальное удаление) или при отмене |
| Drag-and-drop | При завершении перетаскивания (событие drop) |
| Изменение настроек | При закрытии popup |
| Переключение свёрнутости группы | Сразу при переключении |

---

## Миграция данных

При загрузке плагина вызывается `migrateData()`:

```typescript
function migrateData(data: any): PluginData {
  const version = data.version ?? 0;

  if (version < 1) {
    data = migrateV0toV1(data);
  }
  if (version < 4) {
    data = migrateV3toV4(data);
  }
  if (version < 6) {
    data = migrateV5toV6(data);
  }
  if (version < 7) {
    data = migrateV6toV7(data);
  }

  return data as PluginData;
}
```

Миграции выполняются последовательно. После миграции данные пересохраняются.

**Миграция v3 → v4** добавляет поле `hiddenGroups: []` к каждой существующей доске:

```typescript
function migrateV3toV4(data: any): any {
  for (const board of data.boards ?? []) {
    if (board.hiddenGroups === undefined) {
      board.hiddenGroups = [];
    }
  }
  data.version = 4;
  return data;
}
```

**Миграция v5 → v6** добавляет поле `cardLayout: 'single'` в настройки:

```typescript
function migrateV5toV6(data: any): any {
  if (!data.settings.cardLayout) {
    data.settings.cardLayout = 'single';
  }
  data.version = 6;
  return data;
}
```

**Миграция v6 → v7** добавляет поле `notesHidden: false` к каждой существующей доске. Секция Notes остаётся видимой после миграции — пользователь не заметит изменений:

```typescript
function migrateV6toV7(data: any): any {
  for (const board of data.boards ?? []) {
    if (board.notesHidden === undefined) {
      board.notesHidden = false;
    }
  }
  data.version = 7;
  return data;
}
```

Проверка `=== undefined` защищает от перезаписи значения, если поле уже присутствует в данных.

---

## Автоматические переходы статусов

При перемещении задачи между группами (drag-and-drop) применяются правила:

```typescript
function applyStatusTransition(task: Task, fromGroup: GroupId, toGroup: GroupId): void {
  if (toGroup === 'completed') {
    task.status = 'completed';
    task.completedAt = formatDate(new Date()); // YYYY-MM-DD
  } else if (toGroup === 'backlog') {
    // при перемещении в бэклог статус не меняется
  } else if (fromGroup === 'backlog' && task.status === 'new') {
    task.status = 'inProgress';
  } else if (fromGroup === 'completed') {
    task.status = 'inProgress';
    task.completedAt = ''; // очищаем дату завершения
  }
  // перемещение между рабочими группами — статус не меняется
}
```

Автоматические переходы статусов применяются к задачам во всех группах независимо от их видимости. Скрытая группа остаётся полноценной группой с точки зрения логики.

---

## Автоочистка завершённых задач

При загрузке плагина проверяются задачи в группе «Завершённые»:

```typescript
function cleanupCompletedTasks(board: Board, tasks: Record<string, Task>): void {
  const retentionDays = board.groups.completed.completedRetentionDays ?? 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  board.groups.completed.taskIds = board.groups.completed.taskIds.filter(taskId => {
    const task = tasks[taskId];
    if (!task) return false;
    if (!task.completedAt) return true; // нет даты завершения — не удаляем
    const completed = new Date(task.completedAt);
    if (completed < cutoffDate) {
      delete tasks[taskId];
      return false;
    }
    return true;
  });
}
```

Очистка происходит при каждой загрузке плагина. Отдельного уведомления нет — задачи удаляются тихо, так как пользователь сам настроил срок хранения.

---

## CSS — организация стилей

- **Глобальные стили в `styles.css`** — все стили плагина находятся в одном файле `src/styles.css`. Svelte-компоненты не содержат блоков `<style>`. Сборка использует `compilerOptions: { css: 'none' }`, файл копируется в корень при production-билде
- **Префикс `tm-`** — все CSS-классы плагина имеют префикс `tm-` (например, `tm-task-card`, `tm-empty-state`, `tm-board-layout`). Это предотвращает коллизии с встроенными стилями Obsidian (например, Obsidian использует `.empty-state` с `position: absolute`)
- **BEM-нотация** — классы следуют BEM: `tm-block__element--modifier` (например, `tm-task-card__deadline--overdue`, `tm-collapsible-group__count--over`)
- **Obsidian CSS-переменные** (`--background-primary`, `--text-normal`, `--interactive-accent`) — корректное отображение в любой теме (тёмная, светлая, кастомная)
- **Относительные единицы** (`rem`, `%`, `fr`) — подготовка к мобильной адаптации
- **CSS Grid в теле групп** — `.tm-task-group__body` и `.tm-collapsible-group__body` используют `display: grid` с CSS custom property `--tm-card-columns`. В режиме `single` — 1 колонка (поведение идентично прежнему flex-лейауту), в режиме `multi` — 4 колонки для full-width групп, 2 для half-width. На экранах `<600px` принудительно 1 колонка через media query

---

## Скролл групп

Группы имеют фиксированную максимальную высоту (`max-height: 50vh`). При превышении — внутренний вертикальный скролл (`overflow-y: auto`).

SortableJS поддерживает автоскролл при перетаскивании внутри scrollable-контейнера из коробки.

Бэклог и Завершённые — аналогично, при развёртывании показывают содержимое с внутренним скроллом.

---

## Настройки плагина (Settings Tab)

Глобальные настройки отображаются в стандартном разделе настроек Obsidian:

| Настройка | Тип | Значение по умолчанию |
|-----------|-----|----------------------|
| Язык интерфейса | Dropdown: Auto (Obsidian) / English / Русский | Auto |
| Вид карточек | Dropdown: Обычный (3 строки) / Компактный (1 строка) | Обычный |
| Лейаут карточек | Dropdown: Одна колонка / Несколько колонок (4 / 2) | Одна колонка |
| Приоритет по умолчанию | Dropdown: низкий / средний / высокий | средний |

Per-board настройки (WIP-лимиты, срок автоочистки, видимость групп, видимость Notes) управляются через popup «...» в интерфейсе доски.

---

## Настройки доски (BoardSettingsPopup)

Popup «...» рядом с названием доски содержит следующие секции:

- **Переименование** — изменение названия и подзаголовка доски
- **Group Visibility** — управление видимостью групп и секции Notes:
  - Чекбокс для каждой из 6 групп; рядом с названием группы отображается счётчик задач `(N)` если задач больше нуля
  - После списка групп — горизонтальный разделитель (`.tm-popup__divider`)
  - Чекбокс для секции Notes (без счётчика — Notes является текстовым полем, а не группой задач)
- **Удаление доски** — с диалогом подтверждения

**Поведение секции Group Visibility:**

- Снятие чекбокса скрывает группу с доски (добавляет `GroupId` в `board.hiddenGroups`)
- Постановка чекбокса возвращает группу на доску (убирает `GroupId` из `board.hiddenGroups`)
- Нельзя скрыть последнюю видимую группу — чекбокс последней оставшейся видимой группы заблокирован (`disabled`) с tooltip-подсказкой
- Чекбокс Notes управляет `board.notesHidden`; нет ограничения «последняя видимая» — Notes можно скрыть независимо от групп
- Кнопка «Cancel» и клик по overlay сбрасывают несохранённые изменения (видимость групп и Notes)

**Рендеринг доски:**

`BoardLayout` фильтрует группы по `board.hiddenGroups` и рендерит только видимые. Секция Notes рендерится условно:

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

Задачи в скрытых группах хранятся в `data.tasks` и в `taskIds` группы — они не удаляются и не перемещаются. Контент Notes сохраняется при скрытии секции и восстанавливается при повторном показе.

---

## Компактный режим карточек

### Визуальная структура

**Обычный режим (default):**
- 3 строки: верхняя (иконки + дедлайн), описание, исполнитель
- Вертикальный layout
- Дедлайн в полном формате: `2026-03-24`

**Компактный режим (compact):**
- 1 строка: иконки → исполнитель → описание → дедлайн → кнопка удаления
- Горизонтальный flexbox layout
- Дедлайн в сокращённом формате через `formatDeadlineShort()`

### CSS-реализация

```css
.tm-task-card--compact {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  min-height: 1.75rem;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}
```

**Ширины секций:**

| Секция | Ширина | Обрезка | Tooltip |
|--------|--------|---------|---------|
| Иконки (приоритет + статус) | `2.5rem` (фиксированная) | Нет | Нет |
| Исполнитель | `7rem` (фиксированная) | `text-overflow: ellipsis` | `title={task.who}` |
| Описание | `flex: 1` (гибкая) | `text-overflow: ellipsis` | `title={task.what}` |
| Дедлайн | `4.5rem` (фиксированная) | Нет | Нет |
| Кнопка удаления | `1.25rem` (фиксированная) | Нет | Нет |

**Предотвращение растягивания:**

Для корректной работы обрезки на всех уровнях иерархии установлены ограничения:

```css
.tm-task-group {
  min-width: 0;
  overflow: hidden;
}

.tm-collapsible-group {
  min-width: 0;
  overflow: hidden;
}
```

Это предотвращает растягивание групп и доски длинным содержимым карточек.

### Форматирование дедлайна

Функция `formatDeadlineShort()` (в `utils/dateFormat.ts`) сжимает дату в зависимости от контекста:

```typescript
export function formatDeadlineShort(dateStr: string): string {
  if (!dateStr) return '';

  const today = new Date();
  const deadline = new Date(dateStr);

  if (isNaN(deadline.getTime())) return dateStr; // fallback

  const isSameYear = today.getFullYear() === deadline.getFullYear();
  const isSameMonth = today.getMonth() === deadline.getMonth();

  if (isSameYear && isSameMonth) {
    return deadline.getDate().toString(); // "24"
  }

  const day = deadline.getDate().toString().padStart(2, '0');
  const month = (deadline.getMonth() + 1).toString().padStart(2, '0');

  if (isSameYear) {
    return `${month}-${day}`; // "03-24"
  }

  const yearShort = deadline.getFullYear().toString().slice(-2);
  return `${day} '${yearShort}`; // "24 '27"
}
```

**Примеры:**
- Сегодня 16.02.2026, дедлайн 24.02.2026 → `"24"`
- Сегодня 16.02.2026, дедлайн 24.03.2026 → `"03-24"`
- Сегодня 16.02.2026, дедлайн 24.03.2027 → `"24 '27"`

### Переключение режимов

Изменение настройки `cardView` в Settings Tab вызывает `dataStore.set()` → все компоненты TaskCard реагируют на изменение через reactive-выражение:

```typescript
$: isCompact = $dataStore.settings.cardView === 'compact';
```

Перерисовка происходит мгновенно без перезагрузки плагина.

### Миграция данных

При загрузке старых данных без поля `cardView`:

```typescript
if (result.settings.cardView === undefined) {
  result.settings.cardView = DEFAULT_SETTINGS.cardView; // 'default'
}
```

Обратная совместимость гарантирована — пользователи видят обычный режим до первого изменения настройки.

---

## Мультиколоночный лейаут карточек

### Визуальная структура

**Режим `single` (по умолчанию):** каждая карточка занимает 100% ширины группы — текущее поведение.

**Режим `multi`:**
- **4 карточки в строку** — для full-width групп
- **2 карточки в строку** — для half-width групп
- Одиночная карточка (и любое неполное количество в строке) занимает 25% ширины, не растягивается
- На экранах `<600px` принудительно 1 колонка через media query

Режим применяется ко всем видам карточек (`default` и `compact`) и переключается глобально в настройках плагина.

### CSS-реализация

Тело группы использует CSS Grid с CSS custom property `--tm-card-columns`:

```css
.tm-task-group__body {
  display: grid;
  grid-template-columns: repeat(var(--tm-card-columns, 1), minmax(0, 1fr));
  align-content: start;
  gap: 0.35rem;
  padding: 0.35rem;
}

.tm-task-group__body > .tm-empty-state {
  grid-column: 1 / -1; /* Empty State занимает всю ширину */
}

/* CollapsibleGroup аналогично */
.tm-collapsible-group__body {
  display: grid;
  grid-template-columns: repeat(var(--tm-card-columns, 1), minmax(0, 1fr));
  align-content: start;
  gap: 0.35rem;
}

/* Мобильные: принудительно 1 колонка */
@media (max-width: 600px) {
  .tm-task-group__body,
  .tm-collapsible-group__body {
    grid-template-columns: 1fr;
  }
}

/* Multi-режим: поле «Что» обрезается в одну строку */
.tm-task-group__body--multi .tm-task-card__what,
.tm-collapsible-group__body--multi .tm-task-card__what {
  display: block;
  -webkit-line-clamp: unset;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### Логика вычисления колонок

В `TaskGroup.svelte` и `CollapsibleGroup.svelte`:

```typescript
$: cardLayout = $dataStore.settings.cardLayout;
$: isMulti = cardLayout === 'multi';
$: columns = isMulti ? (group.fullWidth ? 4 : 2) : 1;
```

Значение `columns` передаётся через CSS custom property `style="--tm-card-columns: {columns}"` на контейнер тела группы.

### Переключение режима

Изменение настройки `cardLayout` в Settings Tab мгновенно перестраивает все группы — аналогично `cardView`.

---

## Безопасность

- **Запрет `{@html}`** — директива `{@html}` не используется нигде в проекте. Все пользовательские данные (поля задач, названия досок) отображаются через стандартную интерполяцию `{variable}`, которая автоматически экранирует HTML
- **Лимиты длины полей** — текстовые поля ограничены через атрибут `maxlength` на элементах формы: `what` и `why` — 10 000 символов, `who` — 200 символов, `title` доски — 200 символов, `subtitle` доски — 500 символов

---

## Структура проекта

```
obsidian-taskmaster/
├── docs/
│   ├── overview.md            — продуктовая документация
│   └── technical.md           — техническая спецификация (этот файл)
├── src/
│   ├── main.ts                — точка входа плагина (TaskMasterPlugin)
│   ├── view.ts                — TaskMasterView (extends ItemView)
│   ├── data/
│   │   ├── types.ts           — интерфейсы и типы данных
│   │   ├── defaults.ts        — значения по умолчанию, начальное состояние
│   │   ├── migration.ts       — миграции данных
│   │   └── cleanup.ts         — автоочистка завершённых + очистка осиротевших задач
│   ├── logic/
│   │   └── statusTransitions.ts — правила автоматических переходов статусов
│   ├── stores/
│   │   ├── dataStore.ts       — данные (доски, задачи, настройки)
│   │   ├── uiStore.ts         — состояние интерфейса (активная доска, модалки, toast'ы)
│   │   └── pluginStore.ts     — ссылка на экземпляр плагина
│   ├── ui/
│   │   ├── App.svelte
│   │   ├── BoardHeader.svelte
│   │   ├── BoardLayout.svelte
│   │   ├── CollapsibleGroup.svelte
│   │   ├── TaskGroup.svelte
│   │   ├── GroupHeader.svelte
│   │   ├── TaskCard.svelte
│   │   ├── EmptyState.svelte
│   │   ├── TaskFormContent.svelte
│   │   ├── GroupSettingsPopup.svelte
│   │   ├── BoardSettingsPopup.svelte
│   │   ├── DeleteToast.svelte
│   │   └── useSortable.ts       — Svelte action для SortableJS (DnD)
│   ├── modals/
│   │   └── TaskModal.ts       — Obsidian Modal обёртка для TaskFormContent
│   ├── utils/
│   │   └── dateFormat.ts      — утилиты форматирования дат (formatDate для YYYY-MM-DD, formatDeadlineShort для компактного отображения)
│   ├── i18n/
│   │   ├── index.ts           — ядро i18n
│   │   ├── types.ts           — типы i18n (TranslationKey и др.)
│   │   ├── en.ts              — английские переводы
│   │   └── ru.ts              — русские переводы
│   ├── settings.ts            — Settings Tab (глобальные настройки)
│   └── styles.css             — все стили плагина (классы с tm- префиксом, BEM)
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── .gitignore
```

---

## Ключевые решения

| Решение | Выбор | Обоснование |
|---------|-------|-------------|
| Идентификаторы | UUID (`crypto.randomUUID()`) | Уникальность без счётчика, безопасно при копировании данных |
| Порядок карточек | Массив `taskIds` в группе | Простой splice при drag-and-drop, нет пересчёта позиций |
| Текстовые поля | Простой текст (textarea) | Markdown-рендеринг избыточен для MVP |
| Момент сохранения | После каждого завершённого действия | Надёжность без потери данных, debounce не нужен |
| Миграции | Поле `version` + последовательные миграции | Безопасное обновление схемы в будущем |
| Хранение задач | Плоский словарь по UUID | Быстрый доступ, простое перемещение между группами |
| Модальные окна | Obsidian Modal + Svelte-компонент внутри | Стандартное поведение (Escape, overlay) + реактивные формы |
| DnD + Svelte | SortableJS ловит жест → отмена DOM → обновление store → Svelte рисует | Один хозяин DOM, нет конфликтов |
| Stores | 3 store: data, ui, plugin | Чёткое разделение: данные / интерфейс / API |
| Формат дат | YYYY-MM-DD, своя утилита | Лёгкий, без внешних библиотек |
| CSS | Глобальный `styles.css`, tm- префикс, BEM | Нет коллизий с Obsidian, поддержка тем |
| Скролл групп | max-height: 50vh + overflow-y: auto | Стабильный layout, автоскролл при DnD |
| Осиротевшие задачи | Очистка при загрузке | Страховка от мусора в data.json |
| Удаление доски | Каскадное + диалог подтверждения | Защита от случайного удаления |
| Дата завершения | Поле `completedAt`, автоочистка по нему | Корректный срок хранения в «Завершённых» |
| Лимиты полей | `what`/`why`: 10K, `who`: 200, `title`: 200, `subtitle`: 500 | Защита от раздутия data.json |
| XSS-защита | Запрет `{@html}`, только `{variable}` | Экранирование пользовательского ввода |
| Toast-стакинг | Макс. 3, старый вытесняется новым | Предотвращение засорения экрана |
| Создание доски | Без модалки, дефолтное название | Минимум шагов, переименование через «...» |
| Компактный режим | Flexbox, fixed widths, text-overflow: ellipsis | Плотное отображение для списков с 10+ задачами |
| Дедлайн compact | Адаптивный формат (день / месяц-день / день 'год) | Экономия места, контекстная точность |
| min-width: 0 | На всех уровнях иерархии (group, card) | Предотвращение растягивания flexbox/grid длинным контентом |
| Видимость групп | `hiddenGroups: GroupId[]` в Board, фильтрация в BoardLayout | Простое хранение, задачи не перемещаются, логика не зависит от видимости |
| Защита от скрытия всех групп | disabled чекбокс + tooltip для последней видимой группы | Гарантия рабочей доски, без модального диалога |
| Отмена в BoardSettingsPopup | Cancel и overlay-клик сбрасывают черновик видимости | Безопасное редактирование без немедленного применения |
| Мультиколоночный лейаут | CSS Grid + `--tm-card-columns`, глобальная настройка `cardLayout` | Больше задач на экране без горизонтального скролла; SortableJS поддерживает grid-контейнеры |
| Колонки по умолчанию | `single` (1 колонка) | Обратная совместимость, поведение идентично предыдущим версиям |
| Число колонок в multi | 4 для full-width, 2 для half-width | Пропорционально ширине группы, фиксировано (не настраивается) |
| Мобильный breakpoint | media query `<600px` → 1 колонка | Корректное отображение на узких экранах без логики в JS |
| Видимость Notes | `notesHidden: boolean` в Board, `{#if}` в BoardLayout | Полное удаление секции из DOM; контент Notes сохраняется независимо от видимости |
| Notes в BoardSettingsPopup | Тогл после списка групп, отделён разделителем | Логически связан с Group Visibility, но визуально отделён — Notes не является группой задач |
