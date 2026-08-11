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

---
---

# Updated: 2026-08-10 — углубление до уровня реализации

Дополняет разделы 1–9 выше. Не дублирует уже задокументированное; там, где новые факты отменяют прежний вывод, это отмечено явно.

---

## U1. Смена визуального порядка через CSS `order` — проверено экспериментально

### Вывод

**Путь рабочий.** Порядок групп на доске можно задать свойством `order` на обёртках групп, не трогая порядок и структуру блоков в `BoardLayout.svelte`. Это снимает риск №4 из раздела 7 (пересоздание инстансов SortableJS) целиком: шесть литеральных блоков `{#if !hidden.has('<id>')}` (L181–271) остаются на месте, у каждой обёртки меняется только атрибут `style`. Смена значения атрибута не пересоздаёт DOM-узел, поэтому `use:useSortable` на теле группы (`TaskGroup.svelte:32`, `CollapsibleGroup.svelte:68`) не перевызывается ни в `update`, ни в `destroy`.

### Устройство контейнера

`src/styles.css:63–94`:
```
.tm-board-layout            display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr);
                            column-gap/row-gap 0.75rem; align-content: start; flex: 1; overflow-y: auto
.tm-board-layout__group--full        grid-column: 1 / -1
.tm-board-layout__group--half        grid-column: span 1; display:flex; flex-direction:column
.tm-board-layout__group--half > *    flex: 1
.tm-board-layout__group--half-alone  grid-column: 1 / -1
.tm-board-layout__notes              grid-column: 1 / -1
@media (max-width: 600px)            --half и --half-alone → grid-column: 1 / -1
```
`grid-auto-flow` не задан → значение по умолчанию `row` (sparse). Именованных областей и явных `grid-template-areas`/`grid-row` нет — все элементы авто-размещаются.

### Взаимодействие `order` с `grid-column: 1 / -1` и `span 1`

По спецификации CSS Grid алгоритм авто-размещения работает в *order-modified document order*, то есть `order` учитывается. Проверено эмпирически на Chromium из `~/.cache/ms-playwright` (тот же движок, что в Obsidian/Electron) — воспроизведена реальная сетка `.tm-board-layout` с реальными классами:

DOM-порядок: `backlog(--full, order:5)`, `focus(--half, order:2)`, `inProgress(--half, order:1)`, `orgIntentions(--full, order:4)`, `delegated(--half-alone, order:3)`, `completed(--full, order:6)`, `notes(--notes, без order)`.

Результат по `getBoundingClientRect()` (ширина контейнера 1184px):
```
notes         top=8    left=8    w=1184     ← notes уехал наверх (см. ниже)
inProgress    top=56   left=8    w=588  ┐
focus         top=56   left=604  w=588  ┘  пара половинок собралась в одну строку
delegated     top=104  left=8    w=1184
orgIntentions top=152  left=8    w=1184
backlog       top=200  left=8    w=1184
completed     top=248  left=8    w=1184
```
Визуальный порядок групп = порядок значений `order` (1,2,3,4,5,6), при этом:
- две половинки, разнесённые в DOM, но соседние по `order`, встают **рядом в одной строке** — правило упаковки пар сохраняется;
- `grid-column: 1 / -1` (full и half-alone) корректно занимает обе колонки в своей позиции по `order`;
- `grid-column: span 1` корректно получает одну колонку.

### `computeGroupClasses` остаётся без изменений

Функция (`src/ui/boardLayoutUtils.ts:5`) уже order-agnostic: сканирует входной массив слева направо и склеивает соседние `fullWidth:false` в пары. Достаточно подать в неё массив, отсортированный по пользовательскому порядку и отфильтрованный по `hiddenGroups`, — то есть изменить только источник в `BoardLayout.svelte:25–27`. Классы и `order` вычисляются из одного и того же упорядоченного массива, поэтому расхождения между «кто с кем в паре» и «кто где стоит» быть не может по построению.

Комментарий `boardLayoutUtils.ts:3–4` («зависит от фиксированного порядка групп… переработать») после фичи станет неверным.

### Ловушка: `.tm-board-layout__notes`

У обёртки Notes (`BoardLayout.svelte:274`, CSS `styles.css:86–88`) `order` не задан → вычисляется в `0`. Во второй части пробы это подтвердилось: при группах с `order` 1…6 Notes оказался **первым элементом сетки**. После явной установки `order: 99` Notes вернулся вниз:
```
inProgress/focus … completed … notes top=248  ← корректно
```
То же произойдёт при группах с `order` 0…5: элемент с `order:0` и Notes с `order:0` сравниваются по DOM-порядку, Notes в DOM последний — он встанет сразу после группы с `order:0`, то есть вторым. **Notes требует явного `order` больше любого группового** независимо от выбранной базы нумерации (0- или 1-based).

### Побочные эффекты `order`, которые надо учесть

