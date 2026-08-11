---
status: done                    # planned -> in_progress -> done
depends_on: []                     # ID задач-зависимостей (строки: ["01", "02"])
wave: 1                            # волна параллельного выполнения
skills: [code-writing]             # МАССИВ скиллов для загрузки
verify: bash — `npx tsc --noEmit`  # инструмент верификации (опционально: curl, bash, user)
reviewers: [dev-code-reviewer, dev-security-auditor, dev-test-reviewer]  # явно указать. Пусто = fallback на defaults
teammate_name:                     # имя агента-исполнителя (опционально; если не задано — генерируется по описанию задачи)
---

# Task 02: Localization keys

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:code-writing` — [skills/code-writing/SKILL.md](~/.claude/skills/code-writing/SKILL.md)

## Description

Фича 0011 добавляет в интерфейс новые элементы управления: колонку названий групп и пару
стрелок перемещения в попапе настроек доски, а также нейтральную подсказку для пустой
переименованной группы. Все тексты плагина живут в собственной i18n-системе (`src/i18n`),
где ключ должен быть объявлен в union-типе `TranslationKey` и переведён в **обоих** словарях —
`en.ts` и `ru.ts`. `Translations = Record<TranslationKey, string>`, поэтому пропуск ключа в
одном из словарей или в union ломает компиляцию. Эта задача заводит все нужные строки
заранее, чтобы задачи 06 и 08 (отображение названия группы и попап настроек) просто брали
готовые ключи и не занимались правкой словарей параллельно — в один и тот же файл из двух
волн писать нельзя.

Вторая, обязательная часть задачи — почин уже сломанного type-check. Ключ
`'boardSettings.notes'` существует в `en.ts:60` и `ru.ts:60` и используется в
`BoardSettingsPopup.svelte:90`, но в union `TranslationKey` его забыли добавить (хвост фичи
0009). Сейчас `npx tsc --noEmit` падает двумя ошибками TS2353. Это решение зафиксировано в
tech-spec как Decision 9: без него ни одна задача фичи не пройдёт свой quality gate, а наши
изменения получат чужую вину. Правка — одна строка в union.

Задача полностью в `.ts`-файлах, поэтому `npx tsc --noEmit` здесь настоящий, а не
декоративный шлюз (в отличие от задач по `.svelte` — см. Decision 11).

## What to do

1. Добавить в union `TranslationKey` (`src/i18n/types.ts`) недостающий ключ
   `'boardSettings.notes'` — в блок остальных `boardSettings.*`, рядом с
   `'boardSettings.fullWidth' | 'boardSettings.fullWidthTooltip'`. Ничего больше в
   существующих строках union не трогать.
2. Добавить в тот же union три новых ключа для попапа настроек доски:
   - `'boardSettings.groupName'` — заголовок колонки с названием группы;
   - `'boardSettings.moveUp'` — подпись стрелки «вверх» (пойдёт в `title` / `aria-label`);
   - `'boardSettings.moveDown'` — подпись стрелки «вниз».
3. Добавить в union ключ `'emptyState.renamed'` — нейтральная подсказка пустой
   переименованной группы. Разместить его рядом с существующими `emptyState.*`.
4. Добавить переводы всех четырёх новых ключей в `src/i18n/en.ts` и `src/i18n/ru.ts` — в тех
   же секциях и в том же порядке, что и в union, с сохранением текущего форматирования файлов
   (два пробела отступа, пустая строка между смысловыми блоками).

   Тексты — с указанием происхождения каждой строки. Часть взята из user-spec дословно и
   не подлежит изменению; часть в user-spec отсутствует и предложена здесь, в этой задаче:

   | Ключ | EN | RU | Откуда |
   |---|---|---|---|
   | `boardSettings.groupName` | `Group` | `Группа` | RU — из user-spec (макет строки настроек: заголовок колонки «Группа»). EN — **предложен здесь**, в user-spec английского заголовка нет |
   | `boardSettings.moveUp` | `Move up` | `Переместить вверх` | **Предложены здесь.** В user-spec стрелки описаны как элемент («стрелки ↑ ↓») и описано их поведение, но текстовых подписей нет |
   | `boardSettings.moveDown` | `Move down` | `Переместить вниз` | **Предложены здесь**, там же и по той же причине |
   | `emptyState.renamed` | `Nothing here yet — drag tasks in` | `Пока пусто — перетащите сюда задачи` | Обе строки из user-spec дословно (раздел «Экраны и элементы интерфейса», пункт «Пустая группа») |

   Строки из user-spec переписывать нельзя. Предложенные здесь строки — авторское решение
   этой задачи; они выбраны нейтральными к вёрстке (описывают действие, а не значок) и по
   образцу существующих коротких подписей в `boardSettings.*`. Если при реализации найдётся
   причина сформулировать их иначе — менять можно, но с фиксацией в отчёте, потому что на
   них будут ссылаться задачи 06 и 08.

5. Убедиться, что `npx tsc --noEmit` отрабатывает без единой ошибки.

Ничего кроме объявления ключей и переводов в этой задаче не делается: разметку попапа,
стрелки и переключение подсказки в `EmptyState.svelte` реализуют задачи 06 и 08. Ключи
намеренно заводятся «впрок» и на момент завершения этой задачи ещё не используются ни одним
компонентом — это ожидаемое состояние, а не недоделка.

### Контракт имён ключей для задач 06 и 08

Имена ключей, заводимые здесь, — **обязательный контракт**, а не рекомендация:

| Ключ | Кто потребляет |
|---|---|
| `boardSettings.groupName` | Task 08 — заголовок колонки названий в `BoardSettingsPopup.svelte` |
| `boardSettings.moveUp` | Task 08 — `title` / `aria-label` стрелки «вверх» |
| `boardSettings.moveDown` | Task 08 — `title` / `aria-label` стрелки «вниз» |
| `emptyState.renamed` | Task 06 — нейтральная подсказка переименованной пустой группы |

Задачи 06 и 08 обязаны использовать **ровно эти имена**. Если на момент их выполнения ключа
в `src/i18n/types.ts` не окажется — это блокер: остановиться и доложить, что Task 02 не
довела свою часть. Заводить свой ключ с другим именем, дублировать строку литералом в
компоненте или обходиться существующим близким по смыслу ключом **нельзя** — так в словарях
появятся два имени для одной строки, и следующая правка локализации разойдётся по файлам.

Если эта задача по какой-то причине изменит имя ключа относительно таблицы выше, изменение
обязано попасть в отчёт в decisions-log — задачи 06 и 08 читают его как источник истины.

## TDD Anchor

В проекте нет тестового файла для i18n, и Testing Strategy tech-spec его для этой задачи не
требует; новый тест здесь заводить не нужно. Роль падающего-до / зелёного-после теста играет
компилятор — набор ключей проверяется типом `Record<TranslationKey, string>` статически.

Порядок работы — обычный TDD-цикл, только «тест» это `npx tsc --noEmit`:

- **RED (зафиксировать до правок):** `npx tsc --noEmit` → ровно 2 ошибки:
  `src/i18n/en.ts(60,3): error TS2353` и `src/i18n/ru.ts(60,3): error TS2353` про
  `'boardSettings.notes'`. Запусти и убедись, что видишь именно их.
- **RED (шаг 2, проверка полноты словарей):** добавь четыре новых ключа **только** в
  `src/i18n/types.ts` и запусти `npx tsc --noEmit` → должны появиться ошибки TS2739/TS2741 о
  том, что `en` и `ru` не реализуют новые свойства. Это доказывает, что тип действительно
  сторожит полноту обоих словарей.
- **GREEN:** добавь переводы в `en.ts` и `ru.ts` → `npx tsc --noEmit` завершается без вывода
  ошибок (код возврата 0).

## Acceptance Criteria

- [ ] `'boardSettings.notes'` присутствует в union `TranslationKey`
- [ ] В union добавлены ровно эти имена: `'boardSettings.groupName'`, `'boardSettings.moveUp'`,
      `'boardSettings.moveDown'`, `'emptyState.renamed'` — они зафиксированы как контракт для
      задач 06 и 08
- [ ] Все четыре новых ключа переведены в `src/i18n/en.ts` и в `src/i18n/ru.ts`
- [ ] Строки, взятые из user-spec (`emptyState.renamed` в обоих языках и русское `Группа`),
      воспроизведены дословно, включая длинное тире в нейтральной подсказке
- [ ] Строки, предложенные этой задачей (`Group`, `Move up` / `Переместить вверх`,
      `Move down` / `Переместить вниз`), соответствуют таблице; любое отступление от неё
      зафиксировано в отчёте, потому что на эти имена и тексты опираются задачи 06 и 08
- [ ] `npx tsc --noEmit` завершается без ошибок (было 2 — стало 0)
- [ ] Изменены только `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/ru.ts` — проверено
      по конкретным путям. Изменения в `package.json`, `.nvmrc`, `vitest.config.ts` и
      `tests/unit/` принадлежат параллельной Task 01 и нарушением не являются
- [ ] Существующие ключи и переводы не тронуты
- [ ] Форматирование и порядок секций в `en.ts` и `ru.ts` остались зеркальными друг другу

## Context Files

**Feature artifacts:**
- [0011-feat-group-customization.md](docs/features/0011-feat-group-customization/0011-feat-group-customization.md) — user-spec. Источник текста нейтральной подсказки (раздел «Экраны и элементы интерфейса», пункт «Пустая группа») и русского заголовка колонки «Группа» (раздел «Формы и ввод данных», макет строки настроек). Подписей стрелок и английского заголовка колонки в user-spec **нет** — они предложены этой задачей
- [0011-feat-group-customization-tech-spec.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-tech-spec.md) — tech-spec (Decision 9, Decision 11, Task 2 в Implementation Tasks)
- [0011-feat-group-customization-decisions.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-decisions.md) — decisions log
- [0011-feat-group-customization-code-research.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-code-research.md) — исследование кода (i18n и EmptyState — строки 137, 473)

**Project knowledge:**
> В проекте нет каталога `.claude/skills/project-knowledge/`. Роль базы знаний выполняют:
- [CLAUDE.md](CLAUDE.md) — конвенции проекта; раздел «Localization» описывает порядок добавления строк
- [docs/overview.md](docs/overview.md) — продуктовый контекст (группы, их смысл)
- [docs/technical.md](docs/technical.md) — технические решения

**Code files:**
- [src/i18n/types.ts](src/i18n/types.ts) — изменить: union `TranslationKey`
- [src/i18n/en.ts](src/i18n/en.ts) — изменить: английские переводы
- [src/i18n/ru.ts](src/i18n/ru.ts) — изменить: русские переводы
- [src/ui/BoardSettingsPopup.svelte](src/ui/BoardSettingsPopup.svelte) — только читать: где появятся колонка и стрелки, как используется `boardSettings.notes`
- [src/ui/EmptyState.svelte](src/ui/EmptyState.svelte) — только читать: как сейчас собирается ключ `emptyState.{groupId}`
- [src/i18n/index.ts](src/i18n/index.ts) — только читать: как работают `t` и `groupLabels`

## Verification Steps

- Шаг 1: до правок выполнить `npx tsc --noEmit` — зафиксировать 2 ошибки TS2353
  (`src/i18n/en.ts(60,3)`, `src/i18n/ru.ts(60,3)`)
- Шаг 2: после правок выполнить `npx tsc --noEmit` — ожидаемый результат: пустой вывод,
  код возврата 0
- Шаг 3: проверить **конкретные пути**, а не общее число изменённых файлов:
  - `git status --porcelain -- src/i18n/types.ts src/i18n/en.ts src/i18n/ru.ts` — все три
    значатся изменёнными;
  - `git status --porcelain -- src/i18n/ ':!src/i18n/types.ts' ':!src/i18n/en.ts' ':!src/i18n/ru.ts'`
    — пустой вывод: в `src/i18n/` больше ничего не тронуто.

  **`git diff --stat` с подсчётом файлов здесь неприменим.** Task 01 идёт в той же волне
  (`wave: 1`) и параллельно правит `package.json`, создаёт `.nvmrc` и переносит
  `src/ui/boardLayoutUtils.test.ts` → `tests/unit/`. Эти изменения будут видны в общем дереве,
  и проверка «изменены ровно три файла» упадёт на чужой работе. Чужие пути в выводе — норма,
  а не сигнал.
- Шаг 4: глазами сверить `en.ts` и `ru.ts` — одинаковый порядок и группировка ключей

## Details

**Files:**
- `src/i18n/types.ts` — сейчас содержит union `TranslationKey` (строки 4–41) и
  `export type Translations = Record<TranslationKey, string>`. Блок `boardSettings.*` —
  строки 21–26, заканчивается `'boardSettings.fullWidth' | 'boardSettings.fullWidthTooltip'`.
  Блок `emptyState.*` — строки 37–38, шесть ключей по одному на каждую группу. Добавить
  `'boardSettings.notes'` + три новых `boardSettings.*` в первый блок и `'emptyState.renamed'`
  во второй.
- `src/i18n/en.ts` — объект `en: Translations`. `'boardSettings.notes': 'Notes'` уже есть на
  строке 60 (именно он и вызывает ошибку). Секция `emptyState.*` — строки 89–94, последний
  ключ `'emptyState.completed': 'Nothing here yet — completed tasks will appear here'` —
  обрати внимание, нейтральный текст построен по той же модели «Nothing here yet — …».
  Добавить четыре перевода.
- `src/i18n/ru.ts` — зеркальная структура, те же номера строк. `'boardSettings.notes':
  'Заметки'` на строке 60; `'emptyState.completed': 'Пока пусто — завершённые задачи будут
  появляться здесь'` — нейтральный текст также продолжает модель «Пока пусто — …».

