# План: Динамический лейаут

**Спецификация:** [docs/specs/0007-feat-dynamic-layout.md](../specs/0007-feat-dynamic-layout.md)
**Общая оценка:** 10 часов

---

## Фаза 1: Слой данных (1.5h)

### 1.1 Добавить `fullWidth` в тип `Group`

**Оценка:** 0.5h
**Зависимости:** нет
**Файлы:** `src/data/types.ts`

**Шаги:**
1. Добавить поле `fullWidth: boolean` в интерфейс `Group` с комментарием `// true = полная ширина, false = половина`

**Done when:**
- [ ] `Group` содержит поле `fullWidth: boolean`
- [ ] TypeScript компилируется без ошибок (`npm run build` проходит)

---

### 1.2 Дефолты и фабрика групп

**Оценка:** 0.5h
**Зависимости:** 1.1
**Файлы:** `src/data/defaults.ts`

**Шаги:**
1. Объявить константу `DEFAULT_FULL_WIDTH: Record<GroupId, boolean>`:
   - `backlog: true`, `focus: false`, `inProgress: false`, `orgIntentions: true`, `delegated: true`, `completed: true`
2. Обновить сигнатуру `createDefaultGroup()` → `createDefaultGroup(groupId: GroupId)`
3. Добавить `fullWidth: DEFAULT_FULL_WIDTH[groupId]` в возвращаемый объект
4. В `createDefaultBoard` заменить все `createDefaultGroup()` на `createDefaultGroup(id)`

**Done when:**
- [ ] `DEFAULT_FULL_WIDTH` экспортируется из `defaults.ts`
- [ ] `createDefaultGroup(groupId)` принимает `GroupId` и возвращает корректный `fullWidth`
- [ ] `createDefaultBoard` передаёт `id` в `createDefaultGroup`
- [ ] TypeScript компилируется без ошибок

---

### 1.3 Миграция data.json до version 5

**Оценка:** 0.5h
**Зависимости:** 1.2
**Файлы:** `src/data/migration.ts`

**Шаги:**
1. После блока `if (version < 4)` добавить блок `if (version < 5)`
2. В блоке итерировать по `result.boards`, для каждой доски по `GROUP_IDS`:
   - Если `board.groups[id].fullWidth === undefined` → присвоить `DEFAULT_FULL_WIDTH[id]`
3. Установить `result.version = 5`
4. Импортировать `DEFAULT_FULL_WIDTH` из `../data/defaults`

**Done when:**
- [ ] Старый `data.json` (version=4) корректно мигрирует: focus/inProgress → false, остальные → true
- [ ] Новый `data.json` (version=5) не перезаписывает пользовательские значения
- [ ] TypeScript компилируется без ошибок

---

## Фаза 2: Стор и передача данных (1h)

### 2.1 Обновить `updateBoard` в dataStore

**Оценка:** 0.5h
**Зависимости:** 1.1
**Файлы:** `src/stores/dataStore.ts`

**Шаги:**
1. Расширить тип `fields` в `updateBoard`:
   ```typescript
   fields: {
     title: string;
     subtitle: string;
     hiddenGroups: GroupId[];
     groupFullWidths: Record<GroupId, boolean>; // NEW
   }
   ```
2. В теле функции добавить применение `groupFullWidths`:
   ```typescript
   for (const id of GROUP_IDS) {
     board.groups[id].fullWidth = fields.groupFullWidths[id];
   }
   ```

**Done when:**
- [ ] `updateBoard` принимает `groupFullWidths`
- [ ] При вызове значения `fullWidth` сохраняются в store и персистируются
- [ ] TypeScript компилируется без ошибок

---

### 2.2 Обновить `BoardHeader` — передача `fullWidths`

**Оценка:** 0.5h
**Зависимости:** 2.1
**Файлы:** `src/ui/BoardHeader.svelte`

**Шаги:**
1. В функции `saveSettings` собрать `groupFullWidths` из текущего состояния групп доски:
   ```typescript
   const groupFullWidths = Object.fromEntries(
     GROUP_IDS.map(id => [id, fields.fullWidths[id]])
   ) as Record<GroupId, boolean>;
   ```
2. Передать `groupFullWidths` в вызов `updateBoard`
3. Убедиться, что тип `fields` в `saveSettings` включает `fullWidths: Record<GroupId, boolean>`

