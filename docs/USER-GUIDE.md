# Companion — SimpleCue user guide

This module runs [SimpleCue](https://github.com/stoatworks-labs/simplecue) over OSC from a
Stream Deck or any other Bitfocus Companion surface: GO, firing cues, transport and master level,
with buttons that light up for the cue on standby and the cues that are playing.

The [README](../README.md) covers installing the module. This guide is about setting it up so the
lights on your surface mean something.

> **Before you rely on this:** OSC is UDP and **nothing is acknowledged**. A command that goes
> missing on the network looks the same as one that worked, and when SimpleCue goes away it just
> stops sending, so every feedback holds its last known value indefinitely. Pretty much everything
> in this guide follows from that.
>
> This module was built with AI assistance, directed and reviewed by a human author.

---

## Connecting — and step 2 is not optional

In SimpleCue, open **Audio → Control setup**:

1. Turn **OSC** on and note its input port (default **53000**). That goes in *SimpleCue OSC input
   port*.
2. **Add an OSC target** pointing at this Companion machine, on the port set in *Local status
   (feedback) port* (default **53001**).

**SimpleCue doesn't send any status at all until a target exists.** Skip step 2 and everything
still looks fine (actions fire, cues play) while every feedback on the surface stays dark for
ever. It's the most common way this ends up half set up.

If Companion is on a different machine, **the target host must be Companion's IP**, not
`127.0.0.1`.

The Control setup panel has a live monitor of incoming OSC. **If a button seems to do nothing,
look there first.** It answers the only question worth asking at that point, which is whether
anything's arriving at all.

---

## GO is not "fire cue N"

**GO** runs whatever the standby marker is sitting on (the cue itself, or one of its sub-cues)
and then moves the marker on. It's the space bar, and like the space bar it depends on where you
are.

**Cue: fire** fires one named cue, wherever the marker happens to be.

They're different buttons for different jobs. A surface built from GO alone follows the
operator's place in the list; one built from Cue: fire doesn't move the marker at all. Most shows
want both, and want them to look different.

---

## Cue numbers are text

Cue fields are **text, not dropdowns.** SimpleCue's cue numbers are free text (`12`, `12.5`,
`PRE`) and it doesn't publish its cue list over OSC, so there's nothing to fill a list with.

They take Companion variables, so a button can work out its cue number at the moment it's
pressed.

**Numbers match loosely**: `12.50` finds `12.5`. That's on purpose, so a trailing zero typed in a
hurry doesn't lose you a cue.

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

**Put "SimpleCue status is live" on any page that shows cue colour.** It's the one that tells a
current green from a stale one. Without it, a button showing a cue playing might be showing what
was true before the machine went away.

---

## Resync

The module sends a status query every few seconds (you can change how often; **0** turns it off),
and SimpleCue answers by re-publishing its whole state.

**That's what brings the surface back** after either end restarts, or after a lost datagram. Turn
it off and a single dropped packet can leave a light wrong until something next changes.

---

## Master level: relative moves need the status path

**Master level: adjust by** works from the level SimpleCue *last reported*. With no status coming
back to Companion the module has nothing to start from, so **the action is skipped** rather than
jumping from an assumed 0 dB.

If your relative master buttons do nothing, step 2 of the connection setup never got done.

---

## Building a surface that fails safe

1. **"SimpleCue status is live"** on every page with cue colour.
2. **Make GO and Cue: fire look different.** They aren't interchangeable.
3. **Master-below-threshold** somewhere. A master left pulled down is silent in a way nothing else
   on the surface will show you.
4. **Leave the resync running.** It's what lets the page put itself right.

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

- [README](../README.md): installing, and the full list of actions, feedbacks and variables
- [`companion/HELP.md`](../companion/HELP.md): the same material, in Companion's help panel
