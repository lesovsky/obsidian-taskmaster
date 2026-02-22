# Динамический лейаут

**Статус:** Draft
**Дата:** 2026-02-21

## 1. Контекст и проблема

### Текущая ситуация

Лейаут доски в TaskMaster жёстко прописан в `BoardLayout.svelte`: `focus` и `inProgress` всегда занимают половину ширины, остальные группы — всю ширину. Логика вшита в `if/else` ветки с CSS-классами, не управляется данными.

### Цель

Дать пользователю возможность самостоятельно управлять шириной каждой группы на уровне настроек доски: полная ширина (full) или половина (half). Изменение должно применяться мгновенно и сохраняться между сессиями.

### Метрики успеха

- Пользователь может изменить ширину любой группы в настройках доски без перезагрузки Obsidian
- Настройка сохраняется в `data.json` и восстанавливается после перезапуска
- Поведение по умолчанию идентично текущему (focus + inProgress = half, остальные = full)

---

## 2. Требования

### Функциональные

- [ ] [FR-1] Для каждой из 6 групп доступна настройка ширины: `full` (по умолчанию) или `half`
- [ ] [FR-2] Настройка расположена в `BoardSettingsPopup`, рядом с переключателями видимости групп
- [ ] [FR-3] Лейаут доски использует CSS Grid (2 колонки): full-width группы занимают обе колонки, half-width — одну
- [ ] [FR-4] Нечётная одиночная half-width группа автоматически растягивается на всю ширину
- [ ] [FR-5] На узких панелях (<600px) все half-width группы автоматически занимают full-width (через media query, без JS)
- [ ] [FR-6] Настройка применяется реактивно при сохранении модала настроек
- [ ] [FR-7] Значение `fullWidth` сохраняется в `data.json` в поле каждой группы

### Нефункциональные

- [ ] [NFR-1] Значения по умолчанию сохраняют текущее поведение: `focus` и `inProgress` — half, остальные — full
- [ ] [NFR-2] Обратная совместимость: старые `data.json` без поля `fullWidth` корректно мигрируют (дефолт по `DEFAULT_FULL_WIDTH`)
- [ ] [NFR-3] Лейаут не ломается ни при каком сочетании скрытых и half/full групп
- [ ] [NFR-4] Все CSS-классы объявлены исключительно в `src/styles.css` — никаких `<style>` блоков в `.svelte` файлах (конвенция проекта)

---

## 3. User Stories

### US-1: Настройка ширины группы

**Как** пользователь TaskMaster **хочу** переключить группу «Делегировано» на половину ширины **чтобы** разместить её рядом с «Организационными намерениями» на одной строке.

**Критерии приёмки:**
- В настройках доски рядом с каждой группой есть переключатель half/full
- После сохранения настроек группы мгновенно перестраиваются
- Настройка сохраняется в `data.json` и восстанавливается при следующем открытии

### US-2: Адаптивность на мобильном

**Как** пользователь Obsidian на мобильном устройстве **хочу** чтобы все группы занимали всю ширину **чтобы** не скроллить горизонтально.

**Критерии приёмки:**
- При ширине панели < 600px все half-width группы разворачиваются на full-width
- Поведение управляется CSS media query — никакой JS-логики

### US-3: Нечётная одиночная группа

**Как** пользователь **хочу** чтобы одиночная half-width группа (без пары) выглядела нормально **чтобы** не оставалось некрасивого пустого пространства.

**Критерии приёмки:**
- Если в «строке» остаётся одна half-width группа без пары — она растягивается на full-width

---

## 4. Границы (Scope)

### В scope

- Настройка full/half для всех 6 групп: `backlog`, `focus`, `inProgress`, `orgIntentions`, `delegated`, `completed`
- CSS Grid лейаут в `BoardLayout.svelte`
- UI переключателя в `BoardSettingsPopup`
- Адаптивность через CSS media query
- Миграция `data.json` (добавление `fullWidth` с дефолтами)

### Вне scope

