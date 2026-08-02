# SimpleCue

Controls [SimpleCue](https://github.com/stoatworks-labs/simplecue) over OSC.

## Connection

In SimpleCue, open **Audio → Control setup**:

1. Turn **OSC** on and note its input port (default **53000**) — that goes in
   _SimpleCue OSC input port_.
2. Add an OSC **target** pointing at this Companion machine, on the port set in
   _Local status (feedback) port_ (default **53001**).

**Step 2 is not optional if you want feedback.** SimpleCue sends no status until
a target exists. Without one, actions work and every feedback stays dark.

Running Companion on a different machine? The target host must be Companion's IP,
not `127.0.0.1`.

The Control setup panel has a live monitor of incoming OSC. If a button seems to
do nothing, look there first — it answers whether anything is arriving at all.

## Cue numbers

Cue fields are **text**, not dropdowns: SimpleCue's cue numbers are free text
(`12`, `12.5`, `PRE`) and it does not publish its cue list over OSC, so there is
nothing to enumerate. They accept Companion variables.

Numbers match loosely — `12.50` finds `12.5`.

## GO is not "fire cue N"

**GO** performs whatever the standby marker is sitting on — the cue itself, or
one of its sub-cues — and advances. It is the space bar.

To fire one named cue regardless of the marker, use **Cue: fire**.

## Reading the feedbacks

| Feedback                          | Lights when                                         |
| --------------------------------- | --------------------------------------------------- |
| Cue is standing by                | The marker is on that cue — it is what GO will fire |
| Cue is playing                    | That cue is sounding (several can be at once)       |
| Anything is playing               | At least one cue is sounding                        |
| Playback is paused                |                                                     |
| A cue is vamping                  | Something is looping, waiting to be released        |
| Master level is below a threshold | For catching a master left pulled down              |
| **SimpleCue status is live**      | Status has arrived recently                         |
| SimpleCue reported an error       | Usually a cue number that does not exist            |

**Put "SimpleCue status is live" on any page carrying cue colour.** OSC is UDP
and nothing is acknowledged: when SimpleCue goes away it simply stops sending,
so every other feedback holds its last known value indefinitely. That one is
what distinguishes a current green from a stale one.

## Resync

The module sends `/status/query` every few seconds (configurable; 0 turns it
off), which makes SimpleCue re-publish its whole state. This is what recovers
after either end restarts, or after a lost datagram.

## Master level: relative moves

**Master level: adjust by** works from the level SimpleCue last reported. With no
status path back to Companion the module has no starting point, so the action is
skipped rather than jumping from an assumed 0 dB.
