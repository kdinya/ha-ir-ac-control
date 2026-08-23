# Air Conditioner Card (IR Remote)

Universal Home Assistant Lovelace card for controlling an air conditioner
via any `remote` entity that supports `remote.send_command` /
`remote.learn_command` — Broadlink, Xiaomi, ESPHome remote, etc.
Seven-segment display look: large temperature, clock, room/outdoor sensors,
ON/OFF, a second mode button (TURBO/ECO/custom name), 4 timer presets, and a
manual timer with a configurable step.

All entities are optional except the IR remote itself (needed only to
actually send commands — without it the card still renders and can be
positioned/styled).

## Tested hardware

- **IR blaster**: Broadlink RM4C mini
- **Air conditioner**: Samsung AQO9BAN

Other Broadlink models (RM4 Pro, RM Mini 3, etc.) and other AC units should
work the same way as long as their `remote` entity supports
`remote.send_command` / `remote.learn_command`. For Broadlink specifically,
make sure the **Device** field on the "Entities" tab is filled in — it's the
name Broadlink stores learned IR codes under, and `remote.learn_command`
will fail without it.

## Features

- **Visual editor** with tabs: Entities, Buttons & IR codes, Timers,
  Position, Appearance — no manual YAML needed for basic setup.
- **IR code learning**: a "📡 Learn" button next to every code field calls
  `remote.learn_command`, waits for a signal from your physical remote
  (up to ~15s) and fills the field automatically.
- **Multilingual interface** (Ukrainian / English / Russian) — a language
  switcher at the top of the editor. Translation applies immediately, both
  in the editor and on the card itself.
- **Built-in seven-segment font** — works out of the box, no separate font
  file to install. You can upload your own font (`.ttf`/`.otf`/`.woff`/
  `.woff2`) on the "Appearance" tab if you'd rather use a different one.
- **Drag elements with mouse/touch** on the "Position" tab: a live card
  preview with handles over every element — drag to move it, use the
  "−/+" buttons on the handle to resize it, or use the wide X/Y/Size
  sliders below the preview (each duplicated with its own "−/+" buttons)
  for fine, precise control. A ☀/🌙 toggle above the preview lets you see
  how the screen looks both with the AC on and off while positioning.
- **Per-element "always active" toggle** — each of the 12 positionable
  elements has its own checkbox on the "Position" tab to keep it at full
  brightness regardless of AC power state (clock, room temperature/
  humidity, and outdoor weather default to this; everything else defaults
  to dimming with the rest of the screen, but it's your choice per element).
- **Blinking clock separator** — the `:` in the clock blinks once a second,
  like a real digital clock.
- **Pauses itself when not visible** — the once-a-second clock/countdown
  tick stops while the card is scrolled out of view, the browser tab is
  backgrounded, or the card is removed from the dashboard (via
  `IntersectionObserver` / `visibilitychange` / `disconnectedCallback`).
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

## Setting it up

Add the card, then open its visual editor:

1. **Entities** — pick your IR remote (required), plus any optional
   sensors/helpers you have (room temperature/humidity, weather, contact
   sensor, `input_number`/`timer` helpers — see below). **For Broadlink
   devices (e.g. RM4C mini), also fill in the "Device" field** — this is
   the name Broadlink groups your learned codes under (e.g. `AC_Samsung`).
   Without it, "📡 Learn" will fail with
   `required key not provided @ data['device']`.
2. **Buttons & IR codes** — set labels/codes for ON, OFF, the second mode
   (e.g. TURBO), and one code per temperature in your min/max range. Press
   "📡 Learn" next to a field, then press the matching button on your
   physical remote — the code fills in automatically. The +/- buttons on
   the card don't need their own codes: they always send the code for the
   temperature you land on after pressing them.
3. **Timers** — 4 quick presets (in minutes) and the step size for the
   manual timer.
4. **Position** — drag any element on the preview to reposition it, use
   "−/+" (on the handle, or in the list below the preview) to resize it,
   or type exact values into the sliders.
5. **Appearance** — card aspect ratio, button-panel height, and the
   seven-segment font (built-in by default; upload your own if you like).

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

**Do you actually need them?**

- **Temperature (`input_number`)** — no, only if you want the displayed
  temperature to survive reloading the browser tab. The card never does
  anything while it's closed either way (it's a piece of frontend JS, not
  a backend integration), so there's nothing running "in the background"
  for the temperature to interact with. Without the helper it just falls
  back to `default_temp` on every fresh page load.