- Ширина 1/3 или 2/3 (только half/full)
- Drag-and-drop изменение ширины
- Изменение порядка групп
- Разные лейауты для разных досок в рамках одного сеанса

---

## 5. Технический дизайн

### Изменения в типах данных

```typescript
// src/data/types.ts — добавить поле в интерфейс Group (не GroupSettings — такого типа нет)
interface Group {
  taskIds: string[];
  wipLimit: number | null;
  collapsed: boolean;
  completedRetentionDays: number | null;
  fullWidth: boolean; // NEW — true = полная ширина, false = половина
}
```

### Значения по умолчанию (сохраняют текущее поведение)

Константа объявляется в `src/data/defaults.ts` рядом с `createDefaultGroup`:

```typescript
// src/data/defaults.ts
export const DEFAULT_FULL_WIDTH: Record<GroupId, boolean> = {
  backlog:       true,
  focus:         false,  // текущее поведение: половина
  inProgress:    false,  // текущее поведение: половина
  orgIntentions: true,
  delegated:     true,
  completed:     true,
};
```

`createDefaultGroup` необходимо обновить — принимать `groupId` и использовать `DEFAULT_FULL_WIDTH`:

```typescript
export function createDefaultGroup(groupId: GroupId): Group {
  return {
    taskIds: [],
    wipLimit: null,
    collapsed: false,
    completedRetentionDays: null,
    fullWidth: DEFAULT_FULL_WIDTH[groupId],
  };
}
```

В `createDefaultBoard` все вызовы `createDefaultGroup()` обновить до `createDefaultGroup(id)`.

Версия миграции: `version < 5` → `result.version = 5` (текущая максимальная версия — 4, файл `src/data/migration.ts`).

### CSS Grid лейаут

```css
/* src/styles.css */
.tm-board-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 0.75rem; /* горизонтальный зазор между колонками */
  row-gap: 0.75rem;    /* вертикальный зазор между строками */
  align-items: start;
}

.tm-board-layout__group--full {
  grid-column: 1 / -1;
}

.tm-board-layout__group--half {
  grid-column: span 1;
}

/* Одиночная half-width группа без пары */
.tm-board-layout__group--half-alone {
  grid-column: 1 / -1;
}

/* NotesSection всегда на полную ширину */
.tm-board-layout__notes {
  grid-column: 1 / -1;
}

/* Адаптивность */
@media (max-width: 600px) {
  .tm-board-layout__group--half,
  .tm-board-layout__group--half-alone {
    grid-column: 1 / -1;
  }
}
```

### Логика определения одиночной группы в Svelte

Вычислять реактивно список видимых групп. Обходить их попарно: если half-группа имеет следующего half-соседа — оба получают `--half`, иначе — одиночка получает `--half-alone`. `NotesSection` не является группой и не входит в `visibleGroups` — алгоритм не знает о ней.

```typescript
// Пример вычисления в BoardLayout.svelte
$: visibleGroups = GROUP_ORDER
  .filter(id => !hidden.has(id))
  .map(id => ({ id, fullWidth: board.groups[id].fullWidth }));

// Определяем одиночек: half-группа без следующего half-соседа
$: groupClasses = computeGroupClasses(visibleGroups);

// ВАЖНО: функция предполагает фиксированный порядок GROUP_ORDER.
// Если порядок групп станет настраиваемым — функцию необходимо переработать.
function computeGroupClasses(groups: { id: GroupId; fullWidth: boolean }[]) {
  const classes: Record<GroupId, string> = {} as any;
  let i = 0;
  while (i < groups.length) {
    const g = groups[i];
    if (g.fullWidth) {
      classes[g.id] = 'tm-board-layout__group--full';
      i++;
    } else {
      const next = groups[i + 1];
      if (next && !next.fullWidth) {
        // пара
        classes[g.id] = 'tm-board-layout__group--half';
        classes[next.id] = 'tm-board-layout__group--half';
        i += 2;
      } else {
        // одиночка → растягивается на full
        classes[g.id] = 'tm-board-layout__group--half-alone';
        i++;
      }
    }
  }
  return classes;
}
```