1. **DOM-порядок не меняется.** Порядок обхода табом, порядок чтения скринридером и порядок элементов в `document.querySelectorAll` остаются исходными. Для доски из 6 блоков это косметика, но это факт.
2. **Playwright `.nth()` / `.first()` идут по DOM-порядку, а не по визуальному.** E2E-проверки нового порядка групп нельзя строить на индексе элемента — нужен `boundingBox()` (сравнение `top`/`left`) или чтение вычисленного `order`. Это ограничение на способ написания новых тестов.
3. `order` влияет и на порядок отрисовки (paint order) — перекрытий в раскладке нет, эффекта не будет.
4. Медиа-запрос `max-width: 600px` (`styles.css:89–94`) на `order` не влияет — в одноколоночном режиме порядок так же соблюдается.

### Что конкретно меняется в `BoardLayout.svelte`

Шесть обёрток L182, L198, L213, L228, L243, L258 — сейчас `<div class={groupClasses['<id>']}>`. К каждой добавляются `style` с `order` и служебный атрибут (см. U2). Разметка внутри обёрток, колбэки, различие `CollapsibleGroup`/`TaskGroup`, `onAdd={null}` у `completed` — не трогаются.

**Отменяет вывод раздела 1** («разметку L181–271 придётся свернуть в один `{#each}`») и **снимает Problem #4** раздела 7. Problem #3 остаётся частично: разметка по-прежнему дублирует список групп шесть раз, но переписывать её не требуется.

---

## U2. Служебный признак на внешнем контейнере группы

### Где рендерятся обёртки

`src/ui/BoardLayout.svelte`, ровно шесть мест — `div` с классом из `groupClasses`, без каких-либо других атрибутов:

| Строка | Группа | Компонент внутри |
|--------|--------|------------------|
| 182 | `backlog` | `CollapsibleGroup` (L183–193) |
| 198 | `focus` | `TaskGroup` (L199–208) |
| 213 | `inProgress` | `TaskGroup` (L214–223) |
| 228 | `orgIntentions` | `TaskGroup` (L229–238) |
| 243 | `delegated` | `TaskGroup` (L244–253) |
| 258 | `completed` | `CollapsibleGroup` (L259–269) |

У обёртки **нет стабильного класса** — только модификатор раскладки (`--full` / `--half` / `--half-alone`), который меняется по настройкам. Именно поэтому `tests/e2e/0007-dynamic-layout.spec.ts:26–38` добирается до обёртки через `.locator('..')` от тела группы или через `.locator('..').locator('..')` от заголовка свёрнутой группы.

### Почему нельзя переиспользовать `data-group-id`

`data-group-id` проставлен на **теле** группы:
- `src/ui/TaskGroup.svelte:31` — `.tm-task-group__body`
- `src/ui/CollapsibleGroup.svelte:67` — `.tm-collapsible-group__body`, внутри `{#if !collapsed}` (L63), то есть у свёрнутой группы этого элемента в DOM **нет вообще**

Атрибут читается рантаймом: `src/ui/useSortable.ts:26–27` — `evt.from.dataset.groupId` / `evt.to.dataset.groupId`. Sortable привязан к телу, поэтому `evt.from`/`evt.to` — всегда тело; дублирование атрибута на обёртке продакшн-логику не сломает.

Сломаются **тесты**, причём двумя разными способами:
- **шумно** — `page.locator('[data-group-id="X"]')` начнёт матчить два элемента → strict mode violation;
- **молча** — `document.querySelector('[data-group-id="X"]')` вернёт обёртку (она раньше в document order), а не тело; чтение `el.style.getPropertyValue('--tm-card-columns')` даст пустую строку, и проверки колонок будут падать с невнятной диагностикой.

### Свободные имена

Во всём `src/` используются ровно два `data-*`-атрибута: `data-group-id` (`TaskGroup.svelte:31`, `CollapsibleGroup.svelte:67`) и `data-task-id` (`TaskCard.svelte:39,76`, читается в `useSortable.ts:21,30`). Ни в `src/styles.css`, ни в `tests/` других `data-*` нет. Любое имя, отличное от этих двух, конфликта не даст — например `data-tm-group`; `dataset`-ключ у него будет `tmGroup`, что не пересекается с `groupId` в `useSortable.ts`.

### Инвентаризация тестов

Всего файлов: `tests/e2e/helpers.ts`, `core.spec.ts`, `0006-group-visibility.spec.ts`, `0007-dynamic-layout.spec.ts`, `0008-card-columns.spec.ts`.

#### (а) Сломались бы от нового атрибута, **если** дать ему то же имя `data-group-id`

Только те места, где адресуется **сам элемент с атрибутом** (селекторы вида `[data-group-id="X"] .tm-task-card` останутся корректными — CSS-набор элементов дедуплицируется).

