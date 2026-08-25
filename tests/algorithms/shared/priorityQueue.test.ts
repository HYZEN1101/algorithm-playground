import { describe, it, expect } from "vitest";
import { PriorityQueue } from "../../../src/algorithms/shared/priorityQueue";

describe("PriorityQueue", () => {
  it("is empty initially", () => {
    const pq = new PriorityQueue<string>();
    expect(pq.isEmpty()).toBe(true);
    expect(pq.size).toBe(0);
    expect(pq.pop()).toBeUndefined();
  });

  it("pops the single pushed item", () => {
    const pq = new PriorityQueue<string>();
    pq.push("a", 5);
    expect(pq.size).toBe(1);
    expect(pq.pop()).toBe("a");
    expect(pq.isEmpty()).toBe(true);
  });

  it("pops items in ascending priority order regardless of push order", () => {
    const pq = new PriorityQueue<string>();
    pq.push("c", 30);
    pq.push("a", 10);
    pq.push("b", 20);
    expect(pq.pop()).toBe("a");
    expect(pq.pop()).toBe("b");
    expect(pq.pop()).toBe("c");
  });

  it("maintains heap order across interleaved pushes and pops", () => {
    const pq = new PriorityQueue<number>();
    pq.push(5, 5);
    pq.push(1, 1);
    expect(pq.pop()).toBe(1);
    pq.push(3, 3);
    pq.push(0, 0);
    expect(pq.pop()).toBe(0);
    expect(pq.pop()).toBe(3);
    expect(pq.pop()).toBe(5);
    expect(pq.isEmpty()).toBe(true);
  });

  it("equal-priority items pop in insertion order (documented tie-break rule)", () => {
    const pq = new PriorityQueue<string>();
    pq.push("first", 10);
    pq.push("second", 10);
    pq.push("third", 10);
    expect(pq.pop()).toBe("first");
    expect(pq.pop()).toBe("second");
    expect(pq.pop()).toBe("third");
  });

  it("preserves insertion-order tie-break even when ties are interspersed with other priorities", () => {
    const pq = new PriorityQueue<string>();
    pq.push("tie-a", 5);
    pq.push("lower", 1); // pops before both ties
    pq.push("tie-b", 5);
    expect(pq.pop()).toBe("lower");
    expect(pq.pop()).toBe("tie-a"); // inserted before tie-b at the same priority
    expect(pq.pop()).toBe("tie-b");
  });

  it("handles a larger randomized-looking sequence correctly (stress check against a sorted reference)", () => {
    const pq = new PriorityQueue<number>();
    const priorities = [42, 7, 19, 3, 3, 55, 1, 19, 8, 3, 100, 0];
    priorities.forEach((p, i) => pq.push(i, p));

    // Expected pop order: sorted by (priority, insertion index).
    const expected = priorities
      .map((priority, index) => ({ priority, index }))
      .sort((a, b) => (a.priority !== b.priority ? a.priority - b.priority : a.index - b.index))
      .map((e) => e.index);

    const actual: number[] = [];
    while (!pq.isEmpty()) {
      actual.push(pq.pop() as number);
    }
    expect(actual).toEqual(expected);
  });

  it("size decreases correctly after pops", () => {
    const pq = new PriorityQueue<number>();
    pq.push(1, 1);
    pq.push(2, 2);
    pq.push(3, 3);
    expect(pq.size).toBe(3);
    pq.pop();
    expect(pq.size).toBe(2);
    pq.pop();
    pq.pop();
    expect(pq.size).toBe(0);
    expect(pq.isEmpty()).toBe(true);
  });
});
