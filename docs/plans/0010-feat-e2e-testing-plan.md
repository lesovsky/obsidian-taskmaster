# План: E2E Testing Infrastructure

**Спецификация:** [docs/specs/0010-feat-e2e-testing.md](../specs/0010-feat-e2e-testing.md)
**Общая оценка:** 18 часов

---

## Фаза 1: Инфраструктура (4.5h)

### 1.1 Зависимости и package.json
**Оценка:** 0.5h
**Зависимости:** нет
**Файлы:** `package.json`

**Шаги:**
1. Установить `@playwright/test` >= 1.45 (требуется `page.clock` API)
2. Добавить в `devDependencies`: `"@playwright/test": "^1.50.0"`
3. Добавить скрипты:
   ```json
   "test:unit":    "vitest run",
   "test:harness": "node esbuild.harness.mjs",
   "test:e2e":     "playwright test",
   "test:e2e:ui":  "playwright test --ui",
   "test:all":     "vitest run && playwright test"
   ```
4. Запустить `npx playwright install chromium`

**Done when:**
- [ ] `npm run test:unit` работает (vitest не падает с ошибкой конфигурации)
- [ ] `npx playwright --version` показывает >= 1.45

---

### 1.2 Obsidian Mock
**Оценка:** 1.5h
**Зависимости:** нет
**Файлы:** `tests/harness/obsidian-mock.ts`

**Шаги:**
1. Создать файл `tests/harness/obsidian-mock.ts`
2. Реализовать `class App` — заглушка с `workspace`:
   ```typescript
   workspace = { getLeavesOfType: () => [], revealLeaf: () => {}, getLeaf: () => ({}) }
   ```
3. Реализовать `class WorkspaceLeaf` — пустая заглушка
4. Реализовать `class Plugin` — `loadData`/`saveData` через `localStorage`, остальное no-op
5. Реализовать `class Modal` — DOM overlay с `_overlay: HTMLElement | null` (хранить ссылку, не использовать `querySelector`), методы `open()`/`close()` управляют overlay в `body`, вызывают `onOpen()`/`onClose()`
6. Реализовать `class ItemView` — пустая заглушка с `containerEl = document.createElement('div')`
7. Реализовать `class Setting` — no-op для `settings.ts`
8. Экспортировать все классы именованно (named exports — не default)

**Done when:**
- [ ] Файл компилируется без ошибок TypeScript
- [ ] `Modal.open()` добавляет div в `document.body`
- [ ] `Modal.close()` удаляет именно свой overlay (не чужой)

---

### 1.3 Harness: main.ts + index.html + CSS
**Оценка:** 1h
**Зависимости:** 1.2
**Файлы:** `tests/harness/main.ts`, `tests/harness/index.html`, `tests/harness/obsidian-vars.css`

**Шаги:**

**`tests/harness/obsidian-vars.css`** — минимальный набор CSS-переменных Obsidian:
```css
:root {
  --background-primary: #ffffff;
  --background-secondary: #f2f3f5;
  --background-modifier-border: #ddd;
  --text-normal: #2e3338;
  --text-muted: #888;
  --text-on-accent: #ffffff;
  --interactive-accent: #7b6cd9;
  --interactive-accent-hover: #6a5bc8;
  --font-ui-small: 13px;
  --radius-s: 4px;
  --radius-m: 8px;
}
```

**`tests/harness/index.html`**:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="obsidian-vars.css">
  <link rel="stylesheet" href="styles.css">
  <style>body { margin: 0; padding: 8px; }</style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="harness.js"></script>
