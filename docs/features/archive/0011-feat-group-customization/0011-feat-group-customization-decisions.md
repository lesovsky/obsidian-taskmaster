# Decisions Log: Group Customization

Отчёты агентов о выполнении задач. Каждая запись создаётся агентом, выполнившим задачу.

---

## Task 01: Test infrastructure and Node pin

**Status:** Done
**Commit:** af15166
**Agent:** основной агент
**Summary:** Закреплён требуемый рантайм — поле `engines` (`^22.12.0 || >=24.0.0`) в `package.json` и `.nvmrc` с версией 22.23.1, на которой прошла верификация. Тест `boardLayoutUtils.test.ts` перенесён через `git mv` из `src/ui/` в `tests/unit/` с правкой двух строк импортов, после чего попадает под существующий паттерн `include` — юнит-набор стартует и собирает 4 файла вместо нуля. `vitest.config.ts` менять не потребовалось.

**Deviations:**
- Расхождение исходных данных со спекой по пакетному менеджеру: задача и Decision 8 опираются на `npm@11.13.0` (`engines: ^20.17.0 || >=22.9.0`), фактически установлен `npm@10.9.8` (`engines: ^18.17.0 || >=20.5.0`). Фактическое ограничение слабее и в интересующей области полностью покрывает ограничения vitest и vite, поэтому пересечение не изменилось и записанный диапазон остаётся верным. Данные vitest@4.0.18 и vite@7.3.1 совпали со спекой дословно. Тексты спеки не правились — расхождение зафиксировано здесь.
- Post-completion пункт про Decision 8 внутренне противоречив: сначала «править не нужно», затем «заменить и отметить правку». По факту Decision 8 уже содержит корректный `^22.12.0 || >=24.0.0` и непротиворечивое обоснование исключения 23.x, поэтому правка не вносилась — второй половине пункта следовать было не к чему.
- Диапазон в `engines` не просто заявлен, а проверен исполняемо (semver из состава npm) на 10 граничных версиях: 18.19.1, 20.19.0, 21.7.3, 22.11.0, 23.0.0, 23.11.0 отвергаются; 22.12.0, 22.23.1, 24.0.0, 25.1.0 принимаются. Отдельно подтверждено отвержение линии 23.x — ради этого и сохранена каретка вместо `>= 22.12`.
- Ожидаемое следствие переноса, согласованное со спекой: файл вышел из области `tsc --noEmit` (`tsconfig.json` включает только `src/**`), как и остальные тесты в `tests/unit/`. Покрытие не потеряно — тесты теперь реально исполняются раннером.
- Не сделано сознательно: `engine-strict` в `.npmrc` не добавлялся, версии зависимостей не трогались, обходы (`--no-config`, откат vitest/vite, переписывание конфига в CJS) не применялись.

**Tech debt:** Нет. Пре-существующие ошибки `tsc --noEmit` по ключу `boardSettings.notes` в `src/i18n/en.ts` и `src/i18n/ru.ts` — долг фичи 0009, он в зоне Task 02 (Decision 9) и в этой задаче не затрагивался.

**Reviews:**

Ревью на момент записи не проводились — запускаются оркестратором после завершения задачи
(dev-infrastructure-reviewer, dev-code-reviewer, dev-security-auditor).

**Verification:**
- `node -v` → v22.23.1, попадает в `^22.12.0 || >=24.0.0` (предусловие выполнено)
- Проверка диапазона на граничных версиях → 10/10 ожидаемых результатов, 23.x отвергнута
- `npm test` → 4 файла, 30 тестов passed, без `ERR_REQUIRE_ESM`
- `npm run build` → успешно (exit 0)
- `npx playwright test tests/e2e/core.spec.ts` → 35 passed, E2E переносом не задет
- `git log --follow tests/unit/boardLayoutUtils.test.ts` → история до переноса видна
- `ls src/ui/boardLayoutUtils.test.ts` → файла нет, других `*.test.ts` в `src/` не осталось

---

## Task 02: Localization keys

**Status:** Done
**Commit:** ba194b7
**Agent:** основной агент
**Summary:** В union `TranslationKey` добавлены четыре новых ключа (`boardSettings.groupName`, `boardSettings.moveUp`, `boardSettings.moveDown`, `emptyState.renamed`) и переводы к ним в `en.ts` и `ru.ts`; попутно закрыт пре-существующий баг типов — ключ `boardSettings.notes` жил в обоих словарях и использовался в `BoardSettingsPopup.svelte:90`, но отсутствовал в union (хвост фичи 0009, Decision 9). Ключи заведены впрок и на момент коммита ещё не потребляются ни одним компонентом — это ожидаемое состояние, разметку сделают задачи 06 и 08.

**Контракт имён и текстов для задач 06 и 08** (менять нельзя, дублировать литералом в компонентах нельзя):

| Ключ | EN | RU | Происхождение |
|---|---|---|---|
| `boardSettings.groupName` | `Group` | `Группа` | RU — дословно из user-spec (макет строки настроек, L94). **EN предложен этой задачей** — английского заголовка в user-spec нет |
| `boardSettings.moveUp` | `Move up` | `Переместить вверх` | **Предложено этой задачей.** В user-spec стрелки описаны только как элемент `↑ ↓` и через поведение, подписей нет |
| `boardSettings.moveDown` | `Move down` | `Переместить вниз` | **Предложено этой задачей**, там же и по той же причине |
| `emptyState.renamed` | `Nothing here yet — drag tasks in` | `Пока пусто — перетащите сюда задачи` | Обе строки дословно из user-spec (L86), включая длинное тире U+2014 |

Строки, помеченные как предложенные этой задачей, — авторское решение без основания в user-spec: они нейтральны к вёрстке (описывают действие, а не значок) и построены по образцу соседних коротких подписей в `boardSettings.*`.

**Deviations:** Отклонений от спека нет — все четыре имени ключей и все восемь строк совпадают с таблицей из задачи дословно, порядок ключей в union и в обоих словарях зеркальный. Отдельно фиксируются два расхождения в исходных данных, не потребовавших правок:
- Исправление `boardSettings.notes` формально выходит за рамки «добавить строки для фичи 0011» — это чужой долг фичи 0009. Сделано намеренно по Decision 9: без него `npx tsc --noEmit` падает двумя ошибками TS2353 и ни одна задача фичи не проходит свой quality gate.
- Ревью подсветило расхождение user-spec с реальностью, которое эта задача не чинит: в макете строки настроек (L94) колонка видимости подписана «Показать», а компонент рендерит `boardSettings.groupVisibility` = «Видимость групп». Нового ключа это не требует (Task 08 переиспользует существующие ячейки), поэтому ни код, ни спека не правились — расхождение зафиксировано здесь.

**Tech debt:** Нет собственного долга. Унаследованное ограничение, о котором должны знать задачи 06 и 08: `tsc` сторожит только *набор* ключей (`Translations = Record<TranslationKey, string>`), но не их тексты и не факт использования правильного имени в компоненте — потребители живут в `.svelte`, которые `tsc` молча пропускает (Decision 11), а `src/i18n/index.ts` возвращает `dict[key] ?? key`, поэтому опечатка деградирует тихо (отрисуется имя ключа). Контракт имён держится этой записью и E2E-проверкой видимого текста, а не компилятором.

**Reviews:**

*Round 1:*
- dev-code-reviewer: approved, 0 critical / 3 minor (все вне зоны задачи) → [0011-feat-group-customization-task-02-dev-code-reviewer-review.json](0011-feat-group-customization-task-02-dev-code-reviewer-review.json)
- dev-security-auditor: approved, 0 critical / 1 minor (рекомендация для Task 08) → [0011-feat-group-customization-task-02-dev-security-auditor-review.json](0011-feat-group-customization-task-02-dev-security-auditor-review.json)
- dev-test-reviewer: passed, 0 critical / 2 minor (вне файлов задачи) → [0011-feat-group-customization-task-02-dev-test-reviewer-review.json](0011-feat-group-customization-task-02-dev-test-reviewer-review.json)

Замечания ревьюеров адресованы будущим задачам, а не этой: дать полю переименования в Task 08 `maxlength` по образцу заголовка доски (200) и описания (500) и не использовать `{@html}`; добавить в E2E-список tech-spec кейс на пустую переименованную группу — иначе `emptyState.renamed` не проверит ничто (Task 06).

**Verification:**
- RED (до правок): `npx tsc --noEmit` → ровно 2 ошибки TS2353 в `src/i18n/en.ts(60,3)` и `src/i18n/ru.ts(60,3)`
- RED (только `types.ts`): `npx tsc --noEmit` → 2 ошибки TS2739 о том, что `en` и `ru` не реализуют четыре новых свойства
- GREEN (после переводов): `npx tsc --noEmit` → пустой вывод, exit 0
- Проверка по путям: изменены только `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/ru.ts`; в `src/i18n/` больше ничего не тронуто
- Порядок ключей: union, `en.ts` и `ru.ts` — по 90 ключей, идентичный порядок, длинное тире U+2014 в обеих новых подсказках

---

## Task 03: Data model, migration and sanitization

**Status:** Done
**Commit:** 095aa6e (реализация), 8d76086 (правки ревью, раунд 1), 5708535 (правки ревью, раунд 2)
**Agent:** основной агент
**Summary:** В модель добавлены `Group.title` (пустая строка = «использовать локализованное имя по умолчанию») и `Board.groupOrder` (перестановка `GROUP_IDS`), `DEFAULT_DATA.version` поднят 7 → 8, добавлен блок `version < 8`. Ключевое — экспортированные чистые санитайзеры `sanitizeGroupOrder` / `sanitizeGroupTitle` принимают `unknown`, никогда не бросают и вызываются в блоке **вне всех версионных ветвей**: `migrateData` выполняется до первой отрисовки доски и её результат тут же пишется обратно в `data.json`, поэтому исключение там означало бы, что плагин не загрузился, а пользователь не увидел доски вообще.

**Контракт для задач 06, 07, 08** (проверено мутационно, не на глаз):
- `groupOrder` после загрузки — всегда ровно шесть известных id, каждый один раз; неизвестные отбрасываются, дубликаты схлопываются на первую позицию, недостающие дописываются в порядке `GROUP_IDS`. Свежий массив на каждую доску — общий инстанс позволил бы переупорядочиванием одной доски переупорядочить другую.
- `title` после загрузки — всегда строка не длиннее 40 code units, обрезанная по краям.
- **Задача 08 должна вызывать экспортированный `sanitizeGroupTitle` в `updateBoard`, а не писать свой `trim().slice(0, 40)`.** Decision 7 требует, чтобы сохранение и загрузка нормализовали одинаково, а у санитайзера уже три правила, не два (третье — про суррогатные пары, см. ниже); вторая реализация разойдётся с первой в тот же день. Запрет «не дублируй санитайзер внутри `updateBoard`» в task-08 относится к **порядку групп**, а не к имени, — противоречия нет. Константа длины сейчас приватная в модуле; если Task 08 предпочтёт литерал, `maxlength="40"` на инпуте всё равно нужен отдельно.
- **Задача 07: `groupOrder` гарантирует валидную перестановку, но не гарантирует существования самой группы.** `migrateData` не воссоздаёт группу, удалённую руками из `data.json`, — значит `board.groups[id]` для id из `groupOrder` теоретически может быть `undefined`. Это зафиксировано тестом `a board missing a group does not throw (the missing group is not recreated)`. Воссоздание групп — hardening за рамками задачи (прямой запрет в implementation hints), поэтому Task 07 либо фильтрует `groupOrder` по фактически существующим ключам, либо сознательно принимает падение вида на руками испорченном файле.

