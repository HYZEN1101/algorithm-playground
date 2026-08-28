import { useRef, useCallback, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { pixelToGrid, type CellMetrics } from "../../rendering/coordinates";
import type { TerrainType } from "../../world/terrain";
import { worldStore } from "../../state/worldStore";
import { uiStore } from "../../state/uiStore";

/**
 * Deliberately NOT importing RendererHandle from renderer.ts here — that
 * file has exactly one allowed importer, CanvasGrid.tsx (ARCHITECTURE.md
 * §20 risk table). This hook only ever needs one method off the renderer,
 * so it declares that narrow shape itself instead.
 */
interface MetricsSource {
  getMetrics(): CellMetrics | null;
}

type DragState =
  | { mode: "paint"; terrain: TerrainType; lastRow: number; lastCol: number }
  | { mode: "move-start" }
  | { mode: "move-goal" };

export interface GridPointerHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
}

/**
 * Translates raw pointer events into worldStore actions. Reads worldStore
 * imperatively (not via useWorldState()) since this is drag-interaction
 * logic, not something that needs to re-render React — matching
 * ARCHITECTURE.md §9's guidance to keep interaction logic out of both the
 * renderer and raw JSX.
 */
export function useGridInteraction(
  canvasRef: RefObject<HTMLCanvasElement>,
  rendererRef: RefObject<MetricsSource | null>,
): GridPointerHandlers {
  const dragRef = useRef<DragState | null>(null);

  const resolveCell = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>): { row: number; col: number } | null => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !renderer) return null;
      const metrics = renderer.getMetrics();
      if (!metrics) return null;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return pixelToGrid(x, y, metrics);
    },
    [canvasRef, rendererRef],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const cell = resolveCell(e);
      if (!cell) return;

      const { grid, activeTool } = worldStore.getState();
      const id = grid.idOf(cell.row, cell.col);

      if (activeTool.kind === "paint") {
        worldStore.paintCell(id, activeTool.terrain);
        dragRef.current = { mode: "paint", terrain: activeTool.terrain, lastRow: cell.row, lastCol: cell.col };
      } else if (activeTool.kind === "move-start") {
        worldStore.moveStart(id);
        dragRef.current = { mode: "move-start" };
      } else if (activeTool.kind === "move-goal") {
        worldStore.moveGoal(id);
        dragRef.current = { mode: "move-goal" };
      } else if (activeTool.kind === "inspect") {
        // Click-to-select for the Inspector (Phase 6), via its own
        // explicit tool rather than an always-active hover/click — same
        // rationale Phase 2 already used for paint vs. move: overloading
        // a bare click across multiple meanings (paint AND select AND
        // move) is ambiguous once more than one tool exists. Single
        // click only, no drag-to-select — dragRef stays unset so
        // onPointerMove's early-return leaves the selection alone while
        // dragging, matching plain click semantics.
        uiStore.selectNode(id);
      }

      canvasRef.current?.setPointerCapture(e.pointerId);
    },
    [canvasRef, resolveCell],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const cell = resolveCell(e);
      if (!cell) return; // pointer left the grid area — hold last valid state

      const { grid } = worldStore.getState();
      const id = grid.idOf(cell.row, cell.col);

      if (drag.mode === "paint") {
        if (cell.row !== drag.lastRow || cell.col !== drag.lastCol) {
          worldStore.paintLine(drag.lastRow, drag.lastCol, cell.row, cell.col, drag.terrain);
          drag.lastRow = cell.row;
          drag.lastCol = cell.col;
        }
      } else if (drag.mode === "move-start") {
        worldStore.moveStart(id); // no-op (snap-back) if the cell is a wall
      } else if (drag.mode === "move-goal") {
        worldStore.moveGoal(id);
      }
    },
    [resolveCell],
  );

  const endDrag = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
  }, [canvasRef]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerLeave: endDrag,
  };
}
