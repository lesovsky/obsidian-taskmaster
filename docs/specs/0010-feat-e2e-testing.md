# E2E Testing Infrastructure

**Статус:** Approved
**Дата:** 2026-02-23

---

## 1. Контекст и проблема

### Текущая ситуация

После каждой новой фичи плагин тестируется вручную по чеклистам из `docs/testing/`. Checklists подробные (19–25 сценариев на фичу), но:

- ручное тестирование занимает 30–60 минут после каждого изменения;
- регрессии легко пропустить — проверяется только новая фича, не всё ранее реализованное;
- нет защиты от «сломал старое при добавлении нового».

Vitest уже настроен (`npm run test`), но тестов нет.

### Цель

Автоматизировать регрессионное тестирование через E2E-тесты на Playwright, дополнив их unit-тестами для бизнес-логики. Тесты должны покрывать существующие сценарии из `docs/testing/` и пополняться с каждой новой фичей.

### Метрики успеха

- `npm run test:all` проходит за < 2 минут и воспроизводит > 80% сценариев из `docs/testing/`
- Добавление новой фичи не требует ручного прогона полного регресса — только feature-specific spec
- Нет необходимости устанавливать Obsidian для запуска тестов

---

## 2. Требования

### Функциональные

- [ ] **[FR-1]** E2E-тесты запускаются командой `npm run test:e2e` в браузере без Obsidian
- [ ] **[FR-2]** Unit-тесты запускаются командой `npm run test:unit` (или `npm run test`)
- [ ] **[FR-3]** Команда `npm run test:all` запускает unit + E2E последовательно
- [ ] **[FR-4]** Тест-харнесс монтирует реальный `App.svelte` с мок-реализацией Obsidian API
- [ ] **[FR-5]** Каждый тест начинается с чистого состояния (изолированные данные)
- [ ] **[FR-6]** Core E2E тесты покрывают `docs/testing/test-scenarios.md` (секции 3–20)
- [ ] **[FR-7]** Feature-specific E2E тесты покрывают `docs/testing/0006-*`, `0007-*`, `0008-*`
- [ ] **[FR-8]** Unit-тесты покрывают `statusTransitions.ts`, `migration.ts`, `cleanup.ts`
- [ ] **[FR-9]** 7-секундные таймеры тостов тестируются через fake timers (мгновенно)
- [ ] **[FR-10]** Новый spec-файл для фичи 0009 (notes-visibility) создаётся по тому же паттерну

### Нефункциональные

- [ ] **[NFR-1]** Тесты запускаются локально без CI/CD
- [ ] **[NFR-2]** Полный прогон `test:all` < 2 минут
- [ ] **[NFR-3]** Один feature-specific spec < 30 секунд
- [ ] **[NFR-4]** Структура тестов зеркалит структуру `docs/testing/` — один `.spec.ts` на один `-testing.md`
- [ ] **[NFR-5]** Тест-харнесс не требует изменений в production-коде плагина

---

## 3. User Stories

### US-1: Регрессионное тестирование после фичи

**Как** разработчик, добавивший новую фичу,
**Хочу** запустить `npm run test:all` и убедиться что ничего не сломалось,
**Чтобы** не делать ручной прогон всех 200+ сценариев из `docs/testing/`.

**Критерии приёмки:**
- `npm run test:all` проходит без ошибок на чистом коде
- При намеренном введении регрессии — хотя бы один тест падает

### US-2: Тестирование новой фичи

**Как** разработчик, реализовавший новую фичу,
**Хочу** создать `tests/e2e/{N}-{description}.spec.ts` по шаблону,
**Чтобы** автоматически покрыть сценарии из `docs/testing/{N}-...-testing.md`.

**Критерии приёмки:**
- Есть шаблон/документация как создать новый spec-файл
- Spec-файл проходит за < 30 секунд

### US-3: Отладка упавшего теста

**Как** разработчик, у которого упал E2E-тест,
**Хочу** открыть интерактивный режим `npm run test:e2e:ui`,
**Чтобы** пошагово увидеть что именно не работает в браузере.

**Критерии приёмки:**
- `test:e2e:ui` запускает Playwright UI mode с отображением шагов
- Скриншоты/traces сохраняются при падении

---

## 4. Границы (Scope)

### В scope