**Deviations:** От спека не отклонялись — обе новые фичи модели, номер версии и место блока санитизации ровно как в task-03 и tech-spec. Содержательные решения и осознанно не сделанное:
- **Санитизация обходит `Object.values(board.groups)`, а не `GROUP_IDS`.** Блок безусловный, поэтому цикл по `GROUP_IDS` бросал бы `TypeError` на каждой загрузке доски, где руками удалён ключ группы, — ровно тот отказ, ради предотвращения которого задача и существует. Разница в одно слово, без дополнительных ветвлений. Границы гарантии честные и уже, чем «не падает на любых руками правленых данных»: не бросают сами санитайзеры, и блок переживает отсутствующий ключ группы, — но доска без объекта `groups` целиком, `board === null` или группа-примитив по-прежнему дают `TypeError`. Это тот же класс, что и запрещённый задачей guard на `result.boards`: двумя строками ниже в `main.ts` на тех же данных падает `cleanupCompletedTasks`, так что guard перенёс бы отказ, а не устранил.
- **Обрезка не оставляет одиночный суррогат** (`.replace(/[\uD800-\uDBFF]$/, '')`). Поднято code-reviewer и security-auditor: `slice(0, 40)` может разрезать суррогатную пару и записать в `data.json` битый глиф. Взят не предложенный ими `[...s].slice()`: счёт остался в code units — ровно как у `maxlength="40"` будущего инпута, — а испорченный хвост убирается после обрезки. Проверено на 200k случайных well-formed входов аудитором: 0 битых и 0 превышающих лимит результатов.
- **Не фильтруем невидимые и bidi-символы** (находка security round 1). Причины две: U+200D ZWJ относится к категории Cf, и сплошная её вырезка ломала бы легитимные emoji-последовательности в именах групп; и Decision 7 требует симметрии с `updateBoard`, а одностороннее правило здесь заставило бы имя меняться само при перезагрузке. Аудитор в раунде 2 согласился, отозвал свою формулировку правила как небезопасную и перенёс корректную (не вырезать символы, а схлопывать в `''` заголовок без единого видимого символа) в рекомендации для Task 08.
- **Присваивания полей внутри блока `version < 8` ненаблюдаемы никаким тестом** — идущая следом безусловная санитизация перезаписывает оба поля при каждом вызове; сокращение блока до `result.version = 8` оставляет набор зелёным. Оставлены сознательно: шаг 5 задачи предписывает форму блока, а инвариант «один блок на один шаг версии» — то, что позволяет одному вызову провести файл от v1 до v8. Компенсация на стороне тестов: удалено вхолостую проходившее `not.toBe(GROUP_IDS)`, чтобы набор не заявлял покрытия, которого у него нет; реальные сторожа разделяемого массива — тест на `createDefaultBoard` и два теста на ранние возвраты.
- Пре-авторизованное задачей и не тронутое: неглубокий спред в ранних возвратах по-прежнему разделяет с `DEFAULT_DATA` объекты `settings`, `tasks`, `groups` и `hiddenGroups` (свежая копия сделана только для нового `groupOrder`, scope note шага 7); guard на отсутствующий или не-массивный `result.boards` не добавлялся (implementation hints: он перенёс бы отказ, а не предотвратил, — `cleanupCompletedTasks` в `main.ts` падает на тех же данных двумя строками ниже).
- Не применены и зафиксированы как не стоящие кода: ранний выход из цикла санитайзера (домен — шесть элементов); чужие ключи в `board.groups` получают `title`, тогда как `groupOrder` неизвестные id отбрасывает (обрезка ключей уничтожала бы данные); `docs/technical.md` не трогался — это Task 12.

**Tech debt:** Санитизация не смотрит на версию вперёд: файл с `version > 8` пропустит блоки миграции, но всё равно будет отсанитизирован и записан обратно, поэтому старая сборка плагина, открывшая новый `data.json` (типично — vault, синхронизированный между машинами), молча отбросит неизвестные id и обрежет заголовки. Сегодня радиус поражения нулевой — схемы выше 8 не существует; учесть при вводе схемы 9 или при изменении набора групп. Отдельно: тесты не входят в область `tsc --noEmit` (`tsconfig.json` включает только `src/**`), поэтому фикстуры в `tests/` расходятся с интерфейсами молча — в этот раз это поймал ревьюер, а не компилятор.

**Reviews:**

*Round 1:*
- dev-code-reviewer: approved_with_suggestions, 0 critical / 0 major / 4 minor → [0011-feat-group-customization-task-03-dev-code-reviewer-review.json](0011-feat-group-customization-task-03-dev-code-reviewer-review.json)
- dev-security-auditor: approved, 0 critical / 0 major / 6 minor → [0011-feat-group-customization-task-03-dev-security-auditor-review.json](0011-feat-group-customization-task-03-dev-security-auditor-review.json)
- dev-test-reviewer: needs_improvement, 2 major / 5 minor → [0011-feat-group-customization-task-03-dev-test-reviewer-review.json](0011-feat-group-customization-task-03-dev-test-reviewer-review.json)

*Round 2 (после исправлений):*
- dev-code-reviewer: approved_with_suggestions, 0 critical / 0 major / 3 minor → [0011-feat-group-customization-task-03-dev-code-reviewer-review-round2.json](0011-feat-group-customization-task-03-dev-code-reviewer-review-round2.json)
- dev-security-auditor: approved, 0 critical / 0 major / 7 minor → [0011-feat-group-customization-task-03-dev-security-auditor-review-round2.json](0011-feat-group-customization-task-03-dev-security-auditor-review-round2.json)
- dev-test-reviewer: needs_improvement, 2 major / 3 minor → [0011-feat-group-customization-task-03-dev-test-reviewer-review-round2.json](0011-feat-group-customization-task-03-dev-test-reviewer-review-round2.json)

*Round 3 (после исправлений):*
- dev-test-reviewer: passed, 0 critical / 0 major / 3 minor (все — carry-forward в следующие задачи) → [0011-feat-group-customization-task-03-dev-test-reviewer-review-round3.json](0011-feat-group-customization-task-03-dev-test-reviewer-review-round3.json)

Обе major-находки раунда 2 были о завышенных обещаниях набора тестов, а не об ошибках в коде, и обе закрыты на стороне тестов.

**Verification:**
- RED: до реализации `npx vitest run tests/unit/migration.test.ts` → 30 failed / 2 passed; GREEN после реализации → 32 passed, после двух раундов правок → 36 passed
- `npx tsc --noEmit` → exit 0 (пре-существующие ошибки `boardSettings.notes` уже закрыты Task 02)
- `npm run build` → exit 0
- `npm test` → 84 passed, 6 файлов; соседи по волне (`groupOrderUtils.test.ts`, `groupTitle.test.ts`) зелёные
- Мутационные проверки собственных тестов: санитизация только для `boards[0]` → падает; цикл по `GROUP_IDS` вместо `Object.values` → падает; удаление защиты от суррогата → падает; удаление блока `version < 8` → 7 падений; возврат ссылки на `GROUP_IDS` из ветки не-массива → падает; санитайзер, мутирующий вход → падает
- Прочитан `src/data/cleanup.ts`: `cleanupOrphanedTasks` собирает живые id через `Object.values(board.groups)`, а не через `groupOrder`, — шаг 9 задачи выполнен, файл не изменялся

---

## Task 05: Title resolution

**Status:** Done
**Commit:** 6c55562 (реализация), 7a770c4 и 3a5d75c (правки по ревью)
**Agent:** основной агент
**Summary:** Добавлен чистый модуль `src/ui/groupTitle.ts` с единственным экспортом
`resolveGroupTitle(storedTitle: string, defaultLabel: string): string` — возвращает сохранённое
название, если оно непустое после `trim()`, иначе локализованную дефолтную подпись; сохранённое
значение отдаётся как есть, без нормализации (она по Decision 7 живёт в загрузчике и `updateBoard`).
Модуль не имеет ни одного импорта, поэтому запреты на `svelte`, `src/i18n`, `src/stores` и
`src/data/types` выполняются буквально, а тесты идут в `environment: 'node'` без моков.

**Контракт для задачи 06** (три места отображения — `GroupHeader`, `CollapsibleGroup`,
`GroupSettingsPopup`): `import { resolveGroupTitle } from './groupTitle'`, вызов
`resolveGroupTitle(group.title, $groupLabels[id])`. Имя совпадает с предложенным в задаче, менять
спеки не потребовалось. Поле ввода в попапе настроек доски (задача 08) резолвер не вызывает —
Decision 4.

**Deviations:** Нет. Сигнатура на простых строках (без типа `Group`) — сознательно по Decision 4,
чтобы не связывать задачу с параллельной задачей 03. Второго экспорта, «режима для формы»,
мемоизации и рантайм-защиты от `null`/`undefined` нет — все четыре запрета из задачи соблюдены.
Из TDD Anchor реализованы все 5 случаев, шестой (оба аргумента пустые) не заведён: dev-test-reviewer
разобрал его отдельно и отклонил — он не убивает ни одного дополнительного мутанта и лежит в той же
ветке, что и тест на пустое название, а сама задача помечает его как «не отдельная ветка».
Комментарий оставлен на русском — так написаны все соседние модули (`boardLayoutUtils.ts`,
`statusTransitions.ts`, `dateFormat.ts`), это же рекомендовал dev-code-reviewer.

**Tech debt:** Собственного нет. Два наблюдения, вынесенные ревью за пределы задачи и требующие
решения владельцев: (1) ни резолвер, ни нормализация по Decision 7 не вычищают управляющие,
zero-width и bidi-символы — dev-security-auditor рекомендует **принять** как есть (искажение только
визуальное, требует ручной правки `data.json`, обратимо); если хардить — только в `updateBoard`
задачи 08 плюс тот же класс символов в `sanitizeGroupTitle`, но никогда в резолвере. (2) Обязанность
по XSS переходит к задаче 06: три места отображения должны использовать `{}`-интерполяцию, не
`{@html}`; на момент задачи 05 репозиторный скан `{@html}`/`innerHTML` по `src/` даёт единственное
попадание — сам комментарий в модуле.

**Reviews:**

*Round 1:*
- dev-code-reviewer: approved, 0 critical / 0 major / 2 minor (обе опциональные) → [0011-feat-group-customization-task-05-dev-code-reviewer-review.json](0011-feat-group-customization-task-05-dev-code-reviewer-review.json)
- dev-security-auditor: approved, 0 critical / 0 major / 3 minor → [0011-feat-group-customization-task-05-dev-security-auditor-review.json](0011-feat-group-customization-task-05-dev-security-auditor-review.json)
- dev-test-reviewer: passed, 0 findings; мутационная проверка — 6 мутантов внедрены, все убиты сюитой → [0011-feat-group-customization-task-05-dev-test-reviewer-review.json](0011-feat-group-customization-task-05-dev-test-reviewer-review.json)

*Round 2 (после исправлений):*
- dev-code-reviewer: approved, новых замечаний по существу нет; одно опциональное minor (JSDoc вместо `//`) применено коммитом 3a5d75c → [0011-feat-group-customization-task-05-dev-code-reviewer-review-round2.json](0011-feat-group-customization-task-05-dev-code-reviewer-review-round2.json)
- dev-security-auditor: approved, все три находки round 1 закрыты; отдельно проверено, что задача 03 действительно завезла `sanitizeGroupTitle(value: unknown)` с приведением не-строк к `''` и лимитом 40 — это и есть контроль, оправдывающий отсутствие рантайм-защиты в резолвере → [0011-feat-group-customization-task-05-dev-security-auditor-review-round2.json](0011-feat-group-customization-task-05-dev-security-auditor-review-round2.json)

