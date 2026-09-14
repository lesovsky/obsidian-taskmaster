# Тестовая инфраструктура

Плагин Obsidian TaskMaster тестируется двумя инструментами:

- **Vitest** — unit-тесты (175 тестов в 8 файлах, среда Node.js, ~0,5 с на сами тесты)
- **Playwright** — E2E-тесты (123 теста в 6 файлах, реальный браузер)

Итого: 298 тестов.

## Требуемая версия Node

`package.json` объявляет `engines: ^22.12.0 || >=24.0.0` (линия 23.x исключена — её не поддерживает vitest), `.nvmrc` содержит версию, на которой набор проверен: 22.23.1.

Проверка версии сознательно не форсируется (`engine-strict` не включён, CI нет), поэтому запись в `package.json` остаётся декларативной — на несовместимом рантайме тесты не откажутся стартовать, а упадут стеком по внутренностям сборщика. Такой прогон читается как дефект кода, хотя дело в версии Node — при красном прогоне первым делом проверяйте `node -v`.

**На машине разработчика** нужная версия установлена через snap, а системный пакет Node перехватывает её в `PATH`. Поэтому команды тестов запускаются с явной подстановкой пути:

```bash
export PATH=/snap/bin:$PATH
node -v          # ожидается версия из .nvmrc
npm test
```

## Структура тестов

```
tests/
├── harness/
│   ├── obsidian-mock.ts    — Мок Obsidian API (Plugin, Modal, Notice, App, WorkspaceLeaf, ItemView, Setting)
│   ├── main.ts             — Инициализация харнесса + window.__test API
│   ├── index.html          — HTML-обёртка для харнесса
│   ├── obsidian-vars.css   — Obsidian CSS-переменные (фон, текст, акценты)
│   └── styles.css          — копия src/styles.css, которую отдаёт стенд (обновляется при сборке харнесса)
├── e2e/
│   ├── helpers.ts                      — Shared Playwright helpers
│   ├── core.spec.ts                    — Основные сценарии (создание, DnD, доски)
│   ├── 0006-group-visibility.spec.ts
│   ├── 0007-dynamic-layout.spec.ts
│   ├── 0008-card-columns.spec.ts
│   ├── 0011-group-customization.spec.ts
│   └── 0012-follow-up-tasks.spec.ts
└── unit/
    ├── statusTransitions.test.ts
    ├── migration.test.ts
    ├── cleanup.test.ts
    ├── dataStore.test.ts
    ├── followUps.test.ts
    ├── boardLayoutUtils.test.ts
    ├── groupOrderUtils.test.ts
    └── groupTitle.test.ts

esbuild.harness.mjs   — Сборка и dev-сервер харнесса
playwright.config.ts
vitest.config.ts
```

## Команды запуска

```bash
npm run test:unit          # vitest — unit-тесты (175 тестов)
npm run test:e2e           # playwright — E2E тесты (123 теста)
npm run test:e2e:ui        # playwright --ui — интерактивный режим
npm run test:all           # unit + E2E
npm run test:harness       # собрать харнесс без запуска тестов
```

## Архитектура харнесса

### Проблема

Obsidian — закрытое Electron-приложение, недоступное через npm. Плагин импортирует `'obsidian'`, который не существует вне Obsidian.

### Решение

HTML test harness с mock-реализацией Obsidian API:

1. `esbuild.harness.mjs` перехватывает `import ... from 'obsidian'` и подставляет `tests/harness/obsidian-mock.ts`
2. Реальный `App.svelte` монтируется в HTML-страницу
3. Playwright открывает эту страницу и взаимодействует с живым Svelte-приложением

```
esbuild.harness.mjs
  └── tests/harness/main.ts        (entry point)
       ├── obsidian-mock.ts        (replaces 'obsidian' import)
       └── src/ui/App.svelte       (real production app)
```

### Мок Obsidian API (`obsidian-mock.ts`)

Реализованные классы:

