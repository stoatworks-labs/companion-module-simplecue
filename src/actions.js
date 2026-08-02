// Every action here is fire-and-forget. See the note on oscTransport.send:
// nothing SimpleCue does is acknowledged, so no callback can meaningfully
// return a failure. What an operator gets instead is the $(simplecue:last_error)
// variable and the "SimpleCue reported an error" feedback — SimpleCue answers an
// unknown cue number with /status/error rather than silence, and that is the
// only channel through which a bad button press becomes visible.

// SimpleCue's master gain in dB. The floor is this module's choice of a usable
// fader range, not a limit in the app — the app takes any double. Anything
// below the floor is better expressed as Stop or Panic than as a level.
const MASTER_MIN_DB = -60;
const MASTER_MAX_DB = 10;

/** Cue numbers are free text in SimpleCue ("12", "12.5", "PRE"), and the app
 *  never publishes its cue list over OSC — so these cannot be dropdowns and the
 *  operator types the number from the cue sheet. Variables are parsed so a
 *  button can be driven from a custom variable, which is how a "fire whatever is
 *  in the next-cue variable" button gets built. */
function cueNumberOption(label = "Cue number") {
  return {
    id: "cue",
    type: "textinput",
    label,
    default: "",
    useVariables: true,
    tooltip:
      "As printed on the cue sheet, not a list position. Numeric values match loosely, so 12.50 finds 12.5.",
  };
}

function fadeOption(defaultValue) {
  return {
    id: "fade",
    type: "number",
    label: "Fade (seconds)",
    min: 0,
    max: 60,
    default: defaultValue,
    step: 0.1,
  };
}

