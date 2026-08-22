# Companion — SimpleCue user guide

This module drives [SimpleCue](https://github.com/stoatworks-labs/simplecue) over OSC from a
Stream Deck or any other Bitfocus Companion surface — GO, cue fire, transport, master level, with
cue standby and playing colour.

The [README](../README.md) covers installing the module. This is how to set it up so that the
lights on it mean something.

> **Before you rely on this:** OSC is UDP and **nothing is acknowledged**. A command that vanishes
> in the network looks exactly like one that worked, and when SimpleCue goes away it simply stops
> sending — so every feedback holds its last known value indefinitely. The whole shape of this
> guide follows from that.
>
> This module was built with AI assistance, directed and reviewed by a human author.

---

## Connecting — and step 2 is not optional

In SimpleCue, open **Audio → Control setup**:

1. Turn **OSC** on and note its input port (default **53000**). That goes in *SimpleCue OSC input
   port*.
2. **Add an OSC target** pointing at this Companion machine, on the port set in *Local status
   (feedback) port* (default **53001**).

**SimpleCue sends no status at all until a target exists.** Skip step 2 and everything still
appears to work — actions fire, cues play — while every feedback on the surface stays dark
forever. That is the single most common way this ends up half-configured.

If Companion is on a different machine, **the target host must be Companion's IP**, not
`127.0.0.1`.

The Control setup panel has a live monitor of incoming OSC. **If a button seems to do nothing,
look there first** — it answers the one question worth asking: is anything arriving at all?

---

## GO is not "fire cue N"

**GO** performs whatever the standby marker is sitting on — the cue itself, or one of its sub-cues
— and then advances. It is the space bar, and it is stateful.

**Cue: fire** fires one named cue regardless of where the marker is.

Those are different buttons for different jobs. A surface built out of GO alone follows the
operator's position in the list; a surface built out of Cue: fire does not move the marker at all.
Most shows want both, and want them visually distinct.

---

## Cue numbers are text

Cue fields are **text, not dropdowns.** SimpleCue's cue numbers are free text — `12`, `12.5`,
`PRE` — and it does not publish its cue list over OSC, so there is nothing to enumerate.

They accept Companion variables, so a cue number can be built at press time.

**Numbers match loosely**: `12.50` finds `12.5`. That is deliberate, and it means a trailing zero
typed under pressure does not lose a cue.

---

## Reading the feedbacks

| Feedback | Lights when |
| --- | --- |
| **Cue is standing by** | The marker is on that cue — it is what GO will fire |
| **Cue is playing** | That cue is sounding (several can be at once) |
| **Anything is playing** | At least one cue is sounding |
| **Playback is paused** | |
| **A cue is vamping** | Something is looping, waiting to be released |
| **Master level is below a threshold** | For catching a master left pulled down |
| **SimpleCue status is live** | Status has arrived recently |
| **SimpleCue reported an error** | Usually a cue number that does not exist |

**Put "SimpleCue status is live" on any page carrying cue colour.** It is the one that
distinguishes a current green from a stale one — without it, a surface showing a cue playing may
be showing what was true before the machine went away.

---

## Resync

The module sends a status query every few seconds (configurable; **0** turns it off), which makes
SimpleCue re-publish its whole state.

**This is what recovers the surface** after either end restarts, or after a lost datagram. Turning
it off means a single dropped packet can leave a light wrong until the next change.

---

## Master level: relative moves need the status path

**Master level: adjust by** works from the level SimpleCue *last reported*. With no status path
back to Companion the module has no starting point, so **the action is skipped** rather than
jumping from an assumed 0 dB.

If your relative master buttons do nothing, step 2 of the connection setup was never done.

---

## Building a surface that fails safe

1. **"SimpleCue status is live"** on every page with cue colour.
2. **GO and Cue: fire visually distinct.** They are not interchangeable.
3. **Master-below-threshold** somewhere — a master left pulled down is silent in a way nothing
   else on the surface reveals.
4. **Leave the resync running.** It is what makes the page self-heal.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| **Actions work, nothing lights up** | No OSC target in SimpleCue pointing back at Companion. |
| **Feedback worked on one machine, not another** | The target host is `127.0.0.1` rather than Companion's IP. |
| **Relative master moves do nothing** | Same cause — no status path, so there is no level to adjust from. |
| **A cue number is refused** | It does not exist. The error feedback lights for exactly this. |
| **Lights are stuck on an old state** | SimpleCue stopped sending. That is what the status-is-live feedback is for. |
| **GO fired something unexpected** | It fires the standby marker, not a fixed cue. Use Cue: fire. |

---

## See also

- [README](../README.md) — installing, and the full action/feedback/variable list
- [`companion/HELP.md`](../companion/HELP.md) — the same material, in Companion's help panel