| Класс | Что мокируется |
|-------|----------------|
| `Plugin` | `loadData()` / `saveData()` через `localStorage` (`tm-test-data`) |
| `Modal` | Создаёт overlay `div.tm-test-modal-overlay` в `document.body`. Закрывается по Escape, как в Obsidian: вызывается `close()` → `onClose()`, форма уничтожается без сохранения. Мок рассчитан на одно открытое окно: при нескольких мок-окнах Escape закрыл бы все, а Obsidian закрывает только верхнее |
| `Notice` | Та же DOM-структура, что в Obsidian: `div.notice` внутри `div.notice-container` на `document.body`. Строка вставляется через `textContent` (как текст, не разметка), `DocumentFragment` — через `appendChild`. Уведомление удаляется само через `duration` мс, по умолчанию 5000. Настоящую длительность `obsidian.d.ts` не документирует, значение мока выбрано произвольно |
| `App` | Заглушки `workspace.getLeavesOfType`, `getLeaf` |
| `WorkspaceLeaf` | Заглушка `setViewState` |
| `ItemView` | `containerEl` с двумя дочерними элементами (как в Obsidian) |
| `Setting` | Fluent builder — no-op (no-operation) в тестах |

`main.ts` также добавляет полифиллы HTMLElement (`.empty()`, `.setText()`, `.createEl()`, `.addClass()` и др.) и stub `window.moment`.

## window.__test API

Харнесс экспонирует тестовый API на `window.__test`:

| Метод | Описание |
|-------|----------|
| `resetData(partial?)` | Сбрасывает все сторы в чистое состояние и удаляет оставшиеся с прошлого теста уведомления (`.notice-container`). Если `partial` содержит поле `version` — вызывает `migrateData(partial)`. Иначе `migrateData(null)` + deepMerge. Всегда форсирует `language: 'en'`. |
| `getDataStore()` | Возвращает текущее значение `dataStore` |
| `moveTask(id, from, to, index?)` | Перемещает задачу на активной доске через `moveTaskAndNotify` из `src/ui/useSortable.ts`, минуя SortableJS. Это та же функция, которую вызывает обработчик drop: перемещение в store и уведомление о заведённых пост-задачах |
| `updateSettings(settings)` | Обновляет `settings` в `dataStore` |

### Два режима `resetData`

**Версионированный снапшот** — объект с полем `version`:

```typescript
// Запускает полную цепочку миграций. Используется в тестах миграции.
await page.evaluate(() => window.__test.resetData({ version: 3, boards: [...] }));
```

**Переопределение настроек** — объект без поля `version`:

```typescript
// fresh data + deepMerge. Используется для изменения defaultPriority и др.
await page.evaluate(() => window.__test.resetData({ settings: { defaultPriority: 'high' } }));
```

## E2E helpers (`tests/e2e/helpers.ts`)

| Функция | Описание |
|---------|----------|
| `standardBeforeEach(page, partial?)` | Удаляет оставшиеся модальные окна + `resetData` |
| `createTask(page, groupId, data, options?)` | Открывает modal, заполняет форму, сохраняет. Возвращает `taskId`. |
| `moveTask(page, taskId, from, to, index?)` | Вызывает `window.__test.moveTask` (не drag-and-drop) |
| `dragCardToGroup(page, taskId, toGroupId)` | Настоящее перетаскивание мышью через SortableJS в тело группы (см. «Drag-and-drop»). Используется в 0011 и 0012 |
| `groupAddButton(page, groupId)` | Локатор кнопки «+» группы (для рабочих и сворачиваемых групп) |
| `expandGroup(page, groupId)` | Раскрывает collapsible-группу (backlog/completed) если свёрнута |
| `openBoardSettings(page)` | Кликает кнопку настроек доски → ждёт popup |
| `saveBoardSettings(page)` | Кликает Save → ждёт закрытия popup |
| `closeBoardSettings(page)` | Кликает Cancel → ждёт закрытия popup |
| `openGroupSettings(page, groupId)` | Открывает настройки конкретной группы |

### Пример типичного E2E-теста

```typescript
import { test, expect } from '@playwright/test';
import { standardBeforeEach, createTask, moveTask } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await standardBeforeEach(page);
});

test('перемещение задачи в completed меняет статус', async ({ page }) => {
  const taskId = await createTask(page, 'focus', { what: 'Задача' });
  await moveTask(page, taskId, 'focus', 'completed');
  await expect(page.locator(`[data-task-id="${taskId}"]`)).toHaveCount(1);
});
```