</body>
</html>
```

**`tests/harness/main.ts`** — порядок строго:
1. HTMLElement полифилы (до всего остального):
   ```typescript
   (HTMLElement.prototype as any).empty = function() { this.innerHTML = ''; };
   (HTMLElement.prototype as any).setText = function(t: string) { this.textContent = t; };
   (HTMLElement.prototype as any).createEl = function(tag: string, attrs?: { text?: string; cls?: string }) { ... };
   ```
2. Импорты сторов и App
3. Создать `mockPlugin = new MockPlugin()`
4. `migrateData(null)` → свежие данные
5. Установить все три стора + `locale.set('en')`
6. Примонтировать `new App({ target: document.getElementById('app')! })`
7. Объявить `declare global { interface Window { __test: ... } }`
8. Реализовать и экспонировать `window.__test`:
   - `resetData(partial?)` — clearTimeout всех toast timerId, localStorage.removeItem, migrateData(null), deepMerge, force `language='en'` и `hiddenGroups=[]`, set all stores
   - `getDataStore()` — `get(dataStore)`
   - `moveTask(taskId, fromGroup, toGroup, toIndex)` — вызывает `dataStore.moveTask()` из `src/stores/dataStore.ts`

**Done when:**
- [ ] Файлы созданы без синтаксических ошибок
- [ ] `window.__test` типизирован через `declare global`

---

### 1.4 esbuild.harness.mjs + vitest.config.ts + playwright.config.ts
**Оценка:** 1h
**Зависимости:** 1.3
**Файлы:** `esbuild.harness.mjs`, `vitest.config.ts`, `playwright.config.ts`

**`esbuild.harness.mjs`:**
- `entryPoints: ['tests/harness/main.ts']`
- `format: 'esm'` (не `cjs`!)
- `outfile: 'tests/harness/harness.js'`
- esbuild-plugin, перехватывающий `import '...' from 'obsidian'` → `tests/harness/obsidian-mock.ts`
- esbuild-svelte plugin с `compilerOptions: { css: 'none' }`
- При флаге `--serve`: `context.serve({ servedir: 'tests/harness', port: 5173 })`
- Иначе: `context.rebuild()` + `copyFileSync('src/styles.css', 'tests/harness/styles.css')` + `process.exit(0)`

**`vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] },
});
```

**`playwright.config.ts`:**
```typescript
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  fullyParallel: false,
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  webServer: {
    command: 'node esbuild.harness.mjs --serve',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

**Done when:**
- [ ] `npm run test:harness` завершается без ошибок
- [ ] Открыть `http://localhost:5173` после `node esbuild.harness.mjs --serve` — видна доска с группами
- [ ] В консоли браузера нет ошибок
- [ ] `window.__test` доступен в DevTools

---

## Фаза 2: Unit-тесты (3.5h)

### 2.1 statusTransitions.test.ts
**Оценка:** 1h
**Зависимости:** 1.4 (vitest.config.ts)
**Файлы:** `tests/unit/statusTransitions.test.ts`

Покрыть все 5 правил из `src/logic/statusTransitions.ts`:

| Тест | Условие | Ожидание |
|------|---------|----------|
| backlog→focus, status=new | from=backlog, status='new' | status='inProgress' |
| backlog→focus, status=waiting | from=backlog, status='waiting' | status='waiting' (без изменений) |
| any→completed | to='completed' | status='completed', completedAt заполнен |
| completed→focus | from='completed' | status='inProgress', completedAt='') |
| focus→delegated | working→working | status без изменений |
| any→backlog | to='backlog' | status без изменений |

**Done when:**
- [ ] `npm run test:unit` показывает 6+ passed тестов для statusTransitions

---

### 2.2 migration.test.ts
**Оценка:** 1.5h
**Зависимости:** 1.4
**Файлы:** `tests/unit/migration.test.ts`

Покрыть `src/data/migration.ts`:

| Тест | Входные данные | Ожидание |
|------|---------------|----------|
| null → дефолт | `migrateData(null)` | version=7, boards[0] существует |
| `{}` → дефолт | `migrateData({})` | version=7 |
| v1 → v7 | `{ version: 1, boards: [...] }` | ВСЕ поля присутствуют: language='auto', notes='', hiddenGroups=[], fullWidth у групп, cardLayout='single', notesHidden=false (`version` захватывается один раз → все блоки if(version<N) срабатывают) |
| v2 → v7 | `{ version: 2, ... }` | notes='', hiddenGroups=[], fullWidth, cardLayout='single', notesHidden=false |
| v3 → v7 | `{ version: 3, ... }` | hiddenGroups=[], fullWidth, cardLayout='single', notesHidden=false |
| v4 → v7 | `{ version: 4, ... }` | fullWidth у групп, cardLayout='single', notesHidden=false |
| v5 → v7 | `{ version: 5, ... }` | cardLayout='single', notesHidden=false |
| v6 → v7 | `{ version: 6, ... }` | notesHidden=false |
| v7 → v7 | актуальные данные | данные не изменились (идемпотентность) |