**Done when:**
- [ ] `saveSettings` корректно передаёт `groupFullWidths` в `updateBoard`
- [ ] TypeScript компилируется без ошибок

---

## Фаза 3: UI (5h)

### 3.1 BoardSettingsPopup — checkbox «Полная ширина»

**Оценка:** 1.5h
**Зависимости:** 2.2
**Файлы:** `src/ui/BoardSettingsPopup.svelte`

**Шаги:**
1. Добавить локальное состояние `fullWidths: Record<GroupId, boolean>`, инициализировать из `board.groups`
2. Добавить заголовок колонок над списком групп (`tm-popup__group-header`):
   - Три колонки: «Группа», «Показать», «Полная ширина»
3. В каждую строку `.tm-popup__group-row` добавить второй `<input type="checkbox">`:
   - `bind:checked` → `fullWidths[groupId]`
   - `disabled` = группа скрыта (`hiddenGroups.includes(groupId)`)
   - CSS-класс `tm-popup__group-toggle` (или новый, если нужна другая стилизация)
4. Расширить сигнатуру `onSave`:
   ```typescript
   onSave: (fields: {
     title: string;
     subtitle: string;
     hiddenGroups: GroupId[];
     fullWidths: Record<GroupId, boolean>; // NEW
   }) => void
   ```
5. В `handleSave` передавать `fullWidths` в `onSave`
6. Добавить i18n-ключи для заголовков: `$t('boardSettings.fullWidth')` и `$t('boardSettings.groupVisibility')`

**Done when:**
- [ ] В UI видны два checkbox на каждую группу: видимость и полная ширина
- [ ] Checkbox «Полная ширина» заблокирован для скрытых групп
- [ ] При сохранении `fullWidths` передаётся в `onSave`
- [ ] Данные `fullWidth` скрытой группы не сбрасываются

---

### 3.2 i18n-ключи

**Оценка:** 0.5h
**Зависимости:** нет (параллельно с 3.1)
**Файлы:** `src/i18n/en.ts`, `src/i18n/ru.ts`

**Шаги:**
1. В `en.ts` добавить в секцию `boardSettings`:
   ```typescript
   fullWidth: 'Full width',
   fullWidthTooltip: 'Group spans full board width',
   ```
2. В `ru.ts` добавить:
   ```typescript
   fullWidth: 'Полная ширина',
   fullWidthTooltip: 'Группа занимает всю ширину доски',
   ```

**Done when:**
- [ ] Ключи добавлены в оба файла локализации
- [ ] TypeScript компилируется без ошибок

---

### 3.3 CSS — Grid-стили и новые классы

**Оценка:** 1h
**Зависимости:** нет (параллельно с 3.1)
**Файлы:** `src/styles.css`

**Шаги:**
1. Заменить секцию `/* BoardLayout */` — убрать flex-layout, добавить Grid:
   ```css
   .tm-board-layout {
     display: grid;
     grid-template-columns: 1fr 1fr;
     column-gap: 0.75rem;
     row-gap: 0.75rem;
     align-items: start;
     flex: 1;
     overflow-y: auto;
   }
   ```
2. Убрать или переназначить классы `.tm-board-layout__row` и `.tm-board-layout__row--two` (больше не нужны)
3. Добавить новые классы групп:
   ```css
   .tm-board-layout__group--full      { grid-column: 1 / -1; }
   .tm-board-layout__group--half      { grid-column: span 1; }
   .tm-board-layout__group--half-alone { grid-column: 1 / -1; }
   .tm-board-layout__notes            { grid-column: 1 / -1; }
   ```
4. Добавить media query:
   ```css
   @media (max-width: 600px) {
     .tm-board-layout__group--half,
     .tm-board-layout__group--half-alone { grid-column: 1 / -1; }
   }
   ```

**Done when:**
- [ ] Все новые CSS-классы объявлены в `styles.css` (не в `.svelte`)
- [ ] Старые `.tm-board-layout__row` и `--two` удалены или совместимы
- [ ] Визуально: full-группы на всю ширину, half-группы рядом

---

### 3.4 BoardLayout — рефакторинг на CSS Grid

**Оценка:** 2h
**Зависимости:** 3.3, 2.1
**Файлы:** `src/ui/BoardLayout.svelte`

