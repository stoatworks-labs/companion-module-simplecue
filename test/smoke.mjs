// Drives the SimpleCue module's real source against a fake SimpleCue on a real
// UDP socket. Verifies: definition shapes, that actions emit the OSC addresses
// SimpleCue's parser accepts, and that inbound /status/... drives the feedbacks.
import osc from "osc";
import assert from "node:assert/strict";

// A watchdog, because every failure mode in here is a hang rather than a throw:
// a UDP port that never reaches "ready", or a status message that never comes
// back. Without it a broken run looks like a slow one.
const watchdog = setTimeout(() => {
  console.error("\nTIMED OUT — no completion within 30s.");
  process.exit(2);
}, 30000);
watchdog.unref?.();

const MOD = new URL("../src/", import.meta.url).pathname;
const UpdateActions = (await import(`${MOD}actions.js`)).default;
const UpdateFeedbacks = (await import(`${MOD}feedbacks.js`)).default;
const UpdateVariables = (await import(`${MOD}variables.js`)).default;
const UpdatePresets = (await import(`${MOD}presets.js`)).default;
const oscTransport = (await import(`${MOD}osc.js`)).default;

const APP_PORT = 53910; // fake SimpleCue listens here
const MOD_PORT = 53911; // module listens here

const received = [];
const app = new osc.UDPPort({
  localAddress: "127.0.0.1",
  localPort: APP_PORT,
  metadata: true,
});
app.open();
await new Promise((r) => app.on("ready", r));

app.on("message", (m) => {
  received.push(m);
  // Fake SimpleCue: /status/query forces a full publish of six addresses.
  if (m.address.toLowerCase().startsWith("/status/query")) {
    const send = (address, args) =>
      app.send({ address, args }, "127.0.0.1", MOD_PORT);
    send("/status/standby", [
      { type: "s", value: "12.5" },
      { type: "s", value: "Thunder" },
    ]);
    send("/status/playing", [{ type: "i", value: 2 }]);
    send("/status/playingCues", [{ type: "s", value: "3 12.50" }]);
    send("/status/paused", [{ type: "i", value: 0 }]);
    send("/status/vamping", [{ type: "i", value: 1 }]);
    send("/status/master", [{ type: "f", value: -6.25 }]);
  }
});

// --- the fake instance --------------------------------------------------
let actions = {};
let feedbacks = {};
let variables = {};
let presetStructure = null;
let presetDefs = null;
let variableValues = {};

const self = {
  config: {
    remotehost: "127.0.0.1",
    remoteport: String(APP_PORT),
    localport: String(MOD_PORT),
    heartbeat: 5,
    defaultstopfade: 2,
  },
  state: {
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
  },
  log: (level, msg) => {
    if (level === "error") console.error(`  [log ${level}] ${msg}`);
  },
  updateStatus: () => {},
  checkFeedbacks: () => {},
  checkAllFeedbacks: () => {},
  setActionDefinitions: (d) => (actions = d),
  setFeedbackDefinitions: (d) => (feedbacks = d),
  setVariableDefinitions: (d) => (variables = d),
  setPresetDefinitions: (s, p) => {
    presetStructure = s;
    presetDefs = p;
  },
  setVariableValues: (v) => Object.assign(variableValues, v),
  parseVariablesInString: async (s) => s,
  isLive: () => Date.now() - self.state.lastStatusAt <= 15000,
  send: (address, args) => oscTransport.send(self, address, args),
  query: () => oscTransport.query(self),
  refreshVariableValues: () => {
    self.setVariableValues({
      standby_number: self.state.standbyNumber,
      standby_name: self.state.standbyName,
      playing_count: self.state.playingCount,
      playing_cues: self.state.playingCues.join(" "),
      paused: self.state.paused ? "Paused" : "Running",
      vamping: self.state.vamping ? "Vamping" : "No",
      master_db: self.state.masterDb.toFixed(1),
      last_error: self.state.lastError,
      status: self.isLive() ? "Connected" : "No status",
    });
  },
};

UpdateActions(self);
UpdateFeedbacks(self);
UpdateVariables(self);
UpdatePresets(self);
await oscTransport.connect(self);
await new Promise((r) => setTimeout(r, 250));

const ctx = { parseVariablesInString: async (s) => s };
const fb = (id, options = {}) => feedbacks[id].callback({ options }, ctx);
const fire = (id, options = {}) => actions[id].callback({ options });
const wait = () => new Promise((r) => setTimeout(r, 120));

let failures = 0;
const check = async (label, fn) => {
  try {
    await fn();
    console.log(`  ok   ${label}`);
  } catch (e) {
    failures++;
    console.log(`  FAIL ${label}\n       ${e.message}`);
  }
};

