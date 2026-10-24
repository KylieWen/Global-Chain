"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { usageEvents, usagePage, usageSignal, type UsageEntry, type UsageEventName } from "../lib/usage-events";
const key = "global-chain.anonymous-usage.v1";
let memoryPreference: boolean | undefined;
const privacyPreference = () => navigator.doNotTrack === "1" || Boolean((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);

export function UsageInsights({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const pending = useRef<UsageEntry[]>([]);
  useEffect(() => {
    const blocked = privacyPreference(); setRestricted(blocked);
    let preference = memoryPreference ?? true;
    try { preference = localStorage.getItem(key) !== "off"; } catch { /* In-memory toggle still works. */ }
    setAllowed(enabled && preference && !blocked);
    const sync = (event: StorageEvent) => { if (event.key === key) { pending.current = []; memoryPreference = event.newValue !== "off"; setAllowed(enabled && memoryPreference && !privacyPreference()); } };
    window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, [enabled]);
  useEffect(() => {
    if (!allowed) { pending.current = []; return; }
    let sent = 0;
    const record = (event: UsageEventName) => {
      if (++sent > 60 || pending.current.length >= 10) return;
      pending.current.push({ event, page: usagePage(pathname), device: innerWidth <= 640 ? "phone" : innerWidth <= 1100 ? "tablet" : "desktop" });
    };
    record("page_view");
    const flush = () => {
      if (!pending.current.length) return;
      const events = pending.current.splice(0, 10);
      void fetch("/api/usage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events }), credentials: "omit", keepalive: true }).catch(() => undefined);
    };
    const click = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element) return;
      if (element.closest(".map-zoom-controls button")) record("map_zoom");
      else if (element.closest(".map-country-shape,.country-trade-line,.regional-node,.china-province,.regional-node-list button")) record("map_select");
      else {
        const link = element.closest("a[href]");
        if (link) record((link as HTMLAnchorElement).origin !== location.origin ? "outbound_link" : "navigation");
      }
    };
    const change = (event: Event) => { if (event.target instanceof Element && event.target.closest(".atlas-compact-filters,.regional-toolbar")) record("map_filter"); };
    const submit = (event: Event) => { if (event.target instanceof Element && event.target.closest('[role="search"]')) record("search_submit"); };
    const signal = (event: Event) => { const name = (event as CustomEvent).detail; if (usageEvents.includes(name)) record(name); };
    const error = () => record("client_error");
    const visibility = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("click", click, true); document.addEventListener("change", change); document.addEventListener("submit", submit);
    window.addEventListener(usageSignal, signal); window.addEventListener("error", error); window.addEventListener("unhandledrejection", error);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", flush);
    const timer = setInterval(flush, 5000);
    return () => { clearInterval(timer); flush(); document.removeEventListener("click", click, true); document.removeEventListener("change", change); document.removeEventListener("submit", submit); window.removeEventListener(usageSignal, signal); window.removeEventListener("error", error); window.removeEventListener("unhandledrejection", error); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", flush); };
  }, [allowed, pathname]);
  return <details className="usage-preference"><summary>匿名统计：{allowed ? "开启" : "关闭"}</summary><p>仅汇总页面、功能点击、地图操作、引导完成或跳过、错误类别和屏幕尺寸档位，帮助改善体验。保存30天，不建立个人浏览档案，不保存搜索文字、姓名、联系方式或IP。不使用第三方跟踪器。</p><label><input type="checkbox" checked={allowed} disabled={!enabled || restricted} onChange={event => {
    const next = event.target.checked;
    pending.current = [];
    memoryPreference = next;
    try { localStorage.setItem(key, next ? "on" : "off"); } catch { /* Still applies for this page. */ }
    setAllowed(next);
  }} />允许匿名使用统计</label>{restricted && <small>已遵循浏览器的“不跟踪”偏好。</small>}{!enabled && <small>当前站点未开启收集。</small>}<small>服务器的常规访问日志由站点运维另行管理。</small></details>;
}
