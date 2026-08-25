/**
 * Binary min-heap. Used by dijkstra.ts and astar.ts to always pop the
 * lowest-priority (lowest cost/f-score) pending node.
 *
 * Tie-break rule (ARCHITECTURE.md Ambiguity #3): equal-priority items pop
 * in insertion order (stable FIFO among ties). This isn't "hope a
 * comparison-based heap happens to be stable" — insertion sequence is
 * baked directly into the comparator as a secondary key, so the heap
 * invariant itself guarantees the tie-break deterministically regardless
 * of how pushes/pops interleave.
 */
export class PriorityQueue<T> {
  private heap: Array<{ item: T; priority: number; seq: number }> = [];
  private nextSeq = 0;

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  push(item: T, priority: number): void {
    const node = { item, priority, seq: this.nextSeq++ };
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top.item;
  }

  private less(
    a: { priority: number; seq: number },
    b: { priority: number; seq: number },
  ): boolean {
    if (a.priority !== b.priority) return a.priority < b.priority;
    return a.seq < b.seq; // earlier insertion wins ties
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.less(this.heap[index], this.heap[parent])) {
        [this.heap[index], this.heap[parent]] = [this.heap[parent], this.heap[index]];
        index = parent;
      } else {
        break;
      }
    }
  }

  private bubbleDown(index: number): void {
    const n = this.heap.length;
    for (;;) {
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      let smallest = index;
      if (left < n && this.less(this.heap[left], this.heap[smallest])) smallest = left;
      if (right < n && this.less(this.heap[right], this.heap[smallest])) smallest = right;
      if (smallest === index) break;
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}