- **Timer (`timer.*`)** — yes, if you want the sleep timer to reliably
  finish and turn the AC off when **nobody has the dashboard open**. The
  card itself can only react to a timer finishing while it's actually
  mounted in an open browser tab — closing the tab doesn't cancel the HA
  timer (it keeps counting down server-side), but nothing will send the
  "off" IR command when it reaches zero unless something server-side does
  it. For that, add a small automation:

  ```yaml
  automation:
    - alias: "AC card — turn off when sleep timer finishes"
      trigger:
        - platform: event
          event_type: timer.finished
          event_data:
            entity_id: timer.ac_card_sleep
      action:
        - service: remote.send_command
          target:
            entity_id: remote.broadlink
          data:
            device: air_conditioner
            command: "off"   # or your raw/base64 code for 'off'
  ```

  (While the card *is* open, it already does this itself as a
  best-effort — see Changelog below — so the automation is really just
  the "nobody's watching" backstop.)

## Configuration example

```yaml
type: custom:ha-ir-ac-control-card
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

`commands` keys `'16'`–`'30'` (etc., matching your `temp_min`/`temp_max`)
hold the IR code sent for each temperature — these are also what the +/-
buttons send, so there's no separate plus/minus code to configure.

## Updating

Custom element tags (`ha-ir-ac-control-card`, `ha-ir-ac-control-card-editor`)
can only be registered once per browser tab, and browsers cannot redefine
an already-registered tag. If the editor looks like it's missing something
you know was added in a newer version:

1. Confirm HACS actually redownloaded the update (not just shows a badge).
2. Check `customElements.get('ha-ir-ac-control-card-editor')?.VERSION` in
   the browser console (F12) — if it's older than what's on GitHub, this
   tab is running stale code.
3. Open the dashboard in a fresh private/incognito window — the single most
   reliable way to confirm you're looking at the current code.
4. If it's still stale, close every tab pointed at this Home Assistant
   instance and open a new one (resources served through jsDelivr can also
   take a few minutes to pick up a new release).

## Testing

A small Node/jsdom smoke test instantiates the card and the editor,
switches languages, and exercises the drag-canvas handle-building code
path:

```bash
npm install
npm test
```

## Changelog highlights

- **1.6.0** — Fixed the editor's language switch not repainting itself
  immediately (it updated the config but the visible UI stayed on the old
  language until something else forced a redraw). Smaller °C/°/unit
  symbols. Clock's `:` now blinks once a second. Clock/countdown tick
  pauses while the card isn't visible (scrolled off-screen, background
  browser tab, or removed from the dashboard). Every positionable element
  now has its own "always active" toggle (previously hardcoded to 4
  specific elements) plus a ☀/🌙 preview toggle on the Position tab. The
  sleep timer now actually turns the AC off when it finishes naturally
  while the card is open (previously only cleared the on-screen countdown).
- **1.5.0 / 1.4.0** — IR learn no longer hangs waiting on a
  `persistent_notification` for the raw code (Broadlink never puts it
  there); it stores the command name instead, which `remote.send_command`
  already resolves via Broadlink's own storage. Position tab drag handles
  no longer snap back after release. Button-panel height is normalized and
  clamped so buttons respect `controls_height` instead of overflowing it.
  Clock, room temperature/humidity, and outdoor weather set to always stay
  visible by default.
- **1.3.0** — Fixed the Position tab having zero effect on the actual
  card: the `scale()` transform was nested inside `translate()`'s closing
  parenthesis, producing invalid CSS (`translate(0cqw, 0cqw scale(1))`)
  that browsers silently drop — nothing ever visibly moved or resized no
  matter what the editor saved. Embedded a default seven-segment font
  directly in the resource file plus an upload button for a custom one
  (data: URI, no separate file to place under `www/`). Removed the unused
  per-mode temperature and separate +/− IR codes (the +/− buttons always
  send the code for the resulting temperature). Rebuilt the bottom button
  row. Wrapped the whole script in an IIFE so none of its top-level
  functions/constants leak onto `window`, where they could silently
  collide with an unrelated script's same-named globals.
- **1.2.x** — Renamed the custom element tag from `air-conditioner-card`
  to `ha-ir-ac-control-card` (the old name collided with unrelated
  legacy/local cards using the same generic tag — whichever script
  registered it first silently won, regardless of what HACS had
  installed). Stopped the editor from rebuilding its entire DOM on every
  `hass` update (HA calls this on nearly every state change anywhere in
  the system), which used to close the entity-picker dropdown mid-keystroke
  and abort in-progress Position-tab drags.

## Roadmap ideas

- In-editor config validation warnings
- Export/import the IR code table (JSON) to move it between AC units
- Multi-AC support sharing one helper package/blueprint
- Auto-detect remote protocol (raw vs pronto vs named commands)
