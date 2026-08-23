# Air Conditioner Card (IR/Broadlink)

[🇺🇦 Українська](#українська) | [🇬🇧 English](#english) | [🇷🇺 Русский](#русский)

Universal Home Assistant Lovelace card for controlling an air conditioner via
an IR remote (Broadlink `remote.send_command` / `remote.learn_command`).
Seven-segment display look: large temperature, clock, room/outdoor sensors,
ON/OFF, a second mode button (TURBO/ECO/custom name), 4 timer presets + a
manual timer with a configurable step, +/- temperature buttons.

All entities are optional except the IR remote itself (needed only to
actually send commands — without it the card still renders and can be
positioned/styled).

---

## Українська

### Можливості
- **Візуальний редактор** з вкладками: Сутності, Кнопки та IR-коди, Таймери,
  Позиція, Вигляд — жодного ручного YAML не потрібно для базового
  налаштування.
- **Навчання IR-кодів**: кнопка "📡 Навчити" біля кожного поля коду викликає
  `remote.learn_command`, чекає сигнал зі звичайного пульта (до ~15 с) і сама
  підставляє отриманий код.
- **Мультимовний інтерфейс** (uk / en / ru) — перемикач мови вгорі редактора,
  над вкладками. Переклад застосовується одразу — і в самому редакторі, і на
  картці (підписи таймера, одиниці вимірювання тощо).
- **Перетягування елементів мишею/пальцем** на вкладці "Позиція": живе
  прев'ю картки з рамками поверх кожного елемента — тягнеш і елемент
  рухається в реальному часі. Числові повзунки X/Y лишились поруч як точний
  резервний варіант.
- **Зміна розміру елементів** кнопками "−/+" прямо на рамці елемента (або в
  списку нижче) — від 40% до 300% від базового розміру.
- Серверні `timer.*` та `input_number.*` helper-и — температура і таймер
  сну переживають перезавантаження вкладки браузера (не зберігаються
  локально).
- Опційний контактний/силовий датчик — картка сама розуміє, що кондиціонер
  працює, і показує відповідні іконки та анімації.

### Встановлення

**HACS (рекомендовано)**
1. HACS → Frontend → ⋮ → Custom repositories → додайте
   `https://github.com/kdinya/ha-ir-ac-control`, категорія **Lovelace**.
2. Встановіть "Air Conditioner Card (IR/Broadlink)".
3. Картка одразу з'явиться у списку карток при додаванні в дашборд —
   вручну прописувати YAML не потрібно.

**Вручну**
1. Скопіюйте `air-conditioner-card.js` у `/config/www/ha-ir-ac-control/`.
2. Додайте ресурс: Налаштування → Панелі приладів → Ресурси →
   `/local/ha-ir-ac-control/air-conditioner-card.js`, тип **JavaScript Module**.

### Рекомендовані helper-и

```yaml
input_number:
  ac_card_temp:
    name: AC Card — температура
    min: 16
    max: 30
    step: 1

timer:
  ac_card_sleep:
    name: AC Card — таймер сну
```

Виберіть їх на вкладці **Сутності** редактора (`temp_helper`,
`timer_helper`). Без них картка працює, але температура/таймер скидаються
при перезавантаженні вкладки браузера.

### Шрифт Seg7

Покладіть `.woff` файл семисегментного шрифту за шляхом, вказаним у
`font_path` (за замовчуванням
`/local/community/ha-ir-ac-control/fonts/7segment.woff`), або змініть шлях
на вкладці "Вигляд".

### Конфігурація (приклад)

```yaml
type: custom:air-conditioner-card
lang: uk
remote_entity: remote.broadlink
device: air_conditioner
binary_sensor: binary_sensor.ac_contact
room_temp_sensor: sensor.room_temperature
room_humidity_sensor: sensor.room_humidity
weather_entity: weather.home
outdoor_secondary: wind
temp_helper: input_number.ac_card_temp
timer_helper: timer.ac_card_sleep
default_temp: 24
temp_min: 16
temp_max: 30
mode2_name: TURBO
mode2_temp: 24
timer_presets: [30, 60, 90, 120]
timer_step: 5
aspect_ratio: 1.72/1
offset_main_temp_scale: 1
commands:
  'on': 'JgDuAF4A...'
  'off': 'JgBkAV4A...'
  '16': 'JgDuAF4A...'
  '17': 'JgDuAF4A...'
  mode2_on: 'JgDuAF0A...'
  mode2_off: 'JgDuAF8A...'
```

### Що далі (ідеї для наступних версій)

- Валідація конфігу з попередженнями прямо в редакторі
- Експорт/імпорт таблиці IR-кодів (JSON) для перенесення між кондиціонерами
- Підтримка кількох кондиціонерів в одному helper-пакеті/blueprint
- Автоматичне визначення протоколу пульта (raw vs pronto vs named commands)

---

## English

### Features
- **Visual editor** with tabs: Entities, Buttons & IR codes, Timers,
  Position, Appearance — no manual YAML needed for basic setup.
- **IR code learning**: a "📡 Learn" button next to every code field calls
  `remote.learn_command`, waits for a signal from your physical remote
  (up to ~15s) and fills the field automatically.
- **Multilingual interface** (uk / en / ru) — a language switcher at the
  top of the editor, above the tabs. Translation applies immediately, both
  in the editor and on the card itself (timer labels, units, etc.).
- **Drag elements with mouse/touch** on the "Position" tab: a live card
  preview with handles over every element — drag to move it in real time.
  Numeric X/Y sliders remain next to it as a precise fallback.
- **Resize elements** with "−/+" buttons right on the element's handle (or
  in the list below) — from 40% to 300% of the base size.
