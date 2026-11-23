import { describe, it, expect } from "vitest";
import { layoutMapHitRegions, nearestHitPoint } from "../apps/web/lib/map-hit-regions";
const vertices = (path: string) => {
  const values = path.match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)!.map(Number);
  return Array.from({length: values.length / 2}, (_, index) => [values[2 * index], values[2 * index + 1]]);
};
describe("city marker hit regions", () => {
  it("keeps close markers in disjoint nearest-city regions", () => {
    const points=[{id:'a',x:10,y:10},{id:'b',x:15,y:11},{id:'c',x:13,y:16}];
    const result=layoutMapHitRegions(points,14);
    for(const point of points) for(const [x,y] of vertices(result.get(point.id)!)) {
      expect(Math.hypot(x,y)).toBeLessThanOrEqual(14.00001);
      for(const other of points) expect(Math.hypot(x,y)).toBeLessThanOrEqual(Math.hypot(point.x+x-other.x,point.y+y-other.y)+0.00001);
    }
  });
  it("retains a full local target for isolated markers and scales target size", () => {
    for(const radius of [3.5,14,36]) {
      const result=vertices(layoutMapHitRegions([{id:'only',x:500,y:300}],radius).get('only')!);
      expect(result).toHaveLength(20);
      for(const [x,y] of result) expect(Math.hypot(x,y)).toBeCloseTo(radius,8);
    }
  });
  it("resolves overlapping full-size targets to the nearest city", () => {
    const points=[{id:'a',x:10,y:10},{id:'b',x:15,y:11},{id:'c',x:13,y:16}];
    expect(nearestHitPoint(points,10.5,10)?.id).toBe('a');
    expect(nearestHitPoint(points,14.5,11)?.id).toBe('b');
    expect(nearestHitPoint(points,13,15)?.id).toBe('c');
    expect(nearestHitPoint([],0,0)).toBeUndefined();
  });
  it("handles empty maps and rejects invalid targets", () => {
    expect(layoutMapHitRegions([],14).size).toBe(0);
    for(const radius of [0,-1,NaN,Infinity]) expect(()=>layoutMapHitRegions([],radius)).toThrow();
  });
});
