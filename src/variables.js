// A fixed set — unlike a module that discovers its device's objects, everything
// SimpleCue publishes over OSC is known ahead of time (six status addresses,
// Source/Control/ControlHub.cpp's publishStatus). So the definitions can be
// registered once at init rather than rebuilt on every update.
//
// setVariableDefinitions expects an object keyed by variable id, not an array.
export default function UpdateVariableDefinitions(self) {
  self.setVariableDefinitions({
    standby_number: { name: "Standby cue number" },
    standby_name: { name: "Standby cue name" },
    playing_count: { name: "Cues currently sounding" },
    playing_cues: {
      name: "Cue numbers currently sounding (space-separated)",
    },
    paused: { name: "Paused (Paused / Running)" },
    vamping: { name: "Vamping (Vamping / No)" },
    master_db: { name: "Master level, dB" },
    last_error: {
      name: "Last error reported by SimpleCue",
    },
    status: {
      name: "Status feed (Connected / No status)",
    },
  });
}