- Test harness: HTML-страница с мок Obsidian API (`Plugin`, `Modal`, `App`, `ItemView`)
- esbuild конфиг для сборки харнесса (подменяет `obsidian` нашим моком)
- Playwright конфиг с webServer (esbuild serve)
- Unit-тесты: `statusTransitions`, `migration`, `cleanup`
- E2E core spec: сценарии 3–20 из `test-scenarios.md`
- Feature specs: `0006`, `0007`, `0008` (по `docs/testing/`)
- Описание workflow добавления тестов для новой фичи

### Вне scope

- CI/CD интеграция (GitHub Actions)
- Visual regression testing (сравнение скриншотов)
- Тесты производительности
- Тестирование внутри реального Obsidian
- Покрытие секций 1–2 из `test-scenarios.md` (установка, первый запуск — требуют реального Obsidian)

---

## 5. Технический дизайн

### Архитектура

```
tests/
├── harness/
│   ├── obsidian-mock.ts      ← Мок: Plugin, Modal, ItemView, App, WorkspaceLeaf, Setting
│   ├── main.ts               ← Init stores + mount App.svelte + window.__test
│   ├── index.html            ← HTML-обёртка
│   └── obsidian-vars.css     ← CSS-переменные Obsidian (--background-primary и др.)
├── e2e/
│   ├── helpers.ts            ← Общие утилиты: resetData(), createTask(), waitForToast()
│   ├── core.spec.ts          ← test-scenarios.md, секции 3–20
│   ├── 0006-group-visibility.spec.ts
│   ├── 0007-dynamic-layout.spec.ts
│   └── 0008-card-columns.spec.ts
└── unit/
    ├── statusTransitions.test.ts
    ├── migration.test.ts
    └── cleanup.test.ts

esbuild.harness.mjs           ← Build/serve харнесса
playwright.config.ts
vitest.config.ts              ← Точечный конфиг для unit/
```

### Obsidian Mock

Ключевые классы для мока:

**`Plugin`** — хранит данные в `localStorage`:
```typescript
class Plugin {
  app = new App();
  async loadData() { return JSON.parse(localStorage.getItem('tm-data') || 'null'); }
  async saveData(data) { localStorage.setItem('tm-data', JSON.stringify(data)); }
  registerView() {}
  addCommand() {}
  addRibbonIcon() {}
  addSettingTab() {}
  registerInterval() {}
}
```

**`Modal`** — рендерит как DOM overlay в `body`. Хранит ссылку на свой конкретный overlay-элемент (не `querySelector`):
```typescript
class Modal {
  contentEl = document.createElement('div');
  titleEl = document.createElement('div');
  private _overlay: HTMLElement | null = null;
  open() {
    const overlay = document.createElement('div');
    overlay.className = 'tm-test-modal-overlay';
    overlay.append(this.titleEl, this.contentEl);
    document.body.append(overlay);
    this._overlay = overlay;
    this.onOpen();
  }
  close() {
    this._overlay?.remove();
    this._overlay = null;
    this.onClose();
  }
  onOpen() {}
  onClose() {}
}
```

**Obsidian HTMLElement extensions** — Obsidian расширяет нативный `HTMLElement` методами `empty()`, `setText()`, `createEl()` и др. `TaskModal` вызывает `contentEl.empty()` и `titleEl.setText()`. Необходимо полифилить эти методы при инициализации харнесса:
```typescript
// harness/main.ts — до монтирования App
HTMLElement.prototype.empty = function() { this.innerHTML = ''; };
HTMLElement.prototype.setText = function(text: string) { this.textContent = text; };
HTMLElement.prototype.createEl = function(tag: string, attrs?: { text?: string; cls?: string }) {
  const el = document.createElement(tag);
  if (attrs?.text) el.textContent = attrs.text;
  if (attrs?.cls) el.className = attrs.cls;
  this.append(el);
  return el;
};
```

**`App`** — заглушка с workspace:
```typescript
class App {
  workspace = { getLeavesOfType: () => [], revealLeaf: () => {}, getLeaf: () => ({}) };
}
```

### esbuild harness plugin (замена модуля `obsidian`)

```javascript
// esbuild.harness.mjs
{
  name: 'obsidian-mock',
  setup(build) {
    build.onResolve({ filter: /^obsidian$/ }, () => ({
      path: path.resolve('./tests/harness/obsidian-mock.ts'),
    }));
  },
}
```

`obsidian` уже помечен как `external` в основном `esbuild.config.mjs` — в харнессе убираем `external` и подставляем мок через plugin.

### Инициализация харнесса (`harness/main.ts`)

`App.svelte` рендерится только если `$uiStore.activeBoardId` совпадает с существующей доской (`{#if activeBoard}`). При первом запуске и после каждого `resetData()` необходимо явно установить `activeBoardId`:

```typescript
const data = migrateData(null);  // свежие дефолтные данные
pluginStore.set(mockPlugin as any);
dataStore.set(data);
uiStore.update(ui => ({ ...ui, activeBoardId: data.boards[0].id }));
locale.set('en');               // зафиксировать язык, не полагаться на navigator.language
```

### `window.__test` API

Харнесс экспонирует на `window.__test`. Типизация добавляется через `declare global` в `harness/main.ts`:

```typescript
declare global {
  interface Window {
    __test: {
      resetData(partial?: Partial<PluginData>): void;
      getDataStore(): PluginData;
      moveTask(taskId: string, fromGroup: GroupId, toGroup: GroupId, toIndex: number): void;
    };
  }
}
```

`resetData()` сбрасывает **все три стора** и `localStorage`, чтобы изолировать тесты друг от друга. **Важно:** перед сбросом `uiStore` явно отменять активные таймеры тостов через `clearTimeout()`, иначе они сработают в следующем тесте:

```typescript
resetData(partial) {
  // 1. Отменить все активные таймеры тостов
  const currentUi = get(uiStore);
  currentUi.toasts.forEach(t => clearTimeout(t.timerId));

  // 2. Очистить хранилище и построить свежие данные
  localStorage.removeItem('tm-data');
  const data = migrateData(null);
  const merged = partial ? deepMerge(data, partial) : data;
  merged.settings.language = 'en';          // зафиксировать язык
  merged.boards.forEach(b => { b.hiddenGroups = b.hiddenGroups ?? []; });

  // 3. Сбросить все три стора
  dataStore.set(merged);
  uiStore.set({ activeBoardId: merged.boards[0].id, toasts: [] });
  pluginStore.set(mockPlugin as any);
}
```

`window.__test` также экспонирует `moveTask()` для надёжного тестирования drag-and-drop (см. ниже).

Тесты используют: `await page.evaluate(() => window.__test.resetData())`.

### Fake timers для тостов

`page.clock.install()` **должен вызываться до `page.goto('/')`**, иначе таймеры, созданные при инициализации компонентов, уже зарегистрированы в нативном планировщике и не будут перехвачены:

```typescript
test('toast expires after 7 seconds', async ({ page }) => {
  await page.clock.install();          // ← ДО goto
  await page.goto('/');
  // ...удаляем задачу, видим toast...
  await page.clock.fastForward(8000);  // мгновенно 8 секунд вперёд
  await expect(page.locator('.tm-toast')).not.toBeVisible();
});
```

Покрываются оба типа тостов: `DeleteToast` (удаление задачи) и `CompleteToast` (быстрое завершение через иконку ✓ — фича из `src/stores/uiStore.ts`). Поведение одинаковое: 7 сек, кнопка «Undo», стекинг до 3 тостов.

### Стратегия тестирования Drag & Drop

`locator.dragTo()` ненадёжен с SortableJS "cancel+update" стратегией: Playwright делает DOM-снапшот в момент промежуточного отката DOM, что приводит к флакующим тестам. Приоритет методов:

1. **Через `window.__test.moveTask()`** (предпочтительно) — вызывает `dataStore.moveTask()` напрямую, обходя mouse events. Тестирует полный путь: store update → statusTransition → Svelte rerender. Результат проверяется по DOM после события:
   ```typescript
   await page.evaluate(({ taskId, from, to }) =>
     window.__test.moveTask(taskId, from, to, 0),
     { taskId, from: 'backlog', to: 'focus' }
   );
   await expect(page.locator('[data-group="focus"] [data-task-id]')).toHaveCount(1);
   ```

2. **Через `locator.dragTo()`** — только для тестов, которые явно проверяют drag-and-drop UX (ghost-элемент, курсор). Используется с `{ force: true }` при необходимости. Таких тестов минимум.

### npm scripts

```json
"test:unit":    "vitest run",
"test:harness": "node esbuild.harness.mjs",
"test:e2e":     "playwright test",
"test:e2e:ui":  "playwright test --ui",
"test:all":     "vitest run && playwright test"
```

Текущий `"test": "vitest run"` сохраняется без изменений.

### vitest.config.ts

Unit-тесты (`tests/unit/`) импортируют только чистый TypeScript (`statusTransitions.ts`, `migration.ts`, `cleanup.ts`) — без `.svelte` файлов. Svelte transform не требуется, достаточно:

```typescript
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
```

### Playwright config