**Шумно (strict mode violation):**
- `tests/e2e/helpers.ts:100` — `page.locator('[data-group-id="${groupId}"]')` → `.isVisible()`
- `tests/e2e/0006-group-visibility.spec.ts:95, 108, 112, 120, 199, 200, 240, 284, 285` — `expect(page.locator('[data-group-id="X"]')).toBeVisible()/.not.toBeVisible()`
- `tests/e2e/core.spec.ts:245, 248, 252` — то же для `backlog`

**Молча берут не тот элемент (`document.querySelector`):**
- `tests/e2e/0008-card-columns.spec.ts:25` (внутри `setCardLayout`), `:35` (`getCardColumns`), `:43` (`isMultiClass`), `:183`

**Не пострадали бы (в этой категории):** `helpers.ts:57, 105, 115–116, 150–151`; все `[data-group-id="X"] .tm-task-card` / `[data-task-id]`; все `.tm-task-group:has([data-group-id="X"])` и `.tm-collapsible-group:has([data-group-id="X"])`.

**Вывод:** при использовании отдельного имени (`data-tm-group`) категория (а) пуста — ни одно существующее место не ломается.

#### (б) Сломаются от переименования групп — правка обязательна

**Б1. Локаторы строк в попапе настроек через текст.** Ломаются **гарантированно и независимо от переименования**: имя группы переезжает из текстового узла в `value` инпута, а `filter({ hasText })` смотрит только на текстовое содержимое.
- `tests/e2e/0006-group-visibility.spec.ts:22` (хелпер `hideGroup`), `:33` (хелпер `showGroup`) — вызываются из `:50, 55, 100, 111, 130, 142, 175, 184, 211, 237, 238, 246, 247`
- `tests/e2e/0006-group-visibility.spec.ts:66, 69, 77, 88, 155–157, 165, 192, 194, 225` — прямые локаторы строк
- `tests/e2e/0007-dynamic-layout.spec.ts:57` (хелпер `setFullWidth`) — вызывается из `:79, 88, 89, 108, 120, 146, 169, 170, 171, 172, 185, 186, 271`
- `tests/e2e/0007-dynamic-layout.spec.ts:99, 196, 206` — прямые локаторы строк
- `tests/e2e/0008-card-columns.spec.ts:204` — `filter({ hasText: 'Org Intentions' })`

**Б2. Локаторы заголовков свёрнутых групп через текст.** Ломаются при переименовании `backlog`/`completed` — обе свёрнуты по умолчанию (`defaults.ts:28–29`).
- `tests/e2e/helpers.ts:90–93` — константа `COLLAPSIBLE_GROUP_LABELS`; `:99–107` — `expandGroup`, локатор на `:104`
- `tests/e2e/0007-dynamic-layout.spec.ts:20–23` — константа `COLLAPSIBLE_HEADER_TEXT`; `:26–38` — `getGroupWrapperClass`, локатор на `:30`, обёртка через `.locator('..').locator('..')` на `:31`
- `tests/e2e/0006-group-visibility.spec.ts:82, 232` — `expect(...filter({ hasText: 'Backlog' })).toBeVisible()`
- `tests/e2e/core.spec.ts:251` — `filter({ hasText: 'Backlog' }).click()`

**Б3. Косвенно зависимые от Б2 (через `expandGroup`).** `helpers.ts:37–60` `createTask(..., { expand: true })` — вызовы `core.spec.ts:199`, `0008-card-columns.spec.ts:297`.

**Б4. Хелперы, которые логично перевести на новый признак заодно.** Работают и сейчас, но через `:has([data-group-id])` — с новым атрибутом на обёртке становятся проще и устойчивее к свёрнутому состоянию: `helpers.ts:110–117` (`groupAddButton`), `:148–155` (`openGroupSettings`), `0007-dynamic-layout.spec.ts:34–37`, `:294`, `0006-group-visibility.spec.ts:52, 101, 121, 177, 185`, `core.spec.ts:41, 53, 267, 292`.

#### (в) Не затронуты
- Все `[data-group-id="X"] .tm-task-card` / `[data-task-id]` в `core.spec.ts`, `0006`, `0008` — адресуют карточки, а не группу.
- `helpers.ts:74–85` (`moveTask`) — работает через `window.__test.moveTask` с `GroupId`, DOM не трогает.
- `helpers.ts:130–145` (`openBoardSettings`/`saveBoardSettings`/`closeBoardSettings`) — по классам и тексту кнопок, не групп. **NB:** `closeBoardSettings` (`:143`) фильтрует по тексту `'Cancel'`, `saveBoardSettings` (`:137`) — по `.tm-popup__btn--primary`.
- `core.spec.ts:350, 352, 354, 366, 367` — тексты кнопок удаления доски.
- Все три unit-теста в `tests/unit/`.

---

## U3. Точки чтения названия группы — аудит пропсов