**Done when:**
- [ ] `npm run test:unit` показывает 9+ passed тестов для migration

---

### 2.3 cleanup.test.ts
**Оценка:** 1h
**Зависимости:** 1.4
**Файлы:** `tests/unit/cleanup.test.ts`

Покрыть `src/data/cleanup.ts`:

| Тест | Сценарий | Ожидание |
|------|----------|----------|
| cleanupCompleted: срок истёк | completedAt = 31 день назад, retention=30 | задача удалена |
| cleanupCompleted: не истёк | completedAt = 5 дней назад, retention=30 | задача осталась |
| cleanupCompleted: нет completedAt | completedAt='' | задача не удалена |
| cleanupCompleted: нет retention (свежая) | retention=null, completedAt=5 дней назад | задача осталась (дефолт 30 дней, не истёк) |
| cleanupCompleted: нет retention (старая) | retention=null, completedAt=31 день назад | задача удалена (дефолт 30 дней применён) |
| cleanupOrphaned: orphan task | taskId не в taskIds | задача удалена из tasks |
| cleanupOrphaned: referenced task | taskId в taskIds | задача осталась |
| cleanupOrphaned: multi-board | задача в board A, не в board B | задача сохранилась |

**Done when:**
- [ ] `npm run test:unit` показывает 7+ passed тестов для cleanup
- [ ] `npm run test:unit` итого: все тесты зелёные

---

## Фаза 3: E2E helpers + core spec (5.5h)

### 3.1 helpers.ts
**Оценка:** 1h
**Зависимости:** 1.4 (harness работает)
**Файлы:** `tests/e2e/helpers.ts`

Реализовать общие утилиты:

```typescript
// Сброс состояния (вызывать в beforeEach после cleanup overlay)
export async function resetData(page: Page, partial?: object): Promise<void>

// Создать задачу через UI (клик +, заполнить форму, сохранить)
export async function createTask(page: Page, groupId: string, taskData: {
  what: string; why?: string; who?: string; deadline?: string; priority?: string;
}): Promise<string>  // возвращает taskId из data-task-id атрибута

// Переместить задачу через window.__test.moveTask
export async function moveTask(page: Page, taskId: string, from: string, to: string, index?: number): Promise<void>

// Дождаться появления toast
export async function waitForToast(page: Page): Promise<Locator>

// Стандартный beforeEach: закрыть открытые модалы + resetData
export async function standardBeforeEach(page: Page, partial?: object): Promise<void>
```

**Done when:**
- [ ] `createTask` открывает модал, заполняет форму, сохраняет, возвращает ID
- [ ] `moveTask` успешно перемещает задачу через `window.__test.moveTask`

---

### 3.2 core.spec.ts — создание, редактирование, удаление (секции 3–5)
**Оценка:** 2h
**Зависимости:** 3.1
**Файлы:** `tests/e2e/core.spec.ts`

Покрыть сценарии 3.1–5.6 из `docs/testing/test-scenarios.md`:

**Секция 3 — Создание задач:**
- 3.1: создание с полным набором полей → карточка появляется, статус='inProgress'
- 3.2: создание в backlog → статус='new'
- 3.3: кнопка Save неактивна при пустом поле «Что»
- 3.4: 3 задачи подряд → счётчик группы = 3

**Секция 4 — Редактирование:**
- 4.1: клик по карточке → модал с предзаполненными полями
- 4.2: изменить поле + приоритет → карточка обновилась
- 4.3: изменить статус вручную → иконка обновилась, карточка на месте