console.log("\n== definitions ==");
await check("13+ actions registered", () =>
  assert.ok(
    Object.keys(actions).length >= 13,
    `${Object.keys(actions).length}`,
  ),
);
await check("8 feedbacks registered", () =>
  assert.equal(Object.keys(feedbacks).length, 8),
);
await check("9 variables registered", () =>
  assert.equal(Object.keys(variables).length, 9),
);
await check("every action has a callback + options array", () => {
  for (const [id, a] of Object.entries(actions)) {
    assert.equal(typeof a.callback, "function", `${id} callback`);
    assert.ok(Array.isArray(a.options), `${id} options`);
    assert.ok(a.name, `${id} name`);
  }
});
await check("every feedback is boolean with a defaultStyle", () => {
  for (const [id, f] of Object.entries(feedbacks)) {
    assert.equal(f.type, "boolean", `${id} type`);
    assert.ok(f.defaultStyle, `${id} defaultStyle`);
    assert.equal(typeof f.callback, "function", `${id} callback`);
  }
});

console.log("\n== presets ==");
await check("presets use the 2.x (structure, definitions) shape", () => {
  assert.ok(Array.isArray(presetStructure), "structure is an array");
  assert.equal(typeof presetDefs, "object");
});
await check("every preset is type 'simple' with steps + feedbacks", () => {
  for (const [id, p] of Object.entries(presetDefs)) {
    assert.equal(p.type, "simple", `${id} type`);
    assert.ok(Array.isArray(p.steps), `${id} steps`);
    assert.ok(Array.isArray(p.feedbacks), `${id} feedbacks`);
    assert.ok(p.style?.text !== undefined, `${id} style.text`);
  }
});
await check("every preset referenced by the structure exists", () => {
  for (const section of presetStructure) {
    for (const group of section.definitions) {
      for (const ref of group.presets) {
        assert.ok(presetDefs[ref], `section ${section.id} references ${ref}`);
      }
    }
  }
});
await check("every defined preset is referenced by the structure", () => {
  const referenced = new Set(
    presetStructure.flatMap((s) => s.definitions.flatMap((g) => g.presets)),
  );
  for (const id of Object.keys(presetDefs)) {
    assert.ok(referenced.has(id), `${id} is defined but in no section`);
  }
});
await check("every preset action/feedback id is a real definition", () => {
  for (const [id, p] of Object.entries(presetDefs)) {
    for (const step of p.steps) {
      for (const a of [...step.down, ...step.up]) {
        assert.ok(actions[a.actionId], `${id} -> action ${a.actionId}`);
      }
    }
    for (const f of p.feedbacks) {
      assert.ok(feedbacks[f.feedbackId], `${id} -> feedback ${f.feedbackId}`);
    }
  }
});

console.log("\n== inbound status ==");
await check("status query populated the state", async () => {
  assert.equal(self.state.standbyNumber, "12.5");
  assert.equal(self.state.standbyName, "Thunder");
  assert.equal(self.state.playingCount, 2);
  assert.deepEqual(self.state.playingCues, ["3", "12.50"]);
  assert.equal(self.state.vamping, true);
  assert.equal(self.state.masterDb, -6.25);
});
await check("variables reflect the state", () => {
  assert.equal(variableValues.standby_number, "12.5");
  assert.equal(variableValues.master_db, "-6.3");
  assert.equal(variableValues.vamping, "Vamping");
  assert.equal(variableValues.status, "Connected");
});

console.log("\n== feedbacks ==");
await check("standbyCue lights on the standby cue", async () =>
  assert.equal(await fb("standbyCue", { cue: "12.5" }), true),
);
await check("standbyCue matches loosely (12.50 finds 12.5)", async () =>
  assert.equal(await fb("standbyCue", { cue: "12.50" }), true),
);
await check("standbyCue is dark for another cue", async () =>
  assert.equal(await fb("standbyCue", { cue: "3" }), false),
);
await check("standbyCue is dark for an empty field", async () =>
  assert.equal(await fb("standbyCue", { cue: "" }), false),
);
await check("cuePlaying lights for a sounding cue", async () =>
  assert.equal(await fb("cuePlaying", { cue: "3" }), true),
);
await check("cuePlaying matches loosely (12.5 finds 12.50)", async () =>
  assert.equal(await fb("cuePlaying", { cue: "12.5" }), true),
);
await check("cuePlaying is dark for an empty field", async () =>
  assert.equal(await fb("cuePlaying", { cue: "" }), false),
);
await check("anyPlaying / vamping / paused", async () => {
  assert.equal(await fb("anyPlaying"), true);
  assert.equal(await fb("vamping"), true);
  assert.equal(await fb("paused"), false);
});
await check("masterBelow triggers at -6.25 vs -0.5", async () =>
  assert.equal(await fb("masterBelow", { db: -0.5 }), true),
);
await check("connected is live", async () =>
  assert.equal(await fb("connected"), true),
);
await check("recentError is dark with no error", async () =>
  assert.equal(await fb("recentError", { seconds: 10 }), false),
);

console.log("\n== outbound addresses ==");
received.length = 0;
const sent = async (id, options) => {
  received.length = 0;
  await fire(id, options);
  await wait();
  return received.map((m) => m.address);
};

