---
status: planned                    # planned -> in_progress -> done
depends_on: []                     # ID задач-зависимостей (строки: ["01", "02"])
wave: 1                            # волна параллельного выполнения
skills: [infrastructure-setup]     # МАССИВ скиллов для загрузки
verify: bash                       # инструмент верификации (опционально: curl, bash, user)
reviewers: [dev-infrastructure-reviewer, dev-code-reviewer, dev-security-auditor]
teammate_name:                     # имя агента-исполнителя (опционально; если не задано — генерируется по описанию задачи)
---

# Task 01: Test infrastructure and Node pin

## Required Skills

Перед выполнением задачи загрузи:
- `/skill:infrastructure-setup` — [skills/infrastructure-setup/SKILL.md](~/.claude/skills/infrastructure-setup/SKILL.md)

## Description

Юнит-тесты проекта сейчас не запускаются вообще. На машине установлен Node 18.19.1, а
установленный vitest 4.0.18 тянет vite 7.3.1, чей CJS-мост под Node 18 падает на
`ERR_REQUIRE_ESM` при загрузке `vitest.config.ts`. Это не единичная поломка теста — падает
сам старт раннера, поэтому ни одна из последующих задач фичи не может быть проверена.

Вторая проблема: `vitest.config.ts` собирает только `tests/unit/**/*.test.ts`, а файл
`src/ui/boardLayoutUtils.test.ts` лежит в `src/` и в набор не попадает. Пять тестов
`computeGroupClasses` формально существуют, но никогда не выполняются. Фича 0011 переиспользует
`computeGroupClasses` без изменений (Task 07 передаёт в неё массив, предварительно отсортированный
по `groupOrder`), поэтому эти тесты нужны как страховка от регрессии — и должны реально идти.

Задача Wave 0: закрепить требуемую версию Node в самом репозитории (`engines` в `package.json`
и `.nvmrc`, порог `>= 22.12`) и перенести боард-лейаут тест в `tests/unit/`, чтобы он собирался
существующим `include`.

Порог 22.12 — пересечение трёх ограничений, проверенных по установленным пакетам:
- `vitest@4.0.18` → `engines.node: ^20.0.0 || ^22.0.0 || >=24.0.0`
- `vite@7.3.1` (транзитивная зависимость vitest) → `engines.node: ^20.19.0 || >=22.12.0`
- `npm@11.13.0` → поддерживает `^20.17.0 || >=22.9.0`

Линия 23.x исключена сознательно — vitest объявляет её неподдерживаемой. Ветка 20.x технически
проходит (от 20.19), но по Decision 8 в спеке закреплена одна поддерживаемая ветка, чтобы не
удваивать поверхность верификации.

**КРИТИЧНО — это блокирующая задача, а не задача «сделать так, чтобы позеленело».** Обновление
Node выполняется на машине разработчика, вне репозитория. Если фактическая версия Node ниже
22.12 — остановись и доложи блокер. Откат vitest/vite до версий, совместимых с Node 18, —
сознательно отвергнутая альтернатива (Decision 8): она закрепила бы проект на рантайме вне
поддержки. Любой другой обход (пропуск конфига, `--no-config`, отключение `engines`,
`.npmrc` с `engine-strict=false`, переписывание `vitest.config.ts` в CJS ради Node 18)
— тоже обход, и делать его нельзя.

## What to do

1. **Первым шагом** проверить фактическую версию рантайма: `node -v`.
   - Если версия `>= 22.12` — продолжать со шага 2.
   - Если версия ниже — **остановиться**. Не менять файлы «на будущее», не подгонять пакеты.
     Доложить блокер: текущая версия, требуемый порог, и что обновление Node выполняется
     разработчиком вне репозитория (Decision 8). Задача остаётся `in_progress`/blocked.
2. Закрепить порог версии в `package.json` — поле `engines` с требованием Node `>= 22.12`.
   Поле добавляется как новое, остальной манифест не трогается.
3. Создать `.nvmrc` в корне репозитория с конкретной версией линии 22 не ниже 22.12,
   чтобы `nvm use` подхватывал её автоматически.
4. Перенести `src/ui/boardLayoutUtils.test.ts` в `tests/unit/boardLayoutUtils.test.ts`
   средствами git (`git mv`), чтобы история файла сохранилась. Исходный файл в `src/ui/`
   после переноса не остаётся.
5. Починить относительные импорты в перенесённом файле под новое расположение — так же, как
   это сделано в соседних файлах `tests/unit/`.
6. Убедиться, что `vitest.config.ts` собирает перенесённый файл существующим паттерном
   `tests/unit/**/*.test.ts`. Менять конфиг только если это фактически необходимо; если паттерн
   уже покрывает файл — оставить конфиг без изменений и зафиксировать это в отчёте.