Третий раунд не запускался: правка 3a5d75c меняет только формат комментария (`//` → JSDoc, текст
дословно тот же), рантайм-поверхности у неё нет, оба гейта после неё перепроверены.

**Verification:**
- RED (до реализации): `npx vitest run tests/unit/groupTitle.test.ts` → падает с `Cannot find module '../../src/ui/groupTitle'`
- GREEN: `npx vitest run tests/unit/groupTitle.test.ts` → 5 passed (перепроверено после каждой правки по ревью)
- `npx tsc --noEmit` → exit 0, пустой вывод
- Полная сюита сознательно не гонялась: задачи 03 и 04 шли параллельно и правили свои файлы в
  `tests/unit/`; гейт задачи — только своя сюита

---

## Task 04: Reorder logic

**Status:** Done
**Commits:** 6b9b6a3 (реализация), d60e30c (ревью, раунд 1), 820861c (ревью, раунд 2)
**Agent:** основной агент
**Summary:** Создан чистый модуль `src/ui/groupOrderUtils.ts` с логикой стрелок перемещения групп:
видимая строка меняется местами с ближайшей видимой соседкой, перешагивая скрытые (те остаются на
своих индексах), скрытая — с непосредственным соседом по списку. Обе экспортируемые функции
построены на одном внутреннем хелпере `findSwap`, возвращающем пару позиций либо `null`, поэтому
предикат и сам перенос не могут разойтись структурно, а не по договорённости. Перенос реализован
обменом двух позиций, а не `splice` — именно обмен оставляет промежуточные элементы на местах.

**Сигнатуры для Task 08** (попап вызывает обе функции одинаковыми аргументами):

```ts
export type MoveDirection = 'up' | 'down';   // 'up' — в сторону индекса 0

export function canMoveGroup(
  order: GroupId[], groupId: GroupId, direction: MoveDirection, hiddenGroups: GroupId[]
): boolean;

export function moveGroup(
  order: GroupId[], groupId: GroupId, direction: MoveDirection, hiddenGroups: GroupId[]
): GroupId[];
```

`hiddenGroups` — массив, а не `Set`: попап уже держит его массивом
(`BoardSettingsPopup.svelte:14`), лишних преобразований на стороне вызывающего не нужно. Обе
функции чистые и читают только аргументы, поэтому переключение чекбокса видимости меняет
поведение стрелок немедленно, до сохранения. Единственный случай, когда результат `moveGroup` не
равен входу при `canMoveGroup === false`: `order` пришёл не массивом — тогда вернётся пустой
массив. Отсюда правило для Task 08: записывать результат только если предикат вернул `true`.

**Deviations:** Отклонений от спека нет — обе функции названы и подписаны так, как предлагала
задача, модуль импортирует только тип `GroupId`, все 15 TDD-якорей присутствуют дословно.
Сверх спека добавлены два элемента, оба по находкам ревью: guard `Array.isArray` на оба входных
массива (задача требует «never throw», а на `null`/строке функции падали или молча переходили на
подстроки) и исчерпывающий тест согласованности предиката с переносом.

**Tech debt:** Собственного долга нет. Наследуемая дыра, которую эта задача закрыть не может и
которая осталась ничьей: `hiddenGroups` нигде не санируется — `src/data/migration.ts:101-108`
трогает его только в ветке `version < 4` и только при строгом `undefined`, поэтому на текущих
данных (v8) ветка не выполняется. При `"hiddenGroups": null` в data.json попап падает на
`BoardSettingsPopup.svelte:14` (`[...board.hiddenGroups]`) ещё до вызова этого модуля, так что
guard внутри `groupOrderUtils` — защита в глубину, а не лечение симптома. Task 03 закрыт и
санитайзер видимости не добавил; оба ревьюера независимо предложили отнести это к Task 08.

**Reviews:**

*Round 1:*
- dev-code-reviewer: approved_with_suggestions, 0 critical / 0 major / 3 minor → [0011-feat-group-customization-task-04-dev-code-reviewer-review.json](0011-feat-group-customization-task-04-dev-code-reviewer-review.json)
- dev-security-auditor: approved, 0 critical / 0 major / 2 minor → [0011-feat-group-customization-task-04-dev-security-auditor-review.json](0011-feat-group-customization-task-04-dev-security-auditor-review.json)
- dev-test-reviewer: needs_improvement, 0 critical / 2 major / 4 minor → [0011-feat-group-customization-task-04-dev-test-reviewer-review.json](0011-feat-group-customization-task-04-dev-test-reviewer-review.json)

*Round 2 (после исправлений):*
- dev-code-reviewer: approved_with_suggestions, 0 critical / 0 major / 3 minor (заметки для Task 08) → [0011-feat-group-customization-task-04-dev-code-reviewer-review-round2.json](0011-feat-group-customization-task-04-dev-code-reviewer-review-round2.json)
- dev-security-auditor: approved, 0 critical / 0 major / 3 minor (недостижимые пути) → [0011-feat-group-customization-task-04-dev-security-auditor-review-round2.json](0011-feat-group-customization-task-04-dev-security-auditor-review-round2.json)
- dev-test-reviewer: passed, 0 critical / 0 major / 1 minor (косметика) → [0011-feat-group-customization-task-04-dev-test-reviewer-review-round2.json](0011-feat-group-customization-task-04-dev-test-reviewer-review-round2.json)

Главная находка раунда 1 (dev-test-reviewer, major): согласованность предиката и переноса не была
закреплена — реализацию `canMoveGroup` можно было заменить на независимую, применяющую правило
видимой строки к скрытой, и все 18 тестов оставались зелёными. Это ровно тот дефект, который
виден пользователю как «стрелка выглядит неактивной, хотя ход законен». Закрыто тестом, который
выводит ожидание из `moveGroup`, а не задаёт его руками.

**Verification:**
- RED (до реализации): `npx vitest run tests/unit/groupOrderUtils.test.ts` → `Cannot find module '../../src/ui/groupOrderUtils'`
- GREEN: `npx vitest run tests/unit/groupOrderUtils.test.ts` → 22 passed (было 18 до правок по ревью)
- `npx tsc --noEmit` → exit 0, пустой вывод
- Мутационная проверка сюиты (свой прогон, 7 мутантов: no-op перенос, `splice` вместо обмена,
  снятая ветка скрытой строки, снятое перешагивание, мутация входа на месте, переписанный
  предикат, снятый guard) → убиты все 7; независимо dev-test-reviewer построил 18 мутантов → убиты
  все 18
- Все 15 TDD-якорей присутствуют в файле дословно (программная сверка строк с текстом задачи)
- `grep "^import" src/ui/groupOrderUtils.ts` → единственный импорт `import type { GroupId }`;
  ни стора, ни i18n, ни svelte, ни `Board`/`Group` — зависимости от Task 03 нет
- Сюиты, которых волна не касается: `statusTransitions` + `boardLayoutUtils` → 13 passed
- Полный `npm test` сознательно не гонялся: гейт задачи — только своя сюита (см. Verification Steps)

---

## Task 06: Group name display

**Status:** Done
**Commit:** 8dfff69 (реализация), b272b83 и a4fda4e (правки по ревью)
**Agent:** основной агент

**Summary:** Резолвер из задачи 05 подключён во все четыре места, где доска показывает название
группы: шапка обычной группы (`GroupHeader`), шапка сворачиваемой (`CollapsibleGroup`), заголовок
попапа настроек группы (`GroupSettingsPopup`) и подсказка пустой группы (`EmptyState`). Обе шапки
теперь переживают имя в 40 символов: заголовки обрезаются многоточием, счётчик и обе кнопки в
каждой шапке получили `flex-shrink: 0`, чтобы сжимался заголовок, а не они.

**Контракт для задачи 10 (проп `EmptyState`):** `export let groupTitle = '';` — **строка**
`group.title`, а не вычисленный родителем boolean. Признак переименования определяется в одном
месте, внутри `EmptyState`: `groupTitle.trim() !== ''` → ключ `emptyState.renamed`, иначе прежний
`emptyState.{groupId}`. Правило пустоты то же, что в `resolveGroupTitle`, поэтому имя и подсказка
не могут разойтись. Оба места отрисовки (`TaskGroup`, `CollapsibleGroup`) читают
`$: storedTitle = group.title ?? ''` и передают его. Дефолт `''` у пропа — защита от будущего
третьего места вызова: без него забытый проп уронил бы рендер всей группы, а не деградировал бы к
семантической подсказке. `src/ui/groupTitle.ts` не тронут (`git diff` пуст, экспорт по-прежнему
один), предикат «переименована ли группа» туда не добавлялся.

**Deviations:** Одно, осознанное и подтверждённое замером. Задача предписывала ровно восемь
селекторов в `src/styles.css`; изменено девять. Девятый — `.tm-popup__title`: в заголовок попапа
теперь попадает пользовательское имя, и неразрывное имя в 39 символов на вьюпорте 320px давало
357px контента в боксе 278px и распирало сам попап шире его коробки (замерено до и после).
Лечится одной декларацией `overflow-wrap: anywhere`. Важно для будущих правок: здесь
**не взаимозаменяемо** с `word-break: break-word` (строки 330 и 727) — только `anywhere` уменьшает
min-content и не даёт попапу распереться; «унификация» с соседями тихо вернёт баг.

Сверх спека также добавлены три ассерта в `tests/e2e/core.spec.ts` — см. ниже, это находка ревью,
а не инициатива. Все три живут **внутри существующих сценариев**: счёт сценариев не изменился
(35 в `core.spec.ts`, 84 всего), как того требует предусловие задачи 09.

**Что показала мутационная проверка (главное для задачи 10).** Ревьюер экспериментально доказал,
что до правок два из четырёх переписанных мест отображения были не видны вообще ни одному тесту:
подстановка сырого `group.title` в шапку обычной группы и в заголовок попапа оставляла все 84
теста зелёными. Итог после правок — из четырёх мутантов выживает **ровно один**:

| Мутант | Ловится | Чем |
|---|---|---|
| A — `GroupHeader` рендерит сырой `group.title` | да | ассерт в сценарии 3.4 |
| B — заголовок `GroupSettingsPopup` рендерит сырой `group.title` | да | ассерт в сценарии 8.1 |
| D — `CollapsibleGroup` рендерит сырой `group.title` | да | ассерт в сценарии 7.1 |
| C — инвертирован тернарник `EmptyState` | **нет** | ничем, до задачи 10 |

Все три ассерта проверяют только путь по умолчанию (пустое хранимое название → локализованная
подпись) — ровно тот инвариант, который эта задача обещает не сломать, и они не пересекаются со
сценариями задачи 10, проверяющими переименованные значения. Локаторы у них классовые, не
текстовые, поэтому миграцию локаторов в задаче 09 они переживают.

**Хвосты для соседних задач:**
- **Задача 10** — выживший мутант C: выбор ключа подсказки (`emptyState.renamed` vs
  `emptyState.{groupId}`) не покрыт ничем. Сценарий Sc.13 стоит считать блокирующим. Рецепт,
  доставшийся от выброшенного черновика проверки, чтобы не изобретать заново: (а) названия групп
  сеются без UI задачи 08 — версионированный снапшот в `window.__test.resetData`, он проходит
  через `migrateData` (`tests/harness/main.ts:80-95`); (б) обрезка наблюдаема как
  `scrollWidth > clientWidth` на `.tm-group-header__title` при вьюпорте 300px и имени в 38
  символов — на дефолтном вьюпорте колонка шире имени и обрезки просто не происходит;
  (в) доказательство `flex-shrink: 0` — не сама обрезка, а то, что кнопка сохраняет свои 24px и
  остаётся внутри шапки.