await check("go -> /go", async () =>
  assert.deepEqual(await sent("go"), ["/go"]),
);
await check("panic -> /panic", async () =>
  assert.deepEqual(await sent("panic"), ["/panic"]),
);
await check("pauseToggle -> /pause/toggle", async () =>
  assert.deepEqual(await sent("pauseToggle"), ["/pause/toggle"]),
);
await check("standbyNext -> /standby/next", async () =>
  assert.deepEqual(await sent("standbyNext"), ["/standby/next"]),
);
await check("standbyCue -> /standby/12.5", async () =>
  assert.deepEqual(await sent("standbyCue", { cue: "12.5" }), [
    "/standby/12.5",
  ]),
);
await check("cueGo -> /cue/12.5/go", async () =>
  assert.deepEqual(await sent("cueGo", { cue: "12.5" }), ["/cue/12.5/go"]),
);
await check("cueStop -> /cue/PRE/stop with a float fade", async () => {
  received.length = 0;
  await fire("cueStop", { cue: "PRE", fade: 3.5 });
  await wait();
  assert.equal(received[0].address, "/cue/PRE/stop");
  assert.equal(received[0].args[0].type, "f");
  assert.equal(received[0].args[0].value, 3.5);
});
await check("cueReleaseVamp -> /cue/1/releasevamp", async () =>
  assert.deepEqual(await sent("cueReleaseVamp", { cue: "1" }), [
    "/cue/1/releasevamp",
  ]),
);
await check("stopAll carries the fade as a float", async () => {
  received.length = 0;
  await fire("stopAll", { fade: 2 });
  await wait();
  assert.equal(received[0].address, "/stop");
  assert.equal(received[0].args[0].type, "f");
});
await check("a blank cue number sends NOTHING", async () =>
  assert.deepEqual(await sent("cueGo", { cue: "   " }), []),
);
await check("masterLevel -> /master/level as a float", async () => {
  received.length = 0;
  await fire("masterLevel", { db: -6 });
  await wait();
  assert.equal(received[0].address, "/master/level");
  assert.equal(received[0].args[0].value, -6);
});
await check("masterLevelAdjust works off the reported level", async () => {
  received.length = 0;
  await fire("masterLevelAdjust", { delta: -3 });
  await wait();
  assert.equal(received[0].args[0].value, -9.25); // -6.25 + -3
});
await check("masterLevelAdjust clamps at the floor", async () => {
  self.state.masterDb = -59;
  received.length = 0;
  await fire("masterLevelAdjust", { delta: -10 });
  await wait();
  assert.equal(received[0].args[0].value, -60);
  self.state.masterDb = -6.25;
});
await check("sendRaw rejects a non-address", async () =>
  assert.deepEqual(await sent("sendRaw", { address: "go", argument: "" }), []),
);
await check("sendRaw sends a typed argument", async () => {
  received.length = 0;
  await fire("sendRaw", { address: "/master/level", argument: "-12" });
  await wait();
  assert.equal(received[0].args[0].type, "f");
  assert.equal(received[0].args[0].value, -12);
});

console.log("\n== error path ==");
await check(
  "/status/error sets the variable and lights the feedback",
  async () => {
    app.send(
      { address: "/status/error", args: [{ type: "s", value: "No cue 99" }] },
      "127.0.0.1",
      MOD_PORT,
    );
    await wait();
    assert.equal(self.state.lastError, "No cue 99");
    assert.equal(await fb("recentError", { seconds: 10 }), true);
    assert.equal(variableValues.last_error, "No cue 99");
  },
);

console.log("\n== teardown ==");
// Regression guard. osc's UDPPort.close() takes no callback, so the natural
// `new Promise((r) => port.close(r))` never settles — which in Companion means
// destroy() hangs and configUpdated() never reconnects after a host/port edit.
// The symptom is a dead instance, not an error, so it has to be tested for.
await check("close() settles rather than hanging", async () => {
  const closed = await Promise.race([
    oscTransport.close().then(() => "closed"),
    new Promise((r) => setTimeout(() => r("hung"), 3000)),
  ]);
  assert.equal(closed, "closed");
});
await check("close() is safe to call twice", async () => {
  const closed = await Promise.race([
    oscTransport.close().then(() => "closed"),
    new Promise((r) => setTimeout(() => r("hung"), 3000)),
  ]);
  assert.equal(closed, "closed");
});
app.close();

console.log("\n== the checkFeedbacks trap ==");
// InstanceBase.checkFeedbacks(type, ...rest) requires AT LEAST ONE type: with no
// arguments it forwards [undefined] to the host, which checks a feedback type
// called "undefined" — i.e. nothing at all. Every feedback then sits frozen at
// whatever it last evaluated to, with no error anywhere. checkAllFeedbacks() is
// the correct call for "re-evaluate everything".
await check("no bare checkFeedbacks() survives in src/", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const dir = new URL("../src/", import.meta.url).pathname;
  const offenders = [];
  for (const f of readdirSync(dir)) {
    if (!/\.(js|ts)$/.test(f)) continue;
    const body = readFileSync(dir + f, "utf8");
    if (/[^A-Za-z]checkFeedbacks\(\s*\)/.test(body)) offenders.push(f);
  }
  assert.deepEqual(offenders, [], "use checkAllFeedbacks() instead");
});

console.log(
  failures === 0
    ? "\nAll checks passed.\n"
    : `\n${failures} CHECK(S) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
