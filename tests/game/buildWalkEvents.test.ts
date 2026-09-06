import { describe, it, expect } from "vitest";
import { buildWalkEvents } from "../../src/game/buildWalkEvents";

describe("buildWalkEvents", () => {
  it("produces exactly 2*path.length + 1 events, in path order", () => {
    const events = buildWalkEvents([5, 6, 7]);
    expect(events).toHaveLength(2 * 3 + 1);
    expect(events).toEqual([
      { type: "VISIT_NODE", nodeId: 5 },
      { type: "BUILD_PATH", nodeId: 5 },
      { type: "VISIT_NODE", nodeId: 6 },
      { type: "BUILD_PATH", nodeId: 6 },
      { type: "VISIT_NODE", nodeId: 7 },
      { type: "BUILD_PATH", nodeId: 7 },
      { type: "COMPLETE" },
    ]);
  });

  it("handles an empty path without crashing (still terminates with COMPLETE)", () => {
    expect(buildWalkEvents([])).toEqual([{ type: "COMPLETE" }]);
  });

  it("handles a single-node path (start === goal case)", () => {
    const events = buildWalkEvents([42]);
    expect(events).toEqual([
      { type: "VISIT_NODE", nodeId: 42 },
      { type: "BUILD_PATH", nodeId: 42 },
      { type: "COMPLETE" },
    ]);
  });
});
