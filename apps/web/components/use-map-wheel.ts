"use client";
import { useEffect, useRef, type RefObject, type Dispatch, type SetStateAction } from "react";
import { pinchMap, type MapTransform } from "../lib/map-geometry";
import { publishUsageEvent } from "../lib/usage-events";

/** One finger scrolls the page; two fingers manipulate the map without browser zoom. */
export function useMapWheel(ref: RefObject<SVGSVGElement | null>, setTransform: Dispatch<SetStateAction<MapTransform>>, width: number, height: number, transform: MapTransform, suppressClick: RefObject<boolean>) {
  const latest = useRef(transform);
  latest.current = transform;
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const point = (x: number, y: number) => {
      const matrix = svg.getScreenCTM();
      return matrix ? new DOMPoint(x, y).matrixTransform(matrix.inverse()) : { x, y };
    };
    let pinch: { distance: number; center: { x: number; y: number }; transform: MapTransform } | null = null;
    const touchPair = (touches: TouchList) => {
      const a = touches[0]; const b = touches[1];
      return { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), center: point((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2) };
    };
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 2) { if (event.touches.length === 1) suppressClick.current = false; return; }
      event.preventDefault();
      suppressClick.current = true;
      pinch = { ...touchPair(event.touches), transform: latest.current };
    };
    const move = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const pair = touchPair(event.touches);
      setTransform(pinchMap(pinch.transform, pinch.center, pair.center, pair.distance / Math.max(1, pinch.distance), width, height));
    };
    const end = (event: TouchEvent) => { if (event.touches.length < 2) { if (pinch) publishUsageEvent("map_zoom"); pinch = null; } };
    let lastWheelRecord = 0;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const anchor = point(event.clientX, event.clientY);
      if (Date.now() - lastWheelRecord > 1000) { publishUsageEvent("map_zoom"); lastWheelRecord = Date.now(); }
      setTransform(current => pinchMap(current, anchor, anchor, Math.exp(-event.deltaY * .004), width, height));
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    svg.addEventListener("touchstart", start, { passive: false });
    svg.addEventListener("touchmove", move, { passive: false });
    svg.addEventListener("touchend", end);
    svg.addEventListener("touchcancel", end);
    return () => {
      svg.removeEventListener("wheel", wheel);
      svg.removeEventListener("touchstart", start);
      svg.removeEventListener("touchmove", move);
      svg.removeEventListener("touchend", end);
      svg.removeEventListener("touchcancel", end);
    };
  }, [ref, setTransform, width, height, suppressClick]);
}