## Unit-тесты

Запускаются в среде Node.js, не требуют браузера.

| Файл | Что тестирует |
|------|---------------|
| `statusTransitions.test.ts` | 8 тестов: правила смены статуса при перемещении задачи между группами |
| `migration.test.ts` | 52 теста: миграция с каждой версии (0→9), идемпотентность v9→v9, null и пустой объект, санация `groupOrder`, `title` и `followUps` на повреждённых данных |
| `cleanup.test.ts` | 8 тестов: `cleanupCompletedTasks` (retention), `cleanupOrphanedTasks` |
| `dataStore.test.ts` | 29 тестов: `updateBoard` — запись названий, порядка, ширин и видимости, нормализация названия, устойчивость к повреждённой доске; заведение пост-задач — ☑ и отмена, `moveTask` (вход в «Завершённые» против перестановки внутри них), `createFollowUpTasks`, отсутствие заведения из `updateTask` |
| `followUps.test.ts` | 34 теста: `src/logic/followUps.ts` — незаведённые пункты, поля заведённой задачи и обрезка «Зачем», заведение и откат, черновики формы и лимиты, текст уведомления (однопроходная подстановка, оба словаря en и ru) |
| `boardLayoutUtils.test.ts` | 8 тестов: `computeGroupClasses` — пары half, одинокая half, произвольный порядок групп |
| `groupOrderUtils.test.ts` | 31 тест: перемещение стрелками (видимая и скрытая строка), состояние стрелок, согласованность `canMoveGroup` и `moveGroup`, `sanitizeHiddenGroups`, `moveGroupWithinPresent` |
| `groupTitle.test.ts` | 5 тестов: `resolveGroupTitle` — пустое и пробельное название → дефолтная подпись |

`tests/unit/` не входит в область `npx tsc --noEmit`: `tsconfig.json` включает только `src/**`. Ошибки типов в тестах ловит только сам прогон vitest.

## E2E spec-файлы

| Файл | Тестов | Сценарии |
|------|--------|----------|
| `core.spec.ts` | 35 | Создание/редактирование задач, удаление + undo, DnD, WIP-лимиты, управление досками, просрочка, XSS |
| `0006-group-visibility.spec.ts` | 17 | Скрытие/показ групп, защита последней группы, per-board настройки, миграция v3→v4 |
| `0007-dynamic-layout.spec.ts` | 16 | `fullWidth` настройки, алгоритм pairing (half/full/half-alone), миграция v4→v5 |
| `0008-card-columns.spec.ts` | 16 | single/multi `cardLayout`, CSS vars, DnD в multi-режиме, миграция v5→v6 |
| `0011-group-customization.spec.ts` | 18 | Переименование групп, порядок групп на доске (вычисленный `order` + геометрия), стрелки в попапе, выживание DOM-узлов и DnD сразу после перестановки, прокрутка попапа, независимость настроек досок, одинаковые названия у двух групп, приглушение строки до сохранения, длинное название в поле попапа |
| `0012-follow-up-tasks.spec.ts` | 21 | Пост-задачи: редактор в форме и лимиты, маркер `↪ N` в обоих режимах, ☑ с уведомлением и отменой, перетаскивание мышью в «Завершённые», статус в форме, «→ в бэклог» + Save/Escape, скрытый и переименованный бэклог, загрузка v8 и повреждённого списка, форма задачи из «Завершённых» только для чтения. Проверка на двух языках (AC-13) — в unit-тестах: стенд закрепляет `en` |

## Особенности и паттерны

### Изоляция тестов

Конфигурация Playwright: `workers: 1, fullyParallel: false` — тесты не параллельны из-за shared localStorage.

Каждый тест начинается с `standardBeforeEach`, который:
1. Удаляет оставшиеся `.tm-test-modal-overlay` из DOM
2. Вызывает `window.__test.resetData()` — сбрасывает все три стора и удаляет оставшиеся уведомления `Notice`
3. Отменяет pending toast-таймеры через `clearTimeout`, чтобы они не утекали между тестами

