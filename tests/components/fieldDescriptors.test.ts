import { describe, it, expect } from "vitest";
import { getFieldDescriptors } from "../../src/components/inspector/fieldDescriptors";
import { Grid } from "../../src/world/grid";
import { TerrainType } from "../../src/world/terrain";
import type { NodeState } from "../../src/algorithms/pathfinding/types";

function labels(algorithm: Parameters<typeof getFieldDescriptors>[0]): string[] {
  return getFieldDescriptors(algorithm).map((f) => f.label);
}

describe("fieldDescriptors", () => {
  it("BFS shows status, distance, parent, terrain, neighbor count — never g/h/f or discovery order", () => {
    const fields = labels("bfs");
    expect(fields).toEqual(["State", "Distance", "Parent", "Terrain", "Neighbors"]);
  });

  it("DFS shows status, discovery order, parent, terrain, neighbor count — never distance or g/h/f", () => {
    const fields = labels("dfs");
    expect(fields).toEqual(["State", "Discovery Order", "Parent", "Terrain", "Neighbors"]);
  });

  it("Dijkstra shows the same shape as BFS (status, distance, parent, terrain, neighbor count)", () => {
    expect(labels("dijkstra")).toEqual(labels("bfs"));
  });

  it("A* shows status, g, h, f, parent, terrain, neighbor count", () => {
    const fields = labels("astar");
    expect(fields).toEqual(["State", "G Score", "H Score", "F Score", "Parent", "Terrain", "Neighbors"]);
  });

  it("no algorithm's field list is duplicated verbatim with another that should differ (BFS vs A*)", () => {
    expect(labels("bfs")).not.toEqual(labels("astar"));
  });

  it("field values render '—' for an unexplored node (nodeState undefined) rather than a raw undefined/NaN", () => {
    const grid = new Grid(3, 3);
    const ctx = { nodeId: 4, nodeState: undefined, grid };
    for (const field of getFieldDescriptors("astar")) {
      if (field.key === "status") continue; // status has its own explicit "Unexplored" label
      if (field.key === "terrain" || field.key === "neighborCount") continue; // always computable from the grid alone
      expect(field.value(ctx)).toBe("—");
    }
  });

  it("status field reports 'Unexplored' for an untouched node and reflects real statuses otherwise", () => {
    const grid = new Grid(3, 3);
    const statusField = getFieldDescriptors("bfs")[0];
    expect(statusField.value({ nodeId: 0, nodeState: undefined, grid })).toBe("Unexplored");
    expect(statusField.value({ nodeId: 0, nodeState: { status: "frontier" }, grid })).toBe("Frontier");
    expect(statusField.value({ nodeId: 0, nodeState: { status: "visited" }, grid })).toBe("Visited");
    expect(statusField.value({ nodeId: 0, nodeState: { status: "path" }, grid })).toBe("Path");
  });

  it("parent field renders as a (row, col) coordinate, derived from the grid, not a raw NodeId", () => {
    const grid = new Grid(5, 5);
    const parentField = getFieldDescriptors("bfs").find((f) => f.key === "parent")!;
    const nodeState: NodeState = { status: "visited", parent: grid.idOf(2, 3) };
    expect(parentField.value({ nodeId: 0, nodeState, grid })).toBe("(2, 3)");
  });

  it("terrain field reads the grid directly, independent of nodeState", () => {
    const grid = new Grid(3, 3);
    grid.setTerrain(grid.idOf(1, 1), TerrainType.Water);
    const terrainField = getFieldDescriptors("dijkstra").find((f) => f.key === "terrain")!;
    expect(terrainField.value({ nodeId: grid.idOf(1, 1), nodeState: undefined, grid })).toBe("Water");
  });

  it("neighbor count field reads the grid directly and respects walls/bounds", () => {
    const grid = new Grid(3, 3); // all-Road, 3x3
    const neighborField = getFieldDescriptors("bfs").find((f) => f.key === "neighborCount")!;
    // Center cell (1,1) has 4 passable neighbors on an all-Road 3x3 grid.
    expect(neighborField.value({ nodeId: grid.idOf(1, 1), nodeState: undefined, grid })).toBe("4");
    // Corner cell (0,0) has only 2.
    expect(neighborField.value({ nodeId: grid.idOf(0, 0), nodeState: undefined, grid })).toBe("2");
  });
});
