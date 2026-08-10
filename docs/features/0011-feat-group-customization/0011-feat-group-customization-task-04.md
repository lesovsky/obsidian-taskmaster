---
status: planned
depends_on: ["01"]
wave: 2
skills: [code-writing]
verify: bash                       # npx vitest run tests/unit/groupOrderUtils.test.ts
reviewers: [dev-code-reviewer, dev-security-auditor, dev-test-reviewer]
teammate_name:
---

# Task 04: Reorder logic

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:code-writing` — [skills/code-writing/SKILL.md](~/.claude/skills/code-writing/SKILL.md)

## Description

The board settings popup gets move-up / move-down arrows on every group row (Task 8). The
behaviour behind those arrows is the most branch-heavy new logic in the feature, and it is
deliberately asymmetric:

- An arrow on a **visible** group swaps it with the nearest **visible** neighbour in that
  direction, stepping over any hidden groups in between. Those hidden groups keep their own
  positions in the order array. Rationale (user-spec, решение «перепрыгивать скрытые группы»):
  if a visible group swapped with a hidden neighbour, the press would produce no visible change
  on the board and would read as a broken button.
- An arrow on a **hidden** group swaps it with its **immediate list neighbour**, whatever that
  neighbour happens to be. Rationale: without literal behaviour on hidden rows there would be no
  way to choose the slot the group lands on when it is made visible again.
- An arrow is **disabled** when there is nowhere to go in that direction: for a visible group —
  when no visible group remains in that direction; for a hidden group — when it is already at the
  edge of the list.

This task implements exactly that behaviour as a new module of **pure functions**, plus its unit
tests. It writes no UI: Task 8 wires the popup to it.

Why a separate pure module (tech-spec Decision 5): `vitest.config.ts` sets `environment: 'node'`
and the project has no DOM testing library, so logic living inside a `.svelte` file cannot be unit
tested at all. Testing Strategy requires this logic to be covered by unit tests, therefore it must
live outside the component.

The module works on a plain array of group ids plus the set of hidden ids. It does **not** touch
`Board`, `Group` or any field this feature adds, so it neither waits for nor conflicts with
Task 3 (data model / migration) running in the same wave. The only type it may import is the
existing, unchanged `GroupId` union from `src/data/types.ts` — the same way
`src/ui/boardLayoutUtils.ts` does.

Note on the caller's state: in the popup, both the order and the hidden set are **local unsaved**
component state. Toggling a visibility checkbox must change arrow behaviour immediately, before
saving. That is satisfied automatically as long as these functions stay pure and derive everything
from their arguments — they must never read a store, `board`, or any module-level mutable state.

## What to do

1. Write `tests/unit/groupOrderUtils.test.ts` **first**, covering the anchors listed below. Run
   it, confirm it fails (module does not exist yet).
2. Create `src/ui/groupOrderUtils.ts` exporting two pure functions:
   - one that reports whether a given group can move in a given direction (drives the arrow's
     `disabled` state);
   - one that returns the **new order array** after moving a given group in a given direction,
     returning the order unchanged when the move is not possible.
   Suggested names, to be used by Task 8: `canMoveGroup(order, groupId, direction, hiddenGroups)`
   and `moveGroup(order, groupId, direction, hiddenGroups)`, with
   `direction: 'up' | 'down'` (`'up'` = towards index 0). Keep both signatures identical so the
   popup can call them with the same arguments.
3. Implement the two behaviour branches — visible group skips hidden groups, hidden group moves by
   list adjacency — as a swap of two positions in the array. A plain swap of the two indices is
   what leaves everything in between untouched, which is precisely the required semantics for the
   skipping case.
4. Keep the functions total and defensive: never throw, never mutate the input array, always
   return a fresh array from the move function.
5. Guarantee that the two functions agree: whenever the "can move" function returns `false`, the
   move function returns an order equal to the input.
6. Run the unit suite and `npx tsc --noEmit` until both are clean.

## TDD Anchor

Tests to write BEFORE the implementation. Write → run → see them fail → implement → see them pass.
All in `tests/unit/groupOrderUtils.test.ts`, style matching the existing suites
(`describe`/`it`/`expect` from `vitest`, a small local helper to build the order array).

Visible-row branch:
- `tests/unit/groupOrderUtils.test.ts::visible group moves up by swapping with the nearest visible neighbour` — with a hidden group sitting between them, the two visible ids swap and the hidden id stays at its own index.
- `tests/unit/groupOrderUtils.test.ts::visible group moves down by swapping with the nearest visible neighbour` — same, other direction.
- `tests/unit/groupOrderUtils.test.ts::visible group with an adjacent visible neighbour swaps with it` — no hidden groups involved, plain neighbour swap.
- `tests/unit/groupOrderUtils.test.ts::visible group steps over several consecutive hidden groups` — two or more hidden ids in between, all of them keep their indices.

Hidden-row branch:
- `tests/unit/groupOrderUtils.test.ts::hidden group swaps with its immediate neighbour regardless of that neighbour's visibility` — neighbour is visible.
- `tests/unit/groupOrderUtils.test.ts::hidden group swaps with its immediate hidden neighbour` — neighbour is hidden.
- `tests/unit/groupOrderUtils.test.ts::moving a hidden group past a visible neighbour keeps the relative order of visible groups` — the sequence of visible ids, filtered out of the result, is unchanged.