Все четыре компонента **уже получают то, что нужно для резолва** — новых пропсов не требуется ни в одном:

| Файл:строка | Что рендерит | Пропсы, объявленные в компоненте | Доступ к `Group` |
|---|---|---|---|
| `src/ui/GroupHeader.svelte:17` | `{$groupLabels[groupId]}` | `groupId` (L5), `group: Group` (L6), `onAdd` (L7), `onSettings` (L8) | **есть** — `group` |
| `src/ui/CollapsibleGroup.svelte:39` | `{$groupLabels[groupId]}` | `groupId` (L9), `group: Group` (L10), `boardId` (L11), `tasks` (L12), 5 колбэков (L13–17) | **есть** — `group` |
| `src/ui/GroupSettingsPopup.svelte:27` | `{$t('groupSettings.heading')} {$groupLabels[groupId]}` | `groupId` (L5), `group: Group` (L6), `onSave` (L7), `onClose` (L8) | **есть** — `group` |
| `src/ui/BoardSettingsPopup.svelte:61` | `{$groupLabels[groupId]}` | `board: Board` (L6) + локальное состояние | **есть** — `board.groups[groupId]`, плюс локальная копия названий |

`GroupHeader` получает `group` из `TaskGroup.svelte:27` (`<GroupHeader {groupId} {group} … />`), а `TaskGroup`/`CollapsibleGroup` — из `BoardLayout.svelte` (`group={board.groups.<id>}`). Цепочка полная.

### Устройство `groupLabels`

`src/i18n/index.ts:16–26`:
```ts
export const groupLabels = derived(locale, ($locale) => {
  const dict = dictionaries[$locale];
  return { backlog: dict['group.backlog'], focus: dict['group.focus'], … } as Record<GroupId, string>;
});
```
Store производный только от `locale` (`index.ts:9`, `writable<Locale>`), о доске ничего не знает и знать не может — доска приходит пропсом, а не через store. Значит резолв «пользовательское или дефолтное» делается **в точке использования**, а не внутри `groupLabels`.

Форма резолва, консистентная с формулировкой user-spec (пустое значение и строка из пробелов = дефолт): непустое значение поля берётся как есть, иначе `$groupLabels[groupId]`. Trim выполняется при сохранении в попапе, поэтому в данных не может лежать строка из пробелов — но проверка на пустоту всё равно нужна на случай ручной правки `data.json`.

Ключи дефолтных названий: `src/i18n/types.ts:5–6` (union), `src/i18n/en.ts:4–9`, `src/i18n/ru.ts:4–9`.

---

## U4. `EmptyState`

`src/ui/EmptyState.svelte` целиком (13 строк):
```svelte
export let groupId: GroupId;            // L6 — единственный проп
$: key = `emptyState.${groupId}` as TranslationKey;   // L8
<div class="tm-empty-state">{$t(key)}</div>          // L11–13
```
Рендерится ровно из двух мест, оба — без дополнительных пропсов:
- `src/ui/TaskGroup.svelte:36` — `<EmptyState {groupId} />`, внутри `{#if groupTasks.length === 0}` (L35)
- `src/ui/CollapsibleGroup.svelte:72` — `<EmptyState {groupId} />`, внутри `{#if groupTasks.length === 0}` (L71)

Оба родителя имеют `group: Group` в пропсах, то есть признак переименования доступен в точке вызова — нужен один новый булев проп (или проп с самим названием) на `EmptyState`, прокидываемый из двух мест. Собственного доступа к `Board`/`dataStore` у `EmptyState` нет и заводить его незачем.

CSS: `.tm-empty-state` — `src/styles.css:485–492`; позиционирование внутри сетки карточек — `styles.css:120–122` (`.tm-task-group__body > .tm-empty-state { grid-column: 1 / -1 }`) и `styles.css:265` (аналог для collapsible). Новый текст на раскладку не влияет.

Ключи существующих подсказок: `src/i18n/types.ts:37–38`, `en.ts:89–94`, `ru.ts` (те же строки). Нейтральный текст из user-spec потребует **одного нового ключа** в union + оба словаря.

---

## U5. `BoardSettingsPopup` — текущая структура и объём правки

### Разметка строки группы (L52–87)

```svelte
{#each GROUP_IDS as groupId}                       ← L52, неключевой each по константе
  {@const count = board.groups[groupId].taskIds.length}      ← L53
  {@const isVisible = !hiddenGroups.includes(groupId)}       ← L54
  {@const isLastVisible = visibleCount === 1 && isVisible}   ← L55
  <div class="tm-popup__group-row" title={isLastVisible ? …}>   ← L56–59
    <span class="tm-popup__group-name">                      ← L60
      {$groupLabels[groupId]}                                ← L61
      {#if count > 0}<span class="tm-popup__group-count">({count})</span>{/if}   ← L62–64
    </span>
    <input type="checkbox" class="tm-popup__group-toggle" checked={isVisible} disabled={isLastVisible} on:change={…} />  ← L66–78
    <input type="checkbox" class="tm-popup__group-toggle" bind:checked={fullWidths[groupId]} disabled={!isVisible} … />  ← L79–85
  </div>
{/each}
```
Ровно **три ребёнка** в строке. Шапка списка (L47–51) — тоже три `span`: пустой `.tm-popup__group-header-name` (L48) + две подписи колонок (L49, L50). Строка Notes (L89–98) — тоже три ребёнка: `span` с названием (L90), чекбокс (L91–96), пустой `<span></span>`-заглушка (L97).

