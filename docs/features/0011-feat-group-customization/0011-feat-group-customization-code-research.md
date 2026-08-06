# Code Research — 0011 Custom Groups (rename + order)

Дата: 2026-08-06
Scope фичи (после сокращения в интервью): переименование 6 существующих групп (per-board) + управление порядком групп (per-board, стрелки вверх/вниз). Набор `GroupId` не меняется.

Все пути относительно `/home/lesovsky/Projects/obsidian-taskmaster`.

---

## 1. Entry Points

### `src/ui/BoardLayout.svelte` — ключевая точка переработки
Рендерит доску: 6 групп + секцию Notes. Это единственное место, где определяется порядок отрисовки.

- **L23**: `const GROUP_ORDER: GroupId[] = ['backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed'];` — локальная константа компонента, дублирует `GROUP_IDS` из `src/data/types.ts:9`.
- **L21**: `$: hidden = new Set(board.hiddenGroups);`
- **L25–27**: `$: visibleGroups = GROUP_ORDER.filter(id => !hidden.has(id)).map(id => ({ id, fullWidth: board.groups[id].fullWidth }));`
- **L28**: `$: groupClasses = computeGroupClasses(visibleGroups);`
- **L181–271**: разметка — **шесть отдельных литеральных блоков** `{#if !hidden.has('<id>')}` с жёстко вписанным `groupId`, компонентом и колбэками. Порядок в DOM задаётся порядком этих блоков в шаблоне, а не массивом `visibleGroups`. `visibleGroups` влияет только на вычисление CSS-классов.
- Различие компонентов: `backlog` (L183) и `completed` (L259) рендерятся через `CollapsibleGroup` (нужен доп. проп `boardId`), остальные — через `TaskGroup`. У `completed` `onAdd={null}`.
- **L273–281**: `NotesSection` рендерится **после** всех групп, в отдельной обёртке `.tm-board-layout__notes`, вне цикла групп и вне `computeGroupClasses`.

**Вывод:** для настраиваемого порядка разметку L181–271 придётся свернуть в один `{#each}` по упорядоченному списку с ветвлением `CollapsibleGroup` / `TaskGroup`.

### `src/ui/BoardSettingsPopup.svelte` — точка добавления UI
Попап настроек доски. Props (L6–10):
```ts
export let board: Board;
export let canDelete: boolean;
export let onSave: (fields: { title: string; subtitle: string; hiddenGroups: GroupId[]; fullWidths: Record<GroupId, boolean>; notesHidden: boolean }) => void;
export let onDelete: () => void;
export let onClose: () => void;
```
- Локальная копия состояния (L12–19): `title`, `subtitle`, `hiddenGroups` (копия массива), `notesHidden`, `fullWidths` (объект из `GROUP_IDS`), `confirmDelete`. Никакой записи в store до нажатия Save — отмена по Cancel/overlay работает автоматически (компонент уничтожается, локальные переменные теряются).
- **L21**: `$: canSave = title.trim().length > 0;` — валидация только названия доски.
- **L22**: `$: visibleCount` — считает видимые группы для блокировки скрытия последней.
- **L52–87**: `{#each GROUP_IDS as groupId}` — строки групп. Порядок строк = `GROUP_IDS`, т.е. **фиксированный**, не связан с порядком на доске.
- Каждая строка `.tm-popup__group-row` содержит: имя группы + счётчик, чекбокс видимости, чекбокс full width.
- **L88–98**: разделитель + строка Notes.
- **L26**: `onSave({ title: title.trim(), subtitle: subtitle.trim(), hiddenGroups, fullWidths, notesHidden })`.

Место под новые контролы: `.tm-popup` имеет `min-width: 320px; max-width: 420px` (`src/styles.css:638–647`), **без `max-height` и без `overflow`**. Сетка строки — `grid-template-columns: 1fr 4rem 4rem` (`src/styles.css:694` для шапки и `:713` для строки) — обе надо менять согласованно при добавлении колонок.

