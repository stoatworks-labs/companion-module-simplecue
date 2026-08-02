# companion-module-simplecue

> **AI-assisted project.** This module was built with the help of
> [Claude](https://claude.ai), Anthropic's AI assistant — including
> implementation and documentation. Review it accordingly before relying on
> it in production.

A [Bitfocus Companion](https://bitfocus.io/companion) connection module for
[SimpleCue](https://github.com/stoatworks-labs/simplecue) — drive a running
cue player from a Stream Deck or any other Companion surface over its OSC
control protocol.

It talks directly to the app's own OSC listener (UDP, default port 53000) and
receives status on a local port — no separate integration to install on the app
side beyond turning OSC on and adding a target.

## What it does

- **Actions** — GO, stop everything, panic, pause/resume/toggle, release every
  vamp, step the standby marker forward/back or to a named cue, and per-cue
  fire / stop (with fade) / stand by / select / audition / release vamp. Master
  level absolute and relative. A status re-query, and a raw-OSC escape hatch.
- **Feedbacks** — cue is standing by, cue is playing, anything is playing,
  paused, vamping, master below a threshold, status feed is live, and SimpleCue
  reported an error.
- **Variables** — standby cue number and name, count and list of sounding cues,
  paused, vamping, master dB, last error, and whether the status feed is live.
- **Presets** — Transport, Standby, Cues (including a ready-to-drop bank for
  cues 1–8), Master level and Status, all with their feedbacks pre-wired.

## Setting it up

Two ends have to agree, and **the second one is the one people forget**:

1. In SimpleCue: **Audio → Control setup**. Turn OSC on and note its input port
   (53000 by default). That is the module's _SimpleCue OSC input port_.
2. In the same panel, add an OSC **target** pointing at the machine running
   Companion, on the module's _Local status port_ (53001 by default).

**Without a target, SimpleCue sends no status at all.** Actions still work
perfectly, and every feedback stays dark and every variable stays empty. A page
of dead-looking buttons that nonetheless fire cues is the signature of a missing
target.

Across machines, the target host must be the Companion machine's IP, not
`127.0.0.1`.

That panel also carries a live monitor of incoming OSC traffic. When a button
appears to do nothing, it answers the only question worth asking first: is
anything arriving at all?

## Cue numbers are typed, not picked

SimpleCue addresses cues by the number printed on the cue sheet — free text, so
`12`, `12.5` and `PRE` are all valid — and it does **not** publish its cue list
over OSC. There is therefore nothing for a dropdown to enumerate, and cue fields
here are text inputs. They accept Companion variables, so a button can fire
whatever a custom variable holds.

Numeric cue numbers match loosely at both ends: a button set to `12.50` fires
`12.5`, and the matching feedback lights.

## What this module cannot tell you

OSC is UDP and SimpleCue acknowledges nothing. A button press that leaves this
machine tells you nothing about whether the player received it, understood it,
or found the cue.

What it does instead:

- SimpleCue answers an unknown cue number with `/status/error` rather than
  silence. That is surfaced as `$(simplecue:last_error)` and the _SimpleCue
  reported an error_ feedback.
- The module sends `/status/query` on a heartbeat (5 s by default), which makes
  SimpleCue re-publish everything. This is what re-syncs state after either end
  restarts or a datagram is lost.
- _Status feed is live_ is the honest "is it there?" signal — it requires a
  status message to have arrived recently, rather than assuming a successful
  send means a healthy player.

Every other feedback keeps showing its **last known** value when SimpleCue goes
away, because the app stops sending rather than sending "nothing is playing".
Put the status preset on any page whose buttons carry cue colour, so a stale
green is distinguishable from a current one.

## Installing

Not in the official Companion module store. Install it via
**Settings → Developer modules path**: point that at a directory containing this
repo, and restart Companion.

## Tests

```bash
npm test
```

Drives the module's real source against a fake SimpleCue on a real UDP socket:
definition shapes, that every preset references an action and feedback that
exist, that actions emit addresses SimpleCue's parser actually accepts, and that
inbound `/status/…` drives the feedbacks. No Companion install needed.

## Licence

MIT — see [LICENSE](LICENSE).
