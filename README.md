# Air Conditioner Card (IR Remote)

Universal Home Assistant Lovelace card for controlling an air conditioner
via any `remote` entity that supports `remote.send_command` /
`remote.learn_command` — Broadlink, Xiaomi, ESPHome remote, etc.
Seven-segment display look: large temperature, clock, room/outdoor sensors,
ON/OFF, a second mode button (TURBO/ECO/custom name), 4 timer presets + a
manual timer with a configurable step, +/- temperature buttons.

All entities are optional except the IR remote itself (needed only to
actually send commands — without it the card still renders and can be
positioned/styled).

## Features

- **Visual editor** with tabs: Entities, Buttons & IR codes, Timers,
  Position, Appearance — no manual YAML needed for basic setup.
- **IR code learning**: a "📡 Learn" button next to every code field calls
  `remote.learn_command`, waits for a signal from your physical remote
  (up to ~15s) and fills the field automatically.
- **Multilingual interface** (Ukrainian / English / Russian) — a language
  switcher at the top of the editor, above the tabs. Translation applies
  immediately, both in the editor and on the card itself (timer labels,
  units, etc.). This does not affect this README, which is English-only.
- **Drag elements with mouse/touch** on the "Position" tab: a live card
  preview with handles over every element — drag to move it in real time.
  Numeric X/Y sliders remain next to it as a precise fallback.
- **Resize elements** with "−/+" buttons right on the element's handle (or
  in the list below) — from 40% to 300% of the base size.
- Server-side `timer.*` and `input_number.*` helpers — temperature and the
  sleep timer survive a browser tab reload (nothing is stored locally).
- Optional contact/power sensor — the card detects the AC is running and
  shows matching icons/animations on its own.

## Installation

### HACS (recommended)
1. HACS → Frontend → ⋮ → Custom repositories → add
   `https://github.com/kdinya/ha-ir-ac-control`, category **Lovelace**.
2. Install "Air Conditioner Card (IR Remote)".
3. The card shows up right away in the card picker when adding it to a
   dashboard — no manual YAML resource needed.

### Manual
1. Copy `air-conditioner-card.js` to `/config/www/ha-ir-ac-control/`.
2. Add a resource: Settings → Dashboards → Resources →
   `/local/ha-ir-ac-control/air-conditioner-card.js`, type **JavaScript Module**.

## Updating — how to actually get new code into the editor

Custom elements (`air-conditioner-card`, `air-conditioner-card-editor`) can
only be registered **once per browser tab session**, and browsers cannot
redefine an already-registered tag. This causes a confusing situation: the
console banner logs the *file's* version on every load, even when the
*active class* is stuck on an older one — **the banner alone is not proof
the new editor is running.**

If the editor is missing tabs/fields you know were added in a newer
version, work through this checklist in order:

1. **Confirm HACS actually downloaded the new version**, not just listed it
   as available. Open HACS → the repository → make sure the "Update"/
   redownload action was clicked, not merely that a new version badge is
   showing.
2. **Check the real active class version** in the browser console (F12):
   ```js
   customElements.get('air-conditioner-card-editor')?.VERSION
   ```
   This reads the version off the class object itself — if it's older than
   what's on GitHub, this exact browser tab is running stale code no matter
   what any version banner says.
3. **Open the dashboard in a brand-new private/incognito window.** This is
   the single most reliable test: a private window has no custom-element
   registry history and no HTTP cache, so it will show you the true,
   currently-served code. If it looks correct there but not in your normal
   tab/window, the problem is 100% local caching, not the card.
4. **Close every tab pointed at this Home Assistant instance**, then open a
   fresh one. A same-tab reload (even a hard one) usually works, but if
   Home Assistant's service worker or an intermediate CDN (HACS-installed
   resources are commonly served through jsDelivr, which can cache a
   release for a while) is still serving an old file, only a from-scratch
   navigation reliably breaks that chain.
5. If it's still stale after all of that, open DevTools → Sources, find
   `air-conditioner-card.js`, and search its contents for a string that
   only exists in the new version (e.g. `lang-bar`) — this tells you
   definitively whether the *served bytes* are new (and the problem is the
   customElements registry / needs a fresher tab) or old (and the problem
   is upstream caching, e.g. jsDelivr/HACS not having pulled the release
   yet — try again in a few minutes or re-add the custom repository).

As of v1.1.1 the resource guards against the "already defined" hard crash
that a resource reload without a full page reload used to cause (previously
it silently aborted the whole script partway through parsing, which is why
the editor could look completely unchanged after an update — the editor
class is registered near the end of the file and never got reached). That
crash is fixed, but the underlying browser limitation — one registration
per tab — is not something a script can work around; steps 3–4 above are
the real fix when you hit it.

## Recommended helpers

For reliable (not browser-only) storage of the temperature and sleep timer,
add to `configuration.yaml` (or via UI: Settings → Devices & Services →
Helpers):

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

## Seg7 font

Place the seven-segment `.woff` file at the path set in `font_path`
(default `/local/community/ha-ir-ac-control/fonts/7segment.woff`), or change
the path on the "Appearance" tab.

## Configuration example

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

`lang` accepts `uk`, `en`, or `ru` and controls the language of both the
editor UI and the on-card text; it can also be changed live from the
language switcher in the editor.

## Testing

A small Node/jsdom smoke test instantiates the card and the editor,
switches languages, and exercises the drag-canvas handle-building code
path:

```bash
npm install
npm test
```

## Roadmap ideas

- In-editor config validation warnings
- Export/import the IR code table (JSON) to move it between AC units
- Multi-AC support sharing one helper package/blueprint
- Auto-detect remote protocol (raw vs pronto vs named commands)