### `src/ui/BoardHeader.svelte` — промежуточный слой
- **L23–29**: `saveSettings(fields)` переименовывает `fields.fullWidths` → `groupFullWidths` через `Object.fromEntries(GROUP_IDS.map(...))` и вызывает `updateBoard(board.id, { ...fields, groupFullWidths })`. Лишний слой переименования — новые поля надо протянуть через него.
- **L52–59**: монтирует `BoardSettingsPopup`.

### `src/ui/App.svelte`
- **L9**: `activeBoard` ищется по `$uiStore.activeBoardId`; **L15** передаёт `board` и `tasks` в `BoardLayout`. Ничего группового не знает.

---

## 2. Data Layer

### `src/data/types.ts`
```ts
export type GroupId = 'backlog' | 'focus' | 'inProgress' | 'orgIntentions' | 'delegated' | 'completed'; // L5
export const GROUP_IDS: GroupId[] = [...]; // L9 — порядок совпадает с GROUP_ORDER в BoardLayout

export interface Group {          // L23–29
  taskIds: string[];
  wipLimit: number | null;
  collapsed: boolean;
  completedRetentionDays: number | null;
  fullWidth: boolean;             // фича 0007
}

export interface Board {          // L31–40
  id: string;
  title: string;                  // ВНИМАНИЕ: имя `title` уже занято доской
  subtitle: string;
  groups: Record<GroupId, Group>;
  notes: string;
  notesCollapsed: boolean;
  notesHidden: boolean;           // фича 0009
  hiddenGroups: GroupId[];        // фича 0006
}
```
Поля `Group.title` и `Board.groupOrder` отсутствуют.

### `src/data/defaults.ts`
- **L4–11**: `DEFAULT_FULL_WIDTH: Record<GroupId, boolean>` — паттерн «дефолт на группу», прямой аналог для будущих дефолтов.
- **L13–21**: `createDefaultGroup(groupId: GroupId): Group`.
- **L23–42**: `createDefaultBoard(title = 'New board'): Board` — заполняет `groups` циклом по `GROUP_IDS` (L25–27), выставляет `backlog.collapsed`, `completed.collapsed`, `completed.completedRetentionDays = 30`.
- **L51–56**: `DEFAULT_DATA` с `version: 7`.

### `src/data/migration.ts` — паттерн миграций
`migrateData(data: unknown): PluginData` (L5). Устройство:
- L6–8: не объект → дефолт; L11: `version` из raw (0 если нет); L13–15: `version < 1` → полный сброс на дефолт.
- Далее серия независимых блоков `if (version < N) { ...; result.version = N; }` — **все блоки сравнивают исходную `version`**, поэтому v1 проходит все шаги за один вызов.
- L19–29 (v2, settings.language, единственный блок, создающий новый объект через spread); L31–34 — «внеблочная» страховка на `cardView`; L36–46 (v3, notes/notesCollapsed); L48–55 (v4, hiddenGroups); L57–66 (v5, fullWidth по `DEFAULT_FULL_WIDTH`); L68–73 (v6, cardLayout); L75–82 (v7, notesHidden).
- Стиль: мутация `result` на месте + `(board as any)` для отсутствующих полей, проверка через `=== undefined`.
- **Нигде нет валидации содержимого массивов** (например, `hiddenGroups` не проверяется на неизвестные `GroupId`).

Точка добавления v8: после L82, перед `return result` (L84). Плюс `DEFAULT_DATA.version` в `defaults.ts:52`.

### `src/data/cleanup.ts`
- `cleanupCompletedTasks(board, tasks)` — работает только с `board.groups.completed` (L4, L8).
- `cleanupOrphanedTasks(data)` — итерирует `Object.values(board.groups)` (L23), порядок не важен.
Оба не затрагиваются порядком/названиями.

### `src/main.ts`
- **L50–60** `loadPluginData()`: `migrateData(raw)` → `cleanupCompletedTasks` по всем доскам → `cleanupOrphanedTasks` → `saveData`. То есть **миграция сразу записывается на диск при загрузке**.
- L39–47: часовой интервал повторяет cleanup.

