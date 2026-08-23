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
- **Screen brightness slider** on the "Appearance" tab (20–150%) for the
  digital-clock display.
- **Premium-device button styling** — layered metallic gradients, a bevel
  highlight, and a real "press" effect on every button.
- Lightweight on the frontend — the card skips all re-render work on `hass`
  updates that don't touch any entity it actually watches (Home Assistant
  calls every card's `hass` setter on nearly every state change system-wide,
  many times a second).

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
  IR command when it reaches zero unless something server-side does it.
  For that, add one or two small automations (see below).

## Automations for reliable timer-based on/off

The card's own best-effort turn on/off (see Changelog) only fires while a
browser tab with the card actually open is watching the timer. For it to
work with **zero browser involvement** — dashboard closed, phone asleep,
nobody home — the real logic has to live in a Home Assistant automation
that reacts to the `timer.finished` event server-side. This is the
reliable path and costs no extra resources either way: an idle automation
waiting on an event uses no polling and no CPU between triggers.

Two independent timer helpers are supported: one dedicated to turning the
AC **off** (`timer_helper`) and, optionally, a second one dedicated to
turning it **on** (`timer_helper_on`). Each can drive its own automation.

```yaml
timer:
  climate_sleep_timer:
    name: Climate control — sleep timer
  climate_wakeup_timer:
    name: Climate control — wake-up timer

automation:
  - alias: "Climate control: sleep timer — toggle by contact state"
    description: >-
      When the sleep timer finishes, checks the window/contact sensor and
      switches the AC to the opposite state — off if the window is open,
      on otherwise. Adjust the branches if you just want a plain "always
      off" behavior instead.
    triggers:
      - trigger: event
        event_type: timer.finished
        event_data:
          entity_id: timer.climate_sleep_timer
    actions:
      - if:
          - condition: state
            entity_id: binary_sensor.climate_window_contact
            state: "on"
        then:
          - action: remote.send_command
            target:
              entity_id: remote.climate_ir_blaster
            data:
              device: climate.air_conditioner
              command: "off"
        else:
          - action: remote.send_command
            target:
              entity_id: remote.climate_ir_blaster
            data:
              device: climate.air_conditioner
              command: "on"
    mode: single

  - alias: "Climate control: turn on when wake-up timer finishes"
    description: Turns the AC on when the wake-up timer finishes.
    triggers:
      - trigger: event
        event_type: timer.finished
        event_data:
          entity_id: timer.climate_wakeup_timer
    actions:
      - action: remote.send_command
        target:
          entity_id: remote.climate_ir_blaster
        data:
          device: climate.air_conditioner
          command: "on"
    mode: single
```

On the card, pick these entities on the **Entities** tab:

| Config key                  | Points to                          | What it does                                                        |
|------------------------------|-------------------------------------|-----------------------------------------------------------------------|
| `timer_helper`               | `timer.climate_sleep_timer`         | The OFF timer — countdown shown on the card, T30/T60/etc. buttons.   |
| `timer_helper_on`            | `timer.climate_wakeup_timer`        | An independent ON timer (optional; leave empty if you don't need one).|

### Card-only ON/OFF toggle switches

As soon as `timer_helper` and/or `timer_helper_on` are set, the card
automatically shows small "OFF"/"ON" toggle switches under the button
panel — no extra config, no `input_boolean` or any other helper entity to
create. Flipping a switch off tells **the card itself** to stop sending the
IR command when that timer finishes; flipping it on (the default) lets it
keep doing so. The state lives in that browser's `localStorage`, so it's
per-device and doesn't require anything in Home Assistant.

This is entirely independent from the `timer.finished` automations above —
the automation isn't aware of the card's switch and keeps firing regardless
of it. That's intentional: it lets you run the schedule from the
automation only, from the card only, or from both at once (in which case
the IR command just gets sent twice, which is harmless for most AC remotes
but worth avoiding if you'd rather pick one). If you want the automation
itself to be toggleable too, add your own `input_boolean` and a
`conditions:` block referencing it — that's a normal Home Assistant
automation concern, unrelated to the card.

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
screen_brightness: 100
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

- **1.7.1** — The ON/OFF timer toggle switches no longer need
  `input_boolean` helpers: they're now a pure card feature (state kept in
  the browser's `localStorage`), so nothing needs to be created in Home
  Assistant to get them — they just appear once `timer_helper` /
  `timer_helper_on` are set. They're deliberately independent from any
  `timer.finished` automation you may also have, so you can drive the
  schedule from the card, an automation, or both. Also fixed a brief
  flash of the fallback font before the seven-segment digits render on
  load/reload (`font-display: block`).
- **1.7.0** — Added an optional second, independent timer helper
  (`timer_helper_on`) for turning the AC on, separate from the existing
  off timer. Added two optional physical-looking toggle switches on the
  card face (`timer_off_enable_entity` / `timer_on_enable_entity`, bound
  to `input_boolean` helpers) to enable/disable the matching automation
  without editing YAML — see "Automations for reliable timer-based on/off"
  above. The best-effort client-side fallback now covers the on-timer too
  and respects both switches. No changes to idle CPU/DOM behavior — these
  additions only run on the same `hass`-update signature check as
  everything else, so they cost nothing while the dashboard isn't open.
- **1.6.1** — Fixed the manual/dynamic timer forcing the big AC-temperature
  display fully visible while editing it with the AC off (it now only
  affects the timer readout, as intended). The card now skips all
  recomputation and DOM work on `hass` updates that don't change anything
  it actually watches, and only writes DOM text when the value actually
  changed — noticeably lighter on CPU on a live dashboard. Raised the max
  element scale from 600% to 1500%. Room-temperature °C and room-humidity %
  unit symbols are now sized independently (3× and 2× smaller). Position
  tab labels now say what each element actually is (room temperature,
  outdoor temperature, AC set temperature) instead of "small/large". Added
  a screen brightness slider (20–150%) on the Appearance tab. Reworked
  button styling — layered metallic gradients, bevel highlight, deeper
  press effect.
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