**Секция 5 — Удаление + Toast:**
- 5.1: удаление через hover-кнопку × → карточка исчезла, toast появился
- 5.2: удаление через модал → toast появился
- 5.3: undo → карточка вернулась на прежнее место
- 5.4: ждать 7 сек (fake timer) → toast исчез, задача не вернулась
- 5.5: удалить 4 задачи → одновременно видно 3 toast'а
- 5.6: название > 40 символов → в toast обрезается с «…»

**Примечание:** тесты на таймеры (5.4, 5.5) используют `page.clock.install()` до `page.goto('/')` в отдельных `test()` блоках.

**Done when:**
- [ ] Все тесты секций 3–5 проходят зелёными

---

### 3.3 core.spec.ts — drag & drop, группы, WIP, доски (секции 6–20)
**Оценка:** 2.5h
**Зависимости:** 3.2
**Файлы:** `tests/e2e/core.spec.ts` (продолжение)

**Секция 6 — Drag & Drop** (через `window.__test.moveTask()`):
- 6.3: backlog(new) → focus → статус='inProgress'
- 6.4: any → completed → статус='completed'
- 6.5: completed → focus → статус='inProgress', completedAt очищен
- 6.2: focus → delegated → статус не изменился

**Секция 7 — Сворачивание:**
- 7.1: клик по заголовку backlog → разворачивается/сворачивается

**Секция 8 — WIP-лимиты:**
- 8.1: установить WIP=3 → счётчик формата "(N/3)"
- 8.2: превысить WIP → счётчик красный
- 8.3: снять WIP → счётчик без дроби

**Секция 10 — Управление досками:**
- 10.1: создать доску → переключение, 6 пустых групп
- 10.2: переключение между досками → задачи не смешиваются
- 10.3: переименовать доску → новое название в селекторе
- 10.4: пустое название → Save неактивна
- 10.5–10.6: удаление доски с подтверждением
- 10.7: одна доска → кнопка "Удалить" отсутствует

**Секция 11 — Просрочка:**
- 11.1: deadline в прошлом → красная рамка
- 11.2: задача в completed → красная рамка исчезает
- 11.3: без deadline → нет рамки

**Секция 14 — Настройки** (через `resetData`):
- 14.1: `resetData({ settings: { defaultPriority: 'high' } })` → новая задача создаётся с высоким приоритетом

**Секция 15 — Отображение карточки:**
- 15.1–15.2: полная и минимальная карточки

**Секция 20 — Edge cases:**
- 20.2: `<script>alert('XSS')</script>` в названии → текст отображается as-is, скрипт не выполняется

**Done when:**
- [ ] Все тесты секций 6–20 проходят зелёными
- [ ] `npm run test:e2e` проходит полностью

---

## Фаза 4: Feature specs (6h)

### 4.1 0006-group-visibility.spec.ts
**Оценка:** 2h
**Зависимости:** 3.1 (helpers)
**Файлы:** `tests/e2e/0006-group-visibility.spec.ts`

Покрыть `docs/testing/0006-feat-group-visibility-testing.md` (19 сценариев):

- Сценарий 1: скрыть/показать группу → задачи сохраняются
- Сценарий 2: счётчик задач в попапе настроек
- Сценарий 3–4: Cancel и клик overlay сбрасывают изменения
- Сценарий 5: настройки per-board (2 доски, разные hiddenGroups)
- Сценарий 9: последний свитчер задизейблен
- Сценарий 10–12: layout при скрытии focus/inProgress
- Сценарий 13: DnD между видимыми группами
- Сценарий 14–16: edge cases (многократное переключение, collapsed+hidden, переместить+скрыть)
- Сценарий 17: миграция v3→v4 (через `resetData` с version=3)
- Сценарий 18: локализация (EN/RU текстов в попапе)

**Done when:**
- [ ] Все 19 сценариев покрыты тестами
- [ ] Spec проходит < 30 секунд

---

### 4.2 0007-dynamic-layout.spec.ts
**Оценка:** 2h
**Зависимости:** 3.1
**Файлы:** `tests/e2e/0007-dynamic-layout.spec.ts`

Покрыть `docs/testing/0007-feat-dynamic-layout-testing.md` (21 сценарий):