Arrow-enabled state:
- `tests/unit/groupOrderUtils.test.ts::up is disabled for a visible group with no visible group above it` — only hidden ids above.
- `tests/unit/groupOrderUtils.test.ts::down is disabled for a visible group with no visible group below it` — only hidden ids below.
- `tests/unit/groupOrderUtils.test.ts::up is disabled for a hidden group at the first position` — and enabled anywhere else.
- `tests/unit/groupOrderUtils.test.ts::down is disabled for a hidden group at the last position` — and enabled anywhere else.
- `tests/unit/groupOrderUtils.test.ts::the only visible group has both arrows disabled` — five hidden ids, one visible one somewhere in the middle.

Consistency and robustness:
- `tests/unit/groupOrderUtils.test.ts::move returns the order unchanged whenever the arrow is disabled` — asserted for at least one disabled case per row type.
- `tests/unit/groupOrderUtils.test.ts::move does not mutate its input array` — input is deep-equal to a snapshot taken before the call, and the returned array is a different reference.
- `tests/unit/groupOrderUtils.test.ts::an id absent from the order cannot move and leaves the order unchanged` — both functions handle it without throwing.

## Acceptance Criteria

- [ ] `src/ui/groupOrderUtils.ts` exists and exports a "can move" predicate and a "move" function, both pure — no imports from stores, components or i18n.
- [ ] A visible group's arrow swaps it with the nearest visible neighbour in that direction; hidden groups in between keep their positions in the array.
- [ ] A hidden group's arrow swaps it with its immediate list neighbour, visible or hidden.
- [ ] The predicate returns `false` exactly when there is no target: for a visible group — no visible group left in that direction; for a hidden group — it is already at the edge.
- [ ] A board with a single visible group reports both arrows disabled for that group.
- [ ] The move function never mutates its input and always returns a new array.
- [ ] When the predicate says `false`, the move function returns an order equal to the input.
- [ ] Neither function throws on an unknown group id or on a hidden set containing ids not present in the order.
- [ ] `tests/unit/groupOrderUtils.test.ts` covers all TDD anchors and passes.
- [ ] `npx tsc --noEmit` is clean.
- [ ] No import of `Board` or `Group` — the module must not depend on the data-model change made by Task 3.

## Context Files

**Feature artifacts:**
- [0011-feat-group-customization.md](docs/features/0011-feat-group-customization/0011-feat-group-customization.md) — user-spec; см. «Сценарий 4: Перемещение через скрытую группу», раздел «Как это работает» (правила стрелок), «Крайние случаи», «Критерии приёмки»
- [0011-feat-group-customization-tech-spec.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-tech-spec.md) — tech-spec; Decision 5, Testing Strategy → Unit tests, Task 4
- [0011-feat-group-customization-decisions.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-decisions.md) — decisions log (создаётся по ходу выполнения фичи)

**Project knowledge:**
Проект не использует `.claude/skills/project-knowledge/` — его роль выполняют:
- [CLAUDE.md](CLAUDE.md) — конвенции проекта: TypeScript strict, именование, структура `src/`
- [docs/technical.md](docs/technical.md) — техническая архитектура, модель данных, механизмы
- [docs/overview.md](docs/overview.md) — продуктовый контекст: шесть фиксированных групп, назначение доски

**Code files:**
- [src/ui/groupOrderUtils.ts](src/ui/groupOrderUtils.ts) — **создать**; чистые функции перестановки
- [tests/unit/groupOrderUtils.test.ts](tests/unit/groupOrderUtils.test.ts) — **создать**; unit-тесты, пишутся первыми
- [src/ui/boardLayoutUtils.ts](src/ui/boardLayoutUtils.ts) — образец такого же чистого модуля рядом: импортирует только тип `GroupId`, никаких сторов
- [src/ui/boardLayoutUtils.test.ts](src/ui/boardLayoutUtils.test.ts) — образец стиля тестов (сейчас лежит не в `tests/unit/`; переезд делает Task 1)
- [src/data/types.ts](src/data/types.ts) — существующий union `GroupId` и константа `GROUP_IDS`; читать, не менять
- [tests/unit/statusTransitions.test.ts](tests/unit/statusTransitions.test.ts) — образец теста в `tests/unit/` с относительным импортом `../../src/...`
- [src/ui/BoardSettingsPopup.svelte](src/ui/BoardSettingsPopup.svelte) — будущий потребитель (Task 8): читать, чтобы подобрать сигнатуры под его локальное состояние; **в этой задаче не менять**

## Verification Steps

- `npx vitest run tests/unit/groupOrderUtils.test.ts` — все тесты проходят.
- Порядок TDD подтверждён: тесты запускались до реализации и падали (модуль отсутствовал).
- `npx tsc --noEmit` — чисто. Если появляются ошибки про `boardSettings.notes` — это предсуществующая проблема, которую чинит Task 2 (Decision 9), не эта задача.
- `npm test` — остальные unit-сюиты не сломаны.
- `grep -n "import" src/ui/groupOrderUtils.ts` — только `import type { GroupId } from '../data/types'` (либо вообще без импортов). Никаких стора, i18n, svelte, `Board`, `Group`.

