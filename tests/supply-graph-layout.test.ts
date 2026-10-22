import { expect, it } from "vitest";
import { layoutSupplyGraph, routeSupplyEdge, graphNodeWidth, graphNodeHeight } from "../apps/web/lib/supply-graph-layout";

it("keeps dense stages compact and routes every pair outside all node interiors", () => {
  const nodes = Array.from({ length: 45 }, (_, i) => ({ id: `n${i}`, stage: i < 19 ? 1 : i < 36 ? 2 : 3 }));
  const { positions, height } = layoutSupplyGraph(nodes);
  expect(positions.size).toBe(45);
  expect(height).toBeLessThan(900);
  const points = [...positions.values()];
  for (const a of points) for (const b of points) {
    if (a !== b) expect(Math.abs(a.x - b.x) >= graphNodeWidth || Math.abs(a.y - b.y) >= graphNodeHeight).toBe(true);
    for (let lane = 0; lane < 4; lane++) {
      const path = routeSupplyEdge(a, b, lane);
      for (let j = 1; j < path.length; j++) {
        const p = path[j - 1]; const q = path[j];
        for (const node of points) {
          const horizontal = p.y === q.y && p.y > node.y && p.y < node.y + graphNodeHeight && Math.max(p.x, q.x) > node.x && Math.min(p.x, q.x) < node.x + graphNodeWidth;
          const vertical = p.x === q.x && p.x > node.x && p.x < node.x + graphNodeWidth && Math.max(p.y, q.y) > node.y && Math.min(p.y, q.y) < node.y + graphNodeHeight;
          if (horizontal || vertical) throw new Error(`Edge intersects node at ${node.x},${node.y}`);
        }
      }
    }
  }
});
