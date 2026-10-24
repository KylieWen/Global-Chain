export const usageEvents = ["page_view", "navigation", "map_select", "map_zoom", "map_filter", "guide_complete", "guide_skip", "outbound_link", "search_submit", "client_error"] as const;
export const usagePages = ["home", "world_map", "china_map", "product", "industry", "sources", "search", "guide", "countries", "other"] as const;
export const usageDevices = ["phone", "tablet", "desktop"] as const;
export type UsageEventName = typeof usageEvents[number];
export type UsageEntry = { event: UsageEventName; page: typeof usagePages[number]; device: typeof usageDevices[number] };
export const usageSignal = "global-chain.usage-event";
export function publishUsageEvent(event: UsageEventName) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(usageSignal, { detail: event }));
}
export function usagePage(pathname: string): UsageEntry["page"] {
  if (pathname === "/") return "home";
  if (pathname === "/map/china") return "china_map";
  if (pathname === "/map") return "world_map";
  if (pathname === "/search") return "search";
  if (pathname.startsWith("/trade-guide")) return "guide";
  if (pathname.startsWith("/countries")) return "countries";
  if (pathname === "/industry" || /^\/products\/[^/]+\/industry$/.test(pathname)) return "industry";
  if (/^\/products\/[^/]+\/provenance$/.test(pathname)) return "sources";
  if (pathname.startsWith("/products")) return "product";
  return "other";
}
// Reject extra properties, including URL/query, search text, identity and errors.
export function parseUsageBatch(value: unknown): UsageEntry[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).join() !== "events") return null;
  const events = (value as { events?: unknown }).events;
  if (!Array.isArray(events) || events.length < 1 || events.length > 10) return null;
  for (const entry of events) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const row = entry as Record<string, unknown>;
    if (Object.keys(row).sort().join() !== "device,event,page" ||
      !usageEvents.includes(row.event as UsageEventName) ||
      !usagePages.includes(row.page as UsageEntry["page"]) ||
      !usageDevices.includes(row.device as UsageEntry["device"])) return null;
  }
  return events as UsageEntry[];
}