export default function UpdateActions(self) {
  const defaultFade = Number(self.config?.defaultstopfade ?? 2);

  /** Resolve a cue-number field, trimmed. An empty result is dropped rather
   *  than sent: "/cue//go" is not a valid address and SimpleCue would answer
   *  with an error the operator did not cause. */
  const cueNumber = async (event) => {
    const raw = await self.parseVariablesInString(
      String(event.options.cue ?? ""),
    );
    return raw.trim();
  };

  const withCue = (verb, buildArgs) => async (event) => {
    const number = await cueNumber(event);
    if (!number) {
      self.log("warn", `Cue action "${verb}" skipped — no cue number given.`);
      return;
    }
    self.send(`/cue/${number}/${verb}`, buildArgs ? buildArgs(event) : []);
  };

  self.setActionDefinitions({
    // --- The transport --------------------------------------------------
    go: {
      name: "GO (fire the standby step)",
      description:
        "Performs whatever the standby marker is sitting on — the cue itself or one of its sub-cues — and advances. This is the space bar, not 'fire cue N'.",
      options: [],
      callback: async () => self.send("/go", []),
    },
    stopAll: {
      name: "Stop everything",
      description:
        "Fades every sounding cue out over the given time. Use Panic for an immediate cut.",
      options: [fadeOption(defaultFade)],
      callback: async (event) => {
        self.send("/stop", [
          { type: "f", value: Number(event.options.fade) || 0 },
        ]);
      },
    },
    panic: {
      name: "PANIC (immediate silence)",
      description:
        "Cuts all audio instantly and cancels queued outgoing control messages — a message that lands after someone hit panic is exactly what they were stopping.",
      options: [],
      callback: async () => self.send("/panic", []),
    },
    pause: {
      name: "Pause",
      options: [],
      callback: async () => self.send("/pause", []),
    },
    resume: {
      name: "Resume",
      options: [],
      callback: async () => self.send("/resume", []),
    },
    pauseToggle: {
      name: "Pause / Resume (toggle)",
      description:
        "Toggled by SimpleCue, not by this module — so it stays correct even if something else paused playback.",
      options: [],
      callback: async () => self.send("/pause/toggle", []),
    },
    releaseVamp: {
      name: "Release every vamp",
      options: [],
      callback: async () => self.send("/releasevamp", []),
    },

    // --- The standby marker ----------------------------------------------
    standbyNext: {
      name: "Standby: next",
      options: [],
      callback: async () => self.send("/standby/next", []),
    },
    standbyPrevious: {
      name: "Standby: previous",
      options: [],
      callback: async () => self.send("/standby/previous", []),
    },
    standbyCue: {
      name: "Standby: a specific cue",
      options: [cueNumberOption()],
      callback: async (event) => {
        const number = await cueNumber(event);
        if (!number) {
          self.log("warn", "Standby action skipped — no cue number given.");
          return;
        }
        self.send(`/standby/${number}`, []);
      },
    },

    // --- One named cue -----------------------------------------------------
    cueGo: {
      name: "Cue: fire",
      description:
        "Fires that cue as a whole, honouring its 'firing this cue also fires its Play sub-cue' setting.",
      options: [cueNumberOption()],
      callback: withCue("go"),
    },
    cueStop: {
      name: "Cue: stop",
      options: [cueNumberOption(), fadeOption(defaultFade)],
      callback: withCue("stop", (event) => [
        { type: "f", value: Number(event.options.fade) || 0 },
      ]),
    },
    cueStandby: {
      name: "Cue: stand by",
      options: [cueNumberOption()],
      callback: withCue("standby"),
    },
    cueSelect: {
      name: "Cue: select (for editing)",
      description:
        "Moves the editing selection only. It does not change what GO will fire — use 'Cue: stand by' for that.",
      options: [cueNumberOption()],
      callback: withCue("select"),
    },
    cueAudition: {
      name: "Cue: audition",
      options: [cueNumberOption()],
      callback: withCue("audition"),
    },
    cueReleaseVamp: {
      name: "Cue: release vamp",
      options: [cueNumberOption()],
      callback: withCue("releasevamp"),
    },

    // --- Master level -------------------------------------------------------
    masterLevel: {
      name: "Master level: set",
      options: [
        {
          id: "db",
          type: "number",
          label: "Level (dB)",
          min: MASTER_MIN_DB,
          max: MASTER_MAX_DB,
          default: 0,
          step: 0.5,
        },
      ],
      callback: async (event) => {
        self.send("/master/level", [
          { type: "f", value: Number(event.options.db) || 0 },
        ]);
      },
    },
    masterLevelAdjust: {
      name: "Master level: adjust by",
      description:
        "Relative to the level SimpleCue last reported, so it needs a working status path back to Companion. With no status the module has no starting point and the action is skipped rather than jumping from an assumed 0 dB.",
      options: [
        {
          id: "delta",
          type: "number",
          label: "Change (dB)",
          min: -24,
          max: 24,
          default: -3,
          step: 0.5,
        },
      ],
      callback: async (event) => {
        if (!self.isLive()) {
          self.log(
            "warn",
            "Master level adjust skipped — no status from SimpleCue, so the current level is unknown.",
          );
          return;
        }
        const next = Math.min(
          MASTER_MAX_DB,
          Math.max(
            MASTER_MIN_DB,
            self.state.masterDb + (Number(event.options.delta) || 0),
          ),
        );
        self.send("/master/level", [{ type: "f", value: next }]);
      },
    },

    // --- Housekeeping -------------------------------------------------------
    queryStatus: {
      name: "Request a status refresh",
      description:
        "Makes SimpleCue re-send its whole state. The module already does this on a heartbeat; this is for a button when the heartbeat is turned off.",
      options: [],
      callback: async () => self.query(),
    },
    sendRaw: {
      name: "Send a raw OSC address",
      description:
        "An escape hatch for anything this module has not caught up with. The address is sent to SimpleCue exactly as typed.",
      options: [
        {
          id: "address",
          type: "textinput",
          label: "Address",
          default: "/go",
          useVariables: true,
        },
        {
          id: "argument",
          type: "textinput",
          label: "Argument (optional)",
          default: "",
          useVariables: true,
          tooltip:
            "Sent as a float if it parses as a number, otherwise as a string. Leave empty for no argument.",
        },
      ],
      callback: async (event) => {
        const address = (
          await self.parseVariablesInString(String(event.options.address ?? ""))
        ).trim();
        if (!address.startsWith("/")) {
          self.log("warn", `Raw OSC skipped — "${address}" is not an address.`);
          return;
        }
        const raw = (
          await self.parseVariablesInString(
            String(event.options.argument ?? ""),
          )
        ).trim();
        const args = [];
        if (raw.length > 0) {
          const asNumber = Number(raw);
          args.push(
            Number.isFinite(asNumber)
              ? { type: "f", value: asNumber }
              : { type: "s", value: raw },
          );
        }
        self.send(address, args);
      },
    },
  });
}
