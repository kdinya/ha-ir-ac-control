const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.customElements = dom.window.customElements;
global.CustomEvent = dom.window.CustomEvent;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
if (!dom.window.ResizeObserver) {
  dom.window.ResizeObserver = class { observe() {} disconnect() {} };
}
global.ResizeObserver = dom.window.ResizeObserver;

const code = fs.readFileSync(path.join(__dirname, '..', 'air-conditioner-card.js'), 'utf8');
dom.window.eval(code);

// --- 0. Re-evaluating the same script (simulates HA "Reload resources"
//     without a full browser refresh) must NOT throw. ---
try {
  dom.window.eval(code);
  console.log('Double-load guard OK: no "already defined" exception');
} catch (e) {
  throw new Error('Double-load of the resource threw: ' + e.message);
}
if (window.customCards.filter((c) => c.type === 'ha-ir-ac-control-card').length !== 1) {
  throw new Error('window.customCards got duplicated on double-load');
}
console.log('customCards duplicate-guard OK');

const fakeHass = {
  states: {
    'remote.broadlink': { state: 'idle' },
    'sensor.room_temp': { state: '23.4' },
  },
  callService: (domain, service, data) => {
    console.log('callService', domain, service, data);
  },
};

// --- 1. Card renders without throwing, in each language ---
for (const lang of ['uk', 'en', 'ru']) {
  const card = document.createElement('ha-ir-ac-control-card');
  card.setConfig({
    remote_entity: 'remote.broadlink',
    room_temp_sensor: 'sensor.room_temp',
    lang,
  });
  card.hass = fakeHass;
  document.body.appendChild(card);
  const timeEl = card.shadowRoot.querySelector('[data-el="time-num"]');
  if (!timeEl) throw new Error('time element missing for lang ' + lang);
  const windUnit = card.shadowRoot.querySelector('[data-el="wind-unit"]').textContent;
  console.log(`[${lang}] card OK, wind unit = "${windUnit}"`);

  // toggle power on
  card._act('power');
  console.log(`[${lang}] power toggled, local.power=`, card._local.power);
}

// --- 2. Editor renders + language switch + drag canvas builds handles ---
// jsdom has no real layout engine (getBoundingClientRect always returns 0),
// so stub it with plausible pixel values to exercise the handle-building code path.
let rectCounter = 0;
dom.window.Element.prototype.getBoundingClientRect = function () {
  rectCounter++;
  return { left: 10 + (rectCounter % 5) * 20, top: 10 + (rectCounter % 3) * 15, width: 40, height: 20, right: 0, bottom: 0 };
};

const editor = document.createElement('ha-ir-ac-control-card-editor');
let currentConfig = { remote_entity: 'remote.broadlink', room_temp_sensor: 'sensor.room_temp' };
editor.addEventListener('config-changed', (e) => {
  currentConfig = e.detail.config;
  editor.setConfig(currentConfig);
});
editor.setConfig(currentConfig);
editor.hass = fakeHass;
document.body.appendChild(editor);

const langBtnEn = editor.querySelector('.lang-btn[data-lang="en"]');
if (!langBtnEn) throw new Error('EN lang button missing');
langBtnEn.click();
console.log('lang switched to', currentConfig.lang);
if (currentConfig.lang !== 'en') throw new Error('lang switch failed');

// Regression check: clicking a language button must repaint the editor's
// OWN DOM immediately, not just update the config value. Previously
// _setField()'s "suppress the next echoed render" mechanism (added to stop
// Position-tab sliders from jumping mid-drag) silently ate the language
// switch's render too, so the editor kept showing the old language until
// some unrelated action (e.g. a tab click) happened to force a repaint.
const activeLangBtn = editor.querySelector('.lang-btn--active');
if (!activeLangBtn || activeLangBtn.dataset.lang !== 'en') {
  throw new Error('lang switch did not repaint the language bar itself');
}
const entitiesTabBtn = editor.querySelector('.tab[data-tab="entities"]');
if (!entitiesTabBtn || entitiesTabBtn.textContent.trim() !== 'Entities') {
  throw new Error(`lang switch did not repaint tab labels — got "${entitiesTabBtn && entitiesTabBtn.textContent.trim()}"`);
}
console.log('lang-switch repaint OK: editor DOM updated immediately, not just config');

// --- 3. Every editor tab renders without throwing and has expected content. ---
const expectedTabs = ['entities', 'commands', 'timers', 'position', 'appearance'];
for (const tabName of expectedTabs) {
  const tabBtn = editor.querySelector(`.tab[data-tab="${tabName}"]`);
  if (!tabBtn) throw new Error(`Tab button missing: ${tabName}`);
  tabBtn.click();
  const panel = editor.querySelector('#panel');
  if (!panel || panel.children.length === 0) {
    throw new Error(`Tab "${tabName}" rendered an empty panel`);
  }
  console.log(`[tab:${tabName}] OK, ${panel.children.length} panel children`);
}

// commands tab must contain the temperature-code grid + learn buttons
editor.querySelector('.tab[data-tab="commands"]').click();
const learnButtons = editor.querySelectorAll('.learn-btn');
if (learnButtons.length < 5) throw new Error('Expected multiple "Learn" buttons on commands tab, found ' + learnButtons.length);
console.log('learn buttons found:', learnButtons.length);

// Regression: every learn button must show text, not just an icon — the
// per-temperature rows used to be icon-only ('📡') while every other
// learn button showed '📡 Learn'/'📡 Навчити' etc.
for (const btn of learnButtons) {
  if (!btn.textContent.trim() || btn.textContent.trim().length < 3) {
    throw new Error(`A learn button is icon-only (no visible label): "${btn.textContent}"`);
  }
}
console.log('learn-button labels OK: every learn button shows text, not just an icon');