### CSS-сетка

- `.tm-popup__group-header` — `src/styles.css:694–700`: `display: grid; grid-template-columns: 1fr 4rem 4rem; align-items: end;`
- `.tm-popup__group-row` — `src/styles.css:713–719`: `display: grid; grid-template-columns: 1fr 4rem 4rem; align-items: center; padding: 0.35rem 0; border-bottom: 1px solid …`
- `.tm-popup__group-row:last-child` (`:720–722`) и `:has(+ .tm-popup__divider)` (`:723–725`) снимают нижнюю границу
- `.tm-popup__group-toggle` (`:739–741`) — `justify-self: center`; `:disabled` (`:742–745`) — `opacity: 0.4; cursor: not-allowed`
- `.tm-popup__group-name` (`:731–734`), `.tm-popup__group-count` (`:735–738`)

**Обе сетки (`:696` и `:715`) меняются согласованно**, плюс к ним — шапка (L47–51, добавить четвёртый `span`-заглушку под колонку стрелок) и строка Notes (L89–98, добавить четвёртого ребёнка), иначе элементы Notes съедут по колонкам.

### Контейнер попапа

`.tm-popup` — `src/styles.css:638–648`: `min-width: 320px; max-width: 420px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem`. **Нет `max-height`, нет `overflow`.** AC требует ограничения по высоте и прокрутки. Ограничение: `.tm-popup` — flex-колонка, содержащая заголовок (L32), два поля (L34–42), секцию групп (L44–99) и кнопки (L101–113); навешивание `overflow-y` на сам `.tm-popup` уводит в прокрутку и заголовок, и кнопки. Альтернативная точка — прокручивать `.tm-popup__section` (`styles.css:679–680`, сейчас пустое правило).

Для «прокрутки длинного названия внутри поля» дополнительных стилей не нужно: `input type="text"` прокручивается нативно; существующий `.tm-popup__input` (`styles.css:665–675`) задаёт `width: 100%`. Но в grid-ячейке `1fr` нужен `min-width: 0` на колонке/инпуте, иначе инпут раздвинет сетку — это то же ограничение, что уже решено через `minmax(0, 1fr)` в `.tm-board-layout:65`.

Для усечения многоточием в заголовке группы на доске: `.tm-group-header` (`styles.css:125–131`) — flex с `gap`, у `.tm-group-header__title` (`:135–139`) нет `overflow`/`text-overflow`/`min-width: 0`; у `.tm-collapsible-group__header` (`:195–206`) и `.tm-collapsible-group__title` (`:219–221`) — то же. Оба потребуют правки.

### Локальное состояние и откат

`BoardSettingsPopup.svelte:12–19` — инициализация из пропа `board` при создании компонента:
```ts
let title = board.title;                                      // L12 — это название ДОСКИ
let subtitle = board.subtitle;                                // L13
let hiddenGroups: GroupId[] = [...board.hiddenGroups];        // L14 — копия массива
let notesHidden: boolean = board.notesHidden;                 // L15
let fullWidths: Record<GroupId, boolean> = Object.fromEntries(GROUP_IDS.map(…));  // L16–18 — новый объект
let confirmDelete = false;                                    // L19
```
Записи в store до нажатия Save нет. Откат работает автоматически: `BoardHeader.svelte:52` — `{#if showSettings}`; Cancel (`BoardSettingsPopup:111`) и клик по оверлею (`:30`) зовут `onClose` → `showSettings = false` (`BoardHeader.svelte:58`) → компонент уничтожается вместе с локальными переменными. Новое состояние (названия групп, порядок) должно инициализироваться тем же способом — копией, а не ссылкой на `board.*`.

Производные: `canSave` (L21) — только `title.trim().length > 0` (название доски); `visibleCount` (L22) — по `hiddenGroups`, порядко-независим.

### Цепочка `onSave` — три сигнатуры

1. `BoardSettingsPopup.svelte:8` — объявление пропа; вызов на `:26`
2. `BoardHeader.svelte:23–29` — `saveSettings(fields)`; переименовывает `fullWidths` → `groupFullWidths` (L24–26) и зовёт `updateBoard(board.id, { ...fields, groupFullWidths })` (L27); передаётся в попап на `:56`
3. `src/stores/dataStore.ts:199–214` — `updateBoard(boardId, fields)`; присваивает `title`, `subtitle`, `hiddenGroups`, `notesHidden` (L204–207), цикл `for (const id of GROUP_IDS) board.groups[id].fullWidth = …` (L208–210), `persist()` (L213)

