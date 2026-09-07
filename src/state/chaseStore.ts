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
  /** One position per algorithm — all four ghosts always present (Phase 11's decided scope: 4 simultaneous ghosts, not a configurable count — see HANDOFF.md for the planned future "single ghost" option). */
  ghostPositions: Record<AlgorithmName, NodeId> | null;
  /** Which ghost caught the player, once status is "caught". */
  caughtBy: AlgorithmName | null;
  timeRemainingMs: number;
}

export const CHASE_TIME_LIMIT_MS = 30_000;
export const GHOST_REPLAN_INTERVAL_MS = 400;
/**
 * Fixed player movement cadence — one cell every this many ms, driven by
 * a timer, NOT by raw keydown events. Found via play-testing: keydown-
 * driven movement meant speed was bounded by how fast the user could
 * physically mash a key, not by any designed pace, so spamming a
 * direction key could move the player faster than any ghost regardless
 * of the ghosts' own replan interval. A fixed tick makes player speed
 * constant and fair — see HANDOFF.md's Phase 11 Addendum. Set faster
 * than GHOST_REPLAN_INTERVAL_MS (player moves more often than ghosts
 * replan) so the chase stays winnable — a deliberate game-balance choice
 * given ALL FOUR ghosts converge on you at once, not a "make it easy"
 * default.
 */
export const PLAYER_MOVE_INTERVAL_MS = 160;
const CLOCK_TICK_MS = 100;

/**
 * Phase 11 (Chase Mode) live game state — deliberately NOT built on
 * PlaybackController (see PHASE_11_CHASE_MODE.md's Architecture
 * Decision): there is no precomputed timeline here, only a live loop
 * reacting to real-time player input and a live ghost-replan timer. Same
 * hand-rolled-store pattern as every other store in this project
 * (ARCHITECTURE.md §10), just with three internal timers instead of
 * zero (ghost replan, player movement, and the countdown clock).
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
  let playerTimer: ReturnType<typeof setInterval> | null = null;
  let clockTimer: ReturnType<typeof setInterval> | null = null;
  let lastClockTick = 0;

  // Previous-tick ghost positions, keyed by algorithm — used only to
  // pass `avoidPos` into computeGhostStep so a ghost doesn't immediately
  // undo its own last move (see chaseEngine.ts's anti-oscillation note,
  // added after DFS's ghost was observed stalling in a 2-cell loop during
  // real play).
  let previousGhostPositions: Record<AlgorithmName, NodeId> | null = null;

  // Which movement keys are currently held, in press order — the LAST
  // entry is the "active" direction. An ordered array (not a plain Set)
  // so that holding two directions and releasing the most recent one
  // falls back to the other still-held direction, rather than stopping
  // dead — standard snake/pacman-style input handling.
  let heldDirections: Direction[] = [];

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  function clearTimers(): void {
    if (ghostTimer !== null) {
      clearInterval(ghostTimer);
      ghostTimer = null;
    }
    if (playerTimer !== null) {
      clearInterval(playerTimer);
      playerTimer = null;
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
    const previous = previousGhostPositions;
    const nextPositions = { ...state.ghostPositions };
    for (const name of ALGORITHM_NAMES) {
      nextPositions[name] = computeGhostStep(grid, nextPositions[name], playerPos, name, previous?.[name]);
    }
    previousGhostPositions = state.ghostPositions;

    const caughtBy = findCatcher(nextPositions, playerPos);
    state = caughtBy
      ? { ...state, ghostPositions: nextPositions, status: "caught", caughtBy }
      : { ...state, ghostPositions: nextPositions };

    if (caughtBy) clearTimers();
    notify();
  }

  function stepPlayer(): void {
    if (!grid || state.status !== "running" || state.playerNodeId === null) return;
    const activeDirection = heldDirections[heldDirections.length - 1];
    if (!activeDirection) return;

    const newPos = computePlayerMove(grid, state.playerNodeId, activeDirection);
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
      previousGhostPositions = null;
      heldDirections = [];

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
      playerTimer = setInterval(stepPlayer, PLAYER_MOVE_INTERVAL_MS);
      clockTimer = setInterval(tickClock, CLOCK_TICK_MS);
    },

    /**
     * Records that `direction` is now held down (called on keydown).
     * Movement itself happens on `PLAYER_MOVE_INTERVAL_MS`'s own timer
     * (`stepPlayer`, above), not here — this only updates which
     * direction is "active" for that timer to consume on its next tick,
     * which is what makes player speed constant regardless of how fast
     * or slow keys are pressed.
     */
    setDirectionHeld(direction: Direction): void {
      heldDirections = heldDirections.filter((d) => d !== direction);
      heldDirections.push(direction);
    },

    /** Records that `direction` was released (called on keyup). If another direction is still held, it becomes active again automatically (it's still in the array). */
    clearDirectionHeld(direction: Direction): void {
      heldDirections = heldDirections.filter((d) => d !== direction);
    },

    /** Stops any running chase and returns to the pre-game idle state. */
    stop(): void {
      clearTimers();
      grid = null;
      previousGhostPositions = null;
      heldDirections = [];
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
