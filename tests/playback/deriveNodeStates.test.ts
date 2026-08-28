import { describe, it, expect } from "vitest";
import { deriveNodeStates, findCurrentNode, createIncrementalNodeStateDeriver } from "../../src/playback/deriveNodeStates";
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

describe("createIncrementalNodeStateDeriver", () => {
  function buildLongTimeline(n: number): AlgorithmEvent[] {
    const events: AlgorithmEvent[] = [];
    for (let i = 0; i < n; i++) {
      events.push({ type: "ADD_TO_FRONTIER", nodeId: i });
      events.push({ type: "REMOVE_FROM_FRONTIER", nodeId: i });
      events.push({ type: "VISIT_NODE", nodeId: i });
      events.push({ type: "UPDATE_DISTANCE", nodeId: i, distance: i });
    }
    return events;
  }

  it("matches the pure deriveNodeStates output when advancing forward step by step", () => {
    const events = buildLongTimeline(50);
    const incremental = createIncrementalNodeStateDeriver();

    for (let index = 0; index <= events.length; index += 3) {
      const expected = deriveNodeStates(events, index);
      const actual = incremental.derive(events, index);
      expect(new Map(actual.states)).toEqual(expected);
      expect(actual.currentNodeId).toBe(findCurrentNode(events, index));
    }
  });

  it("matches the pure output after a full run advanced in a single call", () => {
    const events = buildLongTimeline(200);
    const incremental = createIncrementalNodeStateDeriver();
    const actual = incremental.derive(events, events.length);
    const expected = deriveNodeStates(events, events.length);
    expect(new Map(actual.states)).toEqual(expected);
  });

  it("falls back correctly when the index moves backward (step-back/seek/reset)", () => {
    const events = buildLongTimeline(20);
    const incremental = createIncrementalNodeStateDeriver();

    incremental.derive(events, 40); // advance forward first
    const backward = incremental.derive(events, 10); // then jump backward
    expect(new Map(backward.states)).toEqual(deriveNodeStates(events, 10));
    expect(backward.currentNodeId).toBe(findCurrentNode(events, 10));

    // And forward again from the rolled-back point, to confirm the cache
    // wasn't left in some inconsistent half-reset state.
    const forwardAgain = incremental.derive(events, 40);
    expect(new Map(forwardAgain.states)).toEqual(deriveNodeStates(events, 40));
  });

  it("resets cleanly when given a different events array (a new algorithm run)", () => {
    const eventsA = buildLongTimeline(10);
    const eventsB = buildLongTimeline(5); // distinct array reference, different content

    const incremental = createIncrementalNodeStateDeriver();
    incremental.derive(eventsA, eventsA.length);

    const resultB = incremental.derive(eventsB, eventsB.length);
    expect(new Map(resultB.states)).toEqual(deriveNodeStates(eventsB, eventsB.length));
  });

  it("handles upToIndex of 0 (nothing played yet)", () => {
    const events = buildLongTimeline(5);
    const incremental = createIncrementalNodeStateDeriver();
    const result = incremental.derive(events, 0);
    expect(result.states.size).toBe(0);
    expect(result.currentNodeId).toBeNull();
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
