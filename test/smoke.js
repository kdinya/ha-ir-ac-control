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
if (window.customCards.filter((c) => c.type === 'air-conditioner-card').length !== 1) {
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
  const card = document.createElement('air-conditioner-card');
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

const editor = document.createElement('air-conditioner-card-editor');
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

// version exposed on the class, used by users to verify the *active* class version
if (customElements.get('air-conditioner-card-editor').VERSION !== customElements.get('air-conditioner-card').VERSION) {
  throw new Error('Card/editor VERSION mismatch');
}
console.log('active class VERSION:', customElements.get('air-conditioner-card-editor').VERSION);

// switch to position tab and check drag handles built
const posTab = editor.querySelector('.tab[data-tab="position"]');
posTab.click();
setTimeout(() => {
  const handles = editor.querySelectorAll('.drag-handle');
  console.log('drag handles found:', handles.length);
  if (handles.length === 0) throw new Error('No drag handles built');
  console.log('ALL SMOKE TESTS PASSED');
  process.exit(0);
}, 50);
