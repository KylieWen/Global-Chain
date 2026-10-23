type HitPoint = { id: string; x: number; y: number };
type Point = [number, number];

/** Partition each marker's local hit area by nearest city, without moving it. */
export function layoutMapHitRegions(points: HitPoint[], radius: number): Map<string, string> {
  if (!(radius > 0) || !Number.isFinite(radius)) throw new Error("Invalid hit radius");
  const paths = new Map<string, string>();
  for (const point of points) {
    let polygon: Point[] = Array.from({ length: 20 }, (_, index) => {
      const angle = 2 * Math.PI * index / 20;
      return [point.x + radius * Math.cos(angle), point.y + radius * Math.sin(angle)];
    });
    for (const other of points) {
      const dx = other.x - point.x, dy = other.y - point.y;
      if (other.id === point.id || dx * dx + dy * dy < 1e-12) continue;
      const mx = (point.x + other.x) / 2, my = (point.y + other.y) / 2;
      const distance = (p: Point) => (p[0] - mx) * dx + (p[1] - my) * dy;
      const clipped: Point[] = [];
      for (let index = 0; index < polygon.length; index++) {
        const a = polygon[index], b = polygon[(index + 1) % polygon.length];
        const da = distance(a), db = distance(b);
        if (da <= 0) clipped.push(a);
        if ((da <= 0) !== (db <= 0)) {
          const t = da / (da - db);
          clipped.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
        }
      }
      polygon = clipped;
      if (!polygon.length) break;
    }
    paths.set(point.id, polygon.map(([x, y], index) => `${index ? "L" : "M"}${x - point.x},${y - point.y}`).join(" ") + (polygon.length ? " Z" : ""));
  }
  return paths;
}