// Regression: the separate ON-timer helper field must be gone entirely.
editor.querySelector('.tab[data-tab="entities"]').click();
if (editor.innerHTML.includes('timer_helper_on')) {
  throw new Error('timer_helper_on field still present in the editor — should have been removed');
}
console.log('timer_helper_on removal OK: no trace of the field in the entities tab');

// Regression: an empty (0) timer preset must render as a dimmed, disabled
// button on the card, not a live button that silently no-ops when pressed.
const presetTestCard = document.createElement('ha-ir-ac-control-card');
presetTestCard.setConfig({ lang: 'en', remote_entity: 'remote.test', timer_helper: 'timer.test', timer_presets: [30, 0, 90, 120] });
presetTestCard.hass = fakeHass;
const emptyPresetBtn = presetTestCard.shadowRoot.querySelector('[data-el="btn-t-empty-1"]');
if (!emptyPresetBtn) throw new Error('Empty preset button not found (expected data-el="btn-t-empty-1")');
if (!emptyPresetBtn.classList.contains('btn--disabled')) {
  throw new Error('Empty preset button is missing the btn--disabled class');
}
const filledPresetBtn = presetTestCard.shadowRoot.querySelector('[data-el="btn-t30"]');
if (!filledPresetBtn || filledPresetBtn.classList.contains('btn--disabled')) {
  throw new Error('Filled preset button should not be disabled');
}
console.log('empty-preset OK: unset preset button is disabled/dimmed, filled ones are not');

// version exposed on the class, used by users to verify the *active* class version
if (customElements.get('ha-ir-ac-control-card-editor').VERSION !== customElements.get('ha-ir-ac-control-card').VERSION) {
  throw new Error('Card/editor VERSION mismatch');
}
console.log('active class VERSION:', customElements.get('ha-ir-ac-control-card-editor').VERSION);

// switch to position tab and check drag handles built
const posTab = editor.querySelector('.tab[data-tab="position"]');
posTab.click();
setTimeout(() => {
  const handles = editor.querySelectorAll('.drag-handle');
  console.log('drag handles found:', handles.length);
  if (handles.length === 0) throw new Error('No drag handles built');

  // --- 4. Regression test: repeated hass "ticks" (HA calls the hass setter
  //     on virtually every state change anywhere in the system, many times
  //     a second) must NOT tear down the editor DOM. Previously every tick
  //     did a full innerHTML rebuild, which nuked the entity-picker's open
  //     dropdown mid-keystroke and aborted in-progress Position-tab drags
  //     by destroying the handle out from under the pointer. ---
  editor.querySelector('.tab[data-tab="entities"]').click();
  const pickerBefore = editor.querySelector('ha-entity-picker');
  if (!pickerBefore) throw new Error('entity picker missing on entities tab');
  for (let i = 0; i < 5; i++) {
    editor.hass = { ...fakeHass, states: { ...fakeHass.states } }; // fresh object each simulated tick
  }
  if (editor.querySelector('ha-entity-picker') !== pickerBefore) {
    throw new Error('hass tick rebuilt the DOM — entity picker identity changed (typing would lose focus/dropdown)');
  }
  console.log('hass-tick stability OK: entity picker survives repeated hass updates');

  editor.querySelector('.tab[data-tab="position"]').click();
  const handleBefore = editor.querySelector('.drag-handle');
  for (let i = 0; i < 5; i++) {
    editor.hass = { ...fakeHass, states: { ...fakeHass.states } };
  }
  if (editor.querySelector('.drag-handle') !== handleBefore) {
    throw new Error('hass tick rebuilt the DOM — drag handle identity changed (an in-progress drag would abort)');
  }
  console.log('hass-tick stability OK: drag handle survives repeated hass updates');

  // --- 5. Regression test: the card itself must skip re-render work when a
  //     hass tick carries no change to any entity it actually watches
  //     (HA calls the setter on nearly every state change system-wide). ---
  const perfCard = document.createElement('ha-ir-ac-control-card');
  perfCard.setConfig({ remote_entity: 'remote.broadlink', room_temp_sensor: 'sensor.room_temp' });
  perfCard.hass = fakeHass;
  document.body.appendChild(perfCard);
  const tempElBefore = perfCard.shadowRoot.querySelector('[data-el="room-temp"]');
  let renderCalls = 0;
  const originalRender = perfCard._render.bind(perfCard);
  perfCard._render = (...args) => { renderCalls++; return originalRender(...args); };
  for (let i = 0; i < 10; i++) {
    perfCard.hass = { ...fakeHass, states: { ...fakeHass.states } }; // same values, fresh object each tick
  }
  if (renderCalls !== 0) throw new Error(`unchanged hass ticks triggered ${renderCalls} re-renders (expected 0)`);
  if (perfCard.shadowRoot.querySelector('[data-el="room-temp"]') !== tempElBefore) {
    throw new Error('unchanged hass ticks touched the DOM');
  }
  perfCard.hass = { ...fakeHass, states: { ...fakeHass.states, 'sensor.room_temp': { state: '25.0' } } };
  if (renderCalls === 0) throw new Error('a genuine sensor change did not trigger a re-render');
  console.log('hass-tick perf gate OK: unchanged ticks skip render, real changes still render');

  console.log('ALL SMOKE TESTS PASSED');
  process.exit(0);
}, 50);