7. Запустить `npm test` и убедиться, что раннер стартует и в вывод попадают все четыре файла,
   включая перенесённый.

## TDD Anchor

Новых тестов эта задача не пишет — переносятся уже существующие. Проверяемый результат
задачи — сам факт, что набор запускается и собирает перенесённый файл:

- `tests/unit/boardLayoutUtils.test.ts` — 5 существующих тестов `computeGroupClasses`
  (все `--full`; шесть `--half`; `[half, half, half]` → последний `--half-alone`;
  `[full, half, full, half]` → оба half становятся `--half-alone`; одна видимая
  half-группа → `--half-alone`) выполняются и проходят без изменения их содержимого.
- `tests/unit/cleanup.test.ts`, `tests/unit/migration.test.ts`,
  `tests/unit/statusTransitions.test.ts` — продолжают собираться и проходить.

Ожидание: `npm test` показывает 4 тестовых файла вместо текущего нуля (сейчас раннер
падает до сбора файлов).

## Acceptance Criteria

- [ ] Первым действием задачи проверена фактическая версия Node; при версии ниже 22.12
      задача остановлена с докладом о блокере, без изменений в пакетах
- [ ] `package.json` содержит поле `engines` с порогом Node `>= 22.12`
- [ ] В корне репозитория есть `.nvmrc` с версией линии 22 (не ниже 22.12)
- [ ] Файл `src/ui/boardLayoutUtils.test.ts` отсутствует; тест живёт в
      `tests/unit/boardLayoutUtils.test.ts`
- [ ] Перенос сделан через `git mv` — `git log --follow` по новому пути показывает историю
- [ ] Импорты в перенесённом файле указывают на `../../src/ui/boardLayoutUtils` и
      `../../src/data/types`
- [ ] Содержимое тестов (набор кейсов, ожидания) не изменено — правились только пути импортов
- [ ] `npm test` завершается успешно и собирает 4 тестовых файла, включая перенесённый
- [ ] Версии `vitest`, `vite`, `@playwright/test` и остальных зависимостей в `package.json`
      не менялись
- [ ] `npm run build` по-прежнему проходит

## Context Files

**Feature artifacts:**
- [0011-feat-group-customization.md](docs/features/0011-feat-group-customization/0011-feat-group-customization.md) — user-spec
- [0011-feat-group-customization-tech-spec.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-tech-spec.md) — tech-spec (Decision 8, Risks, Agent Verification Plan)
- [0011-feat-group-customization-decisions.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-decisions.md) — decisions log
- [0011-feat-group-customization-code-research.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-code-research.md) — исследование кодовой базы

**Project knowledge:**
Каталога `.claude/skills/project-knowledge/` в этом проекте нет — роль project knowledge
выполняют документы в репозитории:
- [CLAUDE.md](CLAUDE.md) — конвенции проекта, структура, команды сборки и тестирования
- [docs/overview.md](docs/overview.md) — продуктовый контекст
- [docs/technical.md](docs/technical.md) — технические решения, стек, тестовая инфраструктура

**Code files:**
- [package.json](package.json) — добавить `engines`; версии зависимостей не трогать
- [.nvmrc](.nvmrc) — создать
- [vitest.config.ts](vitest.config.ts) — проверить `include`; менять только при необходимости
- [src/ui/boardLayoutUtils.test.ts](src/ui/boardLayoutUtils.test.ts) — источник переноса, удаляется
- [tests/unit/boardLayoutUtils.test.ts](tests/unit/boardLayoutUtils.test.ts) — результат переноса
- [src/ui/boardLayoutUtils.ts](src/ui/boardLayoutUtils.ts) — тестируемый модуль, не меняется
- [tests/unit/cleanup.test.ts](tests/unit/cleanup.test.ts) — образец импортов в `tests/unit/`
- [playwright.config.ts](playwright.config.ts) — читать: убедиться, что E2E-конфиг не задет
- [esbuild.harness.mjs](esbuild.harness.mjs) — читать: убедиться, что харнесс не задет

## Verification Steps

1. `node -v` — версия `>= 22.12` (строго; 23.x не годится). Если ниже — стоп и доклад блокера.
2. `npm test` — раннер стартует без `ERR_REQUIRE_ESM`, в выводе 4 тестовых файла,
   среди них `tests/unit/boardLayoutUtils.test.ts`, все тесты зелёные.
3. `ls src/ui/boardLayoutUtils.test.ts` — файла нет.
4. `git log --follow --oneline tests/unit/boardLayoutUtils.test.ts` — видна история до переноса.
5. `git diff` по `package.json` — изменение затрагивает только добавленный блок `engines`.
6. `npm run build` — сборка проходит.
7. `npx playwright test tests/e2e/core.spec.ts` — E2E-набор не сломан переносом
   (опционально, если Node уже обновлён и браузеры установлены).

