import { describe, it, expect } from "vitest";
import { deriveNodeStates, findCurrentNode } from "../../src/playback/deriveNodeStates";
import type { AlgorithmEvent } from "../../src/algorithms/pathfinding/types";

describe("deriveNodeStates", () => {
  it("returns an empty map at index 0", () => {
    const events: AlgorithmEvent[] = [{ type: "ADD_TO_FRONTIER", nodeId: 1 }];
    expect(deriveNodeStates(events, 0).size).toBe(0);
  });

  it("a node becomes frontier after ADD_TO_FRONTIER", () => {
    const events: AlgorithmEvent[] = [{ type: "ADD_TO_FRONTIER", nodeId: 1 }];
    const states = deriveNodeStates(events, 1);
    expect(states.get(1)?.status).toBe("frontier");
  });

  it("a node becomes visited after VISIT_NODE, with a discovery order recorded", () => {
    const events: AlgorithmEvent[] = [
      { type: "ADD_TO_FRONTIER", nodeId: 1 },
      { type: "REMOVE_FROM_FRONTIER", nodeId: 1 },
      { type: "VISIT_NODE", nodeId: 1 },
    ];
    const states = deriveNodeStates(events, events.length);
    expect(states.get(1)?.status).toBe("visited");
    expect(states.get(1)?.order).toBe(0);
  });

  it("ADD_TO_FRONTIER followed later by REMOVE_FROM_FRONTIER + VISIT_NODE: status is correct at every index", () => {
    // This is the exact scenario the phase file calls out: confirm the
    // node's status at each intermediate point in the timeline, not just
    // at the final index.
    const events: AlgorithmEvent[] = [
      { type: "ADD_TO_FRONTIER", nodeId: 7 }, // index 0 -> after: frontier
      { type: "ADD_TO_FRONTIER", nodeId: 8 }, // index 1 -> unrelated node
      { type: "REMOVE_FROM_FRONTIER", nodeId: 7 }, // index 2 -> still frontier (no-op event)
      { type: "VISIT_NODE", nodeId: 7 }, // index 3 -> now visited
      { type: "COMPLETE" }, // index 4
    ];

    expect(deriveNodeStates(events, 0).get(7)).toBeUndefined(); // unexplored
    expect(deriveNodeStates(events, 1).get(7)?.status).toBe("frontier");
    expect(deriveNodeStates(events, 3).get(7)?.status).toBe("frontier"); // after REMOVE, before VISIT
    expect(deriveNodeStates(events, 4).get(7)?.status).toBe("visited"); // after VISIT
    expect(deriveNodeStates(events, 5).get(7)?.status).toBe("visited"); // stays visited to the end
  });

  it("UPDATE_DISTANCE sets distance without clobbering other fields", () => {
    const events: AlgorithmEvent[] = [
      { type: "ADD_TO_FRONTIER", nodeId: 1 },
      { type: "SET_PARENT", nodeId: 1, parentId: 0 },
      { type: "UPDATE_DISTANCE", nodeId: 1, distance: 4 },
    ];
    const state = deriveNodeStates(events, events.length).get(1);
    expect(state).toEqual({ status: "frontier", parent: 0, distance: 4 });
  });

  it("UPDATE_SCORES sets g/h/f together", () => {
    const events: AlgorithmEvent[] = [
      { type: "ADD_TO_FRONTIER", nodeId: 1 },
      { type: "UPDATE_SCORES", nodeId: 1, g: 3, h: 5, f: 8 },
    ];
    const state = deriveNodeStates(events, events.length).get(1);
    expect(state).toMatchObject({ g: 3, h: 5, f: 8 });
  });

  it("BUILD_PATH marks a node as path, overriding prior visited status", () => {
    const events: AlgorithmEvent[] = [
      { type: "ADD_TO_FRONTIER", nodeId: 1 },
      { type: "REMOVE_FROM_FRONTIER", nodeId: 1 },
      { type: "VISIT_NODE", nodeId: 1 },
      { type: "BUILD_PATH", nodeId: 1 },
    ];
    const state = deriveNodeStates(events, events.length).get(1);
    expect(state?.status).toBe("path");
  });

  it("path status is only reached once the timeline reaches the BUILD_PATH event, not before", () => {
    const events: AlgorithmEvent[] = [
      { type: "ADD_TO_FRONTIER", nodeId: 1 },
      { type: "REMOVE_FROM_FRONTIER", nodeId: 1 },
      { type: "VISIT_NODE", nodeId: 1 }, // index 2 -> visited
      { type: "BUILD_PATH", nodeId: 1 }, // index 3 -> path
    ];
    expect(deriveNodeStates(events, 3).get(1)?.status).toBe("visited");
    expect(deriveNodeStates(events, 4).get(1)?.status).toBe("path");
  });

  it("clamps upToIndex into [0, events.length]", () => {
    const events: AlgorithmEvent[] = [{ type: "ADD_TO_FRONTIER", nodeId: 1 }];
    expect(deriveNodeStates(events, -5).size).toBe(0);
    expect(deriveNodeStates(events, 999).get(1)?.status).toBe("frontier");
  });

  it("assigns increasing discovery order across multiple VISIT_NODE events, matching DFS's own counting", () => {
    const events: AlgorithmEvent[] = [
      { type: "VISIT_NODE", nodeId: 1 },
      { type: "VISIT_NODE", nodeId: 2 },
      { type: "VISIT_NODE", nodeId: 3 },
    ];
    const states = deriveNodeStates(events, events.length);
    expect(states.get(1)?.order).toBe(0);
    expect(states.get(2)?.order).toBe(1);
    expect(states.get(3)?.order).toBe(2);
  });
});

describe("findCurrentNode", () => {
  it("is null before any VISIT_NODE event has occurred", () => {
    const events: AlgorithmEvent[] = [{ type: "ADD_TO_FRONTIER", nodeId: 1 }];
    expect(findCurrentNode(events, 1)).toBeNull();
  });

  it("returns the most recently visited node at the given index", () => {
    const events: AlgorithmEvent[] = [
      { type: "VISIT_NODE", nodeId: 1 },
      { type: "VISIT_NODE", nodeId: 2 },
      { type: "VISIT_NODE", nodeId: 3 },
    ];
    expect(findCurrentNode(events, 1)).toBe(1);
    expect(findCurrentNode(events, 2)).toBe(2);
    expect(findCurrentNode(events, 3)).toBe(3);
  });

  it("does not change on non-VISIT_NODE events after the last visit", () => {
    const events: AlgorithmEvent[] = [
      { type: "VISIT_NODE", nodeId: 5 },
      { type: "SET_PARENT", nodeId: 6, parentId: 5 },
      { type: "COMPLETE" },
    ];
    expect(findCurrentNode(events, events.length)).toBe(5);
  });
});