Все три придётся расширить одинаково.

### Порядок строк в попапе

`{#each GROUP_IDS as groupId}` (L52) — **неключевой** each по глобальной константе. AC требует, чтобы строки шли в пользовательском порядке и переставлялись стрелками без сохранения. При переходе на each по локальному массиву порядка нужен **ключ** (`{#each order as groupId (groupId)}`), иначе Svelte переиспользует DOM-узлы по позиции: фокус в текстовом поле и позиция курсора при нажатии стрелки будут теряться, а инпуты — «мигать» значениями. Это единственное место в фиче, где keyed each действительно нужен (на доске он не нужен, см. U1).

---

## U6. Миграция

### Структура `migrateData` (`src/data/migration.ts:5–85`)

- L6–8: не объект → `{ ...DEFAULT_DATA, boards: [{ ...DEFAULT_DATA.boards[0] }] }`
- L10–11: `const version = typeof raw.version === 'number' ? raw.version : 0`
- L13–15: `version < 1` → полный сброс на дефолт
- L17: `let result = data as PluginData` — дальше мутация исходного объекта на месте
- L19–29: `version < 2` — **единственный блок со spread** (создаёт новый `result`), выставляет `version: 2` внутри литерала
- L31–34: внеблочная страховка на `settings.cardView`
- L36–46: `version < 3` → `board.notes`, `board.notesCollapsed`; `result.version = 3` на L45
- L48–55: `version < 4` → `board.hiddenGroups = []`; `result.version = 4` на L54
- L57–66: `version < 5` → цикл по `GROUP_IDS`, `fullWidth` из `DEFAULT_FULL_WIDTH`; `result.version = 5` на L65
- L68–73: `version < 6` → `settings.cardLayout = 'single'`; `result.version = 6` на L72
- L75–82: `version < 7` → `board.notesHidden = false`; `result.version = 7` на L81
- L84: `return result`

Все блоки сравнивают **исходную** `version`, поэтому v1 проходит все шаги за один вызов. Стиль внутри блоков: проверка `(board as any).<field> === undefined` + присваивание через `(board as any)`. Валидации содержимого массивов нет нигде (`hiddenGroups` кладётся пустым и никогда не проверяется на неизвестные `GroupId`).

**Точка вставки v8:** после L82, перед `return result` (L84).

### Где захардкожена версия

Константы `CURRENT_VERSION` в проекте **нет**. Число `7` встречается:

**Продакшн:**
- `src/data/defaults.ts:52` — `DEFAULT_DATA.version: 7`
- `src/data/migration.ts:75` — `if (version < 7)`
- `src/data/migration.ts:81` — `result.version = 7`

**Тесты — `tests/unit/migration.test.ts`:**
- ожидания `expect(result.version).toBe(7)` — строки **22, 29, 37, 57, 72, 91, 107, 120, 129** (9 вхождений)
- названия тестов с числом: **20** (`'null → default data (version=7)'`), **27** (`'{} → default data (version=7)'`), **124** (`'v7 → v7: data unchanged (idempotent)'`), комментарий **125**
- входные версии снапшотов (менять не нужно, но они определяют покрытие): **34** (`version: 1`), **55** (`version: 2`), **66** (`version: 3`), **85** (`version: 4`), **101** (`version: 5`), **114** (`version: 6`); тест идемпотентности **124–132** строит вход через `migrateData(null)`, поэтому автоматически станет v8→v8
- хелпер `makeBoard` — **L7–17**, строит доску без `notes`/`hiddenGroups`/`fullWidth`/`notesHidden`; хелпер `fullWidthGroups` — **L135**

**Тесты — E2E, версионированные снапшоты через `window.__test.resetData`:**
- `tests/e2e/0006-group-visibility.spec.ts:259` — `version: 3`
- `tests/e2e/0007-dynamic-layout.spec.ts:234` — `version: 4`
- `tests/e2e/0008-card-columns.spec.ts:234` — `version: 5`

Эти три проверяют рендер после миграции, а не номер версии — после добавления v8 они продолжат работать, но фактически станут проверять и новый шаг тоже.

**Запись на диск:** `src/main.ts:50–60` — `migrateData(raw)` → cleanup → `saveData`, то есть миграция фиксируется в `data.json` уже при первой загрузке.

---

## U7. Тесты — точное состояние конфигурации