**Dependencies:** нет. Задача не зависит ни от одной другой и намеренно вынесена в первую
волну (`wave: 1`) вместе с Task 01 — она чинит type-check, на который опираются гейты всех
последующих задач (волны 2–9). Задачи 06 (`wave: 3`) и 08 (`wave: 5`) потребляют заведённые
здесь ключи по контракту имён из раздела «What to do».

Task 01 работает параллельно в той же волне и трогает `package.json`, `.nvmrc`,
`vitest.config.ts` и `tests/unit/boardLayoutUtils.test.ts`. Пересечений по файлам с этой
задачей нет, но рабочее дерево общее — отсюда запрет на проверки вида «сколько всего файлов
изменилось» в Verification Steps.

**Edge cases:**
- Длинное тире `—` (U+2014) в нейтральной подсказке: именно оно используется в существующих
  `emptyState.completed` в обоих языках. Не заменяй на дефис.
- Апострофы: в `en.ts` строки в одинарных кавычках, апострофы экранируются (`isn\'t`). В
  новых английских текстах апострофов нет, экранирование не понадобится.
- `emptyState.renamed` не должен пересечься с шаблоном `emptyState.${groupId}` из
  `EmptyState.svelte`: `renamed` не входит в `GroupId`, коллизии нет.
- Не поддавайся соблазну переименовать или «причесать» существующие ключи: на них завязаны
  компоненты и, возможно, E2E-локаторы.