---

## 3. Similar Features (что переиспользовать)

| Фича | Артефакты | Что можно скопировать |
|------|-----------|----------------------|
| 0006 group visibility | `Board.hiddenGroups`, миграция v3→v4 (`migration.ts:48–55`), строки в `BoardSettingsPopup` | Паттерн per-board массива `GroupId[]` + локальная копия в попапе + применение в `updateBoard` |
| 0007 dynamic layout | `Group.fullWidth`, `DEFAULT_FULL_WIDTH`, миграция v4→v5, `computeGroupClasses`, `boardLayoutUtils.test.ts`, e2e `0007-dynamic-layout.spec.ts` | Паттерн per-group поля + дефолтная карта + чистая функция раскладки + тесты миграции в e2e (Сц.16/17) |
| 0009 notes visibility | `Board.notesHidden`, миграция v6→v7, отдельная строка в попапе с `.tm-popup__divider` | Паттерн добавления boolean-поля доски и строки в попап |

Все три фичи следуют одному конвейеру: `types.ts` → `defaults.ts` → `migration.ts` (+bump version) → `dataStore.updateBoard` → `BoardSettingsPopup` (локальная копия) → `BoardHeader.saveSettings` → рендер.

---

## 4. Integration Points

### Где отображается название группы (4 места, все читают `groupLabels`)
| Файл | Строка | Контекст |
|------|--------|----------|
| `src/ui/GroupHeader.svelte` | L17 | `{$groupLabels[groupId]}` — заголовок рабочей группы |
| `src/ui/CollapsibleGroup.svelte` | L39 | `{$groupLabels[groupId]}` — заголовок сворачиваемой группы |
| `src/ui/GroupSettingsPopup.svelte` | L27 | `{$t('groupSettings.heading')} {$groupLabels[groupId]}` — заголовок попапа настроек группы |
| `src/ui/BoardSettingsPopup.svelte` | L61 | `{$groupLabels[groupId]}` — имя в строке списка групп |

`groupLabels` — `derived(locale, ...)` в `src/i18n/index.ts:16–26`, возвращает `Record<GroupId, string>` из ключей `group.{id}`. Store **не знает о доске**, поэтому кастомное имя из него получить нельзя.

Важно: все четыре компонента уже получают объект `group: Group` (или `board`) в пропсах, поэтому при добавлении `Group.title` резолв вида «`group.title || $groupLabels[groupId]`» не требует новых пропсов ни в одном из них.

### Где название группы НЕ используется (проверено grep'ом)
- `src/modals/TaskModal.ts` и `src/ui/TaskFormContent.svelte` используют только `groupId` для дефолтного статуса (`TaskFormContent.svelte:19`), названия не показывают.
- Тосты (`BoardLayout.svelte:288–290`) выводят только текст задачи.
- `src/ui/EmptyState.svelte:8` использует ключ `emptyState.{groupId}` — подсказка пустой группы, **не** название. При переименовании останется на дефолтном тексте.
- `src/settings.ts` — только глобальные настройки, групп не касается.

### Где предполагается фиксированный порядок групп
| Место | Строка | Зависимость от порядка |
|-------|--------|------------------------|
| `src/data/types.ts` | L9 | `GROUP_IDS` — источник «канонического» порядка |
| `src/ui/BoardLayout.svelte` | L23 | дубликат `GROUP_ORDER` |
| `src/ui/BoardLayout.svelte` | L181–271 | **разметка**: порядок литеральных блоков = порядок в DOM |
| `src/ui/BoardSettingsPopup.svelte` | L52 | `{#each GROUP_IDS}` — порядок строк в попапе |
| `src/ui/boardLayoutUtils.ts` | L5–26 | логика пар half/full зависит от порядка **входного массива** (не от глобальной константы) |
| `src/stores/dataStore.ts` | L207 | `for (const id of GROUP_IDS)` — только присвоение fullWidth, порядок безразличен |
| `src/data/defaults.ts` | L25 | заполнение `groups`, порядок безразличен |
| `src/data/migration.ts` | L59 | цикл по `GROUP_IDS`, порядок безразличен |

