# Тестовая инфраструктура

Плагин Obsidian TaskMaster тестируется двумя инструментами:

- **Vitest** — unit-тесты (25 тестов, среда Node.js, ~200 мс)
- **Playwright** — E2E-тесты (84 теста, реальный браузер)

Итого: 109 тестов.

## Структура тестов

```
tests/
├── harness/
│   ├── obsidian-mock.ts    — Мок Obsidian API (Plugin, Modal, App, WorkspaceLeaf, Setting)
│   ├── main.ts             — Инициализация харнесса + window.__test API
│   ├── index.html          — HTML-обёртка для харнесса
│   └── obsidian-vars.css   — Obsidian CSS-переменные (фон, текст, акценты)
├── e2e/
│   ├── helpers.ts                      — Shared Playwright helpers
│   ├── core.spec.ts                    — Основные сценарии (создание, DnD, доски)
│   ├── 0006-group-visibility.spec.ts
│   ├── 0007-dynamic-layout.spec.ts
│   └── 0008-card-columns.spec.ts
└── unit/
    ├── statusTransitions.test.ts
    ├── migration.test.ts
    └── cleanup.test.ts

esbuild.harness.mjs   — Сборка и dev-сервер харнесса
playwright.config.ts
vitest.config.ts
```

## Команды запуска

```bash
npm run test:unit          # vitest — unit-тесты (25 тестов, ~200 мс)
npm run test:e2e           # playwright — E2E тесты (84 теста)
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
| `Modal` | Создаёт overlay `div.tm-test-modal-overlay` в `document.body` |
| `App` | Заглушки `workspace.getLeavesOfType`, `getLeaf` |
| `WorkspaceLeaf` | Заглушка `setViewState` |
| `ItemView` | `containerEl` с двумя дочерними элементами (как в Obsidian) |
| `Setting` | Fluent builder — no-op (no-operation) в тестах |

`main.ts` также добавляет полифиллы HTMLElement (`.empty()`, `.setText()`, `.createEl()`, `.addClass()` и др.) и stub `window.moment`.

## window.__test API

Харнесс экспонирует тестовый API на `window.__test`:

| Метод | Описание |
|-------|----------|
| `resetData(partial?)` | Сбрасывает все сторы в чистое состояние. Если `partial` содержит поле `version` — вызывает `migrateData(partial)`. Иначе `migrateData(null)` + deepMerge. Всегда форсирует `language: 'en'`. |
| `getDataStore()` | Возвращает текущее значение `dataStore` |
| `moveTask(id, from, to, index?)` | Перемещает задачу напрямую через `dataStore`, минуя SortableJS |
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
| `migration.test.ts` | 9 тестов: миграция с каждой версии (0→7), идемпотентность v7→v7, null и пустой объект |
| `cleanup.test.ts` | 8 тестов: `cleanupCompletedTasks` (retention), `cleanupOrphanedTasks` |

## E2E spec-файлы

| Файл | Тестов | Сценарии |
|------|--------|----------|
| `core.spec.ts` | 35 | Создание/редактирование задач, удаление + undo, DnD, WIP-лимиты, управление досками, просрочка, XSS |
| `0006-group-visibility.spec.ts` | 17 | Скрытие/показ групп, защита последней группы, per-board настройки, миграция v3→v4 |
| `0007-dynamic-layout.spec.ts` | 16 | `fullWidth` настройки, алгоритм pairing (half/full/half-alone), миграция v4→v5 |
| `0008-card-columns.spec.ts` | 16 | single/multi `cardLayout`, CSS vars, DnD в multi-режиме, миграция v5→v6 |

## Особенности и паттерны

### Изоляция тестов

Конфигурация Playwright: `workers: 1, fullyParallel: false` — тесты не параллельны из-за shared localStorage.

Каждый тест начинается с `standardBeforeEach`, который:
1. Удаляет оставшиеся `.tm-test-modal-overlay` из DOM
2. Вызывает `window.__test.resetData()` — сбрасывает все три стора
3. Отменяет pending toast-таймеры через `clearTimeout`, чтобы они не утекали между тестами

### Drag-and-drop

SortableJS не поддерживает программный drag-and-drop в Playwright. Вместо этого используется `window.__test.moveTask()`, который напрямую вызывает `dataStore.moveTask()`.

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

### Collapsible-группы (backlog, completed)

Атрибут `[data-group-id]` находится на `.tm-collapsible-group__body`, которое отсутствует в DOM пока группа свёрнута. Для локейтинга свёрнутых групп используется текст заголовка:

```typescript
await page.locator('.tm-collapsible-group__header').filter({ hasText: 'Backlog' }).click();
```

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
