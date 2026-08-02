// Variable references in preset text use `self.label`, the CONNECTION's label,
// not the module id. Companion resolves $(label:variable) against whatever the
// operator named this connection — hardcoding the module id produces buttons
// that render the raw $(...) text on any connection that has been renamed, and
// on a second instance of the same module.
// Presets are a starting layout, not a fixed one — an operator drags one onto a
// button and then edits it. That shapes two choices here:
//
//  * Per-cue presets ship with a concrete cue number rather than a blank field.
//    A preset cannot know a show's cue numbers (SimpleCue publishes no cue list
//    over OSC), and a blank field produces a button that silently does nothing
//    until someone notices mid-show. A wrong-but-obvious default gets edited; an
//    empty one gets missed.
//
//  * Anything that puts a cue on air or takes it off ships with its matching
//    feedback already wired. A fire button that does not go green while the cue
//    is sounding is worse than no preset, because it teaches an operator that
//    the colour means nothing.
//
// @companion-module/base 2.x takes presets as (structure, definitions): the
// sections below carry the grouping, and each definition is `type: 'simple'`.
// There is no `category` field on a definition — that was the 1.x shape, and
// using it produces presets that load but appear nowhere in the UI.

const WHITE = 0xffffff;
const BLACK = 0x000000;
const GREEN = 0x009900;
const RED = 0xcc0000;
const AMBER = 0xcc7a00;
const BLUE = 0x0066cc;
const PURPLE = 0x9900cc;
const GREY = 0x333333;
const DARKGREEN = 0x003300;
const BRIGHTGREEN = 0x00ff00;

/** The cue numbers the shipped bank covers. Plain integers because that is what
 *  an unedited show has; a show numbered 12.5/PRE gets these edited anyway. */
const CUE_BANK = ["1", "2", "3", "4", "5", "6", "7", "8"];

function preset({
  name,
  text,
  size = "18",
  color = WHITE,
  bgcolor = GREY,
  actions = [],
  release = [],
  feedbacks = [],
}) {
  return {
    type: "simple",
    name,
    style: { text, size, color, bgcolor, show_topbar: false },
    steps: [{ down: actions, up: release }],
    feedbacks,
  };
}

