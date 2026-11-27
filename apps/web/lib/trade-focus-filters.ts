/** Region grouping and post-selection trade filters for the world map. */

export type TradeFlowDirection = "all" | "in" | "out";
export type TradeBalance = "all" | "surplus" | "deficit";

export type FocusFilterState = {
  direction: TradeFlowDirection;
  regions: readonly string[];
  balance: TradeBalance;
  minValue: number;
};

export const defaultFocusFilters: FocusFilterState = { direction: "all", regions: [], balance: "all", minValue: 0 };

export const regionOptions = [
  { id: "east-asia", label: "东亚" },
  { id: "southeast-asia", label: "东南亚" },
  { id: "south-asia", label: "南亚" },
  { id: "middle-east", label: "中东" },
  { id: "eu", label: "欧盟" },
  { id: "other-europe", label: "欧洲其他" },
  { id: "north-america", label: "北美" },
  { id: "latin-america", label: "拉美" },
  { id: "africa", label: "非洲" },
  { id: "oceania", label: "大洋洲" }
] as const;

export const valueThresholds = [
  { value: 0, label: "不限" },
  { value: 100_000_000, label: "≥1 亿美元" },
  { value: 1_000_000_000, label: "≥10 亿" },
  { value: 10_000_000_000, label: "≥100 亿" }
] as const;

/** UN M49 -> region bucket. Only countries this catalog can actually plot. */
const regionByM49: Record<string, string> = {
  "156": "east-asia", "392": "east-asia", "410": "east-asia",
  "360": "southeast-asia", "458": "southeast-asia", "764": "southeast-asia",
  "704": "southeast-asia", "608": "southeast-asia", "702": "southeast-asia",
  "356": "south-asia", "586": "south-asia", "050": "south-asia",
  "682": "middle-east", "784": "middle-east", "792": "middle-east",
  "276": "eu", "250": "eu", "380": "eu", "724": "eu", "528": "eu", "616": "eu",
  "203": "eu", "040": "eu", "056": "eu", "752": "eu", "208": "eu", "246": "eu",
  "348": "eu", "372": "eu", "620": "eu", "300": "eu",
  "826": "other-europe", "757": "other-europe", "578": "other-europe",
  "804": "other-europe", "643": "other-europe",
  "842": "north-america", "124": "north-america",
  "076": "latin-america", "484": "latin-america", "152": "latin-america",
  "604": "latin-america", "170": "latin-america", "032": "latin-america",
  "710": "africa", "818": "africa", "566": "africa",
  "036": "oceania"
};

export function regionOfM49(m49: string | null | undefined): string | null {
  if (!m49) return null;
  return regionByM49[m49.padStart(3, "0")] ?? null;
}

type FilterableLine = {
  fromCountryId: string | null;
  toCountryId: string | null;
  fromM49: string | null;
  toM49: string | null;
  value: number | null;
};

/** The other end of a lane relative to the focused country. */
function partnerSide(line: FilterableLine, countryId: string) {
  const outgoing = line.fromCountryId === countryId;
  return { partnerId: outgoing ? line.toCountryId : line.fromCountryId, partnerM49: outgoing ? line.toM49 : line.fromM49, outgoing };
}

/** Money moved into and out of the focused country for each partner. */
export function partnerBalances<T extends FilterableLine>(lines: readonly T[], countryId: string, valueOf: (line: T) => number | null) {
  const stats = new Map<string, { inValue: number; outValue: number }>();
  for (const line of lines) {
    const { partnerId, outgoing } = partnerSide(line, countryId);
    if (!partnerId) continue;
    const entry = stats.get(partnerId) ?? { inValue: 0, outValue: 0 };
    const value = valueOf(line) ?? 0;
    if (outgoing) entry.outValue += value;
    else entry.inValue += value;
    stats.set(partnerId, entry);
  }
  return stats;
}

export function partnerIsAllowed(
  state: FocusFilterState,
  partnerId: string | null,
  partnerM49: string | null,
  stats: Map<string, { inValue: number; outValue: number }>
) {
  if (state.regions.length > 0) {
    const region = regionOfM49(partnerM49);
    if (!region || !state.regions.includes(region)) return false;
  }
  if (state.balance !== "all" && partnerId) {
    const entry = stats.get(partnerId) ?? { inValue: 0, outValue: 0 };
    if (state.balance === "surplus" && entry.outValue <= entry.inValue) return false;
    if (state.balance === "deficit" && entry.outValue >= entry.inValue) return false;
  }
  if (state.minValue > 0 && partnerId) {
    const entry = stats.get(partnerId) ?? { inValue: 0, outValue: 0 };
    if (entry.inValue + entry.outValue < state.minValue) return false;
  }
  return true;
}

/** Applies direction + partner-level filters; returns the lanes that survive. */
export function filterFocusLines<T extends FilterableLine>(
  lines: readonly T[],
  state: FocusFilterState,
  countryId: string,
  valueOf: (line: T) => number | null
): T[] {
  if (state.direction === "all" && state.regions.length === 0 && state.balance === "all" && state.minValue === 0) return [...lines];
  const stats = partnerBalances(lines, countryId, valueOf);
  return lines.filter(line => {
    if (state.direction === "in" && line.toCountryId !== countryId) return false;
    if (state.direction === "out" && line.fromCountryId !== countryId) return false;
    const { partnerId, partnerM49 } = partnerSide(line, countryId);
    return partnerIsAllowed(state, partnerId, partnerM49, stats);
  });
}

export function focusFilterCount(state: FocusFilterState): number {
  return (state.direction === "all" ? 0 : 1) + state.regions.length + (state.balance === "all" ? 0 : 1) + (state.minValue > 0 ? 1 : 0);
}
