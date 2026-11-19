import type { ProductQueryService } from "@globe-chain/domain";
import { tradeAmountWidth } from "../lib/map-presentation";

export type TradeTimeline = {
  product: string;
  currency: string;
  years: string[];
  country?: string;
  direction?: "import" | "export";
};

function consecutiveYears(years: readonly string[]) {
  let run: string[] = [];
  let longest: string[] = [];
  for (const year of [...new Set(years)].sort()) {
    if (run.length && Number(year) !== Number(run[run.length - 1]) + 1) run = [];
    run.push(year);
    if (run.length >= longest.length) longest = [...run];
  }
  return longest;
}

export function findTradeTimeline(queries: ProductQueryService, product: string): TradeTimeline | undefined {
  const observations = queries.getTradeMapView(product)?.observations ?? [];
  const yearsByCurrency = new Map<string, Set<string>>();
  const seriesByRoute = new Map<string, TradeTimeline>();
  for (const observation of observations) {
    const { currency, partnerScope, period, reporter, partner, direction, classification, value, valueDataStatus } = observation;
    if (!currency || partnerScope !== "entity" || !reporter?.m49 || !partner?.m49 || reporter.id === partner.id ||
      period.granularity !== "annual" || !/^\d{4}$/.test(period.label) ||
      period.start !== `${period.label}-01-01` || period.end !== `${period.label}-12-31` ||
      tradeAmountWidth(value, valueDataStatus) === null) continue;
    const years = yearsByCurrency.get(currency) ?? new Set<string>();
    years.add(period.label);
    yearsByCurrency.set(currency, years);
    if (valueDataStatus !== "observed") continue;
    const route = JSON.stringify([reporter.id, partner.id, direction, classification.system, classification.version, classification.code, currency]);
    const series = seriesByRoute.get(route) ?? { product, currency, country: reporter.id, direction, years: [] };
    series.years.push(period.label);
    seriesByRoute.set(route, series);
  }

  // Keep the report direction fixed so mirror records cannot replace the chosen reporter.
  const comparable = [...seriesByRoute.values()].map(series => ({ ...series, years: consecutiveYears(series.years) }));
  const longest = comparable.filter(series => series.years.length >= 2)
    .sort((first, second) => second.years.length - first.years.length ||
      Number(second.direction === "import") - Number(first.direction === "import"))[0];
  if (longest) return longest;

  // Older snapshots may still have bilateral amounts across years from different reporters.
  const cases = [...yearsByCurrency].flatMap(([currency, years]) => {
    if (years.size < 2) return [];
    const visibleYears = [...years].sort().filter(year =>
      queries.selectTradeFlows(product, { itemIds: [product], exactItems: true, year, currency })?.flows.some(flow =>
        flow.isPreferredRecord && flow.sourceEntity?.m49 && flow.destinationEntity?.m49 &&
        tradeAmountWidth(flow.observation.value, flow.observation.valueDataStatus) !== null
      )
    );
    return visibleYears.length > 1 ? [{ product, currency, years: visibleYears }] : [];
  });
  return cases.sort((first, second) => second.years.length - first.years.length)[0];
}