## Details

**Files:**
- `src/ui/groupOrderUtils.ts` — новый файл. Сейчас не существует. Кладётся рядом с
  `boardLayoutUtils.ts`, потому что это логика попапа настроек доски, а не модели данных.
  Содержит две экспортируемые чистые функции и, при необходимости, локальные (не экспортируемые)
  хелперы поиска индекса целевой группы.
- `tests/unit/groupOrderUtils.test.ts` — новый файл. Сейчас не существует. Импорт —
  `../../src/ui/groupOrderUtils` (см. `tests/unit/statusTransitions.test.ts`).
  `vitest.config.ts` собирает `tests/unit/**/*.test.ts`, так что файл попадёт в набор автоматически.

**Dependencies:**
- Зависит от Task 1 (`depends_on: ["01"]`): Task 1 поднимает Node до ≥ 22.12 и делает `npm test`
  работоспособным. Без него vitest не запустится и проверить задачу нечем.
- **Не** зависит от Task 3, хотя они в одной волне: модуль не обращается ни к `Board.groupOrder`,
  ни к `Group.title` — только к массиву идентификаторов, который передаёт вызывающий код. Это
  сознательное свойство (Decision 5); ломать его нельзя, иначе задачи одной волны столкнутся.
- Новых npm-пакетов нет.

**Edge cases:**
- Единственная видимая группа — обе стрелки у неё неактивны, независимо от её позиции в массиве.
- Видимая группа, выше/ниже которой только скрытые — стрелка в эту сторону неактивна, хотя
  элементы в массиве там есть.
- Скрытая группа на позиции 0 — «вверх» неактивна; на последней позиции — «вниз» неактивна.
  Промежуточные позиции активны всегда, соседа искать не нужно.
- Скрытая группа меняется местами с видимой: относительный порядок видимых групп при этом не
  меняется (обмен соседями, из которых ровно один видимый), доска визуально не дёргается.
  Это инвариант, вынесенный в отдельный тест.
- Идентификатор, которого нет в массиве порядка — обе функции отвечают «нельзя»/«без изменений»,
  без исключения. Данные могут быть повреждены руками (Decision 6), а санация из Task 3 —
  отдельный слой; этот модуль просто не должен падать.
- Множество скрытых содержит идентификаторы, отсутствующие в массиве порядка — игнорируются.
- Пустой массив порядка или массив из одного элемента — обе стрелки неактивны, без исключения.

**Implementation hints:**
- Обмен двух позиций массива — это и есть требуемая семантика «перешагивания»: элементы между
  ними не сдвигаются. Не надо ничего вырезать и вставлять (`splice`), иначе скрытые группы
  поедут вместе с видимой и нарушат правило «скрытые остаются на своих позициях».
- Обе ветки различаются только тем, как ищется индекс цели: для видимой строки — ближайший индекс
  в нужную сторону, чей идентификатор не в множестве скрытых; для скрытой — просто соседний
  индекс. Дальше — общий обмен. Стоит выделить поиск цели в один внутренний хелпер и построить
  на нём обе экспортируемые функции: тогда предикат и сам перенос не смогут разойтись
  («цель найдена» ⇔ «стрелка активна»).
- Направление лучше передавать литеральным юнионом (`'up' | 'down'`), а не числом или булевым —
  вызывающий код в попапе читается понятнее, а strict-режим ловит опечатки.
- Для проверки принадлежности к скрытым достаточно `includes` по массиву: групп ровно шесть,
  и вызывающий код в попапе уже держит `hiddenGroups` массивом (`BoardSettingsPopup.svelte:14`).
  Принимать массив, а не `Set` — меньше преобразований на стороне вызывающего.
- Тип параметров — существующий `GroupId` из `src/data/types.ts` (он этой фичей не меняется),
  как это уже сделано в `boardLayoutUtils.ts`. Импортировать `Board`/`Group` нельзя.
- Функции без побочных эффектов и без чтения глобального состояния — это буквальное требование
  сценария «переключил видимость и сразу нажал стрелку»: попап передаёт своё несохранённое
  локальное состояние, и поведение обязано следовать за аргументами.
- CSS/i18n/разметки в этой задаче нет — соответствующие правила CLAUDE.md здесь неприменимы,
  ничего в `styles.css` добавлять не нужно.

## Reviewers

- **dev-code-reviewer** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-04-dev-code-reviewer-review.json`
- **dev-security-auditor** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-04-dev-security-auditor-review.json`
- **dev-test-reviewer** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-04-dev-test-reviewer-review.json`

## Post-completion

- [ ] Записать краткий отчёт в [0011-feat-group-customization-decisions.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [ ] Зафиксировать в отчёте итоговые сигнатуры двух функций — Task 8 будет вызывать их из попапа
- [ ] Если отклонились от спека — описать отклонение и причину
- [ ] Обновить user-spec/tech-spec если что-то изменилось
