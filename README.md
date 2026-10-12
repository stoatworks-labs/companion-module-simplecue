# companion-module-simplecue

> **AI-assisted project.** This module was created with [Claude](https://claude.com/claude-code)
> (Anthropic), directed and reviewed by a human author. Check it over before you rely on it for
> a show.

A [Bitfocus Companion](https://bitfocus.io/companion) module for
[SimpleCue](https://github.com/stoatworks-labs/simplecue), so you can run the cue
player from a Stream Deck (or any other Companion surface) over OSC.

It talks straight to SimpleCue's own OSC listener (UDP, port 53000 by default) and
listens for status coming back on a local port. There's nothing extra to install
on the SimpleCue end: you turn OSC on and add a target, and that's it.

<!-- downloads:start -->

## Download

**[v1.0.4](https://github.com/stoatworks-labs/companion-module-simplecue/releases/tag/v1.0.4)**

This release contains:

- [`companion-module-simplecue-pkg.tgz`](https://github.com/stoatworks-labs/companion-module-simplecue/releases/latest/download/companion-module-simplecue-pkg.tgz) — npm package, 55 KB
- [`simplecue-1.0.4.tgz`](https://github.com/stoatworks-labs/companion-module-simplecue/releases/download/v1.0.4/simplecue-1.0.4.tgz) — npm package, 55 KB

All builds, checksums and release notes: [github.com/stoatworks-labs/companion-module-simplecue/releases](https://github.com/stoatworks-labs/companion-module-simplecue/releases).

<!-- downloads:end -->

## What it does

- **Actions:** GO, stop everything, panic, pause/resume/toggle, release every
  vamp, step the standby marker forward/back or to a named cue, and per-cue
  fire / stop (with fade) / stand by / select / audition / release vamp. Master
  level absolute and relative. A status re-query, and a raw-OSC escape hatch.
- **Feedbacks:** cue is standing by, cue is playing, anything is playing,
  paused, vamping, master below a threshold, status feed is live, and SimpleCue
  reported an error.
- **Variables:** standby cue number and name, count and list of sounding cues,
  paused, vamping, master dB, last error, and whether the status feed is live.
- **Presets:** Transport, Standby, Cues (including a ready-to-drop bank for
  cues 1–8), Master level and Status, all with their feedbacks pre-wired.

## Setting it up

Both ends need setting up, and **the second one is the one everybody forgets**:

1. In SimpleCue: **Audio → Control setup**. Turn OSC on and note its input port
   (53000 by default). That's the module's _SimpleCue OSC input port_.
2. In the same panel, add an OSC **target** pointing at the machine running
   Companion, on the module's _Local status port_ (53001 by default).

**Without a target, SimpleCue doesn't send any status at all.** The actions
still work fine, but every feedback stays dark and every variable stays empty. If
you've got a page of buttons that look dead but still fire cues, that's a missing
target.

If Companion is on a different machine, the target host needs to be that
machine's IP, not `127.0.0.1`.

That panel also has a live monitor of incoming OSC. When a button seems to do
nothing, start there and check whether anything's arriving at all.

## Cue numbers are typed, not picked

SimpleCue knows cues by the number on the cue sheet, which is free text, so `12`,
`12.5` and `PRE` are all fine. It **doesn't** publish its cue list over OSC, so
there's nothing to fill a dropdown with, and the cue fields here are text boxes.
They take Companion variables, so a button can fire whatever a custom variable
holds.

Numeric cue numbers match loosely at both ends: a button set to `12.50` fires
`12.5`, and the matching feedback lights up.

## What this module cannot tell you

OSC runs over UDP and SimpleCue doesn't acknowledge anything, so once a press has
left this machine you've no idea whether the player got it, understood it or found
the cue. Fire and hope, basically.

So here's what it does about that:

- SimpleCue answers an unknown cue number with `/status/error` rather than
  silence. That shows up as `$(simplecue:last_error)` and the _SimpleCue
  reported an error_ feedback.
- The module sends `/status/query` on a heartbeat (5 s by default), which makes
  SimpleCue re-publish everything. That's what gets things back in step after
  either end restarts or a packet goes missing.
- _Status feed is live_ is the one to trust for "is it actually there?". It only
  lights if a status message has arrived recently, rather than assuming that
  sending something means the player's fine.

Every other feedback keeps showing its **last known** value when SimpleCue goes
away, because the app just stops sending rather than saying "nothing is playing".
Put the status preset on any page where the buttons show cue colours, so you can
tell an old green from a current one.

## Installing

It's not in the official Companion module store, so install it as a developer
module: point **Settings → Developer modules path** at a folder containing this
repo, and restart Companion.

## Tests

```bash
npm test
```

This runs the module's actual code against a pretend SimpleCue on a real UDP
socket. It checks the definitions, that every preset points at an action and
feedback that exist, that the actions send addresses SimpleCue's parser will
accept, and that incoming `/status/…` messages drive the feedbacks. You don't need
Companion installed.

<!-- attributions:start -->
This project is built on other people's work — see [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
<!-- attributions:end -->

## Licence

MIT, see [LICENSE](LICENSE).