export default function UpdatePresets(self) {
  const defaultFade = Number(self.config?.defaultstopfade ?? 2);
  const presets = {};

  // --- Transport ----------------------------------------------------------
  presets.go = preset({
    name: "GO — fire the standby step",
    text: `GO\n$(${self.label}:standby_number)`,
    size: "24",
    bgcolor: GREEN,
    actions: [{ actionId: "go", options: {} }],
  });

  presets.go_named = preset({
    name: "GO, with the standby cue's name",
    text: `GO\n$(${self.label}:standby_number)\n$(${self.label}:standby_name)`,
    size: "14",
    bgcolor: GREEN,
    actions: [{ actionId: "go", options: {} }],
  });

  presets.stop_all = preset({
    name: `Stop everything (${defaultFade}s fade)`,
    text: `STOP\n${defaultFade}s`,
    bgcolor: GREY,
    actions: [{ actionId: "stopAll", options: { fade: defaultFade } }],
    // Lit while anything is sounding, so the button doubles as "is there still
    // audio out there?" — the question asked before leaving the desk.
    feedbacks: [
      {
        feedbackId: "anyPlaying",
        options: {},
        style: { bgcolor: AMBER, color: BLACK },
      },
    ],
  });

  presets.panic = preset({
    name: "PANIC — immediate silence",
    text: "PANIC",
    bgcolor: RED,
    actions: [{ actionId: "panic", options: {} }],
  });

  presets.pause_toggle = preset({
    name: "Pause / Resume",
    text: "PAUSE",
    bgcolor: BLACK,
    actions: [{ actionId: "pauseToggle", options: {} }],
    feedbacks: [
      {
        feedbackId: "paused",
        options: {},
        style: { bgcolor: BLUE, color: WHITE },
      },
    ],
  });

  presets.release_vamp = preset({
    name: "Release every vamp",
    text: "RELEASE\nVAMP",
    size: "14",
    bgcolor: BLACK,
    actions: [{ actionId: "releaseVamp", options: {} }],
    feedbacks: [
      {
        feedbackId: "vamping",
        options: {},
        style: { bgcolor: PURPLE, color: WHITE },
      },
    ],
  });

  // --- Standby marker ------------------------------------------------------
  presets.standby_next = preset({
    name: "Standby: next",
    text: "STANDBY\nNEXT",
    size: "14",
    actions: [{ actionId: "standbyNext", options: {} }],
  });

  presets.standby_previous = preset({
    name: "Standby: previous",
    text: "STANDBY\nPREV",
    size: "14",
    actions: [{ actionId: "standbyPrevious", options: {} }],
  });

  presets.standby_display = preset({
    name: "Standby display (no action)",
    text: `STANDBY\n$(${self.label}:standby_number)\n$(${self.label}:standby_name)`,
    size: "14",
    color: AMBER,
    bgcolor: BLACK,
  });

  presets.standby_cue = preset({
    name: "Standby a specific cue (edit the number)",
    text: "STBY\nCue 1",
    size: "14",
    actions: [{ actionId: "standbyCue", options: { cue: "1" } }],
    feedbacks: [
      {
        feedbackId: "standbyCue",
        options: { cue: "1" },
        style: { bgcolor: AMBER, color: BLACK },
      },
    ],
  });

  // --- One cue -------------------------------------------------------------
  presets.cue_go = preset({
    name: "Fire a cue (edit the number)",
    text: "GO\nCue 1",
    bgcolor: BLACK,
    actions: [{ actionId: "cueGo", options: { cue: "1" } }],
    feedbacks: [
      {
        feedbackId: "cuePlaying",
        options: { cue: "1" },
        style: { bgcolor: GREEN, color: WHITE },
      },
      {
        feedbackId: "standbyCue",
        options: { cue: "1" },
        style: { bgcolor: AMBER, color: BLACK },
      },
    ],
  });

  presets.cue_stop = preset({
    name: "Stop a cue (edit the number)",
    text: "STOP\nCue 1",
    bgcolor: BLACK,
    actions: [
      { actionId: "cueStop", options: { cue: "1", fade: defaultFade } },
    ],
    feedbacks: [
      {
        feedbackId: "cuePlaying",
        options: { cue: "1" },
        style: { bgcolor: AMBER, color: BLACK },
      },
    ],
  });

  presets.cue_audition = preset({
    name: "Audition a cue (edit the number)",
    text: "AUD\nCue 1",
    bgcolor: BLACK,
    actions: [{ actionId: "cueAudition", options: { cue: "1" } }],
  });

  presets.cue_release_vamp = preset({
    name: "Release one cue's vamp (edit the number)",
    text: "DEVAMP\nCue 1",
    size: "14",
    bgcolor: BLACK,
    actions: [{ actionId: "cueReleaseVamp", options: { cue: "1" } }],
  });

  // A ready-made bank so a show numbered 1..8 is one drag per button rather
  // than one drag and one edit per button. Feedback is wired on each: standby
  // amber, sounding green.
  for (const cue of CUE_BANK) {
    presets[`cue_bank_${cue}`] = preset({
      name: `Fire cue ${cue}`,
      text: `CUE\n${cue}`,
      bgcolor: BLACK,
      actions: [{ actionId: "cueGo", options: { cue } }],
      feedbacks: [
        {
          feedbackId: "cuePlaying",
          options: { cue },
          style: { bgcolor: GREEN, color: WHITE },
        },
        {
          feedbackId: "standbyCue",
          options: { cue },
          style: { bgcolor: AMBER, color: BLACK },
        },
      ],
    });
  }

  // --- Master --------------------------------------------------------------
  presets.master_display = preset({
    name: "Master level display (no action)",
    text: `MASTER\n$(${self.label}:master_db) dB`,
    size: "14",
    bgcolor: BLACK,
    feedbacks: [
      {
        feedbackId: "masterBelow",
        options: { db: -0.5 },
        style: { bgcolor: BLACK, color: AMBER },
      },
    ],
  });

  presets.master_unity = preset({
    name: "Master to 0 dB",
    text: "MASTER\n0 dB",
    size: "14",
    actions: [{ actionId: "masterLevel", options: { db: 0 } }],
  });

  const masterSteps = [-3, -6, -10, -20];
  for (const db of masterSteps) {
    presets[`master_minus${Math.abs(db)}`] = preset({
      name: `Master to ${db} dB`,
      text: `MASTER\n${db} dB`,
      size: "14",
      actions: [{ actionId: "masterLevel", options: { db } }],
    });
  }

  presets.master_up = preset({
    name: "Master +1 dB",
    text: "MASTER\n+1 dB",
    size: "14",
    actions: [{ actionId: "masterLevelAdjust", options: { delta: 1 } }],
  });

  presets.master_down = preset({
    name: "Master -1 dB",
    text: "MASTER\n-1 dB",
    size: "14",
    actions: [{ actionId: "masterLevelAdjust", options: { delta: -1 } }],
  });

  // --- Status --------------------------------------------------------------
  // Worth putting on any page that carries cue colour. Every other feedback in
  // this module keeps showing its last known value when SimpleCue goes away —
  // this is the one that says whether that value is still current.
  presets.status = preset({
    name: "Status feed is live (press to re-query)",
    text: `SimpleCue\n$(${self.label}:status)`,
    size: "14",
    bgcolor: RED,
    actions: [{ actionId: "queryStatus", options: {} }],
    feedbacks: [
      {
        feedbackId: "connected",
        options: {},
        style: { bgcolor: DARKGREEN, color: BRIGHTGREEN },
      },
    ],
  });

  presets.playing_count = preset({
    name: "Cues sounding (no action)",
    text: `PLAYING\n$(${self.label}:playing_count)`,
    size: "14",
    bgcolor: BLACK,
    feedbacks: [
      {
        feedbackId: "anyPlaying",
        options: {},
        style: { bgcolor: GREEN, color: WHITE },
      },
    ],
  });

  presets.last_error = preset({
    name: "Last error reported by SimpleCue (no action)",
    text: `ERR\n$(${self.label}:last_error)`,
    size: "14",
    bgcolor: BLACK,
    feedbacks: [
      {
        feedbackId: "recentError",
        options: { seconds: 10 },
        style: { bgcolor: RED, color: WHITE },
      },
    ],
  });

  const structure = [
    {
      id: "transport",
      name: "Transport",
      description:
        "GO, stop, panic and pause. GO fires the standby step — it is the space bar, not 'fire cue N'.",
      definitions: [
        {
          id: "transport-main",
          type: "simple",
          name: "Transport",
          presets: [
            "go",
            "go_named",
            "stop_all",
            "panic",
            "pause_toggle",
            "release_vamp",
          ],
        },
      ],
      keywords: ["go", "stop", "panic", "pause"],
    },
    {
      id: "standby",
      name: "Standby",
      description: "Move the standby marker, and show where it is sitting.",
      definitions: [
        {
          id: "standby-main",
          type: "simple",
          name: "Standby",
          presets: [
            "standby_next",
            "standby_previous",
            "standby_display",
            "standby_cue",
          ],
        },
      ],
    },
    {
      id: "cues",
      name: "Cues",
      description:
        "Cue numbers are free text in SimpleCue and are not published over OSC, so these ship with a number to edit rather than a dropdown to pick from.",
      definitions: [
        {
          id: "cues-templates",
          type: "simple",
          name: "One cue (edit the number)",
          presets: ["cue_go", "cue_stop", "cue_audition", "cue_release_vamp"],
        },
        {
          id: "cues-bank",
          type: "simple",
          name: "Cues 1-8, ready to drop",
          description: "Amber while standing by, green while sounding.",
          presets: CUE_BANK.map((cue) => `cue_bank_${cue}`),
        },
      ],
      keywords: ["cue", "fire", "audition", "vamp"],
    },
    {
      id: "master",
      name: "Master level",
      definitions: [
        {
          id: "master-main",
          type: "simple",
          name: "Master level",
          presets: [
            "master_display",
            "master_unity",
            ...masterSteps.map((db) => `master_minus${Math.abs(db)}`),
            "master_up",
            "master_down",
          ],
        },
      ],
    },
    {
      id: "status",
      name: "Status",
      description:
        "Put the status button on any page carrying cue colour — it is what distinguishes a current green from a stale one.",
      definitions: [
        {
          id: "status-main",
          type: "simple",
          name: "Status",
          presets: ["status", "playing_count", "last_error"],
        },
      ],
    },
  ];

  self.setPresetDefinitions(structure, presets);
}