### Поведение свёрнутых групп

`backlog` и `completed` являются `CollapsibleGroup` и могут быть свёрнуты до строки-заголовка. Ширина применяется к внешнему контейнеру группы **вне зависимости от `collapsed`**: если группа свёрнута и имеет `fullWidth: false`, она отображается как узкий заголовок на половину ширины. Это допустимое поведение — пользователь сам управляет обоими параметрами независимо.

### Хранение порядка групп

Порядок отрисовки определяется константой `GROUP_ORDER` (уже существует или создаётся):

```typescript
const GROUP_ORDER: GroupId[] = [
  'backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed'
];
```

### UI в BoardSettingsPopup

В существующем компоненте каждая группа отрисовывается как `.tm-popup__group-row` с именем группы слева и `<input type="checkbox">` справа (управление видимостью). Добавить второй `<input type="checkbox">` в ту же строку для управления шириной.

Итоговая строка группы:
```
[Название группы (N)]   [☑ видима]  [☑ полная ширина]
```

Добавить заголовки колонок над списком (одна строка `tm-popup__group-header`):
```
[Группа]               [Показать]  [Полная ширина]
```

- Название параметра: **`fullWidth`** (EN) / **«Показывать на полную ширину»** (RU, заголовок колонки сокращается до «Полная ширина» из-за ограничений места)
- `true` (checkbox checked) = группа занимает всю ширину доски
- `false` (checkbox unchecked) = группа занимает половину ширины
- Checkbox `fullWidth` недоступен (disabled), если группа скрыта — значение `fullWidth` при этом **сохраняется** (только UI заблокирован, данные не сбрасываются)
- Полная новая сигнатура `onSave`:
  ```typescript
  onSave: (fields: {
    title: string;
    subtitle: string;
    hiddenGroups: GroupId[];
    fullWidths: Record<GroupId, boolean>; // NEW
  }) => void
  ```

### Изменяемые файлы

| Файл | Изменение |
|------|-----------|
| `src/data/types.ts` | Добавить `fullWidth: boolean` в интерфейс `Group` |
| `src/data/defaults.ts` | Обновить `createDefaultGroup(groupId)` — добавить `fullWidth` по `DEFAULT_FULL_WIDTH[groupId]`; объявить константу `DEFAULT_FULL_WIDTH` |
| `src/data/migration.ts` | Добавить миграцию `version < 5`: проставить `fullWidth` по `DEFAULT_FULL_WIDTH` для всех групп всех досок; поднять `result.version = 5` |
| `src/stores/dataStore.ts` | Обновить `updateBoard` — новая сигнатура `fields`: `{ title: string; subtitle: string; hiddenGroups: GroupId[]; groupFullWidths: Record<GroupId, boolean> }`; применять к каждой группе: `for (const id of GROUP_IDS) { board.groups[id].fullWidth = fields.groupFullWidths[id]; }` |
| `src/ui/BoardHeader.svelte` | Обновить `saveSettings` — передавать `fullWidths` в `updateBoard` |
| `src/ui/BoardSettingsPopup.svelte` | Добавить checkbox «Полная ширина» для каждой группы; расширить `onSave` сигнатуру |
| `src/ui/BoardLayout.svelte` | Рефакторинг на CSS Grid, логика `computeGroupClasses`; обёртка `<div class="tm-board-layout__collapsible">` вокруг `NotesSection` переименовывается в `<div class="tm-board-layout__notes">`; wrapper-divы групп получают динамический класс из `groupClasses[groupId]` |
| `src/styles.css` | CSS Grid стили, media query, класс `tm-board-layout__notes` |
| `src/i18n/en.ts` | Добавить ключ для заголовка колонки «Full width» (и tooltip) |
| `src/i18n/ru.ts` | Добавить ключ для заголовка колонки «Полная ширина» (и tooltip) |

---

## 6. Тестирование

### Сценарии ручного тестирования