### `computeGroupClasses` (`src/ui/boardLayoutUtils.ts`)
```ts
export function computeGroupClasses(groups: { id: GroupId; fullWidth: boolean }[]): Record<GroupId, string>
```
Комментарий в коде (L3–4): «ВАЖНО: зависит от фиксированного порядка групп. При появлении настраиваемого порядка — переработать.»

Фактическое поведение: функция **уже order-agnostic** — она сканирует входной массив слева направо и склеивает соседние `fullWidth: false` в пары (L8–24). Классы: `--full`, `--half`, `--half-alone`. Возвращаемый объект — словарь по `id`, порядок не сохраняет.

Значит переработка нужна не в самой функции (достаточно подать массив, отсортированный по `groupOrder`), а в:
1. источнике массива (`BoardLayout.svelte:25–27`);
2. в разметке `BoardLayout.svelte:181–271`, которая порядок игнорирует.

### `src/stores/dataStore.ts` — `updateBoard` (L199–214)
```ts
export function updateBoard(boardId: string, fields: {
  title: string; subtitle: string; hiddenGroups: GroupId[];
  groupFullWidths: Record<GroupId, boolean>; notesHidden: boolean;
}): void
```
Тело: находит доску по id, присваивает `title`, `subtitle`, `hiddenGroups`, `notesHidden`, затем цикл `for (const id of GROUP_IDS) board.groups[id].fullWidth = fields.groupFullWidths[id];`, потом `persist()` (L213).

`persist()` (L13–18) — `plugin.saveData(get(dataStore))`, вызывается в конце **каждой** мутирующей функции store. Прочие функции store, работающие с группами: `addTask` L20, `removeTaskFromGroup` L40, `restoreTaskToGroup` L56, `quickCompleteTask` L75, `undoQuickComplete` L112, `moveTask` L142, `toggleGroupCollapsed` L165, `updateGroupSettings` L176 — все обращаются к `board.groups[groupId]` по ключу, порядок им безразличен.

### `src/ui/useSortable.ts`
Читает `evt.from.dataset.groupId` / `evt.to.dataset.groupId` (L26–27) и зовёт `moveTask`. От порядка групп не зависит. Но: инстанс Sortable создаётся в `create()` и уничтожается в `destroy()` (L58–61) — при переводе разметки на `{#each}` **обязателен keyed each по `id`**, иначе перестановка групп пересоздаст DOM-узлы и Sortable-инстансы.

### NotesSection (фича 0009)
`src/ui/NotesSection.svelte` монтируется в `BoardLayout.svelte:273–281` после всех групп, в обёртке `.tm-board-layout__notes` (CSS `src/styles.css:86–88`, `grid-column: 1 / -1`). В `visibleGroups` и `computeGroupClasses` не входит, `GroupId` у неё нет. В `BoardSettingsPopup` её строка (L89–98) отделена `.tm-popup__divider` и стоит после списка групп. Вывод: в сортировку групп Notes не попадает и остаётся внизу доски, если это не менять специально.

---

## 5. Existing Tests

### Инструменты
- **Vitest 4.0.18** — unit, `vitest.config.ts`: `environment: 'node'`, `include: ['tests/unit/**/*.test.ts']`. Запуск `npm run test:unit`.
- **Playwright 1.50** — e2e, `playwright.config.ts`: `testDir: 'tests/e2e'`, `workers: 1`, `fullyParallel: false`, `baseURL: http://localhost:5173`, webServer `node esbuild.harness.mjs --serve`.
- Харнесс: `esbuild.harness.mjs` подменяет импорт `'obsidian'` на `tests/harness/obsidian-mock.ts`, монтирует реальный `App.svelte`, копирует `src/styles.css` в `tests/harness/styles.css`.
- Документация: `docs/testing/infrastructure.md` (заявлено 25 unit + 84 e2e).