**Implementation hints:**
- Порядок объявления ключей в union и порядок пар в словарях должны совпадать — так файлы
  читаются как один список, и следующая задача не промахнётся мимо секции.
- `'boardSettings.groupName'` — это именно заголовок колонки. В `BoardSettingsPopup.svelte`
  соответствующий `<span class="tm-popup__group-header-name">` сейчас пуст (строка 48);
  заполнит его Task 08, не эта задача. Русский текст «Группа» взят из макета в user-spec;
  английский `Group` в user-spec не встречается и предложен здесь по образцу соседних
  заголовков колонок (`boardSettings.groupVisibility`, `boardSettings.fullWidth`).
- Ключи `moveUp` / `moveDown` названы нейтрально к направлению вёрстки — они описывают
  действие, а не значок; текст стрелки в разметке задаёт Task 08. Сами подписи в user-spec
  отсутствуют — там стрелки описаны только как элемент `↑ ↓` и через своё поведение, — так
  что и имена ключей, и их тексты предложены этой задачей и с этого момента фиксируются как
  контракт.
- Проверить компиляцию можно и точечно: `npx tsc --noEmit` покрывает только `.ts`;
  `.svelte` он молча игнорирует (Decision 11), поэтому не жди от него проверки компонентов.

## Reviewers

- **dev-code-reviewer** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-02-dev-code-reviewer-review.json`
- **dev-security-auditor** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-02-dev-security-auditor-review.json`
- **dev-test-reviewer** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-02-dev-test-reviewer-review.json`

## Post-completion

- [ ] Записать краткий отчёт в [0011-feat-group-customization-decisions.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [ ] Отметить в отчёте факт починки пре-существующей ошибки типов (Decision 9) — это не наш баг, но наш фикс
- [ ] Выписать в отчёт финальный список имён ключей и их тексты — это контракт, по которому
      работают задачи 06 и 08. Отдельно пометить строки, предложенные этой задачей (подписи
      стрелок, английский заголовок колонки), как решения без основания в user-spec
- [ ] Если отклонились от спека — описать отклонение и причину
- [ ] Обновить user-spec/tech-spec если что-то изменилось
