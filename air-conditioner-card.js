/**
 * Air Conditioner Card (Universal IR/Broadlink Edition) v1.1.0
 * https://github.com/kdinya/ha-ir-ac-control
 *
 * Універсальна Lovelace-картка керування кондиціонером через ІЧ-пульт
 * (Broadlink remote.send_command / remote.learn_command).
 *
 * Базується на приватній картці air-conditioner-card v3.25 — той самий
 * дизайн, розташування елементів, семисегментний шрифт та поведінка,
 * але з повністю опційними сутностями та візуальним редактором:
 *  - мовна панель (uk/en/ru) вгорі редактора — переклад застосовується
 *    одразу і в редакторі, і на картці.
 *  - вкладка "Сутності": пульт, room-температура/вологість, погода
 *    (температура + вітер/вологість на вулиці), контактний датчик — усе
 *    опційне, крім пульта потрібного лише для кнопок IR.
 *  - вкладка "Кнопки та IR-коди": назви кнопок ON/OFF, режим 2
 *    (TURBO/ECO/довільна назва), коди для кожної температури в діапазоні
 *    temp_min..temp_max, окремі коди +/- (опційно). Біля кожного поля —
 *    кнопка "Навчити", яка чекає сигнал з фізичного пульта через
 *    remote.learn_command і сама підставляє код.
 *  - вкладка "Таймери": 4 пресети (T-кнопки) + крок ручного таймера.
 *  - вкладка "Позиція": живе перетягування елементів мишею/пальцем прямо
 *    на превʼю картки + кнопки −/+ для зміни розміру (40–300%), а також
 *    точні повзунки X/Y/розмір як резервний варіант.
 *  - вкладка "Вигляд": аспект картки, розміри шрифтів.
 *
 * Таймер вмикання/вимикання зберігається на боці Home Assistant у
 * timer.* helper (не в браузері) — переживає перезавантаження вкладки.
 * Поточна температура — у input_number helper з тієї ж причини.
 */

const CARD_VERSION = '1.1.0';
console.info(`%c AIR-CONDITIONER-CARD %c v${CARD_VERSION} `, 'color:white;background:#1a8fce;font-weight:700;', 'color:#1a8fce;background:#111;font-weight:700;');

// ---------------------------------------------------------------------------
// Допоміжне: перелік елементів екрана, положення яких можна рухати X/Y.
// ---------------------------------------------------------------------------
const POSITIONABLE_ELEMENTS = [
  { key: 'mode',          label: 'Іконка режиму / назва' },
  { key: 'sensors',       label: 'Іконка стану роботи' },
  { key: 'ext_temp',      label: 'Темп. в кімнаті (мала)' },
  { key: 'humidity',      label: 'Вологість в кімнаті' },
  { key: 'main_temp',     label: 'Велика температура' },
  { key: 'time',          label: 'Годинник' },
  { key: 'weather',       label: 'Темп. на вулиці' },
  { key: 'wind',          label: 'Вітер/вологість на вулиці' },
  { key: 'timer_clock',   label: 'Таймер — відлік' },
  { key: 'timer_preset',  label: 'Таймер — підпис' },
  { key: 'fan',           label: 'Іконка вентилятора' },
  { key: 'turbo_lcd',     label: 'Бейдж режиму 2 (TURBO/ECO)' },
];

// Відповідність ключа позиціонованого елемента до атрибута data-el в DOM картки
// (потрібно для розрахунку координат drag-хендлів у редакторі).
const POSITIONABLE_DATA_EL = {
  mode: 'mode-row',
  sensors: 'status-block',
  ext_temp: 'ext-temp-block',
  humidity: 'ext-hum-block',
  main_temp: 'temp-display',
  time: 'time-display',
  weather: 'weather-temp-block',
  wind: 'wind-block',
  timer_clock: 'timer-clock',
  timer_preset: 'timer-preset',
  fan: 'fan-group',
  turbo_lcd: 'turbo-lcd-block',
};

const DEFAULT_OFFSETS = {
  mode_x: '0cqw', mode_y: '0cqw',
  sensors_x: '0cqw', sensors_y: '0cqw',
  ext_temp_x: '0cqw', ext_temp_y: '0cqw',
  humidity_x: '0cqw', humidity_y: '0cqw',
  main_temp_x: '0cqw', main_temp_y: '0cqw',
  fan_x: '0cqw', fan_y: '0cqw',
  turbo_lcd_x: '0cqw', turbo_lcd_y: '0cqw',
  time_x: '0cqw', time_y: '0cqw',
  timer_clock_x: '0cqw', timer_clock_y: '1.0cqw',
  timer_preset_x: '0cqw', timer_preset_y: '3.6cqw',
  weather_x: '0cqw', weather_y: '0cqw',
  wind_x: '0cqw', wind_y: '0cqw',
};

// Масштаб (розмір) кожного елемента, керується кнопками −/+ в редакторі.
const DEFAULT_SCALES = {};
POSITIONABLE_ELEMENTS.forEach((item) => { DEFAULT_SCALES[item.key] = 1; });