### Unit-тесты
- `tests/unit/migration.test.ts` — эталон для миграций. Хелпер `makeBoard(overrides)` (L7–17) строит доску без новых полей; отдельные тесты `vN → v7` на каждую версию, тест идемпотентности v7→v7 через сравнение `JSON.stringify` (L124–132). Сигнатуры: `it('v6 → v7: notesHidden added', ...)`, `it('v7 → v7: data unchanged (idempotent)', ...)`.
  При добавлении v8 придётся обновить **все** ожидания `expect(result.version).toBe(7)` (10 вхождений).
- `tests/unit/cleanup.test.ts`, `tests/unit/statusTransitions.test.ts` — не затрагиваются.
- `src/ui/boardLayoutUtils.test.ts` — 5 тестов на `computeGroupClasses`, лежит **вне** `tests/unit/`, поэтому текущим `vitest.config.ts` не подхватывается (см. Problems).

### E2E-тесты
- `tests/e2e/helpers.ts` — общие хелперы: `standardBeforeEach`, `resetData(page, partial)` (через `window.__test.resetData`), `createTask`, `moveTask`, `expandGroup`, `openBoardSettings`/`saveBoardSettings`/`closeBoardSettings` (L130–145), `openGroupSettings`/`saveGroupSettings`.
- `tests/harness/main.ts` экспонирует `window.__test = { resetData, getDataStore, moveTask, updateSettings }` (L78–125). `resetData` умеет принимать **версионированный снимок** (`'version' in partial` → `migrateData(partial)`, L93–94) — так тестируются миграции в браузере (пример: `0007-dynamic-layout.spec.ts:231–266`, тест «Сц.16 migration v4→v5»).
- `tests/e2e/0007-dynamic-layout.spec.ts` — ближайший аналог: хелперы `getGroupWrapperClass` (L26–38), `isHalf/isHalfAlone/isFull`, `setFullWidth(page, groupName, fullWidth)` (L56–62).
- `tests/e2e/0006-group-visibility.spec.ts` — хелперы `hideGroup`/`showGroup` по имени группы.
- Покрыто: видимость групп, full/half раскладка, миграции v4→v5, персистентность per-board, узкий viewport.
- **Не покрыто**: порядок групп (не существует), названия групп, i18n-переключение имён.

---

## 6. Shared Utilities

| Утилита | Файл | Назначение |
|---------|------|-----------|
| `computeGroupClasses(groups)` | `src/ui/boardLayoutUtils.ts:5` | Чистая функция: массив `{id, fullWidth}` → `Record<GroupId, cssClass>` |
| `groupLabels` (derived store) | `src/i18n/index.ts:16` | Локализованные дефолтные названия групп |
| `t` (derived store) | `src/i18n/index.ts:11` | `(key: TranslationKey) => string`, fallback — сам ключ |
| `setLocale` / `detectLocale` | `src/i18n/index.ts:28–36` | Определение локали (auto → `window.moment.locale()`) |
| `createDefaultGroup` / `createDefaultBoard` | `src/data/defaults.ts:13,23` | Фабрики дефолтных структур |
| `persist()` | `src/stores/dataStore.ts:13` | private, `plugin.saveData(get(dataStore))` |
| `formatDate` | `src/utils/dateFormat.ts` | YYYY-MM-DD |

### i18n
- `src/i18n/types.ts:4–41` — `TranslationKey` это **явный union строк**, `Translations = Record<TranslationKey, string>`. Любой новый ключ надо добавить в union + в `en.ts` + в `ru.ts`, иначе TS-ошибка (strict mode).
- Ключи названий групп: `group.backlog | group.focus | group.inProgress | group.orgIntentions | group.delegated | group.completed` (`types.ts:5–6`, `en.ts:4–9`, `ru.ts:4–9`).
- Существующие ключи попапа доски: `boardSettings.*` (`en.ts:47–60`, `ru.ts:47–60`) — сюда добавлять новые (название группы, порядок, tooltip стрелок).

