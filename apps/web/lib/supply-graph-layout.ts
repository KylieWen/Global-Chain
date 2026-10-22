export type GraphPoint = { x: number; y: number };
export const graphNodeWidth = 176;
export const graphNodeHeight = 76;
const columnPitch = 256;
const rowPitch = 116;
const rowsPerColumn = 7;

/** Stage bands grow sideways rather than producing an arbitrarily tall node list. */
export function layoutSupplyGraph(nodes: readonly { id: string; stage: number }[]) {
  const positions = new Map<string, GraphPoint>();
  const stages: { order: number; x: number; width: number }[] = [];
  let x = 32;
  const orders = [...new Set(nodes.map(node => node.stage))].sort((a, b) => a - b);
  for (const order of orders) {
    const group = nodes.filter(node => node.stage === order);
    const columns = Math.ceil(group.length / rowsPerColumn);
    stages.push({ order, x, width: columns * columnPitch - 24 });
    group.forEach((node, index) => positions.set(node.id, { x: x + Math.floor(index / rowsPerColumn) * columnPitch, y: 56 + index % rowsPerColumn * rowPitch }));
    x += columns * columnPitch + 32;
  }
  return { positions, stages, width: Math.max(760, x), height: Math.max(260, ...[...positions.values()].map(point => point.y + rowPitch + 12)) };
}

/** All bends sit in the grid gutters; even skipped stages/backlinks avoid node interiors. */
export function routeSupplyEdge(from: GraphPoint, to: GraphPoint, index: number): GraphPoint[] {
  const offset = 14 + index % 4 * 3;
  const start = { x: from.x + graphNodeWidth, y: from.y + graphNodeHeight / 2 };
  const end = { x: to.x, y: to.y + graphNodeHeight / 2 };
  const exit = start.x + offset;
  const enter = end.x - offset;
  const lane = from.y + graphNodeHeight + 12 + index % 4 * 3;
  return [start, { x: exit, y: start.y }, { x: exit, y: lane }, { x: enter, y: lane }, { x: enter, y: end.y }, end];
}

export function roundedGraphPath(points: readonly GraphPoint[]): string {
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]; const here = points[i]; const next = points[i + 1];
    const a = Math.hypot(here.x - prev.x, here.y - prev.y);
    const b = Math.hypot(next.x - here.x, next.y - here.y);
    if (!a || !b) { path += ` L${here.x},${here.y}`; continue; }
    const radius = Math.min(6, a / 2, b / 2);
    path += ` L${here.x + (prev.x - here.x) * radius / a},${here.y + (prev.y - here.y) * radius / a} Q${here.x},${here.y} ${here.x + (next.x - here.x) * radius / b},${here.y + (next.y - here.y) * radius / b}`;
  }
  const last = points[points.length - 1];
  return `${path} L${last.x},${last.y}`;
}