## Details

**Files:**
- `package.json` — сейчас содержит `scripts` (`test: vitest run`, `test:unit`, `test:harness`,
  `test:e2e`, `test:e2e:ui`, `test:all`), `devDependencies` (в т.ч. `vitest ^4.0.18`,
  `@playwright/test ^1.50.0`) и `dependencies` (`sortablejs`). Поля `engines` нет — добавить.
  Ничего больше не менять: секции скриптов и зависимостей остаются как есть.
- `.nvmrc` — отсутствует, создать в корне.
- `vitest.config.ts` — сейчас: `environment: 'node'`, `include: ['tests/unit/**/*.test.ts']`.
  После переноса файл попадает под существующий паттерн, изменение конфига скорее всего
  не требуется.
- `src/ui/boardLayoutUtils.test.ts` — 5 тестов `computeGroupClasses`, импорты
  `from './boardLayoutUtils'` и `from '../data/types'`. Оба относительных пути ломаются
  при переносе и должны быть переписаны на `../../src/ui/boardLayoutUtils` и
  `../../src/data/types` (ровно тот стиль, что в `tests/unit/cleanup.test.ts` и
  `tests/unit/migration.test.ts`).

**Dependencies:**
- Задач-предшественников нет — это Wave 0, она блокирует все остальные задачи фичи.
- Новых npm-пакетов не добавляется. Версии существующих не меняются.
- Внешнее предусловие вне репозитория: Node `>= 22.12` на машине разработчика.

**Edge cases:**
- **Node ниже 22.12** — основной сценарий на сегодня (фактически стоит 18.19.1). Останов
  и доклад, а не обход. См. Description.
- **Node линии 23.x** — формально `>= 22.12`, но vitest её не поддерживает. Если рантайм
  окажется 23.x, это тоже блокер: доложить и не продолжать.
- **`engines` и строгость** — не добавлять `engine-strict` в `.npmrc`. Поле `engines`
  здесь документирует и предупреждает, а не ужесточает установку; вводить жёсткий гейт
  эта задача не просила.
- **Область `tsc --noEmit`** — `tsconfig.json` включает только `src/**/*.ts` и
  `src/**/*.svelte`. Сейчас тест-файл лежит в `src/` и попадает под проверку типов; после
  переноса он уходит из области `tsc`, как и остальные тесты в `tests/unit/`. Это ожидаемое
  и согласованное с проектом поведение, а не потеря покрытия — зафиксируй в отчёте.
- **Два пре-существующих типовых error'а** — `npx tsc --noEmit` сейчас падает на
  `'boardSettings.notes'` в `src/i18n/en.ts` и `src/i18n/ru.ts`. Это долг фичи 0009,
  его чинит Task 02 (Decision 9). В этой задаче их **не трогать**; для приёмки Task 01
  `tsc` не является гейтом.
- **Артефакты сборки в git** — `.gitignore` содержит `/main.js` и `/styles.css` с ведущим
  слэшем именно чтобы не игнорировать `src/styles.css`. Ничего в `.gitignore` не менять.
- **Пустой `test-results/`** — каталог игнорируется, на задачу не влияет.

**Implementation hints:**
- Порог в `engines` формулируется как ограничение, а не как точная версия — конкретную
  версию фиксирует `.nvmrc`.
- `git mv` предпочтительнее пары «создать новый + удалить старый»: сохраняет историю и
  делает ревью диффа тривиальным (видно, что содержимое тестов не правилось, кроме импортов).
- Проверить, что после переноса в `src/ui/` не осталось других `*.test.ts` —
  на момент планирования это был единственный такой файл.
- Не переименовывать тест-файл и не переписывать русскоязычные названия кейсов внутри него:
  задача про инфраструктуру, а не про содержимое тестов.
- Ожидаемый вывод `npm test` после починки — 4 файла и суммарно порядка двух десятков
  тестов; точное число не фиксируй как критерий, важен факт сбора перенесённого файла.

## Reviewers

- **dev-infrastructure-reviewer** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-01-dev-infrastructure-reviewer-review.json`
- **dev-code-reviewer** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-01-dev-code-reviewer-review.json`
- **dev-security-auditor** → `docs/features/0011-feat-group-customization/0011-feat-group-customization-task-01-dev-security-auditor-review.json`

## Post-completion

- [ ] Записать краткий отчёт в [0011-feat-group-customization-decisions.md](docs/features/0011-feat-group-customization/0011-feat-group-customization-decisions.md) (Summary: 1-3 предложения, ревью со ссылками на JSON, без таблиц файндингов и дампов)
- [ ] Зафиксировать фактическую версию Node, на которой прошла верификация
- [ ] Если отклонились от спека — описать отклонение и причину
- [ ] Обновить user-spec/tech-spec если что-то изменилось