### Drag-and-drop

Большинство тестов перемещает задачи через `window.__test.moveTask()`. Он идёт в обход SortableJS, но через ту же функцию `moveTaskAndNotify`, что и обработчик drop, поэтому уведомление о пост-задачах проверяется и на этом пути.

Там, где важен сам жест (обработчик `onEnd`, выживание инстансов SortableJS), используется `dragCardToGroup()` из `helpers.ts` — настоящее перетаскивание мышью. Одного `mouse.move` не хватает по двум причинам. Библиотеке нужно начальное смещение, чтобы распознать жест. Кроме того, каждый список на пути курсора принимает карточку и перестраивает доску, и цель уезжает из-под курсора. Поэтому хелпер ждёт класс `tm-sortable-ghost`, затем в цикле наводится на центр цели. После каждого наведения он ждёт окончания анимации вставки и проверяет, что карточка уже в DOM целевой группы.

Playwright-ассерции с retry (`expect(...).toHaveCount(N)`) обеспечивают детерминированное ожидание DOM-обновления после изменения стора.

### Fake timers (тест таймаута toast)

```typescript
// clock.install() должен быть вызван ДО page.goto()
await page.clock.install();
await page.goto('/');
// ...создать задачу, удалить...
await page.clock.fastForward(8000); // вместо реального ожидания 7 секунд
```

Тест 5.4 делает повторный `goto` после `beforeEach` — это намеренно, не ошибка.

### Уведомления Obsidian (Notice)

Уведомления мока локейтятся как `.notice-container > .notice`, текст проверяется через `toHaveText`. Мок удаляет уведомление через 5000 мс, этого хватает на проверку сразу после действия. Для проверки «уведомления нет» используется `toHaveCount(0)` сразу после действия. Уведомления прошлого теста убирает `resetData`.

### Collapsible-группы (backlog, completed)

Атрибут `[data-group-id]` находится на `.tm-collapsible-group__body`, которое отсутствует в DOM пока группа свёрнута. Свёрнутая группа локейтится через `[data-group-container]` на обёртке — она присутствует в обоих состояниях:

```typescript
await page.locator('[data-group-container="backlog"] .tm-collapsible-group__header').click();
```

По тексту заголовка группы локейтить нельзя: название редактируется пользователем. Какой из трёх служебных атрибутов брать — `data-group-id`, `data-group-container` или `data-settings-group` — описано в `docs/technical.md`, раздел «Порядок групп на доске».

### DOM-обновления Svelte

После изменения состояния через `window.__test.*` Svelte обновляет DOM асинхронно.

**Рекомендуемые паттерны ожидания:**

```typescript
// Встроенный retry в Playwright — предпочтительно
await expect(locator).toHaveCount(N);

// Polling до выполнения условия
await page.waitForFunction(() => document.querySelectorAll('.tm-task-card').length === 3);

// Ожидание появления/исчезновения элемента
await page.waitForSelector('.tm-popup', { state: 'detached', timeout: 2000 });
```

**Не использовать:** `await page.waitForTimeout(N)` — нестабильно на разных машинах.

## Добавление новых тестов

### Unit-тест

1. Создать `tests/unit/feature.test.ts`
2. Импортировать тестируемую функцию из `src/`
3. Запустить: `npm run test:unit`

```typescript
import { describe, test, expect } from 'vitest';
import { myFunction } from '../../src/logic/myModule';

describe('myFunction', () => {
  test('возвращает корректный результат', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

### E2E-тест

1. Создать `tests/e2e/NNNN-feat-name.spec.ts`
2. Импортировать helpers из `./helpers`
3. Собрать харнесс: `npm run test:harness`
4. Запустить: `npm run test:e2e -- tests/e2e/NNNN-feat-name.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { standardBeforeEach } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await standardBeforeEach(page);
});

test('описание сценария', async ({ page }) => {
  // ...
});
```

### Обновление харнесса

При изменении `tests/harness/main.ts` или `tests/harness/obsidian-mock.ts`:

```bash
# Dev-сервер с live reload
node esbuild.harness.mjs --serve

# Или разовая сборка
npm run test:harness
```