**Шаги:**
1. Добавить в `<script>` константу `GROUP_ORDER` и функцию `computeGroupClasses`:
   ```typescript
   const GROUP_ORDER: GroupId[] = [
     'backlog', 'focus', 'inProgress', 'orgIntentions', 'delegated', 'completed'
   ];

   // ВАЖНО: зависит от фиксированного GROUP_ORDER.
   // При появлении настраиваемого порядка — переработать.
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
           classes[g.id] = 'tm-board-layout__group--half';
           classes[next.id] = 'tm-board-layout__group--half';
           i += 2;
         } else {
           classes[g.id] = 'tm-board-layout__group--half-alone';
           i++;
         }
       }
     }
     return classes;
   }
   ```
2. Добавить реактивные вычисления:
   ```typescript
   $: visibleGroups = GROUP_ORDER
     .filter(id => !hidden.has(id))
     .map(id => ({ id, fullWidth: board.groups[id].fullWidth }));
   $: groupClasses = computeGroupClasses(visibleGroups);
   ```
3. Переписать разметку: убрать `tm-board-layout__row`-обёртки, каждую группу завернуть в `<div class={groupClasses[groupId]}>` (включая backlog и completed через CollapsibleGroup)
4. Обёртку `NotesSection` изменить: `class="tm-board-layout__collapsible"` → `class="tm-board-layout__notes"`
5. Убедиться, что `CollapsibleGroup`-обёртки для `backlog` и `completed` тоже получают динамический класс

**Done when:**
- [ ] `tm-board-layout__row` и `--two` исчезли из разметки
- [ ] Каждая группа получает класс из `groupClasses[id]`
- [ ] `NotesSection` обёрнута в `tm-board-layout__notes`
- [ ] Дефолтный вид (focus+inProgress рядом) не изменился визуально

---

## Фаза 4: Тестирование (2.5h)

### 4.1 Unit-тесты `computeGroupClasses`

**Оценка:** 1.5h
**Зависимости:** 3.4
**Файлы:** `src/ui/BoardLayout.test.ts` (создать при необходимости)

**Шаги:**
Написать тесты для `computeGroupClasses` (вынести функцию в утилиту или тестировать через импорт):

| Входные данные | Ожидаемый результат |
|---|---|
| Все 6 групп `fullWidth: true` | Все → `--full` |
| Все 6 групп `fullWidth: false` | Пары: `--half`, одиночка не возникает |
| `[half, half, half]` видимых | Первые два → `--half`, третий → `--half-alone` |
| `[full, half, full, half]` | half на позиции 1 → `--half-alone`; half на позиции 3 → `--half-alone` |
| Одна visible группа с `fullWidth: false` | → `--half-alone` |

**Done when:**
- [ ] Все 5 тест-кейсов написаны и зелёные
- [ ] Покрыт алгоритм попарного обхода

---

### 4.2 Ручное тестирование по чеклисту

**Оценка:** 1h
**Зависимости:** 4.1

**Сценарии из спецификации (раздел 6):**
- [ ] 1. Базовое поведение по умолчанию: focus + inProgress рядом
- [ ] 2. Переключить focus в full → inProgress одиночка → растягивается
- [ ] 3. orgIntentions в half → встаёт рядом с delegated (если delegated тоже half)
- [ ] 4. Скрыть одного партнёра → оставшийся half растягивается на full
- [ ] 5. Три half подряд → пара + одиночка-full
- [ ] 6. Перезапустить Obsidian → настройки сохранились
- [ ] 7. Узкий экран (<600px) → все full-width
- [ ] 8. Старый data.json без fullWidth → дефолты применены
- [ ] 9. Обе скрыты, одна включена → растягивается на full
- [ ] 10. Скрыть группу → checkbox ширины заблокирован; данные сохранены
- [ ] 11. Обе скрыты, обе включены → встают парой
- [ ] 12. Все 6 в half → 3 строки по 2 группы
- [ ] 13. Создать новую доску → дефолты корректны
- [ ] 14. Переключение между досками A (all-full) / B (focus-half) → корректная перерисовка
- [ ] 15. backlog свёрнут + fullWidth: false → узкий заголовок на 50%, не баг

**Done when:**
- [ ] Все 15 сценариев пройдены без регрессий
- [ ] Визуал соответствует ожиданиям спецификации
