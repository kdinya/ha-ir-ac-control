# Air Conditioner Card (IR/Broadlink)

Універсальна Lovelace-картка Home Assistant для керування кондиціонером
через ІЧ-пульт (Broadlink `remote.send_command`). Дизайн — семисегментний
екран з великою температурою, годинником, датчиками кімнати/вулиці, кнопками
ON/OFF, TURBO/ECO (довільна назва), 4 пресети таймера + ручний таймер з
кроком 5 хв, +/- температури.

Усі сутності — опційні, крім самого IR-пульта (потрібен лише для реального
надсилання команд; без нього картка показує лише вигляд, без керування).

## Встановлення

### HACS (рекомендовано)
1. HACS → Frontend → ⋮ → Custom repositories → додайте
   `https://github.com/kdinya/ha-ir-ac-control`, категорія **Lovelace**.
2. Встановіть "Air Conditioner Card (IR/Broadlink)".
3. Картка одразу з'явиться у списку карток при додаванні в дашборд
   (`window.customCards`) — вручну прописувати YAML не потрібно.

### Вручну
1. Скопіюйте `air-conditioner-card.js` у `/config/www/ha-ir-ac-control/`.
2. Додайте ресурс: Налаштування → Панелі приладів → ресурси →
   `/local/ha-ir-ac-control/air-conditioner-card.js`, тип **JavaScript Module**.

## Рекомендовані helper-и

Для надійного (не в браузері) збереження температури та таймера сну
додайте у `configuration.yaml` (або через UI: Налаштування → Пристрої та
служби → Помічники):

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

Виберіть їх на вкладці **Сутності** редактора картки (`temp_helper`,
`timer_helper`). Без них картка працює, але температура/таймер скидаються
при перезавантаженні вкладки браузера.

## Навчання IR-кодів

На вкладці **"Кнопки та IR-коди"** редактора біля кожного поля є кнопка
"📡 Навчити" — вона викликає `remote.learn_command` на вибраному пульті,
чекає до ~15 секунд на сигнал зі звичайного пульта та автоматично підставляє
отриманий base64-код у поле.

## Шрифт Seg7

Покладіть `.woff` файл семисегментного шрифту за шляхом, вказаним у
`font_path` (за замовчуванням `/local/community/ha-ir-ac-control/fonts/7segment.woff`),
або змініть шлях на вкладці "Вигляд".

## Конфігурація (приклад)

```yaml
type: custom:air-conditioner-card
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

## Що далі

Після базового встановлення я підготую окремий список пропозицій щодо
покращення (валідація конфігу, live-preview позиціонування прямо на
картинці замість повзунків, експорт/імпорт кодів, підтримка кількох
кондиціонерів в одному helper-пакеті тощо).
