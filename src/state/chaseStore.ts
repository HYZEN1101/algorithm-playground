import { useSyncExternalStore } from "react";
import type { Grid } from "../world/grid";
import type { NodeId } from "../types/shared";
import type { AlgorithmName } from "../algorithms/pathfinding/types";
import { ALGORITHM_NAMES } from "../algorithms/pathfinding/registry";
import { computeGhostStep, computePlayerMove, type Direction } from "../game/chaseEngine";

export type ChaseStatus = "idle" | "running" | "caught" | "survived";

export interface ChaseState {
  status: ChaseStatus;
  playerNodeId: NodeId | null;
  /** One position per algorithm — all four ghosts always present (Phase 11's decided scope: 4 simultaneous ghosts, not a configurable count). */
  ghostPositions: Record<AlgorithmName, NodeId> | null;
  /** Which ghost caught the player, once status is "caught". */
  caughtBy: AlgorithmName | null;
  timeRemainingMs: number;
}

export const CHASE_TIME_LIMIT_MS = 30_000;
const GHOST_REPLAN_INTERVAL_MS = 400;
const CLOCK_TICK_MS = 100;

/**
 * Phase 11 (Chase Mode) live game state — deliberately NOT built on
 * PlaybackController (see PHASE_11_CHASE_MODE.md's Architecture
 * Decision): there is no precomputed timeline here, only a live loop
 * reacting to real-time player input and a live ghost-replan timer. Same
 * hand-rolled-store pattern as every other store in this project
 * (ARCHITECTURE.md §10), just with two internal `setInterval` timers
 * instead of zero.
 */
function createChaseStore() {
  let state: ChaseState = {
    status: "idle",
    playerNodeId: null,
    ghostPositions: null,
    caughtBy: null,
    timeRemainingMs: CHASE_TIME_LIMIT_MS,
  };
  let grid: Grid | null = null;
  let ghostTimer: ReturnType<typeof setInterval> | null = null;
  let clockTimer: ReturnType<typeof setInterval> | null = null;
  let lastClockTick = 0;

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  function clearTimers(): void {
    if (ghostTimer !== null) {
      clearInterval(ghostTimer);
      ghostTimer = null;
    }
    if (clockTimer !== null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  }

  function findCatcher(positions: Record<AlgorithmName, NodeId>, playerPos: NodeId): AlgorithmName | null {
    for (const name of ALGORITHM_NAMES) {
      if (positions[name] === playerPos) return name;
    }
    return null;
  }

  function stepGhosts(): void {
    if (!grid || state.status !== "running" || !state.ghostPositions || state.playerNodeId === null) return;

    const playerPos = state.playerNodeId;
    const nextPositions = { ...state.ghostPositions };
    for (const name of ALGORITHM_NAMES) {
      nextPositions[name] = computeGhostStep(grid, nextPositions[name], playerPos, name);
    }

    const caughtBy = findCatcher(nextPositions, playerPos);
    state = caughtBy
      ? { ...state, ghostPositions: nextPositions, status: "caught", caughtBy }
      : { ...state, ghostPositions: nextPositions };

    if (caughtBy) clearTimers();
    notify();
  }

  function tickClock(): void {
    if (state.status !== "running") return;
    const now = Date.now();
    const elapsed = lastClockTick === 0 ? CLOCK_TICK_MS : now - lastClockTick;
    lastClockTick = now;

    const remaining = Math.max(0, state.timeRemainingMs - elapsed);
    if (remaining <= 0) {
      state = { ...state, timeRemainingMs: 0, status: "survived" };
      clearTimers();
    } else {
      state = { ...state, timeRemainingMs: remaining };
    }
    notify();
  }

  return {
    getState(): Readonly<ChaseState> {
      return state;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * Starts a fresh chase: the player spawns at the world's Start node;
     * all four ghosts spawn together at the world's Goal node, reframed
     * as a "ghost den" (reuses the existing Start/Goal concept rather
     * than adding new spawn-point UI, per PHASE_11_CHASE_MODE.md).
     */
    start(activeGrid: Grid, playerStart: NodeId, ghostSpawn: NodeId): void {
      clearTimers();
      grid = activeGrid;
      lastClockTick = 0;

      const ghostPositions = Object.fromEntries(ALGORITHM_NAMES.map((name) => [name, ghostSpawn])) as Record<
        AlgorithmName,
        NodeId
      >;

      state = {
        status: "running",
        playerNodeId: playerStart,
        ghostPositions,
        caughtBy: null,
        timeRemainingMs: CHASE_TIME_LIMIT_MS,
      };
      notify();

      ghostTimer = setInterval(stepGhosts, GHOST_REPLAN_INTERVAL_MS);
      clockTimer = setInterval(tickClock, CLOCK_TICK_MS);
    },

    /** Attempts to move the player one cell; a no-op if blocked or if no chase is running. Checks for a catch immediately (a player walking INTO a ghost, not just a ghost stepping onto the player). */
    movePlayer(direction: Direction): void {
      if (!grid || state.status !== "running" || state.playerNodeId === null) return;

      const newPos = computePlayerMove(grid, state.playerNodeId, direction);
      if (newPos === state.playerNodeId) return;

      state = { ...state, playerNodeId: newPos };

      if (state.ghostPositions) {
        const caughtBy = findCatcher(state.ghostPositions, newPos);
        if (caughtBy) {
          state = { ...state, status: "caught", caughtBy };
          clearTimers();
        }
      }
      notify();
    },

    /** Stops any running chase and returns to the pre-game idle state. */
    stop(): void {
      clearTimers();
      grid = null;
      state = { status: "idle", playerNodeId: null, ghostPositions: null, caughtBy: null, timeRemainingMs: CHASE_TIME_LIMIT_MS };
      notify();
    },
  };
}

export type ChaseStore = ReturnType<typeof createChaseStore>;

export const chaseStore: ChaseStore = createChaseStore();

export function useChaseState(): ChaseState {
  return useSyncExternalStore(chaseStore.subscribe, chaseStore.getState);
}