- **Задача 09** — сигнал регрессии у сворачиваемой шапки до сих пор частично держится на текстовом
  локаторе `filter({ hasText: 'Backlog' })` в `helpers.ts:104`, который эта задача и удаляет.
  Ассерт в 7.1 добавлен именно поэтому: проверено симуляцией (локатор переведён на нетекстовый) —
  после миграции мутант D падает на `toHaveText`, а не на таймауте клика. После миграции стоит
  прогнать мутант D ещё раз и убедиться, что это по-прежнему так.
- **Задача 08** — `BoardSettingsPopup.svelte:61` намеренно оставлен на `$groupLabels[groupId]`:
  поле ввода имени группы её territory, не этой задачи.

**Tech debt:** Собственного нет. Унаследованное, подтверждённое повторно: `sanitizeGroupTitle`
(`src/data/migration.ts`) режет пробелы, но не символы категорий Cc/Cf — имя из одних zero-width
символов считается непустым и для резолвера, и для проверки переименования (пустая на вид шапка
плюс молча подменённая подсказка), а U+202E разворачивает остаток строки в шапке и в заголовке
попапа. Искажение визуальное, требует ручной правки `data.json`, обратимо; файл принадлежит задаче
03, лечить — в `updateBoard` задачи 08 плюс тот же класс символов в санитайзере.

**Reviews:**

*Round 1:*
- dev-code-reviewer: approved_with_suggestions, 0 critical / 0 major / 3 minor → [0011-feat-group-customization-task-06-dev-code-reviewer-review.json](0011-feat-group-customization-task-06-dev-code-reviewer-review.json)
- dev-security-auditor: approved, 0 critical / 0 major / 3 minor → [0011-feat-group-customization-task-06-dev-security-auditor-review.json](0011-feat-group-customization-task-06-dev-security-auditor-review.json)
- dev-test-reviewer: needs_improvement, 0 critical / 2 major / 4 minor → [0011-feat-group-customization-task-06-dev-test-reviewer-review.json](0011-feat-group-customization-task-06-dev-test-reviewer-review.json)

*Round 2 (после исправлений):*
- dev-code-reviewer: approved_with_suggestions → [0011-feat-group-customization-task-06-dev-code-reviewer-review-round2.json](0011-feat-group-customization-task-06-dev-code-reviewer-review-round2.json)
- dev-security-auditor: changes_required, 1 critical → [0011-feat-group-customization-task-06-dev-security-auditor-review-round2.json](0011-feat-group-customization-task-06-dev-security-auditor-review-round2.json)
- dev-test-reviewer: passed, 0 critical / 0 major / 4 minor → [0011-feat-group-customization-task-06-dev-test-reviewer-review-round2.json](0011-feat-group-customization-task-06-dev-test-reviewer-review-round2.json)

*Round 3 (проверочный, только безопасность):*
- dev-security-auditor: approved, 0 critical / 0 major / 2 minor (оба — перенесённые договорённости:
  Unicode Cc/Cf и организационный риск повторения гонки за дерево в задачах 09-10) →
  [0011-feat-group-customization-task-06-dev-security-auditor-review-round3.json](0011-feat-group-customization-task-06-dev-security-auditor-review-round3.json)

Про critical раунда 2 — он не про код и не про уязвимость: три ревьюера аудировали **одно и то же
рабочее дерево одновременно**, двое ставили мутантов прямо в файлы, и один мутант
(`GroupSettingsPopup`) остался неснятым к моменту аудита, из-за чего гейты, измеренные по дереву,
разошлись с гейтами по коммиту. Туда же уходит и minor «задача добавила третий варнинг сборки»:
на чистом дереве `npm run build` даёт два прежних a11y-варнинга, третий (`unused export property
'groupId'`) порождал сам мутант — снятый вызов `resolveGroupTitle` осиротлял проп. Организационный
вывод на будущее — он адресован задачам 09 и 10, которым эта запись сама раздаёт новые мутационные
прогоны: мутировать только в одноразовом `git worktree`, а не в общем дереве, и любая цифра гейта в
отчёте должна называть SHA, на котором она измерена. Ревьюер раунда 3 отозвал свой же minor про
«третий варнинг сборки» ровно по этой причине: он сравнивал сборку в чистом worktree с грязным
общим деревом, и дельтой оказался чужой мутант, а не диффы коммитов.

**Verification** (всё — на чистом дереве, `git status` без изменённых отслеживаемых файлов):
- Базовый прогон **до** любой правки: `npx playwright test tests/e2e/core.spec.ts` → 35 passed
- `grep -n "emptyState.renamed" src/i18n/types.ts src/i18n/en.ts src/i18n/ru.ts` → три попадания
  (предусловие задачи 02 выполнено)
- `npm run build` → успех, два варнинга, оба пре-существующие a11y (столько же, сколько до задачи)
- `npx playwright test` (все четыре файла) → 84 passed; `npm test` → 84 passed, 6 файлов
- Счёт сценариев не изменился: 35 в `core.spec.ts`, 84 всего
- Мутанты A и B прогнаны собственноручно (оба внедрены одновременно) → падают ровно сценарии 3.4 и
  8.1, 33 passed; мутант D после симуляции миграции локаторов → падает на `toHaveText` в 7.1
- `grep -n "trim()" src/ui/EmptyState.svelte src/ui/TaskGroup.svelte src/ui/CollapsibleGroup.svelte`
  → одно попадание, в `EmptyState.svelte`
- `git diff src/ui/groupTitle.ts` → пусто
- Шесть блоков в `src/styles.css` прочитаны глазами: `flex-shrink: 0` объявлен в каждом
- `npx tsc --noEmit` как гейт **не использовался**: он не проверяет `.svelte` (Decision 11)

---

## Task 07: Board renders in configured order

**Status:** Done
**Commit:** 3dda490 (реализация), fc0b9e5 и dd0f8d0 (правки по ревью)
**Agent:** основной агент

**Summary:** Доска рисует группы в порядке `board.groupOrder`. Порядок задан CSS-свойством `order`
на существующих обёртках, шесть литеральных блоков `{#if}` в `BoardLayout.svelte` остались на месте
и в прежнем DOM-порядке — свёртка их в `{#each}` пересоздала бы обёртки и уничтожила инстансы
SortableJS на телах групп внутри. Каждая обёртка получила инлайновый `style="order: N"` и служебный
атрибут `data-group-container`; блок заметок получил `order: 100`, иначе он всплыл бы над группами.

**Как именно задан порядок.** Одно реактивное выражение `orderedGroups` фильтрует `board.groupOrder`
по `hiddenGroups` и по факту существования объекта группы, и из этого **одного** массива выводятся
все три производные: классы (`computeGroupClasses`, тело не тронуто), значения `order` (`groupStyles`,
нумерация с 1) и признак «группа рисуется» (`renderedGroups`, условие всех шести `{#if}`). Один
источник — чтобы «кто с кем в паре» не могло разъехаться с «кто где стоит». Локальная константа
`GROUP_ORDER` удалена как ставшая неиспользуемой.

**Имя атрибута.** `data-group-container` на обёртке — намеренно **не** `data-group-id`, который
остаётся уникальным на теле группы. При совпадении имён двенадцать строгих `expect()` упали бы
громко, а четыре `document.querySelector` в сценариях колонок карточек молча вернули бы обёртку
вместо тела и прочли бы пустой `--tm-card-columns`, превратив реальную проверку в ложно-зелёную.
`grep -rn "data-group-container" src/` → шесть попаданий, все в `BoardLayout.svelte`.

**Решение по «уточнению волны 2» (группа отсутствует в `groups`).** Выбран первый вариант:
идентификаторы порядка без соответствующего объекта группы просто не рисуются. Это дешевле и
согласуется с принципом «доска обязана открыться», ради которого писался санитайзер; до этой задачи
такой файл ронял рендер целиком. Проверено в харнессе: доска с удалённым `groups.orgIntentions`
открывается, рисует пять обёрток с плотным `order` 1..5, ошибок в консоли нет.
**Важная оговорка, найденная ревью:** инвариант «доска обязана открыться» держится для пяти групп
из шести. На удалённой `completed` падение происходит раньше рендера — `cleanupCompletedTasks`
(`cleanup.ts:4`) читает `board.groups.completed.completedRetentionDays` фиксированным путём, а
`main.ts` вызывает его сразу после `migrateData`. Не регресс этой задачи и не её файл; оговорка
записана в комментарии рядом с фильтром, чинить — в техдолге.

**Проверка существования — `Object.prototype.hasOwnProperty.call`, а не `board.groups[id]`.** Доступ
по ключу ходит по цепочке прототипов: идентификатор вида `constructor` прошёл бы фильтр, занял
позицию и сдвинул `order` всех настоящих групп — молча, без ошибки. Сегодня недостижимо (санитайзер
такие ключи режет), но задача 08 добавляет в `groupOrder` второго писателя. Ревьюер снял A/B: на
3dda490 отравленный после санитайзера порядок давал `order` 2..7, на fc0b9e5 — плотные 1..6.
**Не `Object.hasOwn`** (так было в fc0b9e5, исправлено в dd0f8d0): это ES2022, а проект объявляет
ES2021 в `tsconfig.json` и `esbuild.config.mjs` и не является desktop-only. Промах не ловился ничем —
`tsc` не читает `.svelte`, а esbuild понижает синтаксис, но не runtime-API, — и вызов ушёл в
`main.js` дословно. Поднимать объявленный уровень проекта до ES2022 сознательно не стали: это
общепроектное решение, не дело одной задачи фичи.

**Deviations:** Одно. Условие шести блоков изменено с `{#if !hidden.has('<id>')}` на
`{#if renderedGroups.has('<id>')}`. Блоки остались литеральными и на прежних местах — задача
запрещала свёртку в цикл, а не уточнение условия; без этого обёртка отсутствующей группы отрисовалась
бы без класса и без `order` и всплыла бы наверх доски.

**Reviews:**

*Round 1 (3dda490):*
- dev-code-reviewer: approved_with_suggestions, 0 critical / 0 major / 3 minor → [0011-feat-group-customization-task-07-dev-code-reviewer-review.json](0011-feat-group-customization-task-07-dev-code-reviewer-review.json)
- dev-security-auditor: approved, 0 critical / 0 major / 3 minor → [0011-feat-group-customization-task-07-dev-security-auditor-review.json](0011-feat-group-customization-task-07-dev-security-auditor-review.json)
- dev-test-reviewer: passed, 0 critical / 0 major / 2 minor → [0011-feat-group-customization-task-07-dev-test-reviewer-review.json](0011-feat-group-customization-task-07-dev-test-reviewer-review.json)

*Round 2 (fc0b9e5):*
- dev-code-reviewer: approved_with_suggestions, 0 critical / 1 major / 2 minor → [0011-feat-group-customization-task-07-dev-code-reviewer-review-round2.json](0011-feat-group-customization-task-07-dev-code-reviewer-review-round2.json)
- dev-security-auditor: approved, 0 critical / 0 major / 1 minor → [0011-feat-group-customization-task-07-dev-security-auditor-review-round2.json](0011-feat-group-customization-task-07-dev-security-auditor-review-round2.json)
- dev-test-reviewer: passed, 0 critical / 0 major / 2 minor → [0011-feat-group-customization-task-07-dev-test-reviewer-review-round2.json](0011-feat-group-customization-task-07-dev-test-reviewer-review-round2.json)

*Round 3 (dd0f8d0, точечный — только закрытие major):*
- dev-code-reviewer: approved, 0 critical / 0 major / 0 new findings → [0011-feat-group-customization-task-07-dev-code-reviewer-review-round3.json](0011-feat-group-customization-task-07-dev-code-reviewer-review-round3.json)

