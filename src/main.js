import { InstanceBase, Regex, InstanceStatus } from "@companion-module/base";
import { UpgradeScripts } from "./upgrades.js";
import UpdateActions from "./actions.js";
import UpdateFeedbacks from "./feedbacks.js";
import UpdateVariableDefinitions from "./variables.js";
import UpdatePresets from "./presets.js";
import oscTransport from "./osc.js";
import { aboutField } from "./about-field.js";

// How long without a status message before the module stops claiming SimpleCue
// is there. SimpleCue publishes only on change, so silence is the NORMAL state
// of a healthy player sitting in standby — which is exactly why the module
// re-queries on a heartbeat rather than treating silence as a fault. The
// timeout is generous relative to the heartbeat so one lost datagram does not
// mark a working player offline mid-show.
const STALE_AFTER_MS = 15000;

function defaultState() {
  return {
    standbyNumber: "",
    standbyName: "",
    playingCount: 0,
    playingCues: [],
    paused: false,
    vamping: false,
    masterDb: 0,
    lastError: "",
    lastErrorAt: 0,
    lastStatusAt: 0,
  };
}

export default class ModuleInstance extends InstanceBase {
  constructor(internal) {
    super(internal);
    this.state = defaultState();
    this.heartbeatTimer = null;
  }

  async init(config) {
    this.config = config;
    this.state = defaultState();
    this.updateStatus(
      InstanceStatus.Connecting,
      `Opening port ${this.config.localport}...`,
    );
    this.updateActions();
    this.updateFeedbacks();
    this.updateVariableDefinitions();
    this.updatePresets();
    this.refreshVariableValues();
    await oscTransport.connect(this);
    this.startHeartbeat();
  }

  async destroy() {
    this.stopHeartbeat();
    await oscTransport.close();
  }

  async configUpdated(config) {
    this.config = config;
    this.stopHeartbeat();
    this.updateStatus(InstanceStatus.Connecting, "Reconnecting...");
    await oscTransport.close();
    await oscTransport.connect(this);
    this.startHeartbeat();
  }

  getConfigFields() {
    return [
      {
        type: "static-text",
        id: "info",
        width: 12,
        label: "Connection",
        value:
          "SimpleCue: <b>Audio &rarr; Control setup</b>. Turn OSC on, note its input port, and add an OSC <b>target</b> pointing back at this machine and at the local port below — SimpleCue sends no status at all until a target exists, so feedbacks and variables stay empty without one. That panel's live monitor is the first place to look if a button does nothing.",
      },
      {
        type: "textinput",
        id: "remotehost",
        label: "SimpleCue host",
        width: 6,
        regex: Regex.HOSTNAME,
        default: "127.0.0.1",
      },
      {
        type: "textinput",
        id: "remoteport",
        label: "SimpleCue OSC input port",
        width: 6,
        regex: Regex.PORT,
        default: "53000",
      },
      {
        type: "textinput",
        id: "localport",
        label: "Local status (feedback) port",
        width: 6,
        regex: Regex.PORT,
        default: "53001",
      },
      {
        type: "number",
        id: "heartbeat",
        label: "Resync interval (seconds, 0 = off)",
        width: 6,
        min: 0,
        max: 300,
        default: 5,
      },
      {
        type: "static-text",
        id: "heartbeatinfo",
        width: 12,
        label: "",
        value:
          "The resync sends <code>/status/query</code>, which makes SimpleCue re-send everything. It is what recovers state after either end restarts, or after a lost datagram — OSC is UDP and nothing is retransmitted. Set it to 0 only if you have a reason to keep the network silent.",
      },
      {
        type: "number",
        id: "defaultstopfade",
        label: "Default fade for Stop actions (seconds)",
        width: 6,
        min: 0,
        max: 60,
        default: 2,
      },

      // Vendored from stoatworks-backend/about. A Companion module has no
      // UI of its own, so this config panel is the only surface it has.
      aboutField(),
    ];
  }

  /**
   * Re-query on a timer, and expire the connection status if nothing comes back.
   *
   * The staleness check is the only "is SimpleCue there?" signal available:
   * OSC/UDP gives no delivery confirmation, so a module that reported Ok on a
   * successful send would show green against a player that had been closed for
   * an hour. Requiring a recent status message instead means the indicator is
   * earned rather than assumed.
   */
  startHeartbeat() {
    const seconds = Number(this.config.heartbeat);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.heartbeatTimer = setInterval(() => {
      oscTransport.query(this);
      if (
        this.state.lastStatusAt > 0 &&
        Date.now() - this.state.lastStatusAt > STALE_AFTER_MS
      ) {
        this.updateStatus(
          InstanceStatus.ConnectionFailure,
          "No status from SimpleCue — check its OSC target points here.",
        );
      }
      // Re-evaluated every tick rather than only on an inbound message, because
      // two feedbacks here expire on a clock rather than on a state change:
      // "status is live" has to be able to go dark when SimpleCue stops sending,
      // and "reported an error" has to be able to clear itself. Neither can
      // depend on a message that by definition is not arriving.
      this.checkFeedbacks("connected", "recentError");
      this.refreshVariableValues();
    }, seconds * 1000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  /** True while status has arrived recently enough to be trusted. */
  isLive() {
    return (
      this.state.lastStatusAt > 0 &&
      Date.now() - this.state.lastStatusAt <= STALE_AFTER_MS
    );
  }

  send(address, args = []) {
    oscTransport.send(this, address, args);
  }

  query() {
    oscTransport.query(this);
  }

  refreshVariableValues() {
    const db = this.state.masterDb;
    this.setVariableValues({
      standby_number: this.state.standbyNumber,
      standby_name: this.state.standbyName,
      playing_count: this.state.playingCount,
      playing_cues: this.state.playingCues.join(" "),
      paused: this.state.paused ? "Paused" : "Running",
      vamping: this.state.vamping ? "Vamping" : "No",
      master_db: db.toFixed(1),
      last_error: this.state.lastError,
      status: this.isLive() ? "Connected" : "No status",
    });
  }

  updateActions() {
    UpdateActions(this);
  }

  updateFeedbacks() {
    UpdateFeedbacks(this);
  }

  updateVariableDefinitions() {
    UpdateVariableDefinitions(this);
  }

  updatePresets() {
    UpdatePresets(this);
  }
}

export { UpgradeScripts };