function pxCqw(v) {
  // Приймає '3', '3cqw', '-1.5cqw' -> завжди повертає рядок з cqw
  if (v === undefined || v === null || v === '') return '0cqw';
  const s = String(v).trim();
  return s.endsWith('cqw') ? s : `${s}cqw`;
}
function numFromCqw(v) {
  const n = parseFloat(String(v ?? '0').replace('cqw', ''));
  return Number.isFinite(n) ? n : 0;
}
function numScale(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// ---------------------------------------------------------------------------
// Локалізація (uk / en / ru) — і для картки, і для візуального редактора.
// ---------------------------------------------------------------------------
const LANGS = ['uk', 'en', 'ru'];
const LANG_NAMES = { uk: 'Українська', en: 'English', ru: 'Русский' };

const I18N = {
  uk: {
    lang_label: 'Мова інтерфейсу',
    tab_lang: 'Мова',
    tab_entities: 'Сутності',
    tab_commands: 'Кнопки та IR-коди',
    tab_timers: 'Таймери',
    tab_position: 'Позиція',
    tab_appearance: 'Вигляд',
    f_remote: 'IR-пульт (remote) — потрібен для надсилання команд',
    f_device: 'Device-код для іменованих IR-команд (не обов’язково для raw base64)',
    f_binary_sensor: 'Контактний/силовий датчик роботи (binary_sensor)',
    f_room_temp: 'Температура в кімнаті (sensor)',
    f_room_hum: 'Вологість в кімнаті (sensor)',
    f_weather: 'Погода (weather) — темп. + вітер/вологість на вулиці',
    f_outdoor_temp: 'Або: сенсор температури на вулиці (якщо без weather)',
    f_outdoor_secondary: 'Другий показник на вулиці',
    opt_wind: 'Вітер', opt_humidity: 'Вологість', opt_none: 'Не показувати',
    f_outdoor_hum: 'Сенсор вологості на вулиці (якщо без weather)',
    f_temp_helper: 'Input_number для збереження температури (рекомендовано)',
    f_timer_helper: 'Timer-помічник для таймера сну (рекомендовано)',
    hint_helpers: 'Temp_helper та timer_helper — це input_number/timer helper-и Home Assistant. Без них картка працює, але температура і таймер скидаються при перезавантаженні вкладки.',
    sec_main_buttons: 'Основні кнопки',
    f_btn_on: 'Кнопка ON',
    f_btn_off: 'Кнопка OFF',
    f_mode2_name: 'Назва другого режиму (TURBO/ECO/…)',
    f_mode2_temp: 'Температура для другого режиму',
    f_mode2_on: 'Режим 2 — увімкнути',
    f_mode2_off: 'Режим 2 — вимкнути',
    f_default_temp: 'Температура за замовчуванням (при ON)',
    sec_plusminus: 'Плюс / Мінус (опційно — окремі коди пульта)',
    f_plus: 'Код кнопки "+"',
    f_minus: 'Код кнопки "-"',
    hint_plusminus: 'Якщо коди +/- не задані — картка надсилатиме код відповідної температури з таблиці нижче.',
    sec_temp_codes: 'Коди для кожної температури',
    f_temp_min: 'Мін. температура',
    f_temp_max: 'Макс. температура',
    sec_presets: 'Пресети таймера (4 значення, хв)',
    f_timer_step: 'Крок ручного таймера (хв)',
    sec_pos: 'Положення та розмір елементів екрана',
    hint_pos_drag: 'Перетягніть елемент прямо на екрані картки, щоб змінити позицію. Кнопками "−/+" в кутку — розмір.',
    f_aspect: 'Пропорції картки (aspect-ratio, напр. 1.72/1)',
    f_controls_height: 'Висота панелі кнопок (напр. 12cqw)',
    f_font_path: 'Шлях до шрифту Seg7 (.woff)',
    sec_font_sizes: 'Розміри шрифтів (cqw)',
    lbl_main_temp: 'Велика температура',
    lbl_ext_temp: 'Темп. в кімнаті (мала)',
    lbl_humidity: 'Вологість в кімнаті',
    lbl_time: 'Годинник',
    lbl_weather: 'Темп. на вулиці',
    lbl_wind: 'Вітер/вологість на вулиці',
    lbl_mode: 'Іконка режиму / назва',
    lbl_sensors: 'Іконка стану роботи',
    lbl_timer_clock: 'Таймер — відлік',
    lbl_timer_preset: 'Таймер — підпис',
    lbl_fan: 'Іконка вентилятора',
    lbl_turbo_lcd: 'Бейдж режиму 2 (TURBO/ECO)',
    learn_btn: '📡 Навчити',
    learn_wait: '⏳ Чекаю сигнал…',
    learn_ok: '✅ Записано',
    learn_fail: '⚠️ Не вдалось',
    learn_err: '⚠️ Помилка',
    learn_need_remote: 'Спочатку виберіть IR-пульт на вкладці "Сутності".',
    ph_code: 'base64 IR код або назва команди',
    ph_code_short: 'IR код',
    timer_on_word: 'Увімкн.',
    timer_off_word: 'Вимкн.',
    min_short: 'хв.',
    unit_wind: 'м/с',
    reset_btn: 'Скинути',
  },
  en: {
    lang_label: 'Interface language',
    tab_lang: 'Language',
    tab_entities: 'Entities',
    tab_commands: 'Buttons & IR codes',
    tab_timers: 'Timers',
    tab_position: 'Position',
    tab_appearance: 'Appearance',
    f_remote: 'IR remote (remote entity) — required to send commands',
    f_device: 'Device code for named IR commands (not required for raw base64)',
    f_binary_sensor: 'Contact/power sensor for running state (binary_sensor)',
    f_room_temp: 'Room temperature (sensor)',
    f_room_hum: 'Room humidity (sensor)',
    f_weather: 'Weather entity — outdoor temp + wind/humidity',
    f_outdoor_temp: 'Or: outdoor temperature sensor (if no weather entity)',
    f_outdoor_secondary: 'Second outdoor value',
    opt_wind: 'Wind', opt_humidity: 'Humidity', opt_none: 'Hidden',
    f_outdoor_hum: 'Outdoor humidity sensor (if no weather entity)',
    f_temp_helper: 'input_number helper to persist temperature (recommended)',
    f_timer_helper: 'timer helper for the sleep timer (recommended)',
    hint_helpers: 'temp_helper and timer_helper are Home Assistant input_number/timer helpers. The card works without them, but temperature and timer reset on tab reload.',
    sec_main_buttons: 'Main buttons',
    f_btn_on: 'ON button',
    f_btn_off: 'OFF button',
    f_mode2_name: 'Second mode name (TURBO/ECO/…)',
    f_mode2_temp: 'Temperature for second mode',
    f_mode2_on: 'Mode 2 — turn on',
    f_mode2_off: 'Mode 2 — turn off',
    f_default_temp: 'Default temperature (on ON)',
    sec_plusminus: 'Plus / Minus (optional — separate remote codes)',
    f_plus: '"+" button code',
    f_minus: '"-" button code',
    hint_plusminus: 'If +/- codes are not set, the card will send the code for the resulting temperature from the table below.',
    sec_temp_codes: 'Codes for each temperature',
    f_temp_min: 'Min temperature',
    f_temp_max: 'Max temperature',
    sec_presets: 'Timer presets (4 values, min)',
    f_timer_step: 'Manual timer step (min)',
    sec_pos: 'Position and size of screen elements',
    hint_pos_drag: 'Drag an element right on the card screen to reposition it. Use the "−/+" buttons in the corner to resize it.',
    f_aspect: 'Card aspect ratio (e.g. 1.72/1)',
    f_controls_height: 'Button panel height (e.g. 12cqw)',
    f_font_path: 'Path to the Seg7 font (.woff)',
    sec_font_sizes: 'Font sizes (cqw)',
    lbl_main_temp: 'Large temperature',
    lbl_ext_temp: 'Room temp. (small)',
    lbl_humidity: 'Room humidity',
    lbl_time: 'Clock',
    lbl_weather: 'Outdoor temperature',
    lbl_wind: 'Outdoor wind/humidity',
    lbl_mode: 'Mode icon / name',
    lbl_sensors: 'Running-state icon',
    lbl_timer_clock: 'Timer — countdown',
    lbl_timer_preset: 'Timer — caption',
    lbl_fan: 'Fan icon',
    lbl_turbo_lcd: 'Mode 2 badge (TURBO/ECO)',
    learn_btn: '📡 Learn',
    learn_wait: '⏳ Waiting for signal…',
    learn_ok: '✅ Saved',
    learn_fail: '⚠️ Failed',
    learn_err: '⚠️ Error',
    learn_need_remote: 'Select an IR remote on the "Entities" tab first.',
    ph_code: 'base64 IR code or command name',
    ph_code_short: 'IR code',
    timer_on_word: 'On',
    timer_off_word: 'Off',
    min_short: 'min',
    unit_wind: 'm/s',
    reset_btn: 'Reset',
  },
  ru: {
    lang_label: 'Язык интерфейса',
    tab_lang: 'Язык',
    tab_entities: 'Сущности',
    tab_commands: 'Кнопки и IR-коды',
    tab_timers: 'Таймеры',
    tab_position: 'Позиция',
    tab_appearance: 'Вид',
    f_remote: 'ИК-пульт (remote) — нужен для отправки команд',
    f_device: 'Device-код для именованных IR-команд (не обязательно для raw base64)',
    f_binary_sensor: 'Контактный/силовой датчик работы (binary_sensor)',
    f_room_temp: 'Температура в комнате (sensor)',
    f_room_hum: 'Влажность в комнате (sensor)',
    f_weather: 'Погода (weather) — темп. + ветер/влажность на улице',
    f_outdoor_temp: 'Или: датчик температуры на улице (если без weather)',
    f_outdoor_secondary: 'Второй показатель на улице',
    opt_wind: 'Ветер', opt_humidity: 'Влажность', opt_none: 'Не показывать',
    f_outdoor_hum: 'Датчик влажности на улице (если без weather)',
    f_temp_helper: 'input_number для сохранения температуры (рекомендуется)',
    f_timer_helper: 'Timer-помощник для таймера сна (рекомендуется)',
    hint_helpers: 'temp_helper и timer_helper — это input_number/timer helper-ы Home Assistant. Без них карточка работает, но температура и таймер сбрасываются при перезагрузке вкладки.',
    sec_main_buttons: 'Основные кнопки',
    f_btn_on: 'Кнопка ON',
    f_btn_off: 'Кнопка OFF',
    f_mode2_name: 'Название второго режима (TURBO/ECO/…)',
    f_mode2_temp: 'Температура для второго режима',
    f_mode2_on: 'Режим 2 — включить',
    f_mode2_off: 'Режим 2 — выключить',
    f_default_temp: 'Температура по умолчанию (при ON)',
    sec_plusminus: 'Плюс / Минус (опционально — отдельные коды пульта)',
    f_plus: 'Код кнопки "+"',
    f_minus: 'Код кнопки "-"',
    hint_plusminus: 'Если коды +/- не заданы — карточка будет отправлять код соответствующей температуры из таблицы ниже.',
    sec_temp_codes: 'Коды для каждой температуры',
    f_temp_min: 'Мин. температура',
    f_temp_max: 'Макс. температура',
    sec_presets: 'Пресеты таймера (4 значения, мин)',
    f_timer_step: 'Шаг ручного таймера (мин)',
    sec_pos: 'Положение и размер элементов экрана',
    hint_pos_drag: 'Перетащите элемент прямо на экране карточки, чтобы изменить позицию. Кнопками "−/+" в углу — размер.',
    f_aspect: 'Пропорции карточки (aspect-ratio, напр. 1.72/1)',
    f_controls_height: 'Высота панели кнопок (напр. 12cqw)',
    f_font_path: 'Путь к шрифту Seg7 (.woff)',
    sec_font_sizes: 'Размеры шрифтов (cqw)',
    lbl_main_temp: 'Большая температура',
    lbl_ext_temp: 'Темп. в комнате (малая)',
    lbl_humidity: 'Влажность в комнате',
    lbl_time: 'Часы',
    lbl_weather: 'Темп. на улице',
    lbl_wind: 'Ветер/влажность на улице',
    lbl_mode: 'Иконка режима / название',
    lbl_sensors: 'Иконка состояния работы',
    lbl_timer_clock: 'Таймер — отсчёт',
    lbl_timer_preset: 'Таймер — подпись',
    lbl_fan: 'Иконка вентилятора',
    lbl_turbo_lcd: 'Бейдж режима 2 (TURBO/ECO)',
    learn_btn: '📡 Обучить',
    learn_wait: '⏳ Жду сигнал…',
    learn_ok: '✅ Записано',
    learn_fail: '⚠️ Не удалось',
    learn_err: '⚠️ Ошибка',
    learn_need_remote: 'Сначала выберите ИК-пульт на вкладке "Сущности".',
    ph_code: 'base64 IR код или имя команды',
    ph_code_short: 'IR код',
    timer_on_word: 'Вкл.',
    timer_off_word: 'Выкл.',
    min_short: 'мин.',
    unit_wind: 'м/с',
    reset_btn: 'Сбросить',
  },
};

function translate(lang, key) {
  const l = LANGS.includes(lang) ? lang : 'uk';
  return (I18N[l] && I18N[l][key]) ?? I18N.uk[key] ?? key;
}

// ---------------------------------------------------------------------------
// Картка
// ---------------------------------------------------------------------------
class AirConditionerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._lockUntil = 0;
    this._local = { temp: 24, power: false, mode2: false, ha_timer_active_minutes: null };
    this._sensors = { roomTemp: '-', roomHum: '--', outTemp: '-', outSecondary: '-', isRunning: false };
    this._initialized = false;
    this._timeTimer = null;
    this._timerStateObj = null;
    this._elCache = {};
    this._lastConfirmedPower = null;

    this._timerEditMode = false;
    this._timerEditValue = 30;
    this._timerTimeout = null;

    this.shadowRoot.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (btn) this._act(btn.dataset.act);
    });
  }

  connectedCallback() {
    if (this._initialized) this._updateClock();
    if (this._timeTimer) clearInterval(this._timeTimer);
    this._timeTimer = setInterval(() => this._updateClock(), 1000);
  }

  disconnectedCallback() {
    if (this._timeTimer) clearInterval(this._timeTimer);
    if (this._timerTimeout) clearTimeout(this._timerTimeout);
  }

  _updateClock() {
    const countdownClock = this._el('ha-countdown-clock');
    const countdownPreset = this._el('ha-countdown-preset');
    const timerClockBg = this._el('timer-clock');
    const timerPresetBg = this._el('timer-preset');

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const timeEl = this._el('time-num');
    if (timeEl) timeEl.textContent = timeStr;

    if (this._timerEditMode) {
      if (countdownClock) countdownClock.textContent = `${this._timerEditValue}:00`;
      if (countdownPreset) countdownPreset.textContent = this._local.power ? `(${this._t('timer_off_word')})` : `(${this._t('timer_on_word')})`;
      if (timerClockBg) timerClockBg.classList.add('timer-badge--on');
      if (timerPresetBg) timerPresetBg.classList.add('timer-badge--on');
      return;
    }

    if (this._timerStateObj && this._timerStateObj.state === 'active') {
      const finishesAt = this._timerStateObj.attributes.finishes_at;
      const remainingMs = new Date(finishesAt) - new Date();

      if (remainingMs > 0) {
        const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        const mm = mins.toString().padStart(2, '0');
        const ss = secs.toString().padStart(2, '0');

        if (countdownClock) countdownClock.textContent = hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
        if (countdownPreset) countdownPreset.textContent = `(${this._local.ha_timer_active_minutes}${this._t('min_short')})`;
        if (timerClockBg) timerClockBg.classList.add('timer-badge--on');
        if (timerPresetBg) timerPresetBg.classList.add('timer-badge--on');
      } else {
        this._clearCountdownFields(countdownClock, countdownPreset, timerClockBg, timerPresetBg);
      }
    } else {
      this._clearCountdownFields(countdownClock, countdownPreset, timerClockBg, timerPresetBg);
    }
  }

  _clearCountdownFields(clock, preset, clockBg, presetBg) {
    if (clock) clock.textContent = '';
    if (preset) preset.textContent = '';
    if (clockBg) clockBg.classList.remove('timer-badge--on');
    if (presetBg) presetBg.classList.remove('timer-badge--on');
  }

  setConfig(config) {
    if (!config || typeof config !== 'object') throw new Error('Некоректний конфіг картки');

    const prevLang = this.config?.lang;
    const nextLang = LANGS.includes(config.lang) ? config.lang : 'uk';
    if (this._initialized && prevLang && prevLang !== nextLang) this._initialized = false;

    let presets = [30, 60, 90, 120];
    if (config.timer_presets) {
      if (typeof config.timer_presets === 'string') {
        presets = config.timer_presets.split(',').map((p) => parseInt(p.trim())).filter((p) => !isNaN(p));
      } else if (Array.isArray(config.timer_presets)) {
        presets = config.timer_presets.map((p) => parseInt(p)).filter((p) => !isNaN(p));
      }
      if (presets.length !== 4) presets = [30, 60, 90, 120];
    }

    const offsets = {};
    for (const key of Object.keys(DEFAULT_OFFSETS)) {
      offsets[`offset_${key}`] = pxCqw(config[`offset_${key}`] ?? DEFAULT_OFFSETS[key]);
    }
    const scales = {};
    for (const key of Object.keys(DEFAULT_SCALES)) {
      scales[`offset_${key}_scale`] = numScale(config[`offset_${key}_scale`] ?? DEFAULT_SCALES[key]);
    }

    this.config = {
      ...config,

      lang: LANGS.includes(config.lang) ? config.lang : 'uk',

      remote_entity: config.remote_entity || '',
      device: config.device || '',

      room_temp_sensor: config.room_temp_sensor || config.heat_index_sensor || '',
      room_humidity_sensor: config.room_humidity_sensor || config.humidity_sensor || '',

      weather_entity: config.weather_entity || '',
      outdoor_temp_sensor: config.outdoor_temp_sensor || '',
      outdoor_secondary: config.outdoor_secondary || 'wind', // 'wind' | 'humidity' | 'none'
      outdoor_humidity_sensor: config.outdoor_humidity_sensor || '',

      binary_sensor: config.binary_sensor || '',

      temp_helper: config.temp_helper || '',
      timer_helper: config.timer_helper || '',

      default_temp: Number(config.default_temp ?? 24),
      temp_min: Number(config.temp_min ?? 16),
      temp_max: Number(config.temp_max ?? 30),
      timer_presets: presets,
      timer_step: Number(config.timer_step ?? 5),

      mode2_name: config.mode2_name || 'TURBO',
      mode2_temp: Number(config.mode2_temp ?? config.default_temp ?? 24),

      aspect_ratio: config.aspect_ratio || '1.72/1',
      font_path: config.font_path || '/local/community/ha-ir-ac-control/fonts/7segment.woff',

      controls_height: config.controls_height || '12cqw',
      font_size_main_temp: config.font_size_main_temp || '14.5cqw',
      font_size_ext_temp: config.font_size_ext_temp || '5.0cqw',
      font_size_humidity: config.font_size_humidity || '4.0cqw',
      font_size_labels: config.font_size_labels || '3.5cqw',
      font_size_sensors: config.font_size_sensors || '2.8cqw',
      font_size_mode: config.font_size_mode || '2.5cqw',
      font_size_turbo_txt: config.font_size_turbo_txt || '2.1cqw',
      font_size_time: config.font_size_time || '3.8cqw',
      font_size_timer_clock: config.font_size_timer_clock || '2.8cqw',
      font_size_timer_preset: config.font_size_timer_preset || '2.0cqw',
      font_size_weather: config.font_size_weather || '3.2cqw',
      font_size_wind: config.font_size_wind || '3.2cqw',

      opacity_off_main_temp: config.opacity_off_main_temp || '0.35',
      opacity_off_ext_temp: config.opacity_off_ext_temp || '0.35',
      opacity_off_humidity: config.opacity_off_humidity || '0.35',
      opacity_off_sensors: config.opacity_off_sensors || '0.35',
      opacity_off_mode: config.opacity_off_mode || '0.35',
      opacity_off_time: config.opacity_off_time || '0.35',
      opacity_off_timer: config.opacity_off_timer || '0.35',
      opacity_off_weather: config.opacity_off_weather || '0.35',
      opacity_off_wind: config.opacity_off_wind || '0.35',

      ...offsets,
      ...scales,

      commands: config.commands || {},
    };
  }

  _t(key) { return translate(this.config?.lang, key); }

  set hass(hass) {
    this._hass = hass;
    const get = (id) => (id && hass.states[id]?.state) ?? '';
    const isUnavailable = (id) => {
      if (!id) return true;
      const s = get(id);
      return s === '' || s === 'unavailable' || s === 'unknown';
    };

    // --- контактний/силовий датчик (опційний) ---
    const binEntity = this.config.binary_sensor;
    const isContactOpen = binEntity ? hass.states[binEntity]?.state === 'on' : this._local.power;

    // --- температура/вологість в кімнаті (опційні) ---
    const roomTemp = isUnavailable(this.config.room_temp_sensor) ? '-' : parseFloat(get(this.config.room_temp_sensor)).toFixed(1);
    const roomHum = this.config.room_humidity_sensor
      ? (isUnavailable(this.config.room_humidity_sensor) ? '-' : (parseFloat(get(this.config.room_humidity_sensor)) || 0).toFixed(0))
      : '--';

    // --- погода на вулиці (опційна): або weather_entity, або окремий sensor ---
    let outTemp = '-';
    let outSecondary = '-';
    const wEnt = this.config.weather_entity;
    if (wEnt && !isUnavailable(wEnt)) {
      const wState = hass.states[wEnt];
      const wTempRaw = wState.attributes.temperature !== undefined ? wState.attributes.temperature : wState.state;
      if (Number.isFinite(parseFloat(wTempRaw))) outTemp = parseFloat(wTempRaw).toFixed(1);
      if (this.config.outdoor_secondary === 'wind') {
        const wWindRaw = wState.attributes.wind_speed;
        if (Number.isFinite(parseFloat(wWindRaw))) outSecondary = parseFloat(wWindRaw).toFixed(1);
      } else if (this.config.outdoor_secondary === 'humidity') {
        const wHumRaw = wState.attributes.humidity;
        if (Number.isFinite(parseFloat(wHumRaw))) outSecondary = parseFloat(wHumRaw).toFixed(0);
      }
    } else if (this.config.outdoor_temp_sensor && !isUnavailable(this.config.outdoor_temp_sensor)) {
      outTemp = parseFloat(get(this.config.outdoor_temp_sensor)).toFixed(1);
      if (this.config.outdoor_secondary === 'humidity' && this.config.outdoor_humidity_sensor && !isUnavailable(this.config.outdoor_humidity_sensor)) {
        outSecondary = parseFloat(get(this.config.outdoor_humidity_sensor)).toFixed(0);
      }
    }

    // --- серверний таймер ---
    const timerId = this.config.timer_helper;
    const timerState = timerId ? hass.states[timerId] : null;
    if (timerState) {
      this._timerStateObj = timerState;
      if (timerState.state === 'active') {
        const durationRaw = timerState.attributes.duration || '00:00:00';
        const parts = durationRaw.split(':');
        this._local.ha_timer_active_minutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      } else {
        this._local.ha_timer_active_minutes = null;
      }
    } else {
      this._timerStateObj = null;
      this._local.ha_timer_active_minutes = null;
    }

    if (this._lastConfirmedPower === null) this._lastConfirmedPower = isContactOpen;
    const autoTurnedOff = binEntity && this._lastConfirmedPower === true && isContactOpen === false;
    this._lastConfirmedPower = isContactOpen;

    this._sensors = { roomTemp, roomHum, outTemp, outSecondary, isRunning: isContactOpen };

    if (autoTurnedOff) {
      this._local.mode2 = false;
      if (this._timerStateObj && this._timerStateObj.state === 'active') this._svc('timer', 'cancel', timerId);
    }

    if (Date.now() > this._lockUntil) {
      const tempId = this.config.temp_helper;
      if (tempId && hass.states[tempId]) {
        const tState = hass.states[tempId].state;
        if (tState !== 'unavailable' && tState !== 'unknown' && tState !== '') {
          const parsed = parseFloat(tState);
          if (Number.isFinite(parsed)) this._local.temp = Math.round(parsed);
        }
      }
      if (binEntity) this._local.power = isContactOpen;
    }

    this._render();
  }

  _injectGlobalFont() {
    const fontId = 'ac-card-seg7-font';
    if (!document.getElementById(fontId)) {
      const style = document.createElement('style');
      style.id = fontId;
      style.textContent = `
        @font-face {
          font-family: 'Seg7';
          src: url('${this.config.font_path}') format('woff');
          font-weight: normal; font-style: normal;
        }
      `;
      document.head.appendChild(style);
    }
  }

  _sendIR(cmdKey) {
    if (!this.config.remote_entity || !this.config.commands) return;
    let cmd = this.config.commands[cmdKey] ?? this.config.commands[String(cmdKey)];
    if (cmd === undefined || cmd === null || cmd === '') return;
    if (typeof cmd === 'string') cmd = cmd.trim();

    const payload = { entity_id: this.config.remote_entity };
    if (cmd.startsWith('b64:') || cmd.startsWith('Jg') || cmd.length > 40) {
      payload.command = cmd.startsWith('b64:') ? cmd : `b64:${cmd}`;
    } else {
      payload.command = cmd;
      if (this.config.device) payload.device = this.config.device;
    }
    this._hass.callService('remote', 'send_command', payload);
  }

  _svc(domain, service, entity_id, extra = {}) {
    if (!entity_id) return;
    this._hass.callService(domain, service, { entity_id, ...extra });
  }

  _setLocalTemp(value) {
    this._local.temp = value;
    const tempId = this.config.temp_helper;
    if (tempId && this._hass.states[tempId]) this._svc('input_number', 'set_value', tempId, { value });
  }

  _startTimerTimeout() {
    if (this._timerTimeout) clearTimeout(this._timerTimeout);
    this._timerTimeout = setTimeout(() => { this._saveDynamicTimer(); this._render(); }, 5000);
  }

  _saveDynamicTimer() {
    if (this._timerTimeout) clearTimeout(this._timerTimeout);
    this._timerEditMode = false;
    const minutes = this._timerEditValue;
    const timerEntity = this.config.timer_helper;
    if (!timerEntity) return;
    if (minutes <= 0) {
      this._svc('timer', 'cancel', timerEntity);
    } else {
      const hh = Math.floor(minutes / 60);
      const mm = minutes % 60;
      this._svc('timer', 'start', timerEntity, { duration: `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00` });
    }
  }

  _toggleTimer_Server(minutes) {
    const timerEntity = this.config.timer_helper;
    if (!timerEntity) return;
    if (this._local.ha_timer_active_minutes === minutes) {
      this._svc('timer', 'cancel', timerEntity);
    } else {
      const hh = Math.floor(minutes / 60);
      const mm = minutes % 60;
      this._svc('timer', 'start', timerEntity, { duration: `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00` });
    }
  }

  _act(act) {
    const step = this.config.timer_step || 5;

    if (act === 'toggle_timer_edit') {
      if (!this.config.timer_helper) return;
      if (this._timerTimeout) clearTimeout(this._timerTimeout);
      this._timerEditMode = !this._timerEditMode;
      if (this._timerEditMode) {
        this._timerEditValue = this._local.ha_timer_active_minutes || 30;
        this._startTimerTimeout();
      } else {
        this._saveDynamicTimer();
      }
      this._render();
      return;
    } else if (act === 'timer_plus') {
      this._timerEditValue = Math.min(480, (this._timerEditValue || 0) + step);
      this._startTimerTimeout();
      this._updateClock();
      return;
    } else if (act === 'timer_minus') {
      this._timerEditValue = Math.max(0, (this._timerEditValue || 0) - step);
      this._startTimerTimeout();
      this._updateClock();
      return;
    }

    this._lockUntil = Date.now() + 7000;

    if (act === 'power') {
      this._local.power = !this._local.power;
      if (!this._local.power) {
        this._local.mode2 = false;
        if (this._timerStateObj && this._timerStateObj.state === 'active') this._svc('timer', 'cancel', this.config.timer_helper);
        this._sendIR('off');
      } else {
        this._setLocalTemp(this.config.default_temp);
        this._sendIR('on');
      }
    } else if (act === 'mode2') {
      const mTemp = this.config.mode2_temp;
      if (!this._local.power) {
        this._local.power = true;
        this._local.mode2 = true;
        this._setLocalTemp(mTemp);
        this._sendIR('mode2_on');
      } else {
        this._local.mode2 = !this._local.mode2;
        this._setLocalTemp(mTemp);
        this._sendIR(this._local.mode2 ? 'mode2_on' : 'mode2_off');
      }
    } else if (act === 'plus' && !this._local.mode2 && this._local.temp < this.config.temp_max) {
      this._setLocalTemp(this._local.temp + 1);
      if (!this._local.power) this._local.power = true;
      this._sendIR(this.config.commands.plus ? 'plus' : String(this._local.temp));
    } else if (act === 'minus' && !this._local.mode2 && this._local.temp > this.config.temp_min) {
      this._setLocalTemp(this._local.temp - 1);
      if (!this._local.power) this._local.power = true;
      this._sendIR(this.config.commands.minus ? 'minus' : String(this._local.temp));
    } else if (act.startsWith('act_t')) {
      if (this._timerTimeout) clearTimeout(this._timerTimeout);
      this._timerEditMode = false;
      this._toggleTimer_Server(parseInt(act.slice(5)));
    }
    this._render();
  }

  _render() {
    if (!this._initialized) this._initHTML();
    this._updateDOM();
  }

  _initHTML() {
    this._elCache = {};
    this._injectGlobalFont();
    const c = this.config;
    const presets = c.timer_presets;
    const off = (k) => c[`offset_${k}`];
    const scl = (k) => ` scale(${c[`offset_${k}_scale`] ?? 1})`;

    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <div class="wrapper">
        <div class="card">
          <div class="screen" data-el="screen">
            <div class="screen-inner">

              <div class="screen-timer-clock seg" data-el="timer-clock" style="transform: translate(calc(-50% + ${off('timer_clock_x')}), ${off('timer_clock_y')}${scl('timer_clock')});">
                <span data-el="ha-countdown-clock"></span>
              </div>
              <div class="screen-timer-preset" data-el="timer-preset" style="transform: translate(calc(-50% + ${off('timer_preset_x')}), ${off('timer_preset_y')}${scl('timer_preset')});">
                <span data-el="ha-countdown-preset"></span>
              </div>

              <div class="screen-top">
                <div class="col-left">
                  <div class="mode-row" data-el="mode-row" style="transform: translate(${off('mode_x')}, ${off('mode_y')}${scl('mode')});">
                    <span class="mode-icon">❄</span>
                    <span class="mode-text">COOL</span>
                  </div>
                  <div class="status-row" data-el="status-block" style="transform: translate(${off('sensors_x')}, ${off('sensors_y')}${scl('sensors')});">
                    <svg class="status-ac-icon" data-el="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="6" width="20" height="7" rx="1.5"/><line x1="6" y1="13" x2="18" y2="13"/>
                      <path class="wind-line wl1" d="M5 16c0 1.5 0.5 2.5 1.5 2.5"/>
                      <path class="wind-line wl2" d="M12 16v3"/>
                      <path class="wind-line wl3" d="M19 16c0 1.5-0.5 2.5-1.5 2.5"/>
                    </svg>
                  </div>
                </div>
                <div class="col-right">
                  <div class="ext-temp-block" data-el="ext-temp-block" style="transform: translate(${off('ext_temp_x')}, ${off('ext_temp_y')}${scl('ext_temp')});">
                    <span class="seg ext-temp-val" data-el="room-temp">-</span><span class="ext-unit">°C</span>
                  </div>
                  <div class="ext-hum-block" data-el="ext-hum-block" style="transform: translate(${off('humidity_x')}, ${off('humidity_y')}${scl('humidity')});">
                    <span class="seg ext-hum-val" data-el="room-hum">--</span><span class="ext-unit">%</span>
                  </div>
                </div>
              </div>

              <div class="screen-weather-temp" data-el="weather-temp-block" style="transform: translate(${off('weather_x')}, ${off('weather_y')}${scl('weather')});">
                <svg class="weather-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 8C20.11 8 21 8.9 21 10V16.76C21.61 17.31 22 18.11 22 19C22 20.66 20.66 22 19 22C17.34 22 16 20.66 16 19C16 18.11 16.39 17.31 17 16.76V10C17 8.9 17.9 8 19 8M19 9C18.45 9 18 9.45 18 10V11H20V10C20 9.45 19.55 9 19 9M12 5.69L7 10.19V18H14.1L14 19L14.1 20H5V12H2L12 3L16.4 6.96C15.89 7.4 15.5 7.97 15.25 8.61L12 5.69Z" /></svg>
                <span class="seg weather-val" data-el="weather-temp">-</span><span class="weather-unit">°C</span>
              </div>
              <div class="screen-wind-speed" data-el="wind-block" style="transform: translate(${off('wind_x')}, ${off('wind_y')}${scl('wind')});">
                <svg class="wind-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M4,10A1,1 0 0,1 3,9A1,1 0 0,1 4,8H12A2,2 0 0,0 14,6A2,2 0 0,0 12,4C11.45,4 10.95,4.22 10.59,4.59C10.2,5 9.56,5 9.17,4.59C8.78,4.2 8.78,3.56 9.17,3.17C9.9,2.45 10.9,2 12,2A4,4 0 0,1 16,6A4,4 0 0,1 12,10H4M19,12A1,1 0 0,0 20,11A1,1 0 0,0 19,10C18.72,10 18.47,10.11 18.29,10.29C17.9,10.68 17.27,10.68 16.88,10.29C16.5,9.9 16.5,9.27 16.88,8.88C17.42,8.34 18.17,8 19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14H5A1,1 0 0,1 4,13A1,1 0 0,1 5,12H19M18,18H4A1,1 0 0,1 3,17A1,1 0 0,1 4,16H18A3,3 0 0,1 21,19A3,3 0 0,1 18,22C17.17,22 16.42,21.66 15.88,21.12C15.5,20.73 15.5,20.1 15.88,19.71C16.27,19.32 16.9,19.32 17.29,19.71C17.47,19.89 17.72,20 18,20A1,1 0 0,0 19,19A1,1 0 0,0 18,18Z" /></svg>
                <span class="seg wind-val" data-el="wind-speed">-</span><span class="wind-unit" data-el="wind-unit">${this._t('unit_wind')}</span>
              </div>

              <div class="screen-center" data-el="temp-display" style="transform: translate(calc(-50% + ${off('main_temp_x')}), calc(-50% + ${off('main_temp_y')})${scl('main_temp')});">
                <span class="seg temp-big" data-el="temp-num">${c.default_temp}</span><span class="temp-degree">°C</span>
              </div>
              <div class="screen-time" data-el="time-display" style="transform: translate(calc(-50% + ${off('time_x')}), calc(-50% + ${off('time_y')})${scl('time')});">
                <span class="seg time-val" data-el="time-num">00:00</span>
              </div>

              <div class="screen-bottom">
                <div class="fan-group" data-el="fan-group" style="transform: translate(${off('fan_x')}, ${off('fan_y')}${scl('fan')});">
                  <div class="fan-wrap" data-el="fan-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z" /></svg>
                  </div>
                  <div class="fan-bars"><div class="bar b1"></div><div class="bar b2"></div><div class="bar b3"></div><div class="bar b4"></div></div>
                </div>
                <div class="bottom-right" data-el="turbo-lcd-block" style="transform: translate(${off('turbo_lcd_x')}, ${off('turbo_lcd_y')})${scl('turbo_lcd')};">
                  <span class="turbo-badge" data-el="turbo-badge">${(c.mode2_name || 'TURBO').toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="controls">
            <div class="left-group">
              <button class="btn btn-power" data-act="power" data-el="btn-power">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
              </button>
            </div>

            <div class="center-group" data-el="center-group">
              <button class="btn btn-timer" data-act="act_t${presets[0]}" data-el="btn-t${presets[0]}">T${presets[0]}</button>
              <button class="btn btn-timer" data-act="act_t${presets[1]}" data-el="btn-t${presets[1]}">T${presets[1]}</button>

              <div class="control-slot">
                <button class="btn btn-sm btn-temp-minus" data-act="minus" data-el="btn-minus">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button class="btn btn-sm btn-timer-minus" data-act="timer_minus" data-el="btn-timer-minus">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>

              <button class="btn btn-dyn-timer" data-act="toggle_timer_edit" data-el="btn-dyn-timer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </button>

              <div class="control-slot">
                <button class="btn btn-sm btn-temp-plus" data-act="plus" data-el="btn-plus">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button class="btn btn-sm btn-timer-plus" data-act="timer_plus" data-el="btn-timer-plus">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>

              <button class="btn btn-timer" data-act="act_t${presets[2]}" data-el="btn-t${presets[2]}">T${presets[2]}</button>
              <button class="btn btn-timer" data-act="act_t${presets[3]}" data-el="btn-t${presets[3]}">T${presets[3]}</button>
            </div>

            <div class="turbo-group">
              <button class="btn btn-turbo" data-act="mode2" data-el="btn-turbo">${(c.mode2_name || 'TURBO').toUpperCase()}</button>
            </div>
          </div>
        </div>
      </div>
    `;
    this._initialized = true;
  }

  _el(key) {
    if (!this._elCache[key]) this._elCache[key] = this.shadowRoot.querySelector(`[data-el="${key}"]`);
    return this._elCache[key];
  }

  _updateDOM() {
    const { temp, power, mode2, ha_timer_active_minutes } = this._local;
    const { roomTemp, roomHum, outTemp, outSecondary, isRunning } = this._sensors;
    const c = this.config;

    const host = this.shadowRoot.host;
    const opacityVars = {
      '--mode-op': c.opacity_off_mode, '--sensors-op': c.opacity_off_sensors,
      '--ext-temp-op': c.opacity_off_ext_temp, '--humidity-op': c.opacity_off_humidity,
      '--main-temp-op': c.opacity_off_main_temp, '--time-op': c.opacity_off_time,
      '--timer-op': c.opacity_off_timer, '--weather-op': c.opacity_off_weather, '--wind-op': c.opacity_off_wind,
    };
    const isTimerActive = this._timerStateObj && this._timerStateObj.state === 'active';
    for (const [cssVar, offValue] of Object.entries(opacityVars)) {
      let finalVal = power ? '1' : offValue;
      if (this._timerEditMode && (cssVar === '--timer-op' || cssVar === '--main-temp-op')) finalVal = '1';
      if (isTimerActive && cssVar === '--timer-op') finalVal = '1';
      host.style.setProperty(cssVar, finalVal);
    }

    const set = (key, val) => { const el = this._el(key); if (el) el.textContent = val; };
    set('temp-num', temp);
    set('room-temp', roomTemp);
    set('room-hum', roomHum);
    set('weather-temp', outTemp);
    set('wind-speed', outSecondary);
    const windUnitEl = this._el('wind-unit');
    if (windUnitEl) windUnitEl.textContent = c.outdoor_secondary === 'humidity' ? '%' : this._t('unit_wind');

    const statusIconEl = this._el('status-icon');
    if (statusIconEl) statusIconEl.classList.toggle('active', isRunning);

    this._el('fan-icon')?.classList.toggle('spinning', power);
    this._el('turbo-badge')?.classList.toggle('turbo-badge--on', mode2);
    this._el('btn-power')?.classList.toggle('btn-power--on', power);
    this._el('btn-turbo')?.classList.toggle('btn-turbo--on', mode2);
    this._el('btn-plus')?.classList.toggle('btn--disabled', mode2);
    this._el('btn-minus')?.classList.toggle('btn--disabled', mode2);

    c.timer_presets.forEach((m) => {
      this._el(`btn-t${m}`)?.classList.toggle('btn-timer--on', ha_timer_active_minutes === m);
    });

    const humBlock = this._el('ext-hum-block');
    if (humBlock) humBlock.style.display = c.room_humidity_sensor ? '' : 'none';
    const weatherBlock = this._el('weather-temp-block');
    if (weatherBlock) weatherBlock.style.display = (c.weather_entity || c.outdoor_temp_sensor) ? '' : 'none';
    const windBlock = this._el('wind-block');
    if (windBlock) windBlock.style.display = (c.outdoor_secondary !== 'none' && (c.weather_entity || c.outdoor_humidity_sensor)) ? '' : 'none';

    const dynBtn = this._el('btn-dyn-timer');
    if (dynBtn) dynBtn.style.display = c.timer_helper ? '' : 'none';
    c.timer_presets.forEach((m) => { const b = this._el(`btn-t${m}`); if (b) b.style.display = c.timer_helper ? '' : 'none'; });

    const centerGroupEl = this._el('center-group');
    if (centerGroupEl) centerGroupEl.classList.toggle('center-group--timer-mode', this._timerEditMode);
    this._el('btn-dyn-timer')?.classList.toggle('btn-dyn-timer--active', this._timerEditMode);
  }

  _css() { return `
    :host { display: block; isolation: isolate; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .wrapper { container-type: inline-size; container-name: ac; width: 100%; }
    .card {
      position: relative; border-radius: 3.8cqw; padding: 2.8cqw 3.2cqw 0; aspect-ratio: ${this.config.aspect_ratio};
      display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      user-select: none; overflow: hidden;
      background:
        linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 25%, transparent 50%, rgba(255,255,255,0.04) 100%),
        linear-gradient(160deg, #1a1c20 0%, #0e0f12 60%, #09090c 100%);
      border: 0.12cqw solid rgba(255,255,255,0.12); border-bottom-color: rgba(255,255,255,0.04); border-right-color: rgba(255,255,255,0.06);
      box-shadow: 0 12px 40px rgba(0,0,0,0.75), 0 4px 12px rgba(0,0,0,0.5), inset 1px 1px 0 rgba(255,255,255,0.08), inset -1px -1px 0 rgba(0,0,0,0.6);
    }
    .card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 42%;
      background: linear-gradient(180deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 50%, transparent 100%);
      border-radius: 3.8cqw 3.8cqw 60% 60%; pointer-events: none;
    }
    .screen {
      flex: 1; border-radius: 1.8cqw; position: relative; overflow: hidden; border: 0.5cqw solid rgba(0,0,0,0.55);
      box-shadow: inset 0 0.8cqw 2cqw rgba(0,0,0,0.3), inset 0 -0.2cqw 0.4cqw rgba(255,255,255,0.2), 0 0.2cqw 0.6cqw rgba(0,0,0,0.35);
      background: linear-gradient(160deg, #d0d5d2 0%, #c4cac6 30%, #bcc3be 60%, #b5bcb8 100%);
    }
    .screen::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 38%;
      background: linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 70%, transparent 100%);
      border-radius: 1.8cqw 1.8cqw 0 0; pointer-events: none; z-index: 2;
    }
    .screen::after {
      content: ''; position: absolute; inset: 0;
      background: repeating-linear-gradient(180deg, transparent 0px, transparent 2.5px, rgba(0,0,0,0.03) 2.5px, rgba(0,0,0,0.03) 5px);
      pointer-events: none; z-index: 1;
    }
    .screen-inner { position: relative; height: 100%; width: 100%; }
    .clean-num { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 800; color: #1c2820; line-height: 1; }
    .seg { font-family: 'Seg7', 'Courier New', monospace; color: #1c2820; line-height: 1; }
    .screen-top { position: absolute; top: 1.8cqw; left: 2.5cqw; right: 2.5cqw; display: flex; justify-content: space-between; align-items: flex-start; }
    .col-left { display: flex; flex-direction: column; gap: 0.4cqw; }
    .mode-row { display: flex; align-items: center; gap: 0.7cqw; font-size: ${this.config.font_size_mode}; font-weight: 800; letter-spacing: 0.2cqw; color: #1c2820; opacity: var(--mode-op); transition: opacity 0.3s; }
    .mode-icon { font-size: calc(${this.config.font_size_mode} + 0.2cqw); display: inline-block; animation: bob 3.5s ease-in-out infinite; }
    @keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.25cqw); } }
    .status-row { display: flex; align-items: center; opacity: var(--sensors-op); transition: opacity 0.3s; margin-top: 0.4cqw; color: #1c2820; }
    .status-ac-icon { width: ${this.config.font_size_sensors}; height: ${this.config.font_size_sensors}; transition: transform 0.3s; }
    .status-ac-icon .wind-line { opacity: 0; transition: opacity 0.3s; }
    .status-ac-icon.active .wind-line { opacity: 1; }
    .status-ac-icon.active .wl1 { animation: air-wave 1.2s ease-in-out infinite 0s; }
    .status-ac-icon.active .wl2 { animation: air-wave 1.2s ease-in-out infinite 0.2s; }
    .status-ac-icon.active .wl3 { animation: air-wave 1.2s ease-in-out infinite 0.4s; }
    @keyframes air-wave { 0%, 100% { opacity: 0.2; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.05); } }
    .col-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5cqw; }
    .ext-temp-block { display: flex; align-items: baseline; gap: 0.4cqw; opacity: var(--ext-temp-op); transition: opacity 0.3s; }
    .ext-hum-block { display: flex; align-items: baseline; gap: 0.4cqw; opacity: var(--humidity-op); transition: opacity 0.3s; }
    .ext-temp-val { font-size: ${this.config.font_size_ext_temp}; letter-spacing: 0.02cqw; }
    .ext-hum-val { font-size: ${this.config.font_size_humidity}; letter-spacing: 0.02cqw; }
    .ext-unit { font-size: calc(${this.config.font_size_labels} * 0.7); font-weight: 700; color: #1c2820; opacity: 0.8; font-family: -apple-system, sans-serif; }
    .weather-icon { width: calc(${this.config.font_size_weather} * 0.9); height: calc(${this.config.font_size_weather} * 0.9); color: #1c2820; opacity: 0.8; margin-right: 0.5cqw; }
    .wind-icon { width: calc(${this.config.font_size_wind} * 0.9); height: calc(${this.config.font_size_wind} * 0.9); color: #1c2820; opacity: 0.8; margin-right: 0.5cqw; }
    .screen-weather-temp { position: absolute; top: 12.5cqw; left: 2.5cqw; display: flex; align-items: center; opacity: var(--weather-op); transition: opacity 0.3s; z-index: 6; }
    .weather-val { font-size: ${this.config.font_size_weather}; letter-spacing: 0.02cqw; }
    .weather-unit { font-family: -apple-system, sans-serif; font-size: calc(${this.config.font_size_weather} * 0.6); font-weight: 700; color: #1c2820; opacity: 0.8; margin-left: 0.2cqw; }
    .screen-wind-speed { position: absolute; top: 17.5cqw; left: 2.5cqw; display: flex; align-items: center; opacity: var(--wind-op); transition: opacity 0.3s; z-index: 6; }
    .wind-val { font-size: ${this.config.font_size_wind}; letter-spacing: 0.02cqw; }
    .wind-unit { font-family: -apple-system, sans-serif; font-size: calc(${this.config.font_size_wind} * 0.6); font-weight: 700; color: #1c2820; opacity: 0.8; margin-left: 0.2cqw; }
    .screen-center { position: absolute; top: 48%; left: 50%; display: flex; justify-content: center; align-items: baseline; gap: 0.4cqw; opacity: var(--main-temp-op); transition: opacity 0.3s; z-index: 5; }
    .temp-big { font-size: ${this.config.font_size_main_temp}; letter-spacing: -0.5cqw; text-shadow: 0 0.2cqw 0.4cqw rgba(0,0,0,0.15); }
    .temp-degree { font-family: -apple-system, sans-serif; font-size: 4.2cqw; font-weight: 700; color: #1c2820; opacity: 0.8; }
    .screen-time { position: absolute; top: 68%; left: 50%; display: flex; justify-content: center; align-items: center; opacity: var(--time-op); transition: opacity 0.3s; z-index: 4; }
    .time-val { font-size: ${this.config.font_size_time}; letter-spacing: 0.05cqw; text-shadow: 0 0.1cqw 0.3cqw rgba(0,0,0,0.12); }
    .screen-timer-clock { position: absolute; top: 0; left: 50%; display: flex; align-items: center; font-size: ${this.config.font_size_timer_clock}; font-weight: 900; letter-spacing: 0.03cqw; color: #1c2820; opacity: var(--timer-op); transition: opacity 0.3s; z-index: 7; }
    .screen-timer-preset { position: absolute; top: 0; left: 50%; display: flex; align-items: center; font-size: ${this.config.font_size_timer_preset}; font-weight: 700; letter-spacing: 0.01cqw; font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1c2820; opacity: var(--timer-op); transition: opacity 0.3s; z-index: 7; }
    .timer-badge--on { opacity: 1; }
    .screen-bottom { position: absolute; bottom: 1.6cqw; left: 2.5cqw; right: 2.5cqw; display: flex; align-items: flex-end; justify-content: space-between; }
    .fan-group { display: flex; align-items: center; gap: 1.2cqw; opacity: var(--mode-op); transition: opacity 0.3s; }
    .fan-wrap { width: 5.5cqw; height: 5.5cqw; color: #1c2820; transform-origin: center center; }
    .fan-wrap svg { width: 100%; height: 100%; }
    .fan-wrap.spinning { animation: spin 1.6s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .fan-bars { display: flex; align-items: flex-end; gap: 0.5cqw; height: 3cqw; }
    .bar { width: 0.85cqw; background: #1c2820; border-radius: 0.4cqw; }
    .b1{height:0.9cqw} .b2{height:1.7cqw} .b3{height:2.4cqw} .b4{height:3cqw}
    .bottom-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.3cqw; opacity: var(--mode-op); transition: opacity 0.3s; }
    .turbo-badge { font-size: ${this.config.font_size_turbo_txt}; font-weight: 900; letter-spacing: 0.3cqw; font-family: -apple-system, sans-serif; color: #1c2820; opacity: 0.1; transition: opacity 0.3s; }
    .turbo-badge--on { opacity: 1; text-shadow: 0 0 1cqw rgba(80,140,220,0.5); }
    .controls { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: 100%; height: ${this.config.controls_height}; }
    .left-group { display: flex; justify-content: flex-start; align-items: center; }
    .center-group { display: flex; align-items: center; gap: 1.5cqw; justify-content: center; }
    .control-slot { position: relative; width: 9.5cqw; height: 9.5cqw; flex-shrink: 0; }
    .control-slot .btn { position: absolute; top: 0; left: 0; width: 100%; height: 100%; margin: 0; transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease; }
    .control-slot .btn-timer-minus, .control-slot .btn-timer-plus { opacity: 0; transform: scale(0.4) rotate(-135deg); pointer-events: none; }
    .control-slot .btn-temp-minus, .control-slot .btn-temp-plus { opacity: 1; transform: scale(1) rotate(0deg); pointer-events: auto; }
    .center-group--timer-mode .btn-temp-minus, .center-group--timer-mode .btn-temp-plus { opacity: 0; transform: scale(0.4) rotate(135deg); pointer-events: none; }
    .center-group--timer-mode .btn-timer-minus, .center-group--timer-mode .btn-timer-plus { opacity: 1; transform: scale(1) rotate(0deg); pointer-events: auto; }
    .control-slot .btn-timer-minus, .control-slot .btn-timer-plus { border-color: rgba(20, 184, 166, 0.3); color: #5eead4; background: linear-gradient(145deg, rgba(20,40,38,0.9) 0%, rgba(10,20,19,0.95) 100%); }
    .btn-dyn-timer { width: 4.8cqw; height: 4.8cqw; border-color: rgba(20, 184, 166, 0.25); color: rgba(45, 170, 155, 0.6); background: linear-gradient(145deg, rgba(30,40,38,0.8) 0%, rgba(15,25,23,0.9) 100%); }
    .btn-dyn-timer svg { width: 2.4cqw; height: 2.4cqw; }
    .btn-dyn-timer--active { border-color: #14b8a6; color: #5eead4; box-shadow: 0 0.4cqw 0 rgba(0,0,0,0.45), 0 0 2.5cqw rgba(20,184,166,0.55), inset 0 0.2cqw 0 rgba(255,255,255,0.07); animation: pulse-border 1.5s infinite alternate; }
    @keyframes pulse-border { 0% { box-shadow: 0 0.4cqw 0 rgba(0,0,0,0.45), 0 0 1.5cqw rgba(20,184,166,0.4); } 100% { box-shadow: 0 0.4cqw 0 rgba(0,0,0,0.45), 0 0 3.2cqw rgba(20,184,166,0.7); } }
    .btn {
      width: 10.5cqw; height: 10.5cqw; border-radius: 50%; border: 0.15cqw solid rgba(255,255,255,0.08);
      cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      color: rgba(160,175,165,0.65); transition: transform 0.1s ease, box-shadow 0.18s ease;
      background: linear-gradient(145deg, rgba(50,55,65,0.9) 0%, rgba(22,25,30,0.95) 100%);
      box-shadow: 0 0.5cqw 0 rgba(0,0,0,0.5), 0 0.8cqw 2cqw rgba(0,0,0,0.4), inset 0 0.2cqw 0 rgba(255,255,255,0.07), inset 0 -0.15cqw 0 rgba(0,0,0,0.4);
    }
    .btn svg { width: 4.5cqw; height: 4.5cqw; }
    .btn:active { transform: translateY(0.35cqw) scale(0.95); box-shadow: 0 0.15cqw 0 rgba(0,0,0,0.6), 0 0.3cqw 0.8cqw rgba(0,0,0,0.5), inset 0 0.4cqw 0.8cqw rgba(0,0,0,0.4); }
    .btn-sm { width: 100%; height: 100%; }
    .btn--disabled { opacity: 0.25; pointer-events: none; filter: grayscale(0.5); }
    .btn-power { border-color: rgba(100,55,15,0.5); color: rgba(130,70,20,0.65); }
    .btn-power--on { border-color: #c87820; color: #ffaa40; box-shadow: 0 0.5cqw 0 rgba(0,0,0,0.445), 0 0.8cqw 2cqw rgba(0,0,0,0.4), 0 0 3cqw rgba(200,120,30,0.55), inset 0 0.2cqw 0 rgba(255,255,255,0.1); }
    .btn-turbo { width: 10.5cqw; height: 10.5cqw; font-size: 1.85cqw; font-weight: 900; letter-spacing: 0.08cqw; border-color: rgba(18,55,95,0.45); color: rgba(70,125,165,0.55); z-index: 2; }
    .btn-turbo--on { border-color: #1a8fce; color: #40c0f5; box-shadow: 0 0.5cqw 0 rgba(0,0,0,0.45), 0 0.8cqw 2cqw rgba(0,0,0,0.4), 0 0 3cqw rgba(26,143,206,0.6), inset 0 0.2cqw 0 rgba(255,255,255,0.1); }
    .btn-timer { width: 8cqw; height: 8cqw; border-radius: 50%; font-size: 1.7cqw; font-weight: 900; border-color: rgba(15,118,110,0.35); color: rgba(45,170,155,0.55); background: linear-gradient(145deg, rgba(20,40,38,0.9) 0%, rgba(10,20,19,0.95) 100%); }
    .btn-timer--on { border-color: #14b8a6; color: #5eead4; box-shadow: 0 0.4cqw 0 rgba(0,0,0,0.45), 0 0 2.5cqw rgba(20,184,166,0.55), inset 0 0.2cqw 0 rgba(255,255,255,0.07); }
  `; }

  getCardSize() { return 3; }
  static getConfigElement() { return document.createElement('air-conditioner-card-editor'); }
  static getStubConfig() { return { remote_entity: '', device: '', room_temp_sensor: '' }; }
}

customElements.define('air-conditioner-card', AirConditionerCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'air-conditioner-card',
  name: 'Air Conditioner Card (IR/Broadlink)',
  description: 'Універсальна картка керування кондиціонером через ІЧ-пульт (Broadlink), з навчанням кодів у редакторі.',
  preview: false,
});

// ---------------------------------------------------------------------------
// Візуальний редактор
// ---------------------------------------------------------------------------
class AirConditionerCardEditor extends HTMLElement {
  constructor() {
    super();
    this._tab = 'entities';
    this._learning = null; // ключ поля, яке зараз навчається
  }

  setConfig(config) { this._config = { ...config }; this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }

  _t(key) { return translate(this._config?.lang, key); }

  _emitChange(newConfig) {
    this._config = newConfig;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
  }

  _setField(key, value) {
    this._emitChange({ ...this._config, [key]: value });
  }

  _setCommand(key, value) {
    const commands = { ...(this._config.commands || {}), [key]: value };
    this._emitChange({ ...this._config, commands });
  }

  _setScale(key, value) {
    const clamped = Math.max(0.4, Math.min(3, Math.round(value * 20) / 20));
    this._emitChange({ ...this._config, [`offset_${key}_scale`]: clamped });
  }

  async _learn(cmdKey, buttonEl) {
    const remote = this._config.remote_entity;
    if (!remote || !this._hass) {
      alert(this._t('learn_need_remote'));
      return;
    }
    if (this._learning) return;
    this._learning = cmdKey;
    const originalText = buttonEl.textContent;
    buttonEl.textContent = this._t('learn_wait');
    buttonEl.disabled = true;

    try {
      const before = new Set(
        Object.values(this._hass.states)
          .filter((s) => s.entity_id.startsWith('persistent_notification.'))
          .map((s) => s.entity_id)
      );

      await this._hass.callService('remote', 'learn_command', {
        entity_id: remote,
        timeout: 15,
      });

      const found = await this._pollForLearnedCode(before, 16000);
      if (found) {
        this._setCommand(cmdKey, found);
        buttonEl.textContent = this._t('learn_ok');
      } else {
        buttonEl.textContent = this._t('learn_fail');
      }
    } catch (e) {
      console.error('AC card learn error', e);
      buttonEl.textContent = this._t('learn_err');
    } finally {
      setTimeout(() => { buttonEl.textContent = originalText; buttonEl.disabled = false; }, 1800);
      this._learning = null;
    }
  }

  _pollForLearnedCode(beforeSet, timeoutMs) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const states = Object.values(this._hass.states).filter(
          (s) => s.entity_id.startsWith('persistent_notification.') && !beforeSet.has(s.entity_id)
        );
        for (const s of states) {
          const text = `${s.attributes.title || ''} ${s.attributes.message || ''}`;
          const match = text.match(/[A-Za-z0-9+/=]{20,}/);
          if (match) {
            this._hass.callService('persistent_notification', 'dismiss', { notification_id: s.entity_id.replace('persistent_notification.', '') });
            resolve(match[0]);
            return;
          }
        }
        if (Date.now() - start > timeoutMs) { resolve(null); return; }
        setTimeout(tick, 700);
      };
      tick();
    });
  }

  _render() {
    if (!this._hass || !this._config) return;

    const c = this._config;
    const tempMin = Number(c.temp_min ?? 16);
    const tempMax = Number(c.temp_max ?? 30);
    const commands = c.commands || {};

    this.innerHTML = `
      <style>
        .lang-bar { display: flex; align-items: center; gap: 0.6em; margin-bottom: 0.9em; padding-bottom: 0.9em; border-bottom: 1px solid var(--divider-color, #ccc); flex-wrap: wrap; }
        .lang-bar .lang-label { font-size: 0.85em; opacity: 0.75; margin-right: 4px; }
        .lang-btn { padding: 5px 12px; border-radius: 20px; border: 1px solid var(--divider-color, #ccc); background: var(--card-background-color, #fff); color: var(--primary-text-color, #000); cursor: pointer; font-size: 0.85em; }
        .lang-btn--active { background: var(--primary-color, #03a9f4); border-color: var(--primary-color, #03a9f4); color: white; font-weight: 600; }
        .tabs { display: flex; gap: 0.5em; margin-bottom: 1em; flex-wrap: wrap; }
        .tab { padding: 6px 12px; border-radius: 8px; background: var(--secondary-background-color, #eee); cursor: pointer; font-size: 0.9em; }
        .tab--active { background: var(--primary-color, #03a9f4); color: white; }
        .panel { display: flex; flex-direction: column; gap: 10px; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field label { font-size: 0.85em; opacity: 0.75; }
        .row { display: flex; gap: 8px; align-items: center; }
        .row input[type="text"] { flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--divider-color, #ccc); background: var(--card-background-color, #fff); color: var(--primary-text-color, #000); }
        .row input[type="number"] { width: 80px; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--divider-color, #ccc); }
        .learn-btn { white-space: nowrap; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--primary-color, #03a9f4); background: transparent; color: var(--primary-color, #03a9f4); cursor: pointer; font-size: 0.85em; }
        .temp-grid { display: grid; grid-template-columns: 50px 1fr auto; gap: 6px 8px; align-items: center; max-height: 320px; overflow-y: auto; padding-right: 4px; }
        .section-title { font-weight: 600; margin-top: 6px; }
        .hint { font-size: 0.8em; opacity: 0.6; }
        .pos-item { display: grid; grid-template-columns: 1fr 90px 90px 84px; gap: 8px; align-items: center; }
        .pos-item label { font-size: 0.85em; }
        .stepper { display: flex; align-items: center; gap: 2px; justify-content: flex-end; }
        .stepper button { width: 22px; height: 22px; line-height: 1; border-radius: 5px; border: 1px solid var(--divider-color, #ccc); background: var(--card-background-color, #fff); color: var(--primary-text-color, #000); cursor: pointer; font-size: 0.9em; }
        .stepper span { font-size: 0.78em; width: 30px; text-align: center; opacity: 0.8; }
        .drag-canvas-wrap { position: relative; width: 100%; margin-bottom: 14px; border-radius: 10px; background: var(--secondary-background-color, #222); }
        .drag-canvas-wrap air-conditioner-card { display: block; pointer-events: none; }
        .drag-handle { position: absolute; border: 1.5px dashed rgba(3,169,244,0.9); border-radius: 6px; background: rgba(3,169,244,0.12); cursor: grab; touch-action: none; box-sizing: border-box; }
        .drag-handle:hover, .drag-handle.dragging { background: rgba(3,169,244,0.28); border-color: #03a9f4; }
        .drag-handle .handle-label { position: absolute; top: -1.4em; left: 0; font-size: 10px; white-space: nowrap; background: rgba(3,169,244,0.95); color: #fff; padding: 1px 5px; border-radius: 4px; pointer-events: none; }
        .drag-handle .handle-size { position: absolute; bottom: -11px; right: -11px; display: flex; gap: 2px; }
        .drag-handle .handle-size button { width: 22px; height: 22px; border-radius: 50%; border: none; background: #03a9f4; color: #fff; font-size: 13px; line-height: 1; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.5); pointer-events: all; }
        ha-textfield, ha-entity-picker { width: 100%; }
      </style>

      <div class="lang-bar">
        <span class="lang-label">${this._t('lang_label')}:</span>
        ${LANGS.map((code) => `<button type="button" class="lang-btn${code === (c.lang || 'uk') ? ' lang-btn--active' : ''}" data-lang="${code}">${LANG_NAMES[code]}</button>`).join('')}
      </div>

      <div class="tabs">
        <div class="tab" data-tab="entities">${this._t('tab_entities')}</div>
        <div class="tab" data-tab="commands">${this._t('tab_commands')}</div>
        <div class="tab" data-tab="timers">${this._t('tab_timers')}</div>
        <div class="tab" data-tab="position">${this._t('tab_position')}</div>
        <div class="tab" data-tab="appearance">${this._t('tab_appearance')}</div>
      </div>
      <div class="panel" id="panel"></div>
    `;

    this.querySelectorAll('.lang-btn').forEach((el) => {
      el.addEventListener('click', () => this._setField('lang', el.dataset.lang));
    });

    this.querySelectorAll('.tab').forEach((el) => {
      el.classList.toggle('tab--active', el.dataset.tab === this._tab);
      el.addEventListener('click', () => { this._tab = el.dataset.tab; this._render(); });
    });

    const panel = this.querySelector('#panel');

    if (this._tab === 'entities') {
      panel.appendChild(this._entityField(this._t('f_remote'), 'remote_entity', 'remote'));
      panel.appendChild(this._textField(this._t('f_device'), 'device'));
      panel.appendChild(this._entityField(this._t('f_binary_sensor'), 'binary_sensor', 'binary_sensor'));
      panel.appendChild(this._entityField(this._t('f_room_temp'), 'room_temp_sensor', 'sensor'));
      panel.appendChild(this._entityField(this._t('f_room_hum'), 'room_humidity_sensor', 'sensor'));
      panel.appendChild(this._entityField(this._t('f_weather'), 'weather_entity', 'weather'));
      panel.appendChild(this._entityField(this._t('f_outdoor_temp'), 'outdoor_temp_sensor', 'sensor'));
      panel.appendChild(this._selectField(this._t('f_outdoor_secondary'), 'outdoor_secondary', [
        ['wind', this._t('opt_wind')], ['humidity', this._t('opt_humidity')], ['none', this._t('opt_none')],
      ]));
      panel.appendChild(this._entityField(this._t('f_outdoor_hum'), 'outdoor_humidity_sensor', 'sensor'));
      panel.appendChild(this._entityField(this._t('f_temp_helper'), 'temp_helper', 'input_number'));
      panel.appendChild(this._entityField(this._t('f_timer_helper'), 'timer_helper', 'timer'));
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = this._t('hint_helpers');
      panel.appendChild(hint);
    }

    if (this._tab === 'commands') {
      const mk = (label, key) => this._commandRow(label, key, commands);
      panel.appendChild(this._sectionTitle(this._t('sec_main_buttons')));
      panel.appendChild(mk(this._t('f_btn_on'), 'on'));
      panel.appendChild(mk(this._t('f_btn_off'), 'off'));
      panel.appendChild(this._textField(this._t('f_mode2_name'), 'mode2_name'));
      panel.appendChild(this._numberField(this._t('f_mode2_temp'), 'mode2_temp', 16, 30));
      panel.appendChild(mk(this._t('f_mode2_on'), 'mode2_on'));
      panel.appendChild(mk(this._t('f_mode2_off'), 'mode2_off'));
      panel.appendChild(this._numberField(this._t('f_default_temp'), 'default_temp', 16, 30));

      panel.appendChild(this._sectionTitle(this._t('sec_plusminus')));
      panel.appendChild(mk(this._t('f_plus'), 'plus'));
      panel.appendChild(mk(this._t('f_minus'), 'minus'));
      const hint2 = document.createElement('div');
      hint2.className = 'hint';
      hint2.textContent = this._t('hint_plusminus');
      panel.appendChild(hint2);

      panel.appendChild(this._sectionTitle(`${this._t('sec_temp_codes')} (${tempMin}–${tempMax}°C)`));
      panel.appendChild(this._numberField(this._t('f_temp_min'), 'temp_min', 10, 30));
      panel.appendChild(this._numberField(this._t('f_temp_max'), 'temp_max', 10, 35));
      const grid = document.createElement('div');
      grid.className = 'temp-grid';
      for (let t = tempMin; t <= tempMax; t++) {
        grid.appendChild(this._tempRow(t, commands));
      }
      panel.appendChild(grid);
    }

    if (this._tab === 'timers') {
      const presets = Array.isArray(c.timer_presets) ? c.timer_presets : [30, 60, 90, 120];
      panel.appendChild(this._sectionTitle(this._t('sec_presets')));
      const row = document.createElement('div');
      row.className = 'row';
      presets.forEach((val, idx) => {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.value = val;
        inp.addEventListener('change', () => {
          const next = [...presets];
          next[idx] = parseInt(inp.value) || 0;
          this._setField('timer_presets', next);
        });
        row.appendChild(inp);
      });
      panel.appendChild(row);
      panel.appendChild(this._numberField(this._t('f_timer_step'), 'timer_step', 1, 60));
    }

    if (this._tab === 'position') {
      panel.appendChild(this._sectionTitle(this._t('sec_pos')));
      const hintDrag = document.createElement('div');
      hintDrag.className = 'hint';
      hintDrag.textContent = this._t('hint_pos_drag');
      panel.appendChild(hintDrag);
      panel.appendChild(this._buildDragCanvas());

      POSITIONABLE_ELEMENTS.forEach((item) => {
        const label = this._t(`lbl_${item.key}`) || item.label;
        const xKey = `offset_${item.key}_x`;
        const yKey = `offset_${item.key}_y`;
        const scaleKey = `offset_${item.key}_scale`;
        const xVal = numFromCqw(c[xKey]);
        const yVal = numFromCqw(c[yKey]);
        const scaleVal = numScale(c[scaleKey]);
        const wrap = document.createElement('div');
        wrap.className = 'pos-item';
        wrap.innerHTML = `<label>${label}</label>`;
        const xInput = document.createElement('input');
        xInput.type = 'range'; xInput.min = -30; xInput.max = 30; xInput.step = 0.5; xInput.value = xVal;
        xInput.addEventListener('input', () => this._setField(xKey, `${xInput.value}cqw`));
        const yInput = document.createElement('input');
        yInput.type = 'range'; yInput.min = -30; yInput.max = 30; yInput.step = 0.5; yInput.value = yVal;
        yInput.addEventListener('input', () => this._setField(yKey, `${yInput.value}cqw`));

        const stepper = document.createElement('div');
        stepper.className = 'stepper';
        const minusBtn = document.createElement('button'); minusBtn.type = 'button'; minusBtn.textContent = '−';
        const sizeLbl = document.createElement('span'); sizeLbl.textContent = `${Math.round(scaleVal * 100)}%`;
        const plusBtn = document.createElement('button'); plusBtn.type = 'button'; plusBtn.textContent = '+';
        minusBtn.addEventListener('click', () => this._setScale(item.key, numScale(this._config[scaleKey]) - 0.05));
        plusBtn.addEventListener('click', () => this._setScale(item.key, numScale(this._config[scaleKey]) + 0.05));
        stepper.appendChild(minusBtn); stepper.appendChild(sizeLbl); stepper.appendChild(plusBtn);

        wrap.appendChild(xInput);
        wrap.appendChild(yInput);
        wrap.appendChild(stepper);
        panel.appendChild(wrap);
      });
    }

    if (this._tab === 'appearance') {
      panel.appendChild(this._textField(this._t('f_aspect'), 'aspect_ratio'));
      panel.appendChild(this._textField(this._t('f_controls_height'), 'controls_height'));
      panel.appendChild(this._textField(this._t('f_font_path'), 'font_path'));
      panel.appendChild(this._sectionTitle(this._t('sec_font_sizes')));
      [
        ['font_size_main_temp', 'lbl_main_temp'],
        ['font_size_ext_temp', 'lbl_ext_temp'],
        ['font_size_humidity', 'lbl_humidity'],
        ['font_size_time', 'lbl_time'],
        ['font_size_weather', 'lbl_weather'],
        ['font_size_wind', 'lbl_wind'],
      ].forEach(([key, labelKey]) => panel.appendChild(this._textField(this._t(labelKey), key)));
    }
  }

  // -------------------------------------------------------------------------
  // Живий попередній перегляд картки з можливістю перетягування елементів
  // мишею/пальцем прямо на екрані, і зміни розміру кнопками "−/+".
  // -------------------------------------------------------------------------
  _buildDragCanvas() {
    const wrap = document.createElement('div');
    wrap.className = 'drag-canvas-wrap';

    const liveCard = document.createElement('air-conditioner-card');
    wrap.appendChild(liveCard);

    const previewConfig = {
      ...this._config,
      // трохи "живих" даних, щоб було видно всі елементи на прев'ю
      room_temp_sensor: this._config.room_temp_sensor || '',
    };
    liveCard.setConfig(previewConfig);
    liveCard.hass = this._hass;

    // Форсуємо стан "увімкнено", щоб всі елементи (не напівпрозорі) було видно й зручно тягати.
    requestAnimationFrame(() => {
      try {
        liveCard._local.power = true;
        liveCard._local.temp = previewConfig.default_temp || 24;
        liveCard._sensors = { roomTemp: '24.0', roomHum: '48', outTemp: '19.0', outSecondary: '3.2', isRunning: true };
        liveCard._render();
      } catch (e) { /* ignore */ }
      this._positionDragHandles(wrap, liveCard);
    });

    // Перебудовуємо мітки, коли змінюється розмір контейнера (наприклад, вкладку відкрили в іншому вікні).
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => this._positionDragHandles(wrap, liveCard));
      ro.observe(wrap);
    }

    return wrap;
  }

  _positionDragHandles(wrap, liveCard) {
    wrap.querySelectorAll('.drag-handle').forEach((h) => h.remove());
    const screenEl = liveCard.shadowRoot && liveCard.shadowRoot.querySelector('.screen');
    if (!screenEl) return;
    const screenRect = screenEl.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    if (screenRect.width === 0) return;
    const cqwPx = screenRect.width / 100; // 1cqw у пікселях

    POSITIONABLE_ELEMENTS.forEach((item) => {
      const dataEl = POSITIONABLE_DATA_EL[item.key];
      const targetEl = liveCard.shadowRoot.querySelector(`[data-el="${dataEl}"]`);
      if (!targetEl) return;
      const r = targetEl.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;

      const handle = document.createElement('div');
      handle.className = 'drag-handle';
      handle.style.left = `${r.left - wrapRect.left}px`;
      handle.style.top = `${r.top - wrapRect.top}px`;
      handle.style.width = `${Math.max(r.width, 18)}px`;
      handle.style.height = `${Math.max(r.height, 18)}px`;

      const label = document.createElement('div');
      label.className = 'handle-label';
      label.textContent = this._t(`lbl_${item.key}`) || item.label;
      handle.appendChild(label);

      const sizeBox = document.createElement('div');
      sizeBox.className = 'handle-size';
      const minusBtn = document.createElement('button'); minusBtn.type = 'button'; minusBtn.textContent = '−';
      const plusBtn = document.createElement('button'); plusBtn.type = 'button'; plusBtn.textContent = '+';
      const scaleKey = `offset_${item.key}_scale`;
      minusBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      plusBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      minusBtn.addEventListener('click', (e) => { e.stopPropagation(); this._setScale(item.key, numScale(this._config[scaleKey]) - 0.05); });
      plusBtn.addEventListener('click', (e) => { e.stopPropagation(); this._setScale(item.key, numScale(this._config[scaleKey]) + 0.05); });
      sizeBox.appendChild(minusBtn); sizeBox.appendChild(plusBtn);
      handle.appendChild(sizeBox);

      this._attachDragBehavior(handle, item.key, cqwPx);
      wrap.appendChild(handle);
    });
  }

  _attachDragBehavior(handle, key, cqwPx) {
    const xKey = `offset_${key}_x`;
    const yKey = `offset_${key}_y`;
    let startX = 0, startY = 0, baseX = 0, baseY = 0, dragging = false;

    handle.addEventListener('pointerdown', (e) => {
      if (e.target !== handle && e.target.tagName === 'BUTTON') return;
      dragging = true;
      handle.classList.add('dragging');
      handle.setPointerCapture(e.pointerId);
      startX = e.clientX; startY = e.clientY;
      baseX = numFromCqw(this._config[xKey]);
      baseY = numFromCqw(this._config[yKey]);
      e.preventDefault();
    });

    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dxCqw = (e.clientX - startX) / cqwPx;
      const dyCqw = (e.clientY - startY) / cqwPx;
      const nx = Math.round((baseX + dxCqw) * 2) / 2;
      const ny = Math.round((baseY + dyCqw) * 2) / 2;
      handle.style.transform = `translate(${(nx - baseX) * cqwPx}px, ${(ny - baseY) * cqwPx}px)`;
      handle.dataset.pendingX = nx;
      handle.dataset.pendingY = ny;
    });

    const commit = (e) => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      handle.style.transform = '';
      const nx = handle.dataset.pendingX !== undefined ? parseFloat(handle.dataset.pendingX) : baseX;
      const ny = handle.dataset.pendingY !== undefined ? parseFloat(handle.dataset.pendingY) : baseY;
      this._emitChange({ ...this._config, [xKey]: `${nx}cqw`, [yKey]: `${ny}cqw` });
    };
    handle.addEventListener('pointerup', commit);
    handle.addEventListener('pointercancel', commit);
  }

  _sectionTitle(text) {
    const el = document.createElement('div');
    el.className = 'section-title';
    el.textContent = text;
    return el;
  }

  _entityField(label, key, domain) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `<label>${label}</label>`;
    const picker = document.createElement('ha-entity-picker');
    picker.hass = this._hass;
    picker.value = this._config[key] || '';
    if (domain) picker.includeDomains = [domain];
    picker.addEventListener('value-changed', (ev) => { ev.stopPropagation(); this._setField(key, ev.detail.value || ''); });
    wrap.appendChild(picker);
    return wrap;
  }

  _textField(label, key) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `<label>${label}</label>`;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = this._config[key] ?? '';
    input.addEventListener('change', () => this._setField(key, input.value));
    wrap.appendChild(input);
    return wrap;
  }

  _numberField(label, key, min, max) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `<label>${label}</label>`;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = min; input.max = max;
    input.value = this._config[key] ?? '';
    input.addEventListener('change', () => this._setField(key, parseFloat(input.value)));
    wrap.appendChild(input);
    return wrap;
  }

  _selectField(label, key, options) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `<label>${label}</label>`;
    const select = document.createElement('select');
    options.forEach(([val, text]) => {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = text;
      if ((this._config[key] || 'wind') === val) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => this._setField(key, select.value));
    wrap.appendChild(select);
    return wrap;
  }

  _commandRow(label, cmdKey, commands) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `<label>${label}</label>`;
    const row = document.createElement('div');
    row.className = 'row';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = this._t('ph_code');
    input.value = commands[cmdKey] || '';
    input.addEventListener('change', () => this._setCommand(cmdKey, input.value));
    const learnBtn = document.createElement('button');
    learnBtn.className = 'learn-btn';
    learnBtn.type = 'button';
    learnBtn.textContent = this._t('learn_btn');
    learnBtn.addEventListener('click', () => this._learn(cmdKey, learnBtn).then(() => { input.value = this._config.commands?.[cmdKey] || input.value; }));
    row.appendChild(input);
    row.appendChild(learnBtn);
    wrap.appendChild(row);
    return wrap;
  }

  _tempRow(temp, commands) {
    const rowLabel = document.createElement('div');
    rowLabel.textContent = `${temp}°C`;
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = this._t('ph_code_short');
    input.value = commands[String(temp)] || '';
    input.addEventListener('change', () => this._setCommand(String(temp), input.value));
    const learnBtn = document.createElement('button');
    learnBtn.className = 'learn-btn';
    learnBtn.type = 'button';
    learnBtn.textContent = '📡';
    learnBtn.title = this._t('learn_btn');
    learnBtn.addEventListener('click', () => this._learn(String(temp), learnBtn).then(() => { input.value = this._config.commands?.[String(temp)] || input.value; }));

    const frag = document.createDocumentFragment();
    frag.appendChild(rowLabel);
    frag.appendChild(input);
    frag.appendChild(learnBtn);
    const container = document.createElement('div');
    container.style.display = 'contents';
    container.appendChild(frag);
    return container;
  }
}
customElements.define('air-conditioner-card-editor', AirConditionerCardEditor);