Все три ревьюера раунда 2 независимо сошлись на одной и той же оставшейся находке (ES2022-вызов);
код-ревьюер оценил её как major, двое — как minor. Правило волны 3 про мутантов сработало: все
мутационные прогоны шли в одноразовых `git worktree`, общее дерево ни разу не было грязным, и все
цифры в отчётах названы вместе с SHA. Два ревьюера намеренно не запускали Playwright из worktree:
`playwright.config.ts` держит захардкоженный порт 5173 с `reuseExistingServer`, и прогон молча
тестировал бы чужую сборку — это стоит помнить задачам 09 и 10.

**Tech debt (передаётся дальше, ни одно не чинится здесь):**
- `BoardSettingsPopup.svelte:17,53` и `dataStore.ts:207-208` безусловно обходят все шесть
  идентификаторов и падают на доске с удалённой группой. Не регресс — до этой задачи такой файл
  вообще не рисовался, — но именно она делает шестерёнку настроек достижимой. Владелец — **задача 08**.
- `cleanup.ts:4` (фиксированный путь к `groups.completed`) — падение при загрузке, см. оговорку выше.
- Ветка «идентификатор в `groupOrder` без объекта группы» не покрыта ни одним автоматическим тестом.

**Verification** (всё на чистом дереве, финальные цифры — на dd0f8d0):
- `npm test` → 87 passed, 6 файлов (было 84; +3 кейса произвольного порядка)
- `npm run build` → успех, два варнинга, оба пре-существующие a11y (столько же, сколько до задачи)
- `npx playwright test` → 84 passed, файлы под `tests/e2e/` не тронуты
- `grep -rn "data-group-container" src/` → шесть попаданий, все в `BoardLayout.svelte`
- `grep -c "Object.hasOwn" main.js` → 0
- Мутант «функция пересортировывает вход в порядок `GROUP_IDS`» (регрессия «привязаться к
  идентификатору вместо позиции») убивается ровно новым кейсом «перестановка разрывает пару», все
  пять прежних кейсов под ним проходят — новые кейсы не вакуумные
- Харнесс, обратный `groupOrder`: значения `order` и визуальный порядок сверху вниз совпадают с
  `groupOrder`, DOM-порядок обёрток неизменен, заметки на `order: 100` ниже всех групп, реальное
  перетаскивание мышью переносит карточку focus→delegated и обратно без перезагрузки
- Харнесс, отравленный после санитайзера `groupOrder` с ключом `constructor` → шесть обёрток,
  плотный `order` 1..6, ошибок нет
- `npx tsc --noEmit` как гейт **не использовался**: он не проверяет `.svelte` (Decision 11)

---

## Task 08: Settings popup and save chain

**Status:** Done
**Commit:** 65696f7 (реализация), 9c0ee19 и 0edc923 (правки по ревью), 4-й коммит — точечные
пометки по раунду 3
**Agent:** основной агент

**Summary:** В попапе настроек доски каждая строка группы получила поле имени и пару стрелок
переноса, а строки пошли по `board.groupOrder` вместо константы `GROUP_IDS`. Цепочка сохранения
расширена целиком в одном коммите — `BoardSettingsPopup.onSave` → `BoardHeader.saveSettings` →
`dataStore.updateBoard`, — потому что доска после задачи 07 уже рисуется из `groupOrder` и частично
обновлённая цепочка записала бы туда `undefined`.

**Контракт поля ввода.** Значение поля — **сырое** `board.groups[id].title`, пустое у
непереименованной группы; локализованный дефолт живёт только в `placeholder`. `resolveGroupTitle`
(задача 05) в попапе не вызывается и правило `title || label` не инлайнится: и то и другое положило
бы дефолт в поле литеральным текстом, подсказка никогда бы не показалась, а «Сохранить» без правок
записало бы шести группам текущие локализованные названия и лишило заголовки перевода при смене
языка (Decision 4). На стороне стора это закреплено тестом «keeps an empty group title empty».

**Нормализация — на границе стора.** `updateBoard` прогоняет каждое имя через экспортированный
`sanitizeGroupTitle` из `migration.ts` — тот же санитайзер, что и на загрузке (Decision 7), поэтому
правила обрезки и предела длины не могут разойтись между входами. `maxlength="40"` на поле остаётся,
но точкой контроля не является. `groupOrder`, наоборот, пишется **как есть**: его санитайзер живёт
на загрузке (Decision 6), и второй экземпляр в сторе стал бы вторым источником правды. Асимметрия
намеренная и закреплена тестом.

**Атрибут строки — `data-settings-group`.** Не `data-group-id` (тело группы) и не
`data-group-container` (обёртка на доске): попап не размонтирует доску, поэтому общий атрибут дал бы
две совпадающие цели на группу — часть проверок упала бы громко, часть молча стала бы
ложно-зелёной (Decision 3). `grep -rn "data-settings-group" src/` → одно попадание;
`grep -rn "data-group-container\|data-group-id" src/ui/BoardSettingsPopup.svelte` → пусто.

**Перестановка.** Стрелки ходят через чистый модуль задачи 04. Итог раунда 2: вместо предиката по
полному порядку введён `moveGroupWithinPresent(order, presentGroups, ...)` — перестановка идёт
только между **нарисованными** строками, а идентификатор без объекта группы сохраняет свою
абсолютную позицию в порядке. Это закрыло «стрелка активна, но ничего не двигается» и для видимых,
и для скрытых строк; на здоровых данных функция побайтово совпадает с `moveGroup` (ревьюер проверил
исчерпывающим перебором всех 720 порядков и всех подмножеств скрытых). Предикат стрелки —
`canMoveGroup(presentGroups, ...)`, ровно те же аргументы, что уходят в перенос, поэтому «активна» и
«сработала» не могут разойтись.

**Требование волны 2 (несанированный `hiddenGroups`).** Приведение к массиву известных
идентификаторов вынесено из компонента в `sanitizeHiddenGroups` в `groupOrderUtils.ts`: внутри
`.svelte` эта логика не покрывается unit-тестами вовсе (Decision 11), а рядом с чистыми функциями
переноса — покрывается. Дубликаты схлопываются, как в `sanitizeGroupOrder`.

**Техдолг из задачи 07 закрыт частично.** Безусловный обход шести идентификаторов убран и в попапе
(строки рисуются по фактически существующим группам), и в `updateBoard` (запись пропускает группу,
которой нет). Проверяется **значение**, а не наличие ключа: `"focus": null` проходит
`hasOwnProperty` и уронил бы запись на полпути — доска осталась бы наполовину обновлённой, а
`persist()` не был бы вызван. `fullWidth` нормализуется через `=== true`, иначе неполная карта
записала бы `undefined` в boolean-поле.

**Deviations:** Одно, за пределами буквы задачи. Задача просила «обрезать и ограничить 40
символами» прямо в `updateBoard`; вместо своей обрезки вызван экспортированный `sanitizeGroupTitle`
— решение 7 требует одинаковой нормализации на сохранении и на загрузке, а две копии правила
разошлись бы (у санитайзера, помимо trim и предела, есть ещё срез повисшего суррогата).

**Reviews:**

*Round 1 (65696f7):*
- dev-code-reviewer: approved_with_suggestions, 0 critical / 0 major / 4 minor → [0011-feat-group-customization-task-08-dev-code-reviewer-review.json](0011-feat-group-customization-task-08-dev-code-reviewer-review.json)
- dev-security-auditor: approved, 0 critical / 1 major / 4 minor → [0011-feat-group-customization-task-08-dev-security-auditor-review.json](0011-feat-group-customization-task-08-dev-security-auditor-review.json)
- dev-test-reviewer: needs_improvement, 0 critical / 2 major / 10 minor → [0011-feat-group-customization-task-08-dev-test-reviewer-review.json](0011-feat-group-customization-task-08-dev-test-reviewer-review.json)

*Round 2 (9c0ee19):*
- dev-code-reviewer: approved_with_suggestions, 0 critical / 0 major / 2 minor → [0011-feat-group-customization-task-08-dev-code-reviewer-review-round2.json](0011-feat-group-customization-task-08-dev-code-reviewer-review-round2.json)
- dev-security-auditor: approved, 0 critical / 1 major (перенесён) / 4 minor → [0011-feat-group-customization-task-08-dev-security-auditor-review-round2.json](0011-feat-group-customization-task-08-dev-security-auditor-review-round2.json)
- dev-test-reviewer: passed, 0 critical / 0 major / 6 minor → [0011-feat-group-customization-task-08-dev-test-reviewer-review-round2.json](0011-feat-group-customization-task-08-dev-test-reviewer-review-round2.json)

*Round 3 (0edc923):*
- dev-code-reviewer: approved, 0 critical / 0 major / 2 minor (оба optional) → [0011-feat-group-customization-task-08-dev-code-reviewer-review-round3.json](0011-feat-group-customization-task-08-dev-code-reviewer-review-round3.json)
- dev-test-reviewer: passed, 0 critical / 0 major / 4 minor → [0011-feat-group-customization-task-08-dev-test-reviewer-review-round3.json](0011-feat-group-customization-task-08-dev-test-reviewer-review-round3.json)

Два раунда обязательных правок были вызваны тестами, а не кодом: раунд 1 показал, что удаление
`persist()` из `updateBoard` и правка «не затирать сохранённое имя пустым» оставляли набор зелёным —
оба критерия приёмки не могли упасть ни на чём. Оба закрыты и убиваются мутантами. Все мутационные
прогоны шли в одноразовых `git worktree`, общее дерево ни разу не было грязным.

**Найдено по ходу и передаётся дальше:**
- **Задаче 09:** сломанных сценариев ровно 27 — 15 в `0006-group-visibility`, 11 в
  `0007-dynamic-layout`, 1 в `0008-card-columns` (`TC-13`). Все падают на
  `.tm-popup__group-row` + `filter({ hasText: '<имя группы>' })`: имя стало значением поля ввода, и
  `hasText` его больше не видит. Индексы переключателей не менялись — стрелки это `<button>`, так
  что `.tm-popup__group-toggle` `.first()`/`.nth(1)` по-прежнему видимость и полная ширина.
- **Задаче 10 (не покрыто ничем):** класс затемнения `.tm-popup__group-row--hidden`; `maxlength`
  самого поля (сценарий на ровно 40 символов проходит и без атрибута); сценарий с удалённым объектом
  группы — единственный способ прогнать `moveGroupWithinPresent` через компонент; round-trip
  `hiddenGroups: null` и дубликаты.
- **Ловушка стенда.** `esbuild.harness.mjs --serve` копирует `src/styles.css` **один раз при
  старте**, а `playwright.config.ts` держит `reuseExistingServer`. Уже запущенный стенд отдаёт
  старый CSS: правки стилей проверяются только после рестарта сервера. Стоило одного ложного
  падения проверки высоты попапа.
- **Тестовые файлы не проверяются типами вообще.** `tsconfig.json` включает только `src/`, так что
  `npx tsc --noEmit` ничего не говорит о `tests/`. Двойное приведение фейкового плагина
  (`as unknown as Plugin`) читаемее, чем `as never`, но контракта не проверяет — его держит сам тест.

**Техдолг (передаётся дальше, ни одно не чинится здесь):**
- **Путь загрузки не тотален по формам правленного руками `data.json`.** `migrateData` разыменовывает
  каждое значение `board.groups` (`migration.ts:156`), `main.ts:52` зовёт его без перехвата, поэтому
  `"delegated": null` роняет плагин до монтирования — попапа, которым можно было бы починить, просто
  нет. `board.hiddenGroups` не санируется на загрузке вовсе, и `{}`/`42`/`true` убивают доску на
  `BoardLayout.svelte:21`; `board.title`/`subtitle` не проверяются перед `.trim()`. Готовый
  `sanitizeHiddenGroups` для этого уже есть, но проводка живёт в файлах задач 03 и 07, дефект
  преэкзистентный, и задача 08 делает картину строго лучше. Владелец — отдельная задача, не эта.
