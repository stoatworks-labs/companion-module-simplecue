import osc from "osc";
import { InstanceStatus } from "@companion-module/base";

// SimpleCue's status addresses are absolute — there is no application prefix on
// them the way PDF Presenter has "/pdfpresenter". That is worth knowing before
// pointing this module's listen port at a machine running several show-control
// apps: anything else broadcasting bare "/status/..." to the same port will be
// read as SimpleCue. Give the module its own port.
const STATUS_PREFIX = "/status";

/** Every status argument arrives as i, f or s (Source/Control/OscControl.cpp's
 *  addArgument maps juce::var that way and nothing else). Reading .value is
 *  therefore safe, but the TYPE is not guaranteed across SimpleCue versions —
 *  masterDb is a double today and would silently become an int if it were ever
 *  rounded upstream. Coerce at the point of use, not here. */
function arg(args, index = 0, fallback = null) {
  const a = args?.[index];
  if (a === undefined || a === null) return fallback;
  return a.value ?? fallback;
}

function num(args, index = 0, fallback = 0) {
  const v = Number(arg(args, index, fallback));
  return Number.isFinite(v) ? v : fallback;
}

function str(args, index = 0, fallback = "") {
  const v = arg(args, index, fallback);
  return v === null || v === undefined ? fallback : String(v);
}

function handleMessage(self, oscMsg) {
  const address = String(oscMsg.address ?? "")
    .trim()
    .toLowerCase();
  if (!address.startsWith(`${STATUS_PREFIX}/`)) return;

  const args = oscMsg.args ?? [];

  switch (address) {
    case "/status/standby":
      self.state.standbyNumber = str(args, 0);
      self.state.standbyName = str(args, 1);
      break;
    case "/status/playing":
      self.state.playingCount = num(args, 0, 0);
      break;
    case "/status/playingcues": {
      // A space-separated string, and empty when nothing is sounding. Splitting
      // "" on " " yields [""], not [], so filter — otherwise "is cue X playing"
      // matches a button whose cue number field was left blank.
      const raw = str(args, 0);
      self.state.playingCues = raw.split(" ").filter((n) => n.length > 0);
      break;
    }
    case "/status/paused":
      self.state.paused = num(args, 0, 0) !== 0;
      break;
    case "/status/vamping":
      self.state.vamping = num(args, 0, 0) !== 0;
      break;
    case "/status/master":
      self.state.masterDb = num(args, 0, 0);
      break;
    case "/status/error":
      self.state.lastError = str(args, 0);
      self.state.lastErrorAt = Date.now();
      self.log("warn", `SimpleCue reported: ${self.state.lastError}`);
      break;
    default:
      // An unrecognised /status/... address is not an error. SimpleCue may add
      // more, and a module that logged every one would fill an operator's log
      // with noise during a show.
      return;
  }

  self.state.lastStatusAt = Date.now();
  self.updateStatus(InstanceStatus.Ok);
  self.refreshVariableValues();
  self.checkFeedbacks();
}

const oscTransport = {
  udpPort: null,

  async connect(self) {
    this.udpPort = new osc.UDPPort({
      localAddress: "0.0.0.0",
      localPort: Number(self.config.localport),
      metadata: true,
    });

    this.udpPort.open();

    this.udpPort.on("ready", () => {
      self.log(
        "info",
        `Listening for SimpleCue status on port ${self.config.localport}`,
      );
      // Connecting proves nothing about the far end — UDP has no handshake, and
      // SimpleCue only broadcasts on CHANGE. Without this query a module started
      // mid-show sits with empty variables and dark feedbacks against a perfectly
      // healthy player until the operator happens to press something.
      //
      // Status stays Connecting until a status message actually arrives, so the
      // instance list distinguishes "listening" from "hearing SimpleCue".
      self.updateStatus(
        InstanceStatus.Connecting,
        "Listening — waiting for status from SimpleCue.",
      );
      this.query(self);
    });

    this.udpPort.on("message", (oscMsg) => handleMessage(self, oscMsg));

    this.udpPort.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        self.log("error", `Port ${self.config.localport} already in use`);
        self.updateStatus(
          InstanceStatus.ConnectionFailure,
          `Port ${self.config.localport} in use elsewhere.`,
        );
      } else {
        self.log("error", `UDP port error: ${err.message}`);
        self.updateStatus(InstanceStatus.UnknownError, err.message);
      }
    });
  },

  /** Ask SimpleCue to re-send its whole state. Cheap (six small UDP messages)
   *  and idempotent, which is what makes it usable as a resync heartbeat. */
  query(self) {
    this.send(self, "/status/query", []);
  },

  /**
   * Fire one command at SimpleCue.
   *
   * Deliberately returns nothing. OSC over UDP is unacknowledged — the send
   * succeeding means the datagram left this machine, not that SimpleCue got it,
   * understood it, or found the cue. An address naming a cue that does not exist
   * comes back as /status/error, which is why the module surfaces that as a
   * variable and a feedback rather than pretending a button press can fail.
   */
  send(self, address, args) {
    if (!this.udpPort) return;
    try {
      this.udpPort.send(
        { address, args },
        self.config.remotehost,
        Number(self.config.remoteport),
      );
    } catch (e) {
      self.log("error", `Failed to send ${address}: ${e.message}`);
    }
  },

  /**
   * Close the listen socket.
   *
   * osc's UDPPort.close() takes NO callback — it just calls socket.close()
   * (node_modules/osc/src/platforms/osc-node.js). Passing a resolver to it, the
   * obvious-looking `new Promise((r) => port.close(r))`, therefore produces a
   * promise that never settles: destroy() never finishes and configUpdated()
   * never gets past the close to reconnect, so editing the host or port hangs
   * the instance until Companion is restarted.
   *
   * The port does emit "close", so that is what to await — with a timeout,
   * because a socket that never opened emits nothing and a module that cannot
   * be destroyed is worse than one that leaks a UDP port.
   */
  async close() {
    const port = this.udpPort;
    if (!port) return;
    this.udpPort = null;
    await new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(done, 1000);
      port.once("close", done);
      try {
        port.close();
      } catch {
        done();
      }
    });
  },
};

export default oscTransport;