- Сценарии 1–8: happy path (дефолтный лейаут, переключение fullWidth, сохранение)
- Сценарии 9–15: edge cases (все half, чередование, collapsed+half, notes всегда full)
- Сценарии 16–17: миграция v4→v5 и идемпотентность
- Сценарии 18–20: UI попапа (disabled checkbox, сохранение значения при скрытии, заголовки колонок)
- Сценарий 21: responsive <600px (через `page.setViewportSize({ width: 500, height: 800 })`)

**Done when:**
- [ ] Все 21 сценарий покрыты
- [ ] Spec проходит < 30 секунд

---

### 4.3 0008-card-columns.spec.ts
**Оценка:** 2h
**Зависимости:** 3.1
**Файлы:** `tests/e2e/0008-card-columns.spec.ts`

Покрыть `docs/testing/0008-feat-card-columns-testing.md` (TC-1 по TC-17 + Edge Cases):

- TC-1–TC-3: single/multi переключение → немедленное обновление grid
- TC-4–TC-6: количество колонок (4 для full-width, 2 для half-width), неполная строка
- TC-7: Empty State на 100% ширины в multi-режиме
- TC-8–TC-9: DnD в multi-режиме (через `moveTask`)
- TC-10: compact + multi
- TC-11–TC-12: truncation длинного заголовка (ellipsis + tooltip)
- TC-13: изменение ширины группы → пересчёт колонок
- TC-14: сохранение после перезапуска (через `resetData` с `cardLayout: 'multi'`)
- TC-15: миграция v5→v6 (через resetData с version=5)
- TC-16: responsive <600px → 1 колонка
- TC-17: смена языка (EN/RU подписи dropdown)
- EC-1–EC-4: edge cases (1-3 задачи в multi, D&D при переключении, backlog в multi)

**Done when:**
- [ ] Все TC и EC покрыты тестами
- [ ] Spec проходит < 30 секунд

---

## Фаза 5: Финальная проверка (0.5h)

### 5.1 Полный прогон и верификация
**Оценка:** 0.5h
**Зависимости:** все предыдущие
**Файлы:** нет изменений

**Шаги:**
1. `npm run test:all` — убедиться что unit + e2e проходят за < 2 минут
2. `npm run test:e2e:ui` — убедиться что Playwright UI открывается с трейсами
3. Намеренно сломать `statusTransitions.ts` (удалить `task.status = 'inProgress'`) → убедиться что тест падает
4. Восстановить

**Done when:**
- [ ] `npm run test:all` < 2 минут, все зелёные
- [ ] При регрессии — тест падает с понятной ошибкой
- [ ] Скриншоты/traces сохраняются в `test-results/` при падении

---

## Итоговая структура коммитов

```
feat: add @playwright/test dependency and test scripts
feat: add obsidian-mock.ts and esbuild.harness.mjs
feat: add test harness (main.ts, index.html, obsidian-vars.css)
feat: add playwright.config.ts and vitest.config.ts
test: add unit tests for statusTransitions, migration, cleanup
test: add E2E helpers and core spec (sections 3-8)
test: add E2E core spec (sections 10-20)
test: add 0006-group-visibility e2e spec
test: add 0007-dynamic-layout e2e spec
test: add 0008-card-columns e2e spec
```

## Критические зависимости

```
1.1 → 1.2 → 1.3 → 1.4 → { 2.x (параллельно) , 3.1 → 3.2 → 3.3 → 4.x (параллельно) } → 5.1
```

Фазы 2 (unit) и 3–4 (e2e) можно вести параллельно после готовности 1.4.

## Известные риски при реализации

| Риск | Когда проявится | Что делать |
|------|-----------------|------------|
| `contentEl.empty()` не полифилен → падение Modal | 1.3 при проверке в браузере | Полифил в main.ts до монтирования App |
| esbuild `format: 'esm'` + Svelte 4 → проблемы с tree-shaking | 1.4 | Попробовать `format: 'iife'` как fallback |
| `page.clock.install()` не перехватывает toast timers | 3.2 при тесте 5.4 | Вызывать до `page.goto()` |
| `moveTask` не экспортирован из dataStore.ts | 3.1 | Проверить экспорт, при необходимости добавить re-export в harness |