- `cleanup.ts:4` (фиксированный путь к `groups.completed`) — прежняя запись из задачи 07 в силе.
- Форма полей цепочки сохранения выписана инлайном трижды в двух файлах; именованный тип читался бы
  лучше, но проверки не добавил бы — `tsc` не смотрит в `.svelte` (Decision 11).

**Verification** (всё на чистом дереве, финальные цифры — на последнем коммите задачи):
- `npm run build` → успех, два варнинга, оба преэкзистентные a11y (столько же, сколько до задачи)
- `npm test` → 111 passed, 7 файлов (было 94 после волны 4; +13 в новом `tests/unit/dataStore.test.ts`,
  +4 на `sanitizeHiddenGroups`, +4 на `moveGroupWithinPresent`)
- `npx playwright test tests/e2e/core.spec.ts` → 35 passed
- `npx tsc --noEmit` → чисто; как гейт для попапа не годится, `.svelte` он не читает (Decision 11)
- `npx playwright test` по трём остальным наборам → 22 passed, 27 failed, список выше; файлы под
  `tests/e2e/` не тронуты
- Ручной прогон в харнессе (12 проверок, конфиг вне репозитория): строки идут по `groupOrder`,
  поле пустое с локализованной подсказкой и `maxlength=40`, сохранение без правок оставляет все
  шесть `title` пустыми, обрезка и возврат к дефолту работают, Cancel отбрасывает и имена и порядок,
  стрелки перешагивают скрытые и гаснут на краях, единственная видимая группа — обе стрелки погашены,
  затемнение и поведение стрелок меняются до сохранения, повреждённый `hiddenGroups` не ломает попап,
  попап помещается в 420px вьюпорт и прокручивается, переключатель строки заметок стоит в своей
  колонке, имя вида `<img src=x onerror=...>` выводится текстом
- Мутанты (все убиты, прогоны в одноразовых worktree): удаление `persist()`; «пустое имя не затирает
  сохранённое»; перекрёстный ключ имени; срез с хвоста вместо начала; доска по индексу вместо `id`;
  санитайзер порядка внутри стора; passthrough в `sanitizeHiddenGroups`; потеря записи имени и
  порядка; снятие гарда отсутствующей группы; делегирование `moveGroupWithinPresent` в `moveGroup`;
  сдвиг обратной записи на единицу; возврат гарда к `hasOwnProperty`; снятие `=== true`; снятие
  схлопывания дубликатов

---

## Task 09: Migrate existing E2E locators

**Status:** Done
**Commit:** a7a1b75 (миграция локаторов), ddaf1af (правка по ревью + отчёты)
**Agent:** основной агент

**Summary:** Существующие сценарии переведены с поиска групп по отображаемым названиям на два
устойчивых атрибута: доска адресуется через `data-group-container` на обёртке, строки попапа — через
`data-settings-group`. Ни одного нового сценария, ни одного изменённого ассерта: 84 сценария до и
после, из них 27 были красными.

**Две разные поломки, а не одна.** Строки попапа сломались детерминированно и независимо от
переименования: задача 08 увела название группы из текстового узла в `value` инпута, а
`filter({ hasText })` смотрит только на текст. Заголовки свёрнутых групп ломались бы при первом же
переименовании. Обе лечатся одинаково, но первая уже была фактом, а не риском.

**Обёртка вместо `.locator('..')`.** `getGroupWrapperClass` карабкался к обёртке двумя хопами вверх
по DOM и ветвился на «свёрнутая / обычная группа». Атрибут на самой обёртке снял и ветку, и хопы:
для `TaskGroup` и `CollapsibleGroup` теперь один и тот же однострочный поиск. То же сделано с Сц.21
(`boundingBox` обёртки) — она сидела в том же файле и страдала тем же.

**Что осталось нетронутым — намеренно.** Все локаторы `[data-group-id="X"]`, адресующие **тело**
группы, побайтово прежние. Особенно четыре `document.querySelector` в `0008-card-columns.spec.ts`:
они читают `--tm-card-columns` и `classList` с тела, и подмена на атрибут обёртки вернула бы пустую
строку и отсутствующий класс **без единой ошибки** — реальная проверка молча стала бы
ложно-зелёной. Проверено диффом: строки 25, 35, 43, 183 не сдвинулись даже номерами. По той же
причине не тронуты `:has([data-group-id])` в `helpers.ts`, `core.spec.ts` и `0006` (строки 178, 186)
— они не текстовые, задача выводит их из области.

**Индексы переключателей не поехали.** Задача 08 добавила в строку попапа поле имени
(`.tm-popup__group-title-input`) и две кнопки-стрелки (`.tm-popup__group-move-btn`) — ни один из них
не носит класс `.tm-popup__group-toggle`, поэтому `.first()` и `.nth(1)` по-прежнему означают
видимость и полную ширину. Проверено по разметке и подтверждено зелёным прогоном.

**Никакой карты «id → название».** Названия убраны как слой адресации целиком, а не заменены
константой в другом месте: `COLLAPSIBLE_GROUP_LABELS` и `COLLAPSIBLE_HEADER_TEXT` удалены,
`grep` по обоим именам пуст.

**Deviations:** нет. Диффом затронуты только локаторы и комментарии, описывавшие удалённый поиск;
`git diff --stat src/` пуст.

**Reviews** (облегчённый режим по указанию пользователя — два ревьюера вместо трёх, один раунд):
- dev-test-reviewer: passed, 0 critical / 0 major / 3 minor → [0011-feat-group-customization-task-09-dev-test-reviewer-review.json](0011-feat-group-customization-task-09-dev-test-reviewer-review.json)
- dev-code-reviewer: approved_with_suggestions, 0 critical / 0 major / 4 minor → [0011-feat-group-customization-task-09-dev-code-reviewer-review.json](0011-feat-group-customization-task-09-dev-code-reviewer-review.json)

Применена одна находка (ddaf1af): комментарий в `core.spec.ts` пересказывал собственный селектор —
переписан на «почему», как в двух других мигрированных местах. Остальные не применялись осознанно:
неиспользуемый импорт `expandGroup` в `0006` и непокрытый типами `tests/` преэкзистентны (CLAUDE.md
разрешает убирать только то, что осиротело от **своих** правок), а две находки о форме ассертов
требуют трогать ассерты — что задача прямо запрещает, и что принадлежит задаче 10.

**Наблюдения (в техдолг не идут, но полезны следующему):**
- **`tests/` не проверяется типами вообще** — `tsconfig.json` включает только `src/**`, отдельного
  конфига для тестов нет, Playwright транспилирует через esbuild без проверки типов. Расчёт задачи
  на то, что `GroupId` в сигнатуре хелпера превратит пропущенный вызов в ошибку компиляции, **в этом
  репозитории не работает**: опечатка в идентификаторе всё так же даст таймаут локатора. Аннотации
  оставлены как декларация намерения, полнота миграции подтверждена `grep`, а не компилятором.
  Прежняя запись задачи 08 о том же — в силе.
- **Два параллельных прогона Playwright дерутся за порт 5173.** `reuseExistingServer` включён, и тот
  прогон, что поднял стенд, гасит его на выходе — под соседним прогоном сервер исчезает и сыплется
  `net::ERR_CONNECTION_REFUSED`. Ровно это увидел один из ревьюеров (10 падений в `core.spec.ts`,
  сразу после — 35/35 и 84/84). Свойство стенда, не дефект кода: ревьюеров, которые гоняют набор,
  нельзя запускать одновременно.
- Ловушка со стилями (стенд копирует `src/styles.css` один раз на старте) в этой задаче не выстрелила
  — сервер поднимался с нуля, `diff src/styles.css tests/harness/styles.css` пуст, Сц.21 зелёная.

**Verification:**
- Базовый замер до правок: `npx playwright test` → **27 failed, 22 passed** по трём наборам,
  список ровно совпал с замером задачи 08 (15 в `0006`, 11 в `0007`, `TC-13` в `0008`);
  `core.spec.ts` — 35 passed, то есть волны 2–5 ничего сверх предсказанного не сломали
- `npx playwright test` → **84 passed, 0 failed, 0 skipped** (25.4s)
- `npm test` → 111 passed, 7 файлов (без изменений — задача не трогает unit-тесты)
- `npx tsc --noEmit` → чисто (как гейт для `tests/` не годится, см. выше)
- `grep -rn "hasText: '(Backlog|Focus|In Progress|Org Intentions|Delegated|Completed)'" tests/e2e/`
  → пусто; `grep -rn "COLLAPSIBLE_GROUP_LABELS|COLLAPSIBLE_HEADER_TEXT" tests/e2e/` → пусто
- `git diff --stat src/` → пусто
- Счёт сценариев по файлам: 17 + 16 + 16 + 35 = 84, как до задачи; ни одного `skip`/`fixme`/`only`
- Разовая проверка однозначности (временный сценарий, удалён): `[data-group-container]` → ровно 6,
  `[data-settings-group]` → ровно 6, `.tm-popup__group-row` → 7 (шесть групп + строка заметок,
  у которой атрибута нет)

## Task 10: Feature E2E acceptance suite

**Summary:** Создан `tests/e2e/0011-group-customization.spec.ts` — пятнадцать сценариев приёмки
фичи: названия, порядок, контракт поля названия (Decision 4), перетаскивание сразу после
перестановки, независимость досок, подсказка пустой группы. Порядок на доске везде проверяется
вычисленным `order` и экранной геометрией, а не индексом элемента (Decision 12); в попапе — наоборот,
последовательностью строк, потому что там она настоящая. Каждое утверждение прогнано негативным
контролем: 22 возмущения, все дали ожидаемый цвет.

**Отклонение от спека — один сценарий сверх четырнадцати.** Задача перечисляла Сц.1–Сц.14. Добавлен
**Сц.15** — стрелки у **скрытой** строки. Ни один из четырнадцати не нажимал стрелку на скрытой
строке, то есть буквальная ветка `findSwap` (скрытая группа меняется местами с непосредственным
соседом по списку) в браузер не попадала вообще: удали её из `groupOrderUtils.ts` — все четырнадцать
остаются зелёными. Сама логика покрыта unit-тестами намеренно (user-spec, «Testing strategy»), но
вторая половина критерия приёмки — «после возврата в видимые группа появляется на доске на заданной
позиции» — это утверждение о проводке, которое unit-тест сделать не может. Найдено ревью, добавлено
как минимальный сценарий на этот критерий.

**Ловушка внутри самого Сц.15.** Первая редакция прятала одну группу и двигала её. С единственной
скрытой строкой все её буквальные соседи видимые, и обе ветки дают одинаковый список — сценарий
проходил при удалённой ветке, то есть повторял ровно тот дефект, ради которого писался. Финальная
редакция прячет **две соседние** группы, поэтому первое нажатие приземляется на скрытого соседа —
чего ветка «перешагивания» не делает никогда.

**Перетаскивание (Сц.5) заведено настоящим вводом мыши.** `moveTask` в файле не встречается;
между перестановкой и перетаскиванием нет ни `goto`, ни `resetData`. Хелпер оказался нетривиальным:
каждый список, над которым проходит указатель, принимает карточку и перекомпоновывает доску, уводя
цель из-под курсора. Итоговая схема — дождаться ghost-класса (подтверждение, что библиотека взяла
жест), затем цикл «прицелиться → дать анимации осесть → проверить по DOM, в каком списке лежит узел».
Ожидание ghost-класса оказалось несущим: без него второе перетаскивание Сц.5 молча не стартовало,
а тест валился на «карточка не приехала» — диагностика указывала не на тот конец.

