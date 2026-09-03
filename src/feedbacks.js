// All of these read self.state, which is only ever written by an inbound
// /status/... message. That has one consequence worth stating plainly: with no
// OSC target configured in SimpleCue, every feedback here sits at its "off"
// state forever while the actions carry on working perfectly. A page of dark
// buttons that still fire cues is the signature of a missing target, not a
// broken module.
//
// Nothing here goes dark on its own when SimpleCue disappears, because the app
// stops sending rather than sending "nothing is playing" — the last known state
// simply persists. Put "SimpleCue status is live" on any page whose buttons
// carry playing/standby colour, so a stale green is distinguishable from a
// current one.

/** Cue numbers match loosely in SimpleCue itself ("12.50" finds "12.5"), so the
 *  same has to be true here or a feedback would fail to light on a cue the
 *  matching action successfully fires. Compare numerically when both sides
 *  parse as numbers, and case-insensitively as text otherwise (SimpleCue
 *  lower-cases incoming addresses, so "PRE" and "pre" are one cue). */
function cueMatches(a, b) {
  const left = String(a ?? "").trim();
  const right = String(b ?? "").trim();
  if (!left || !right) return false;
  const ln = Number(left);
  const rn = Number(right);
  if (Number.isFinite(ln) && Number.isFinite(rn)) return ln === rn;
  return left.toLowerCase() === right.toLowerCase();
}

const cueOption = {
  id: "cue",
  type: "textinput",
  label: "Cue number",
  default: "",
  useVariables: true,
};

export default function UpdateFeedbacks(self) {
  self.setFeedbackDefinitions({
    standbyCue: {
      type: "boolean",
      name: "Cue is standing by",
      description:
        "Lights while SimpleCue's standby marker is on this cue — i.e. this is what GO will fire.",
      defaultStyle: { bgcolor: 0xcc7a00, color: 0xffffff },
      options: [cueOption],
      callback: (feedback) => {
        const wanted = String(feedback.options.cue ?? "");
        return cueMatches(self.state.standbyNumber, wanted);
      },
    },
    cuePlaying: {
      type: "boolean",
      name: "Cue is playing",
      description:
        "Lights while this cue is sounding. Several cues can be playing at once — SimpleCue reports them all.",
      defaultStyle: { bgcolor: 0x00aa00, color: 0xffffff },
      options: [cueOption],
      callback: (feedback) => {
        const wanted = String(feedback.options.cue ?? "");
        return self.state.playingCues.some((n) => cueMatches(n, wanted));
      },
    },
    anyPlaying: {
      type: "boolean",
      name: "Anything is playing",
      description: "Lights while at least one cue is sounding.",
      defaultStyle: { bgcolor: 0x00aa00, color: 0xffffff },
      options: [],
      callback: () => self.state.playingCount > 0,
    },
    paused: {
      type: "boolean",
      name: "Playback is paused",
      defaultStyle: { bgcolor: 0x0066cc, color: 0xffffff },
      options: [],
      callback: () => self.state.paused,
    },
    vamping: {
      type: "boolean",
      name: "A cue is vamping",
      description:
        "Lights while any cue is looping in its vamp region and waiting to be released.",
      defaultStyle: { bgcolor: 0x9900cc, color: 0xffffff },
      options: [],
      callback: () => self.state.vamping,
    },
    masterBelow: {
      type: "boolean",
      name: "Master level is below a threshold",
      description:
        "For catching a master left pulled down. Compares against the level SimpleCue last reported.",
      defaultStyle: { bgcolor: 0xcc0000, color: 0xffffff },
      options: [
        {
          id: "db",
          type: "number",
          label: "Below (dB)",
          min: -60,
          max: 10,
          default: -0.5,
          step: 0.5,
        },
      ],
      callback: (feedback) =>
        self.state.masterDb < Number(feedback.options.db ?? 0),
    },
    connected: {
      type: "boolean",
      name: "SimpleCue status is live",
      description:
        "Lights while status has arrived recently. This is the honest 'is it there?' signal — OSC is UDP and a command going out proves nothing about the far end.",
      defaultStyle: { bgcolor: 0x003300, color: 0x00ff00 },
      options: [],
      callback: () => self.isLive(),
    },
    recentError: {
      type: "boolean",
      name: "SimpleCue reported an error",
      description:
        "Lights for a while after SimpleCue sends /status/error — most often a cue number that does not exist. The text is in $(simplecue:last_error).",
      defaultStyle: { bgcolor: 0xcc0000, color: 0xffffff },
      options: [
        {
          id: "seconds",
          type: "number",
          label: "Stay lit for (seconds)",
          min: 1,
          max: 300,
          default: 10,
        },
      ],
      callback: (feedback) => {
        if (!self.state.lastErrorAt) return false;
        const window = (Number(feedback.options.seconds) || 10) * 1000;
        return Date.now() - self.state.lastErrorAt < window;
      },
    },
  });
}