1. **Базовое поведение по умолчанию** — открыть новую доску: focus + inProgress стоят рядом, остальные на full
2. **Переключить focus в full** — focus занимает всю ширину, inProgress встаёт одиночкой → растягивается на full
3. **Переключить orgIntentions в half** — если delegated тоже half, они встают рядом; если нет — orgIntentions растягивается
4. **Скрыть одного из half-партнёров** — оставшийся растягивается на full
5. **Три half-группы подряд** — первые две в паре, третья растягивается на full
6. **Перезапустить Obsidian** — настройки сохранились
7. **Узкий экран (<600px)** — все группы full-width независимо от настроек
8. **Старый data.json без fullWidth** — загружается без ошибок, дефолты применены корректно
9. **Обе группы пары скрыты, затем одна сделана видимой** — она растягивается на full-width, не висит половинкой с пустым местом
10. **Checkbox ½ недоступен для скрытой группы** — при снятии галочки видимости, checkbox ширины блокируется
11. **Обе группы пары скрыты, затем обе включены одновременно** — они встают рядом как пара, не одиночки
12. **Все 6 групп переключены в half-width** — на экране 3 строки по 2 группы, визуально корректно
13. **Создать новую доску** — focus и inProgress по умолчанию half, остальные full (проверить `createDefaultGroup`)
14. **Переключиться между досками с разными конфигурациями** — доска A (все full), доска B (focus half, inProgress half): A→B→A, лейаут корректно перерисовывается
15. **Свёрнутая группа с `fullWidth: false`** — backlog свёрнут и занимает половину ширины; выглядит как узкий заголовок, не как баг

---

## 7. План реализации

1. Обновить `types.ts` — добавить `fullWidth` в интерфейс `Group`
2. Обновить `defaults.ts` — `DEFAULT_FULL_WIDTH`, `createDefaultGroup(groupId)`, `createDefaultBoard`
3. Добавить миграцию `version < 5` в `migration.ts`
4. Обновить `dataStore.ts` — `updateBoard` принимает `groupFullWidths`
5. Обновить `BoardHeader.svelte` — передавать `fullWidths` в `updateBoard`
6. Обновить `BoardSettingsPopup.svelte` — UI checkbox «Полная ширина»
7. Рефакторинг `BoardLayout.svelte` — CSS Grid + `computeGroupClasses` + класс для `NotesSection`
8. Обновить `styles.css` — Grid стили, `tm-board-layout__notes`, media query
9. Добавить i18n-ключи в `en.ts` и `ru.ts` — заголовок и tooltip для «Full width» / «Полная ширина»
10. Unit-тесты для `computeGroupClasses`: все full, все half, три half подряд, чередование full/half/full, одна видимая half-группа
11. Ручное тестирование по чеклисту

---

## 8. Риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Старые `data.json` без `fullWidth` | Высокая (все существующие установки) | Миграция с `DEFAULT_FULL_WIDTH` |
| Логика одиночки сложнее ожидаемого | Средняя | `computeGroupClasses` покрывается Unit-тестами |
| CSS Grid несовместим с каким-то контейнером Obsidian | Низкая | Проверить в реальном Obsidian на этапе разработки |
| Визуальный дисбаланс при разной высоте колонок | Низкая | Группы независимы по высоте (`align-items: start`) |
| `computeGroupClasses` зависит от фиксированного `GROUP_ORDER` | Низкая | Если в будущем порядок групп станет настраиваемым, функцию необходимо переработать. Задокументировать это ограничение в комментарии к функции. |
| `@media (max-width: 600px)` реагирует на viewport, а не на ширину панели | Средняя | На десктопе с узким сплит-вью (панель <600px, viewport >600px) media query не сработает. Это **известное ограничение** текущей версии. Полное решение потребует `ResizeObserver` на контейнере — это выходит за рамки scope. Поведение на мобильном Obsidian корректно. |

---

## 9. Открытые вопросы

- *(закрыто)* Поведение пар → CSS Grid авто-упаковка
- *(закрыто)* Одиночная half-группа → растягивается на full
- *(закрыто)* Сворачиваемые группы → поддерживают настройку ширины
- *(закрыто)* Узкие экраны → авто-collapse в full через media query