**Проверка сохранности — снимком, а не `page.goto`.** Харнесс стартует из `migrateData(null)` и
`localStorage` не читает. Снимок читается до `resetData` (тот первым делом удаляет ключ), а в Сц.9
после восстановления доска выбирается явно — `resetData` переключает активную на первую.

**Оговорка Сц.14 (записана, а не спрятана).** Буквальная проверка «после сохранения без правок смена
языка по-прежнему переводит заголовки» из E2E недостижима: харнесс жёстко ставит `en`
(`locale.set('en')`), а `updateSettings({language})` трогает только поле в сторе. Поэтому проверено
причинное условие — `title` пуст у всех шести групп активной доски, — при котором `resolveGroupTitle`
отдаёт локализованный дефолт; перевод при смене языка гарантируют unit-тесты задачи 05.

**Негативный контроль — 22 возмущения, все с ожидаемым результатом.** Обязательные из TDD Anchor:
- **Сц.5 без вызова перетаскивания — красный.** Это и есть доказательство, что зелёный результат
  вызван перетаскиванием, а не тем, что задача и так лежала где надо.
- **Сц.5 со сбросом на третью группу (`delegated` вместо `backlog`) — красный**: утверждение
  проверяет конкретного приёмника. Здесь всплыл настоящий дефект хелпера: первая редакция
  «доезжала» только до первого списка на пути и роняла карточку в `backlog`, а тест это не замечал.
- **Сц.5 без шага перестановки — зелёный**, **Сц.5 с перезагрузкой между перестановкой и
  перетаскиванием — тоже зелёный**. Второй и есть тот ложно-зелёный вариант, ради отличия от
  которого сценарий написан; в финальной версии перезагрузки нет.
- Сц.3 без сохранения, Сц.4 без нажатия стрелки, Сц.10 с названием в 5 символов, Сц.13 с
  переименованной контрольной группой, Сц.14 с одним явным названием — все красные.

Остальные: Сц.1 (пропуск переименования; отдельно — подложенный снимок, чтобы покраснела именно
половина «после перезагрузки»), Сц.2 (ожидание дефолта в `value`), Сц.6 (без сохранения; без
скрытия), Сц.7 (Save вместо Cancel), Сц.8 (Save вместо клика по оверлею), Сц.9 (доска B не
сохранена), Сц.11 (без переключения видимости перед стрелкой), Сц.12 (высокий вьюпорт), Сц.15 (без
нажатий; с одной скрытой группой вместо двух). Два возмущения — правкой `src/styles.css` с
перезапуском стенда (`white-space: nowrap` → `overflow-wrap: anywhere` для проверки переноса;
снятый `max-height: 80vh` для проверки «попап внутри экрана»), один — через `page.addStyleTag`
(`overflow: visible` для проверки, что заголовок не распирает строку). `src/styles.css` восстановлен,
`git status src/` пуст.

**Что переписано по ревью.** Три утверждения не отличали рабочий продукт от сломанного и заменены:
проверка прокрутки в Сц.12 пересказывала предикат, которым элемент и отбирался; проверка «правый
край заголовка внутри обёртки» в Сц.10 непобедима структурно (заголовок — первый элемент строки, его
бокс не может вылезти вправо) и заменена на переполнение самой строки заголовка; парные сравнения
рангов в Сц.3/4/9/11 заменены на сравнение всей видимой последовательности — пара позиций
удовлетворяется и лишними перемещениями в другом месте списка. `groupRanks` после этого остался без
вызывающих и удалён.

**Наблюдение в чужом коде (не чинили — задача пишет только тесты).** `freshDefaultData()` в
`src/data/migration.ts` копирует `DEFAULT_DATA` и `DEFAULT_DATA.boards[0]` поверхностным спредом,
поэтому возвращаемые данные делят с модульной константой `groups`, `hiddenGroups`, `tasks`,
`settings` и даже `id` доски — клонируется только `groupOrder` (у которого на этот счёт как раз
стоит комментарий). В плагине `migrateData(null)` вызывается один раз за загрузку, и это невидимо;
в харнессе `resetData()` вызывается многократно в одной странице, и название группы, записанное
предыдущим сохранением, переживает «чистый» сброс. Наткнулись на это, строя негативный контроль:
возмущение «восстановить из чистых данных вместо снимка» осталось зелёным именно поэтому. На
изоляцию тестов не влияет — каждый тест получает свою страницу, — но первый сценарий, который
вызовет `resetData(page)` дважды в одном тесте, на это наступит.

**Reviews** (облегчённый режим по указанию пользователя — два ревьюера вместо трёх, два раунда):
- dev-test-reviewer: round 1 needs_improvement (0 critical / 1 major / 11 minor) →
  [round 1](0011-feat-group-customization-task-10-dev-test-reviewer-review.json);
  round 2 needs_improvement (0 critical / 0 major / 8 minor) →
  [round 2](0011-feat-group-customization-task-10-dev-test-reviewer-review-round2.json)
- dev-code-reviewer: round 1 approved_with_suggestions (0 critical / 2 major / 9 minor) →
  [round 1](0011-feat-group-customization-task-10-dev-code-reviewer-review.json);
  round 2 approved_with_suggestions (0 critical / 1 major in-file / 6 minor) →
  [round 2](0011-feat-group-customization-task-10-dev-code-reviewer-review-round2.json)

Оба major из round 1 и major из round 2 закрыты. Не применялись осознанно: находка про
`freshDefaultData()` (чужой файл, задача не правит продукт — записана выше), предложения расширить
набор на disabled-стрелки, trim пробелов в названии и перетаскивание между двумя обычными группами
(за пределами списка сценариев задачи; первые два покрыты unit-тестами задач 03 и 04), а также
замечание про фиксированное ожидание 250 мс в хелпере перетаскивания — оно послеанимационное по
смыслу, что признаёт и сам ревьюер.

**Verification:**
- `npx playwright test tests/e2e/0011-group-customization.spec.ts` → **15 passed**
- `npx playwright test` → **99 passed, 0 failed** (84 прежних + 15 новых), стенд поднят с нуля,
  `diff src/styles.css tests/harness/styles.css` пуст
- `npm test` → 111 passed (unit-тесты не трогали), `npx tsc --noEmit` чисто, `npm run build` ok
- Негативный контроль: 22 возмущения, 22 совпадения с ожиданием
- `grep -n "nth(\|moveTask\|goto(\|toHaveValue(en\[" tests/e2e/0011-group-customization.spec.ts` →
  только `page.goto('/')` в `beforeEach` и одно упоминание в комментарии
- `git status --short src/` пуст — временные поломки из негативного контроля убраны
- Стабильность: набор прогонялся подряд, падений не было; отдельно перепроверен Сц.5

---

## Task 11: Pre-deploy QA

**Status:** Done
**Commit:** — (продуктовый код не менялся; `git status --porcelain src/ tests/` пуст)
**Agent:** основной агент

**Summary:** Приёмка фичи целиком на Node v22.23.1: `npm test` — 111/111 (набор раскладки доски
`tests/unit/boardLayoutUtils.test.ts` присутствует в выводе поимённо, 8 тестов, а не подразумевается
зелёной итоговой строкой), `npx tsc --noEmit` — пусто, `npx playwright test` — 99/99 по всем пяти
файлам сценариев (0006/0007/0008/0011/core), `npm run build` — `main.js` и `styles.css` пересобраны в
корне. Все 36 критериев (27 из user-spec, 9 из tech-spec) разобраны с именованными доказательствами:
31 passed, 4 failed, 1 not_verifiable, 0 critical. Полный отчёт —
[logs/working/qa-report.json](logs/working/qa-report.json).

**Phase 1 (Environment Rebuild) пропущена осознанно.** Скилл требует `Makefile`/`GNUmakefile` или
`docker-compose*`/`compose*` в корне; проверено — ни одного нет, это плагин Obsidian, а не сервис.
Докеризация не заводилась. Смысл фазы соблюдён иначе: порт 5173 проверен свободным до прогона
(`reuseExistingServer` не мог подцепиться к стенду со старой сборкой), артефакты сборки удалялись
перед `npm run build`, `diff src/styles.css tests/harness/styles.css` пуст.

**Два хрупких места проверены по устройству, а не по статусу.** В Сц.5 между `saveBoardSettings` и
`dragCardToGroup` нет ни `goto`, ни `resetData`, ни перезагрузки, перетаскивание идёт настоящим вводом
мыши, а не через `window.__test.moveTask`; выживание узлов измеряется JS-expando на всех обёртках и
телах. Все проверки порядка на доске построены на вычисленном `order` и геометрии — `domIndex`
участвует только как тай-брейкер при равных `order`, как и разрешает flex.

**Deviations:** Отклонений от спека нет. Итоговый `status` в отчёте — `failed` при нуле critical:
правило скилла «passed при нуле critical» здесь дало бы зелёный ярлык отчёту с четырьмя проваленными
критериями, что ввело бы team lead в заблуждение; обоснование записано в поле `statusRationale`.

**Tech debt:** Три критерия провалены исключительно отсутствием проверки — поведение реализовано и
читается в коде, но автоматизируемый критерий без теста по правилу задачи считается провалом, а не
«непроверяемым»: US-05 (одинаковые названия у двух групп), US-24 (строка приглушается сразу при
переключении видимости, до сохранения), US-25 (название в 40 символов прокручивается внутри поля
попапа — проверена только вторая половина, усечение в заголовке доски). Отсюда же провален агрегатный
TS-9. Плюс два minor: раскладка половинок после перестановки покрыта только unit-уровнем, и
перетаскивание после перестановки не гоняется между двумя обычными группами (отклонено осознанно в
записи Task 10). Продуктовых дефектов не найдено; лечится тремя небольшими правками тестов.

**Отложено на пользователя (`not_verifiable` и раздел «Пользователь проверяет»):** читаемость
приглушённых строк и новых элементов управления в светлой и тёмной темах (US-12 — механизм проверен
автоматически: класс в Сц.15 и `opacity: 0.5` в `src/styles.css:746`, читаемость — нет), отсутствие
визуальных провалов в сетке после перестановки, понятность попапа без документации, настоящий
перезапуск Obsidian и открытие доски, созданной до обновления, а также ручной прогон перетаскивания
сразу после перестановки с участием «Бэклога» и «Выполнено». Шаги проверки перечислены в
`deferredToPostDeploy` отчёта.

**Verification:**
- `npm test` → 111 passed, 7 файлов, 0 failed / 0 skipped, exit 0
- `npx tsc --noEmit` → вывод 0 байт, exit 0
- `npx playwright test` → 99 passed (0006: 17, 0007: 16, 0008: 16, 0011: 15, core: 35), exit 0
- `npm run build` → exit 0, `main.js` (133561 B) и `styles.css` (21016 B) в корне
- `node -v` → v22.23.1 против `engines: ^22.12.0 || >=24.0.0` и `.nvmrc: 22.23.1`
- `logs/working/qa-report.json` парсится, 36 записей критериев, у каждой непустое доказательство
- `git status --porcelain src/ tests/` → пусто

---

## Task 12: Закрытие пробелов приёмки (US-05, US-24, US-25)

**Status:** Done
**Agent:** основной агент

**Summary:** Три критерия, помеченных приёмкой как `failed` из-за отсутствия проверки, закрыты
сценариями в `tests/e2e/0011-group-customization.spec.ts`. Продуктовый код не менялся —
`git diff --stat src/` пуст. Прогон E2E вырос с 99 до 102, набор 0011 — с 15 до 18 сценариев;
существующие сценарии не правились и ни один ассерт не ослаблен.