- Server-side `timer.*` and `input_number.*` helpers — temperature and the
  sleep timer survive a browser tab reload (nothing is stored locally).
- Optional contact/power sensor — the card detects the AC is running and
  shows matching icons/animations on its own.

### Installation

**HACS (recommended)**
1. HACS → Frontend → ⋮ → Custom repositories → add
   `https://github.com/kdinya/ha-ir-ac-control`, category **Lovelace**.
2. Install "Air Conditioner Card (IR/Broadlink)".
3. The card shows up right away in the card picker when adding it to a
   dashboard — no manual YAML resource needed.

**Manual**
1. Copy `air-conditioner-card.js` to `/config/www/ha-ir-ac-control/`.
2. Add a resource: Settings → Dashboards → Resources →
   `/local/ha-ir-ac-control/air-conditioner-card.js`, type **JavaScript Module**.

### Recommended helpers

```yaml
input_number:
  ac_card_temp:
    name: AC Card temperature
    min: 16
    max: 30
    step: 1

timer:
  ac_card_sleep:
    name: AC Card sleep timer
```

Pick them on the editor's **Entities** tab (`temp_helper`, `timer_helper`).
Without them the card still works, but temperature/timer reset on a browser
tab reload.

### Seg7 font

Place the seven-segment `.woff` file at the path set in `font_path`
(default `/local/community/ha-ir-ac-control/fonts/7segment.woff`), or change
the path on the "Appearance" tab.

### Configuration example

```yaml
type: custom:air-conditioner-card
lang: en
remote_entity: remote.broadlink
device: air_conditioner
binary_sensor: binary_sensor.ac_contact
room_temp_sensor: sensor.room_temperature
room_humidity_sensor: sensor.room_humidity
weather_entity: weather.home
outdoor_secondary: wind
temp_helper: input_number.ac_card_temp
timer_helper: timer.ac_card_sleep
default_temp: 24
temp_min: 16
temp_max: 30
mode2_name: TURBO
mode2_temp: 24
timer_presets: [30, 60, 90, 120]
timer_step: 5
aspect_ratio: 1.72/1
commands:
  'on': 'JgDuAF4A...'
  'off': 'JgBkAV4A...'
  '16': 'JgDuAF4A...'
  '17': 'JgDuAF4A...'
  mode2_on: 'JgDuAF0A...'
  mode2_off: 'JgDuAF8A...'
```

### Roadmap ideas
- In-editor config validation warnings
- Export/import the IR code table (JSON) to move it between AC units
- Multi-AC support sharing one helper package/blueprint
- Auto-detect remote protocol (raw vs pronto vs named commands)