---

## 7. Potential Problems

**Файлов `docs/decisions-log.md` и `docs/tech-debt.md` в репозитории нет** — формальных ADR и реестра долга не ведётся. Ниже — долг, обнаруженный в коде.

1. **[Блокер инфраструктуры] `npm test` / `npm run test:unit` сейчас падает.** Установлен Node v18.19.1, vitest 4.0.18 требует `^20.0.0 || ^22.0.0 || >=24.0.0`, vite 7.3.1 — `^20.19.0 || >=22.12.0`. Фактический вывод: `Error [ERR_REQUIRE_ESM]: require() of ES Module .../vite/dist/node/index.js from .../vitest/dist/config.cjs not supported`. До обновления Node unit-тесты (в т.ч. на новую миграцию v8) не запускаются.

2. **[Средний] `src/ui/boardLayoutUtils.test.ts` не исполняется.** `vitest.config.ts` содержит `include: ['tests/unit/**/*.test.ts']`, а файл лежит в `src/ui/`. Тесты `computeGroupClasses` — именно та логика, которую фича трогает, — сейчас мёртвые. Handling: либо перенести в `tests/unit/`, либо расширить `include`.

3. **[Средний] Разметка `BoardLayout.svelte:181–271` игнорирует `visibleGroups`.** Порядок в DOM задан шестью литеральными блоками; `visibleGroups` используется только для CSS-классов. Любое изменение порядка требует переписывания разметки на `{#each}`, а это затрагивает: две разные компоненты (`CollapsibleGroup` требует `boardId`), `onAdd={null}` для `completed`, и 5 колбэков на каждую группу.

4. **[Средний] Риск пересоздания SortableJS при переходе на `{#each}`.** `use:useSortable` в `TaskGroup.svelte:32` и `CollapsibleGroup.svelte:68`. Без keyed each (`{#each ordered as g (g.id)}`) Svelte будет пересоздавать DOM групп при перестановке — Sortable-инстансы уничтожатся/пересоздадутся, возможны потери drag-состояния.

5. **[Средний] E2E-тесты завязаны на английские названия групп как на текстовые селекторы.** `tests/e2e/helpers.ts:90–93` (`COLLAPSIBLE_GROUP_LABELS`), `0007-dynamic-layout.spec.ts:20–23` и десятки `filter({ hasText: 'Focus' | 'In Progress' | 'Org Intentions' | ... })` в `0006`, `0007`, `0008`. Переименование групп в тестовых сценариях сломает эти локаторы. Handling: в новых тестах на переименование ставить кастомное имя и/или добавить в строку попапа `data-group-id`.

6. **[Средний] `Group` без валидации порядка на входе.** Ни одна миграция не валидирует содержимое массивов (`hiddenGroups` в `migration.ts:48–55` кладётся как есть). Для `groupOrder` нужно предусмотреть санацию: неизвестный `GroupId`, дубликаты, отсутствующие id (например, если файл `data.json` правили руками или в будущем добавится группа). Без санации `{#each groupOrder}` даст `board.groups[id] === undefined` → runtime-ошибка при рендере.

7. **[Низкий] `.tm-popup` не скроллится.** `src/styles.css:638–647`: `min-width: 320px; max-width: 420px`, `display:flex; flex-direction:column; gap:0.75rem` — нет `max-height` / `overflow-y`. Сейчас попап содержит 2 поля + 6 строк групп + строку Notes + кнопки. Добавление в каждую строку текстового инпута названия и двух стрелок увеличит и высоту, и требуемую ширину (сетка `1fr 4rem 4rem`, `styles.css:694,713`). На узких экранах / коротких окнах Obsidian попап может выйти за пределы вьюпорта.

8. **[Низкий] Дублирование порядка групп в трёх местах** — `GROUP_IDS` (`types.ts:9`), `GROUP_ORDER` (`BoardLayout.svelte:23`), порядок блоков в разметке. Расхождение между ними ничем не проверяется.

