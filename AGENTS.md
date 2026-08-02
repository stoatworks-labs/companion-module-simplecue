# AGENTS.md — bringing an LLM up to speed on this Companion module

Orientation for an AI assistant (or a new human) picking this project up cold. There is no
`CLAUDE.md` here; this is the entry point.

---

## 1. What this is

A **Bitfocus Companion connection module** for **SimpleCue**, the platform-independent audio
cue player. It drives GO, per-cue fire/stop/standby/audition, panic, pause, vamp release,
the standby marker and the master level from a Stream Deck, and lights buttons from the
player's own status broadcasts.

JavaScript, Node 22 runtime, `nodejs-ipc` API. `@companion-module/base` 2.x.

## 2. It talks OSC directly to the app — there is no middleware

```
Companion surface  ──▶  this module  ──UDP OSC 53000──▶  SimpleCue
                                     ◀──UDP OSC 53001──  (status broadcasts)
```

The protocol is owned by [`simplecue`](https://github.com/stoatworks-labs/simplecue), not by
this repo — `Source/Control/OscControl.cpp` (inbound parsing) and
`Source/Control/ControlHub.cpp::publishStatus` (outbound status). **Change an address there
and this module breaks silently**: a Stream Deck button stops working mid-show with no error
anywhere obvious. Change both together.

Two things the app's own `docs/control.md` does not mention, both verified against the
source and relied on here:

- `/stopall` is a synonym for `/stop`, `/cue/go` for `/go`, and `/standby/prev` for
  `/standby/previous`.
- `/status/query` triggers a **forced** full publish (`publishStatus(..., true)`), bypassing
  the change-detection that normally suppresses a repeat. That is what makes it usable as a
  resync heartbeat.

## 3. The asymmetry that shapes every design decision here

**SimpleCue publishes status only to explicitly configured OSC targets, and only on change.**

Consequences, in the order they bite:

1. With no target configured, actions work perfectly and _every_ feedback stays dark. That
   is the single most common support question this module will generate. It is called out in
   the config panel, the README and `companion/HELP.md` — keep it there.
2. Silence is the normal state of a healthy player sitting in standby. So silence must never
   be treated as a fault directly; the module re-queries on a heartbeat and only calls the
   connection stale after `STALE_AFTER_MS` without any status.
3. When SimpleCue goes away it stops sending rather than sending "nothing is playing". Every
   feedback except `connected` therefore holds its last known value indefinitely. This is a
   knowing trade, not an oversight — clearing them on disconnect would blank a cue-colour
   page during a brief network blip. The `connected` feedback is the honest signal, and the
   docs tell operators to put it on any page with cue colour.

## 4. Layout

| File               | Role                                                                        |
| ------------------ | --------------------------------------------------------------------------- |
| `src/main.js`      | `InstanceBase` lifecycle, config fields, heartbeat, staleness               |
| `src/osc.js`       | Socket handling, inbound `/status/…` parsing, outbound send                 |
| `src/actions.js`   | The buttons                                                                 |
| `src/feedbacks.js` | Button lighting, including loose cue-number matching                        |
| `src/variables.js` | Fixed set — everything SimpleCue publishes is known ahead of time           |
| `src/presets.js`   | Preset sections + definitions (2.x `setPresetDefinitions(structure, defs)`) |
| `src/upgrades.js`  | Companion config migrations (currently a stub)                              |
| `test/smoke.mjs`   | Drives the real source against a fake SimpleCue on a real UDP socket        |

## 5. Traps already paid for

- **`osc`'s `UDPPort.close()` takes no callback.** The obvious
  `new Promise((r) => port.close(r))` never settles, so `destroy()` hangs and
  `configUpdated()` never reaches its reconnect — editing the host or port kills the instance
  until Companion restarts. Await the port's `"close"` event with a timeout instead. There is
  a regression check for this in `test/smoke.mjs`; the same bug exists in the sibling OSC
  modules (`companion-module-pdf-presenter-lite`,
  `companion-module-presentation-commander-client`) and is worth fixing there in the same
  sitting.
- **`@companion-module/base` 2.x presets are `setPresetDefinitions(structure, definitions)`**
  with `type: 'simple'` and grouping in the structure. The 1.x `category` field on a
  definition still _loads_ — the presets just never appear in the UI, which looks like a
  rendering bug rather than a schema mistake.
- **Splitting `/status/playingCues` on a space yields `[""]` when nothing is playing**, not
  `[]`. Unfiltered, that makes "is cue X playing" light for a button whose cue field is blank.
- **Cue numbers must match loosely in feedbacks too.** SimpleCue matches `12.50` to `12.5`
  when firing; a feedback that compared as strings would fail to light on a cue the matching
  action successfully fires.

## 6. Deliberate omissions — do not "fix" these

- **No cue-list dropdowns.** SimpleCue publishes no cue list over OSC, so a dropdown would
  have to be fabricated or hand-maintained. Adding one means adding the broadcast to the app
  first.
- **No per-cue "is stopped" feedback.** The app reports what is _playing_; "not in that list"
  covers both stopped and non-existent, and a button that looks identical for "cue finished"
  and "cue number is wrong" is worse than no button.
- **Actions return nothing.** Nothing is acknowledged over OSC, so no callback can honestly
  report failure. Don't add optimistic state updates — a button that goes green on press
  rather than on the player saying so will lie during exactly the failure it exists to catch.

## 7. Context that matters

This drives live event production. A button press here changes what an audience hears. Prefer
failing safe: don't invent state to display when the app's status is unknown, and keep
reconnection resilient — a surface that doesn't recover after the app restarts is a dead
surface mid-show.

## 8. Conventions

- Not in the official Companion module store — it installs via **Settings → Developer
  modules path**. Bear that in mind before writing install instructions that assume the store.
- Ships a user-facing AI-assisted disclaimer; review before relying on it in production.
- "Commit" means commit **and** push.