- **Сц.16 (US-05)** — двум группам задаётся одно и то же название: сохранение проходит, обе группы
  остаются на доске в своём порядке, обе показывают общее название, в сторе лежат два независимых
  `title`, остальные четыре группы не задеты, при переоткрытии попапа дубль на месте.
- **Сц.17 (US-24)** — строка приглушается сразу по клику чекбокса: класс появляется до сохранения,
  вычисленный `opacity` строки падает ниже 1, соседняя строка остаётся нетронутой, а доска позади
  попапа и `hiddenGroups` в сторе не меняются — это и отличает «немедленно» от «после сохранения».
  Обратное переключение возвращает строку так же немедленно.
- **Сц.18 (US-25, первая половина)** — название в 40 символов в поле попапа: текст не помещается в
  поле, поле реально прокручивается внутри себя, и при этом не вылезает за свою ячейку сетки, не
  распирает строку и не заставляет попап прокручиваться вбок.

**Решение по форме проверок.** Отсутствие предупреждения в Сц.16 проверяется не `toHaveCount(0)` на
угаданном имени класса (такая проверка зелена на любом продукте), а сравнением `textContent` и числа
элементов попапа до и после появления дубля: значение поля ввода не входит в `textContent` и не
добавляет элемент, поэтому предупреждение любой формы обязано сдвинуть одну из двух величин.

**Решение по замерам в Сц.18.** Вложенность меряется по ячейке `.tm-popup__group-name`, а не только
по строке: `scrollWidth` строки в Chromium не отражает переполнение грид-ячейки, пока поле не
выходит за правый край самой строки, — так что проверка на уровне строки одна не отличила бы
рабочую вёрстку от сломанной. Из сценария убраны замеры, которые не могут покраснеть в принципе:
высота строки и ширина поля до/после ввода (`<input>` не переносится и не растёт по содержимому,
поэтому эти величины совпадают и на исправном, и на сломанном продукте).

**Доказательство падаемости.** Каждый сценарий прогонялся под возмущением продукта, после чего
возмущение откатывалось (`git diff --stat src/` пуст):
- Сц.16 / предупреждение: в `BoardSettingsPopup.svelte` добавлены детектор дублей и блок с текстом
  — красный на сравнении `textContent`. Отдельно, без блока, только `canSave && !hasDuplicateTitles`
  — красный на `toBeEnabled` кнопки «Сохранить».
- Сц.17 / привязка к сохранённому состоянию: `class:tm-popup__group-row--hidden` переведён на
  `board.hiddenGroups` — Сц.17 красный, Сц.15 при этом зелёный (ровно тот пробел, который она не
  ловила). Отдельно `opacity: 0.5` → `opacity: 1` в `src/styles.css` — красный на замере прозрачности.
- Сц.18 / рост поля: `min-width: 0` → `min-width: 40ch` у `.tm-popup__group-title-input` — красный на
  переполнении ячейки; `min-width: 100ch` — красный на «тексту есть куда прокручиваться».
  Переполнение строки и попапа замерено под возмущением `min-width: 23rem` у
  `.tm-popup__group-name` (строка 408 против 378, попап 428 против 418).

**Ловушка стенда.** Стенд копирует `src/styles.css` в `tests/harness/styles.css` один раз при старте
сервера, поэтому все возмущения стилей проверялись при свободном порту 5173 — Playwright поднимал
сервер сам и забирал свежую копию. Совпадение копии проверялось `grep` по `tests/harness/styles.css`.

**Verification:**
- `npx playwright test` → 102 passed, 0 failed, exit 0 (было 99; 0011: 18 сценариев)
- повторный `npx playwright test` → 102 passed, без flaky
- `npm test` → 111 passed, 7 файлов, exit 0
- `npx tsc --noEmit` → вывод пуст, exit 0
- `git diff --stat src/` → пусто, продуктовый код не изменён

---

## Task 12: Documentation update

**Status:** Done
**Commits:** 47a2163, 308e78c, 708e9b4
**Agent:** основной агент

**Summary:** `docs/technical.md` приведён к тому, что реально поставлено: версия схемы 8 в примере
`data.json` и в интерфейсах, поля `Group.title` и `Board.groupOrder`, миграция 7 → 8, санация обоих
полей на каждой загрузке вне версионных веток, два новых раздела — «Пользовательские названия групп»
и «Порядок групп на доске» (отрисовка через CSS-свойство `order`, шесть литеральных `{#if}`-блоков и
причина, три тестовых атрибута, известное ограничение порядка обхода), дополнены разделы про попап
настроек доски, структуру проекта и таблицу ключевых решений. Дополнительный объём: `README.md` и
`README.ru.md` приведены к фактическому требованию Node, `docs/testing/infrastructure.md` — к
фактическому составу тестов и к способу запуска на машине разработчика. `CHANGELOG.md` и
`CHANGELOG.ru.md` получили согласованные записи в стиле соседних.

**Что документировано по коду, а не по спеке.** Все числа, имена и значения взяты из исходников
после Task 10, не из tech-spec: предел названия 40 (`GROUP_TITLE_MAX_LENGTH` в `migration.ts` и
`maxlength` в попапе), `order: 100` у секции заметок, `opacity: 0.5` у скрытой строки,
`max-height: 80vh` у попапа, имена трёх атрибутов, порядок `trim()` → обрезка по длине.

**Расхождения реализации со спекой (реализация описана, спека не правилась):**
- Tech-spec формулирует разрешение названия как `group.title || $groupLabels[groupId]`; реализация
  (`src/ui/groupTitle.ts`) проверяет `storedTitle.trim() !== ''`, поэтому на дефолт откатывается и
  название из одних пробелов. Реализация строже и согласована с той же проверкой в `EmptyState.svelte`.
- Decision 7 фиксирует асимметрию: `hiddenGroups`, в отличие от `groupOrder`, не проверяется вовсе.
  Реализация асимметрию частично закрыла — `sanitizeHiddenGroups()` в `src/ui/groupOrderUtils.ts`
  санирует список на границе попапа. На загрузке `hiddenGroups` по-прежнему не проверяется, как и
  сказано в спеке.
- Санация в описании спеки идёт «после миграции»; в коде блок стоит после всех версионных веток и
  выполняется при любой версии данных, включая уже мигрированную. В документе описано второе.

**Найденный, но не исправленный дрейф документации** (вход для следующей фичи, за пределами правимых
блоков):
- В `CHANGELOG.md` и `CHANGELOG.ru.md` отсутствует фича версии схемы 6 — `settings.cardLayout`,
  мультиколоночный лейаут карточек — ни в `Added`, ни в `Changed`, ни в одном из двух языков.
  Пропущена и сама фича, и смена версии. Не чинилось: задача документирует фичу 0011.
- `docs/overview.md` не описывает ни переименование групп, ни их порядок; в перечне возможностей
  попапа настроек доски (строка 237) их тоже нет. Продуктовая документация в задачу не входила.
- Листинг `migrateData()` в техдоке остаётся упрощённым: ветки `< 2`, `< 3`, `< 5` в нём не
  показаны. Задача санкционировала добавление только ветки `< 8`, поэтому упрощение сохранено —
  но это дрейф.
- Таблица хелперов в `docs/testing/infrastructure.md` не упоминает `resetData`, `fillTaskForm`,
  `waitForToast`, `saveGroupSettings`, которые есть в `tests/e2e/helpers.ts`.
- Дерево Svelte-компонентов в разделе «Архитектура компонентов» не содержит `NotesSection.svelte`
  (правилась только строка про `BoardSettingsPopup`).

**Находки в коде (зафиксированы, не чинились):**
- Путь загрузки не тотален относительно руками испорченного `data.json`: `cleanupCompletedTasks()`
  (`src/data/cleanup.ts:4`) читает `board.groups.completed.completedRetentionDays` фиксированным
  путём и на доске с удалённой группой `completed` роняет плагин до отрисовки. Санитайзеры
  восстанавливают идентификатор в порядке, но не сам объект группы. Нужен владелец — это не
  дефект фичи 0011, а общее свойство пути загрузки. В техдоке ограничение названо честно.
- Каталог `tests/` целиком вне области `npx tsc --noEmit`: `tsconfig.json` включает только `src/**`.
  Состояние существовало и раньше, после переноса `boardLayoutUtils.test.ts` распространилось на все
  семь файлов. Возврат статической проверки для тестов — отдельное решение.
- `freshDefaultData()` в `src/data/migration.ts` копирует `DEFAULT_DATA` поверхностным спредом и
  делит с модульной константой `groups`, `hiddenGroups`, `tasks`, `settings` и `id` доски
  (клонируется только `groupOrder`). В плагине невидимо — `migrateData(null)` вызывается раз за
  загрузку; первый сценарий, который вызовет служебный сброс дважды в одном тесте, на это наступит.
  Повтор находки из Task 10, оставлен как открытый.

**Правки за пределами фичи, сделанные осознанно:** внутри правимых блоков содержимое приведено к
`src/data/types.ts` — в примере `data.json` и интерфейсах появились `fullWidth`, `notes`,
`notesCollapsed` (долг фич 0005 и 0007), в объединение `Status` добавлен пропущенный `'meeting'`
(долг фичи 0004), в «Структуре проекта» — `boardLayoutUtils.ts`, каталог `tests/` и конфиги.
Оставлять заведомо неверный текст в строках, которые всё равно редактируются, значит сохранять ложь.

**Reviews** (один ревьюер, один раунд — по указанию оркестратора):
- dev-code-reviewer: round 1 approved_with_suggestions (0 critical / 2 major / 5 minor) →
  [round 1](0011-feat-group-customization-task-12-dev-code-reviewer-review.json)

Оба major закрыты: снят ложный превосходный оборот про «единственные поля, проверяемые на каждой
загрузке» (второй безусловный доводчик — подстановка `settings.cardView`), и написана эта запись.
Из minor применены все четыре: уточнено, что строки попапа идут по порядку за вычетом
идентификаторов без объекта группы; названа функция, которую попап действительно вызывает
(`moveGroupWithinPresent`); в обеих версиях CHANGELOG различено поведение стрелки у видимой и у
скрытой строки; в «Структуру проекта» добавлены `docs/features/` и `docs/screenshots/`. Плюс
добавлено предупреждение, что имена `migrateVNtoVM` в техдоке — приём изложения, а не реальные
символы.

**Verification:**
- `grep -nE "groupOrder|\btitle\b" docs/technical.md` → оба новых поля видны (команда из `verify`)
- `grep -n "groupOrder" docs/technical.md` → встречается в примере `data.json`, в интерфейсе `Board`,
  в разделе миграции и в разделе про порядок отрисовки
- `grep -n '"version": 8|version = 8|версии 8|< 8' docs/technical.md` → версия поднята и в примере,
  и в разделе миграции
- `grep -n "data-group-container|data-settings-group|data-group-id" docs/technical.md` → все три
  атрибута описаны в одной таблице с причиной разделения
- `grep -n "SortableJS" docs/technical.md` → обоснование через сохранение инстансов присутствует в
  разделе про порядок групп
- `npx playwright test --list` → 102 теста в 5 файлах (0006: 17, 0007: 16, 0008: 16, 0011: 18,
  core: 35) — числа в `docs/testing/infrastructure.md` совпадают
- `npx vitest run` → 111 passed, 7 файлов, ~300 мс — числа в таблице unit-тестов совпадают
- `node -v` → v22.23.1 против `engines: ^22.12.0 || >=24.0.0` в `package.json` и `.nvmrc` — записи в
  обоих README совпадают с фактическим требованием
- `git diff --stat src/ tests/` → пусто: задача не трогала ни продуктовый код, ни тесты
