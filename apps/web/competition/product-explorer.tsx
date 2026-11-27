import { useEffect, useRef } from "react";
import type { ProductBreakdownNode, ProductQueryService } from "@globe-chain/domain";
import { itemLabel } from "../lib/item-label";
import { mapStoryWithContext } from "../lib/map-view-model";
import { mapPath, productPath } from "../lib/paths";
import Link, { useLocation } from "./navigation";
import "./product-explorer.css";

function findPath(node: ProductBreakdownNode, focus: string | null): ProductBreakdownNode[] | undefined {
  if (node.item.id === focus) return [node];
  for (const child of node.children) {
    const path = findPath(child, focus);
    if (path) return [node, ...path];
  }
}

function tradeDestination(queries: ProductQueryService, product: string, item: string) {
  const observations = queries.getTradeMapView(product, { focusItemId: item })?.observations ?? [];
  const periods = new Map<string, { year: string; currency: string; bilateral: boolean; world: boolean }>();
  for (const row of observations) {
    if (row.item?.id !== item || !row.currency) continue;
    const key = JSON.stringify([row.period.label, row.currency]);
    const period = periods.get(key) ?? { year: row.period.label, currency: row.currency, bilateral: false, world: false };
    period.bilateral ||= row.partnerScope === "entity" && Boolean(row.reporter?.m49 && row.partner?.m49);
    period.world ||= row.partnerScope === "world_total";
    periods.set(key, period);
  }
  const newestFirst = [...periods.values()].sort((first, second) => second.year.localeCompare(first.year));
  for (const scope of ["bilateral", "world"] as const) {
    for (const period of newestFirst) {
      if (!period[scope]) continue;
      const { year, currency } = period;
      const selection = queries.selectTradeFlows(product, { itemIds: [item], exactItems: true, year, currency });
      const hasRecords = scope === "world"
        ? Boolean(selection?.worldTotals.length)
        : selection?.flows.some(flow => flow.isPreferredRecord && flow.sourceEntity?.m49 && flow.destinationEntity?.m49);
      if (hasRecords) return { scope, href: mapPath({ product, layer: "trade", items: item, scope, year, currency }) };
    }
  }
}

export function ProductExplorer({ breakdown, queries }: { breakdown: ProductBreakdownNode; queries: ProductQueryService }) {
  const location = useLocation();
  const focus = new URL(location).searchParams.get("focus");
  const path = (focus && findPath(breakdown, focus)) || [breakdown];
  const current = path[path.length - 1];
  const product = breakdown.item.id;
  const item = current.item.id;
  const name = itemLabel(current.item);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousItem = useRef(item);
  useEffect(() => {
    if (previousItem.current !== item) titleRef.current?.focus({ preventScroll: true });
    previousItem.current = item;
  }, [item]);

  function entryPath(id: string) {
    const url = productPath(product);
    return id === product ? url : `${url}?${new URLSearchParams({ focus: id })}`;
  }

  const trade = tradeDestination(queries, product, item);
  const story = queries.getSupplyChainStory(product);
  const branch = story ? mapStoryWithContext(story, breakdown, item) : null;
  const hasProduction = branch && (branch.flows.length > 0 || branch.nodes.some(node => node.entity?.m49));

  return (
    <section className="product-explorer" aria-labelledby="product-explorer-heading">
      <h2 id="product-explorer-heading">商品拆解</h2>
      <nav className="product-explorer-path" aria-label="所在拆解路径">
        <ol>
          {path.map((entry, index) => (
            <li key={entry.item.id}>
              {index > 0 && <span aria-hidden="true">›</span>}
              {entry === current
                ? <span aria-current="page">{name}</span>
                : <Link href={entryPath(entry.item.id)}>{itemLabel(entry.item)}</Link>}
            </li>
          ))}
        </ol>
      </nav>
      <div className="product-explorer-body">
        <div className="product-explorer-detail">
          <h3 ref={titleRef} tabIndex={-1}>{name}</h3>
          {current.item.description && <p>{current.item.description}</p>}
          {(trade || hasProduction) && (
            <div className="product-explorer-actions">
              {trade && <Link href={trade.href}>{trade.scope === "world" ? "查看贸易总计" : "查看双边贸易"} <span aria-hidden="true">↗</span></Link>}
              {hasProduction && <Link href={mapPath({ product, focus: item, layer: "supply-chain" })}>查看代表性路线 <span aria-hidden="true">↗</span></Link>}
            </div>
          )}
        </div>
        {current.children.length > 0 && (
          <div className="product-explorer-children">
            <h3>下一级部件与上游</h3>
            <ul>
              {current.children.map(child => (
                <li key={child.item.id}>
                  <Link href={entryPath(child.item.id)}>
                    <strong>{itemLabel(child.item)}</strong>
                    {child.children.length > 0 && <small>{child.children.length} 个下一级条目</small>}
                    <span aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
