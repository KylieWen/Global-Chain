export type MapTransform = { x: number; y: number; scale: number };

export function clampMapTransform(transform: MapTransform, width = 1000, height = 540): MapTransform {
  const scale = Math.max(1, Math.min(4, transform.scale));
  if (scale === 1) return { x: 0, y: 0, scale: 1 };
  return { scale, x: Math.max(width * (1 - scale), Math.min(0, transform.x)), y: Math.max(height * (1 - scale), Math.min(0, transform.y)) };
}

export function zoomMap(transform: MapTransform, factor: number, width = 1000, height = 540): MapTransform {
  const scale = Math.max(1, Math.min(4, transform.scale * factor));
  return clampMapTransform({ scale, x: width / 2 - (width / 2 - transform.x) * scale / transform.scale, y: height / 2 - (height / 2 - transform.y) * scale / transform.scale }, width, height);
}