```typescript
webServer: {
  command: 'node esbuild.harness.mjs --serve',
  url: 'http://localhost:5173',
  reuseExistingServer: !process.env.CI,
},
workers: 1,          // один воркер — гарантированная изоляция через resetData()
fullyParallel: false, // тесты внутри файла последовательны, нет конкуренции за localStorage
```

**Изоляция тестов** — в каждом `test.beforeEach`:
1. Закрыть незакрытые модальные окна (защита от Svelte-утечек если предыдущий тест не закрыл модал):
   ```typescript
   await page.evaluate(() =>
     document.querySelectorAll('.tm-test-modal-overlay').forEach(el => el.remove())
   );
   ```
2. Сбросить состояние: `await page.evaluate(() => window.__test.resetData())`

esbuild `--serve` mode (`context.serve({ servedir: 'tests/harness', port: 5173 })`) пересобирает на каждый запрос — нет отдельного watch процесса. В `esbuild.harness.mjs`: при флаге `--serve` вызывать `context.serve()`, иначе `context.rebuild()` + `process.exit(0)`.

**Формат бандла**: `format: 'esm'` (не `cjs` — CJS не работает в браузере без Node.js). Основной `esbuild.config.mjs` использует `format: 'cjs'` для Obsidian/Electron — харнесс это не наследует.

**CSS-стили**: харнесс подключает `src/styles.css` напрямую (путём копирования в `tests/harness/dist/styles.css` при сборке) и `tests/harness/obsidian-vars.css`. Минимальный набор Obsidian CSS-переменных для `obsidian-vars.css`:
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

---

## 6. Workflow: добавление тестов для новой фичи

При добавлении новой фичи `{N}-feat-{description}` разработчик:

1. Создаёт `docs/testing/{N}-feat-{description}-testing.md` (по существующему шаблону)
2. Создаёт `tests/e2e/{N}-feat-{description}.spec.ts` по следующему шаблону:

```typescript
import { test, expect } from '@playwright/test';
import { resetData, createTask } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await resetData(page);
});

test.describe('00N: Feature Name', () => {
  test('TC-1: Happy path description', async ({ page }) => {
    // ...
  });
});
```

3. Каждый TC-N из `docs/testing/` → один `test('TC-N: ...')` в spec-файле
4. Запускает `npm run test:all` — убеждается что всё зелёное

---

## 7. Тестирование (самопроверка инфраструктуры)

- [ ] `npm run test:unit` — все unit-тесты зелёные
- [ ] `npm run test:harness` — харнесс собирается без ошибок
- [ ] `npm run test:e2e` — Playwright открывает браузер, все spec-файлы проходят
- [ ] `npm run test:e2e:ui` — открывается Playwright UI с трейсами
- [ ] `npm run test:all` — последовательный прогон < 2 минут
- [ ] При намеренном удалении из кода строки `task.status = 'inProgress'` в `statusTransitions.ts` — падает тест на автопереход статуса
- [ ] При изменении CSS-класса `.tm-toast` — падает тест на toast

---

## 8. Риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Drag-and-drop в Playwright ненадёжен | Средняя | Высокое | Использовать `locator.dragTo()` + `{ force: true }` если нужно; при нестабильности — mock через `page.evaluate` |
| esbuild mock сломает импорты в TypeScript | Низкая | Среднее | esbuild не делает type-checking; `npx tsc --noEmit` останется отдельной командой |
| `TaskModal` вызывает `contentEl.empty()` / `titleEl.setText()` — Obsidian extensions | Высокая | Высокое | Полифилить `HTMLElement.prototype.empty/setText/createEl` в `harness/main.ts` до монтирования App |
| Fake timers конфликтуют с Playwright internals | Низкая | Среднее | Использовать `page.clock` (Playwright 1.45+), не `sinon`/`jest.useFakeTimers` |

---

## 9. Открытые вопросы

- ~~Нужен ли CI/CD?~~ — Нет (решено)
- ~~Один spec-файл или несколько?~~ — Один файл на фичу (решено)
- ~~Fake timers или реальные?~~ — Fake timers, `page.clock.install()` до `page.goto()` (решено)
- ~~`contentEl.empty()` и др. Obsidian extensions~~ — полифилить в `harness/main.ts` (решено)
- ~~Drag-and-drop~~ — через `window.__test.moveTask()`, не mouse events (решено)
- Секция 14 (`test-scenarios.md`) — глобальные настройки через Obsidian SettingsTab: тестировать через `resetData({ settings: { defaultPriority: 'high' } })` и проверять UI (SettingsTab не мокается — слишком дорого)
