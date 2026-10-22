/** Visual encodings only: source amounts and classifications stay on each record. */
export const tradeAmountBands = [
  { minimum: 0, width: 1.2, label: "不足100万" },
  { minimum: 1e6, width: 2, label: "100万—1000万" },
  { minimum: 1e7, width: 2.8, label: "1000万—1亿" },
  { minimum: 1e8, width: 3.6, label: "1亿—10亿" },
  { minimum: 1e9, width: 4.4, label: "10亿—100亿" },
  { minimum: 1e10, width: 5.2, label: "100亿及以上" }
] as const;

export function tradeAmountWidth(value: number | null, status: string): number | null {
  if (value === null || !Number.isFinite(value) || value < 0 || !["observed", "estimated"].includes(status)) return null;
  return [...tradeAmountBands].reverse().find(band => value >= band.minimum)!.width;
}

type LabelPoint = { id: string; name: string; x: number; y: number };
export type MapLabel = LabelPoint & { width: number; height: number };

/** Input order gives selected endpoints priority. Hide labels that cannot fit without overlap. */
export function layoutMapLabels(points: readonly LabelPoint[], fontSize: number, width = 1000, height = 540): MapLabel[] {
  const labels: MapLabel[] = [];
  for (const point of points) {
    if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) continue;
    const textWidth = [...point.name].reduce((sum, char) => sum + (char.codePointAt(0)! > 255 ? 1 : .6), 0) * fontSize;
    const boxWidth = textWidth + 6;
    const boxHeight = fontSize + 6;
    const gap = fontSize * .6;
    const candidates = [
      [point.x + gap, point.y - gap - boxHeight], [point.x + gap, point.y + gap],
      [point.x - gap - boxWidth, point.y - gap - boxHeight], [point.x - gap - boxWidth, point.y + gap],
      [point.x - boxWidth / 2, point.y - gap - boxHeight * 2]
    ];
    for (const [x, y] of candidates) {
      if (x < 5 || y < 5 || x + boxWidth > width - 5 || y + boxHeight > height - 5) continue;
      if (labels.some(other => x < other.x + other.width + 3 && x + boxWidth + 3 > other.x && y < other.y + other.height + 3 && y + boxHeight + 3 > other.y)) continue;
      labels.push({ ...point, x, y, width: boxWidth, height: boxHeight });
      break;
    }
  }
  return labels;
}