9. **[Низкий] Лишний слой переименования полей** `fullWidths` → `groupFullWidths` в `BoardHeader.svelte:23–27`. Новые поля придётся протаскивать через три сигнатуры: `BoardSettingsPopup.onSave` → `BoardHeader.saveSettings` → `dataStore.updateBoard`.

10. **[Низкий] Именование `title`.** `Board.title` уже существует (`types.ts:33`), и в `BoardSettingsPopup` локальная переменная `title` (L12) — это название доски. Добавление `Group.title` создаст неоднозначность внутри этого компонента; понадобятся раздельные имена локальных переменных.

11. **[Низкий] Миграция пишется на диск сразу при загрузке** (`main.ts:52–59`). Откатиться на предыдущую версию плагина после запуска v8 нельзя без ручного восстановления `data.json` — старый код просто проигнорирует новые поля (это безопасно), но `version: 8` останется в файле.

12. **Безопасность.** Пользовательский ввод названия группы будет отображаться через `{...}` интерполяцию Svelte (авто-экранирование), `{@html}` в проекте не используется — XSS-риска нет при соблюдении конвенции. Длина ограничивается атрибутом `maxlength` на инпуте (паттерн из `BoardSettingsPopup.svelte:36,41`: `maxlength="200"` / `"500"`); для лимита 40 символов — тот же приём. Отдельной серверной/логической валидации длины в проекте нет нигде, включая существующие поля.

---

## 8. Constraints & Infrastructure

- **Стек**: TypeScript strict, Svelte 4.2.19, esbuild 0.21.5 + esbuild-svelte 0.8.1, SortableJS 1.15.3 (единственная runtime-зависимость). Obsidian API min 1.0.0.
- **CSS**: `compilerOptions: { css: 'none' }` в `esbuild.config.mjs` и `esbuild.harness.mjs` — scoped-стили Svelte выключены. Все классы в `src/styles.css` с префиксом `tm-`, BEM. `esbuild.harness.mjs:39` копирует `src/styles.css` → `tests/harness/styles.css` при старте dev-сервера, поэтому e2e видит те же стили.
- **Node**: v18.19.1 — несовместим с установленными vitest/vite (см. Problems #1). E2E через Playwright запускается отдельно (`esbuild.harness.mjs` — чистый esbuild, работает на Node 18).
- **Персистентность**: единственный `data.json` через `loadData()`/`saveData()`. `persist()` вызывается после каждой мутации store — отдельного «сохранить всё» нет.
- **Версия данных**: текущая 7 (`defaults.ts:52`, последняя миграция `migration.ts:75–82`).
- **Скрипты**: `dev`, `build`, `test`(=vitest run), `test:unit`, `test:harness`, `test:e2e`, `test:e2e:ui`, `test:all`.
- **Pre-commit hooks / CI**: в репозитории не обнаружены (`.github/`, `.husky/`, `.gitlab-ci.yml` отсутствуют). Проверки — только ручные (`npx tsc --noEmit`, `npm run build`).
- **Env-переменные**: не используются.
- **Релиз**: версия дублируется в `manifest.json` и `package.json`; артефакты `main.js`, `styles.css` в корне (в `.gitignore` с ведущим `/`).

---

## 9. External Libraries

Новых библиотек фича не требует. Затрагиваемые существующие:

- **SortableJS 1.15.3** — используется только для перетаскивания карточек внутри и между группами (`src/ui/useSortable.ts`). Общая группа `'taskmaster'`, `draggable: '[data-task-id]'`. Для перестановки самих групп **не используется** (и по решению интервью использоваться не будет — стрелки вместо D&D). Единственное требование: при переходе разметки на `{#each}` не допустить пересоздания контейнеров (см. Problems #4).
- **Svelte 4** — keyed each (`{#each list as item (item.id)}`) сохраняет компоненты и DOM-узлы при перестановке; для незакейенного each Svelte обновляет узлы по позиции, что и уничтожит привязку Sortable. Реактивные `$:` в `BoardLayout` при переходе на each сохраняются как есть.