### `vitest.config.ts` (8 строк, целиком)
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],   // ← L6
  },
});
```
`src/ui/boardLayoutUtils.test.ts` (59 строк, 5 тестов на `computeGroupClasses`) не подпадает под `include` → не исполняется. Достаточно расширить массив на L6 (`'src/**/*.test.ts'`) либо перенести файл в `tests/unit/`. Побочных эффектов у первого варианта нет: `tsconfig.json:17` уже включает `src/**/*.ts`, типы `vitest` резолвятся (проверено `npx tsc --noEmit` — на этот файл ошибок нет), а `esbuild.config.mjs:10` собирает от `src/main.ts` с `treeShaking: true`, поэтому тест-файл в бандл не попадает (он ниоткуда не импортируется).

### `playwright.config.ts` (16 строк, целиком)
```ts
testDir: 'tests/e2e', workers: 1, fullyParallel: false,
use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
webServer: { command: 'node esbuild.harness.mjs --serve', url: 'http://localhost:5173',
             reuseExistingServer: !process.env.CI }
```
Ни `projects`, ни `retries`, ни `reporter` не заданы. Браузеры установлены (`~/.cache/ms-playwright`: chromium-1194/1208/1228 + headless shell).

### Harness — `esbuild.harness.mjs` (47 строк)
- L13: `entryPoints: ['tests/harness/main.ts']`, L16: `outfile: 'tests/harness/harness.js'`, L14–15: `bundle: true, format: 'esm'`
- L21–28: плагин `obsidian-mock` — `onResolve` на `/^obsidian$/` → `tests/harness/obsidian-mock.ts`
- L29–32: `esbuildSvelte` с `compilerOptions: { css: 'none' }` — идентично проду (`esbuild.config.mjs:23–25`)
- L38 (режим `--serve`) и L45 (разовая сборка): `copyFileSync('src/styles.css', 'tests/harness/styles.css')` — **стили копируются один раз при старте**, watch за CSS нет; после правки `src/styles.css` dev-сервер харнесса надо перезапускать
- L41: `ctx.serve({ servedir: 'tests/harness', port: 5173 })`

`tests/harness/harness.js` — сгенерированный артефакт, лежит в репозитории (содержит старую копию `useSortable`, строки 6008–6012).

### Доступ E2E к данным — `tests/harness/main.ts` (139 строк)
- L5–37: полифиллы `HTMLElement.prototype` (`empty`, `setText`, `createEl`, `addClass`, `removeClass`, `toggleClass`, `hasClass`) — **обязаны идти до импортов**
- L40: заглушка `window.moment = { locale: () => 'en' }` — иначе `detectLocale` (`i18n/index.ts:30`) падает на `'auto'`
- L54–61: инициализация — `new MockPlugin()`, `migrateData(null)`, `settings.language = 'en'`, `pluginStore.set`, `dataStore.set`, `uiStore.activeBoardId`, `locale.set('en')`
- L64: `new App({ target: document.getElementById('app')! })`
- L67–76: `declare global { interface Window { __test: {…} } }` — типизация API
- L78–125: `window.__test = { resetData, getDataStore, moveTask, updateSettings }`

**`resetData(partial?)` — L79–112:**
- a) L81–84: гасит таймеры всех тостов из `uiStore` (защита от протечки между тестами)
- b) L87: `localStorage.removeItem('tm-test-data')`
- c) L92–98: **ветвление по наличию поля `version`** — снапшот с `version` уходит прямо в `migrateData(partial)` (L94), иначе берётся `migrateData(null)` + `deepMerge(data, partial)` (L96–97)
- d) L100–101: принудительно `settings.language = 'en'` и `locale.set('en')` — вся E2E-адресация по тексту завязана на английский словарь
- e) L104–106: страховка `if (!board.hiddenGroups) board.hiddenGroups = []`
- f) L109–111: сброс всех трёх стор; `uiStore.set({ activeBoardId, toasts: [] })`

`deepMerge` — L128–138: один уровень вложенности, **массивы заменяются целиком**. Для порядка групп (массив) это удобно: `resetData(page, { boards: [...] })` заменит массив досок целиком; передать только порядок одной доски через merge не получится — нужен либо полный снапшот с `version`, либо новый метод в `__test`.

Обёртка со стороны тестов — `tests/e2e/helpers.ts:7–20`: `standardBeforeEach` сначала вычищает `.tm-test-modal-overlay` (L9–11), затем `resetData` (L16–20) с ожиданием `.tm-app`.

### Текущее состояние прогона

`npx vitest run` на установленном Node падает **до загрузки тестов**:
```
failed to load config from …/vitest.config.ts
Error [ERR_REQUIRE_ESM]: require() of ES Module …/node_modules/vite/dist/node/index.js
from …/node_modules/vitest/dist/config.cjs not supported.
```

---

## U8. Node и окружение — точные требования

### Заявленные `engines` установленных пакетов

| Пакет | Версия в `node_modules` | `engines.node` |
|---|---|---|
| `vite` (транзитивная зависимость vitest) | 7.3.1 | `^20.19.0 \|\| >=22.12.0` |
| `vitest` | **4.0.18** (в `package.json` заявлено `^4.0.18`) | `^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` |
| `@playwright/test` | **1.58.2** (в `package.json` заявлено `^1.50.0`) | `>=18` |
| `esbuild` | 0.21.5 | `>=12` |
| `esbuild-svelte` | 0.8.2 | `>=14` |
| `svelte` | 4.2.20 | `>=16` |
| `typescript` | 5.9.3 | `>=14.17` |

Пересечение `vite` и `vitest`: `^20.19.0 || >=22.12.0`. Плюс установленный `npm` 11.13.0 требует `^20.17.0 || >=22.9.0`. Итоговое пересечение — **`>=20.19.0` в ветке 20 либо `>=22.12.0`**; порог 22.12 из user-spec ему соответствует.

### Фактическое окружение

- `node -v` → **v18.19.1**
- `npm -v` → **11.13.0**, при каждом вызове печатает `npm warn cli npm v11.13.0 does not support Node.js v18.19.1`

### Фиксация версии в репозитории

Ничего нет: **`.nvmrc`, `.node-version`, `.tool-versions` отсутствуют**; в `package.json` (35 строк, приведён целиком в разделе 8) **поля `engines` нет**; в `.github/`, `.husky/`, `.gitlab-ci.yml` — тоже нет (директорий не существует). AC требует зафиксировать требование в проекте — свободна любая из трёх точек.

---

## U9. Дополнения к Potential Problems

Файлов `docs/decisions-log.md` и `docs/tech-debt.md` в репозитории по-прежнему нет (проверено повторно) — ADR и реестра долга не ведётся, флагов оттуда нет.

**13. [Высокий, блокирует quality gate] `npx tsc --noEmit` сейчас падает — 2 ошибки, не связанные с этой фичей.**
```
src/i18n/en.ts(60,3): error TS2353: … ''boardSettings.notes'' does not exist in type 'Translations'.
src/i18n/ru.ts(60,3): error TS2353: … ''boardSettings.notes'' does not exist in type 'Translations'.
```
Ключ `'boardSettings.notes'` добавлен в оба словаря (`en.ts:60`, `ru.ts:60`) и используется в `BoardSettingsPopup.svelte:90`, но **не добавлен в union `TranslationKey`** (`src/i18n/types.ts:21–26` — там `boardSettings.*` заканчивается на `fullWidthTooltip`). Недоделка фичи 0009. `.svelte` мимо `tsc` проходит молча (парсер их игнорирует), поэтому ошибка вылезает только на словарях. Severity: сама по себе безвредна в рантайме (значение в словаре есть), но typecheck как гейт для этой фичи не пройдёт, а фича добавляет новые ключи в тот же union — риск, что ошибку спишут на свои изменения. Handling: одна строка в `types.ts`.

**14. [Средний] Уточнение к Problem #5 — поломка тестов шире, чем «переименование ломает текстовые локаторы».** Строковые локаторы строк попапа (`.tm-popup__group-row` + `filter({ hasText })`, категория Б1 в U2) перестанут работать **независимо от того, переименовывает тест группу или нет**: название переезжает в `value` инпута, а `hasText` смотрит только текстовые узлы. Затронуто 5 хелперов и ~30 вызовов в трёх spec-файлах.

**15. [Средний] `document.querySelector('[data-group-id]')` в `0008-card-columns.spec.ts` (L25, 35, 43, 183) — «тихая» точка отказа.** Если служебный признак на обёртке назвать так же, эти хелперы вернут обёртку вместо тела и молча начнут читать пустой `--tm-card-columns`. Прямая мотивация выбрать другое имя атрибута.

**16. [Низкий] `.tm-board-layout__notes` без явного `order`** — при переходе на CSS-порядок обёртка Notes уедет наверх (проверено). См. U1.

**17. [Низкий] Стили заголовков групп не переживут длинное название.** `.tm-group-header` (`styles.css:125–131`) и `.tm-collapsible-group__header` (`:195–206`) — flex-контейнеры без `min-width: 0` на детях; `.tm-group-header__title` (`:135–139`) и `.tm-collapsible-group__title` (`:219–221`) без `overflow`/`text-overflow`. 40 символов вытолкнут счётчик и иконки за границы группы.

**18. [Низкий] `harness.js` — сгенерированный артефакт в репозитории.** `tests/harness/harness.js` содержит устаревшую сборку. На тесты не влияет (playwright поднимает свежий `--serve`), но в diff фичи появится шум, если кто-то запустит `npm run test:harness`.

**19. [Информационно] Порядок в тестах нельзя проверять индексом элемента.** При CSS-подходе DOM-порядок групп неизменен, поэтому `.nth()`/`.first()`/`querySelectorAll` в новых E2E-сценариях на порядок дадут ложно-зелёный результат. Проверять надо через `boundingBox()` или через вычисленный `order`.
