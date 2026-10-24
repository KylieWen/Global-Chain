"use client";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { publishUsageEvent } from "../lib/usage-events";
const FocusContext = createContext<(() => void) | null>(null);
type LockingOrientation = ScreenOrientation & { lock?: (value: "landscape") => Promise<void> };
export function MapFocusButton({ label }: { label: string }) {
  const open = useContext(FocusContext);
  return <button type="button" className="map-focus-open" aria-label={`展开${label}`} onClick={open ?? undefined}>⛶ 大图</button>;
}
export function MapFocus({ title, children, onZoom, onReset }: { title: string; children: ReactNode; onZoom: (factor: number) => void; onReset: () => void }) {
  const root = useRef<HTMLDivElement>(null); const exit = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null); const active = useRef(false); const native = useRef(false); const locked = useRef(false);
  const [expanded, setExpanded] = useState(false); const [filters, setFilters] = useState(false); const [details, setDetails] = useState(false);
  const titleId = useId();
  const close = useCallback(() => { active.current = false; setExpanded(false); setFilters(false); setDetails(false); }, []);
  const open = async () => {
    opener.current = root.current?.querySelector<HTMLElement>(".map-focus-open") ?? document.activeElement as HTMLElement | null; active.current = true; setExpanded(true); publishUsageEvent("map_zoom");
    const element = root.current;
    try {
      await element?.requestFullscreen?.();
      if (!active.current) { if (document.fullscreenElement === element) await document.exitFullscreen(); return; }
      if (document.fullscreenElement === element) {
        native.current = true;
        const orientation = screen.orientation as LockingOrientation | undefined;
        try { await orientation?.lock?.("landscape"); if (orientation?.lock) { locked.current = true; if (!active.current) { orientation.unlock(); locked.current = false; } } }
        catch { /* Manual rotation remains available if locking is unsupported. */ }
      }
    } catch { /* The expanded page layout also works without native fullscreen. */ }
  };
  useEffect(() => {
    if (!expanded || !root.current) return;
    const element = root.current; const overflow = document.body.style.overflow; const y = window.scrollY;
    document.body.style.overflow = "hidden";
    const siblings = new Map<HTMLElement, boolean>(); let branch: HTMLElement = element;
    while (branch.parentElement) {
      for (const sibling of [...branch.parentElement.children]) if (sibling !== branch && sibling instanceof HTMLElement && !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)) { siblings.set(sibling, sibling.inert); sibling.inert = true; }
      branch = branch.parentElement; if (branch === document.body) break;
    }
    exit.current?.focus({ preventScroll: true });
    const change = () => { if (native.current && !document.fullscreenElement) close(); };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      const controls = [...element.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],select,input,[tabindex]:not([tabindex="-1"])')].filter(control => control.getClientRects().length > 0);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("fullscreenchange", change); document.addEventListener("keydown", keyboard);
    return () => {
      active.current = false; document.removeEventListener("fullscreenchange", change); document.removeEventListener("keydown", keyboard);
      document.body.style.overflow = overflow; for (const [sibling, inert] of siblings) sibling.inert = inert;
      if (locked.current) { screen.orientation?.unlock?.(); locked.current = false; }
      if (document.fullscreenElement === element) void document.exitFullscreen().catch(() => undefined);
      native.current = false;
      if (opener.current?.isConnected) { window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }); opener.current.focus({ preventScroll: true }); }
    };
  }, [expanded, close]);
  const reveal = (target: EventTarget | null) => { if (expanded && target instanceof Element && target.closest(".map-country-shape,.country-trade-line,.regional-node,.china-province")) setDetails(true); };
  return <FocusContext.Provider value={open}><div ref={root} className="map-focus-root" data-expanded={expanded} data-filters={filters} data-details={details} role={expanded ? "dialog" : undefined} aria-modal={expanded ? true : undefined} aria-labelledby={expanded ? titleId : undefined} onClick={event => reveal(event.target)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") reveal(event.target); }}>
    {expanded && <><header className="map-focus-bar"><h2 id={titleId}>{title} · 大图</h2><div className="map-focus-tools"><button type="button" aria-label="大图放大" onClick={() => { onZoom(1.25); publishUsageEvent("map_zoom"); }}>＋</button><button type="button" aria-label="大图缩小" onClick={() => { onZoom(.8); publishUsageEvent("map_zoom"); }}>－</button><button type="button" onClick={onReset}>复位</button><button type="button" aria-expanded={filters} onClick={() => setFilters(value => !value)}>筛选</button><button type="button" aria-expanded={details} onClick={() => setDetails(value => !value)}>详情</button><button type="button" ref={exit} className="map-focus-exit" onClick={close}>退出大图 ×</button></div></header><p className="map-focus-orientation-hint">转动手机横屏，地图看得更宽 · 双指缩放与移动</p></>}
    <div className="map-focus-body">{children}</div>
  </div></FocusContext.Provider>;
}