---

## Русский

### Возможности
- **Визуальный редактор** с вкладками: Сущности, Кнопки и IR-коды, Таймеры,
  Позиция, Вид — ручной YAML не нужен для базовой настройки.
- **Обучение IR-кодам**: кнопка "📡 Обучить" рядом с каждым полем кода
  вызывает `remote.learn_command`, ждёт сигнал с обычного пульта (до ~15 с)
  и сама подставляет полученный код.
- **Многоязычный интерфейс** (uk / en / ru) — переключатель языка вверху
  редактора, над вкладками. Перевод применяется сразу — и в редакторе, и на
  самой карточке (подписи таймера, единицы измерения и т.д.).
- **Перетаскивание элементов мышью/пальцем** на вкладке "Позиция": живой
  предпросмотр карточки с рамками поверх каждого элемента — тянешь, и
  элемент двигается в реальном времени. Числовые ползунки X/Y остались
  рядом как точный резервный вариант.
- **Изменение размера элементов** кнопками "−/+" прямо на рамке элемента
  (или в списке ниже) — от 40% до 300% базового размера.
- Серверные `timer.*` и `input_number.*` helper-ы — температура и таймер сна
  переживают перезагрузку вкладки браузера (ничего не хранится локально).
- Опциональный контактный/силовой датчик — карточка сама понимает, что
  кондиционер работает, и показывает соответствующие иконки и анимации.

### Установка

**HACS (рекомендуется)**
1. HACS → Frontend → ⋮ → Custom repositories → добавьте
   `https://github.com/kdinya/ha-ir-ac-control`, категория **Lovelace**.
2. Установите "Air Conditioner Card (IR/Broadlink)".
3. Карточка сразу появится в списке карточек при добавлении на дашборд —
   вручную прописывать YAML не нужно.

**Вручную**
1. Скопируйте `air-conditioner-card.js` в `/config/www/ha-ir-ac-control/`.
2. Добавьте ресурс: Настройки → Панели приборов → Ресурсы →
   `/local/ha-ir-ac-control/air-conditioner-card.js`, тип **JavaScript Module**.

### Рекомендуемые helper-ы

```yaml
input_number:
  ac_card_temp:
    name: AC Card — температура
    min: 16
    max: 30
    step: 1

timer:
  ac_card_sleep:
    name: AC Card — таймер сна
```

Выберите их на вкладке **Сущности** редактора (`temp_helper`,
`timer_helper`). Без них карточка работает, но температура/таймер
сбрасываются при перезагрузке вкладки браузера.

### Шрифт Seg7

Положите `.woff` файл семисегментного шрифта по пути, указанному в
`font_path` (по умолчанию
`/local/community/ha-ir-ac-control/fonts/7segment.woff`), или измените путь
на вкладке "Вид".

### Пример конфигурации

```yaml
type: custom:air-conditioner-card
lang: ru
remote_entity: remote.broadlink
device: air_conditioner
binary_sensor: binary_sensor.ac_contact
room_temp_sensor: sensor.room_temperature
room_humidity_sensor: sensor.room_humidity
weather_entity: weather.home
outdoor_secondary: wind
temp_helper: input_number.ac_card_temp
timer_helper: timer.ac_card_sleep
default_temp: 24
temp_min: 16
temp_max: 30
mode2_name: TURBO
mode2_temp: 24
timer_presets: [30, 60, 90, 120]
timer_step: 5
aspect_ratio: 1.72/1
commands:
  'on': 'JgDuAF4A...'
  'off': 'JgBkAV4A...'
  '16': 'JgDuAF4A...'
  '17': 'JgDuAF4A...'
  mode2_on: 'JgDuAF0A...'
  mode2_off: 'JgDuAF8A...'
```

### Дальнейшие планы
- Валидация конфига с предупреждениями прямо в редакторе
- Экспорт/импорт таблицы IR-кодов (JSON) для переноса между кондиционерами
- Поддержка нескольких кондиционеров в одном helper-пакете/blueprint
- Автоопределение протокола пульта (raw vs pronto vs именованные команды)
