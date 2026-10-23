import { itemLabel } from "../../lib/item-label";
import Link from "next/link";
import { Breadcrumbs, ContextBanner, PageIntro, SiteShell } from "../../components/site-shell";
import { TradeGuideDirectory, TradeGuideResults } from "../../components/trade-guide";
import { GuideQueryForm } from "../../components/guide-query-form";
import { getQueryService } from "../../lib/data";
import { readPageContext, type SearchParamsLike } from "../../lib/context";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TradeGuidePage({
  searchParams
}: {
  searchParams: Promise<SearchParamsLike>;
}) {
  const params = await searchParams;
  const context = readPageContext(params);
  const productId = first(params.product) ?? "generic-smartphone";
  const jurisdiction = first(params.jurisdiction);
  const direction = first(params.direction) as "import" | "export" | undefined;
  const queries = await getQueryService(context.datasetVersion);
  const products = queries.listProducts();
  const countries = queries.listCountries();
  const product = products.find(({ productId: id }) => id === productId) ?? products[0];
  const selectedProductId = product?.productId ?? productId;
  const guides = product
    ? queries.getTradeGuides(selectedProductId, {
      jurisdictionEntityId: jurisdiction,
      direction,
      ...context
    })
    : [];
  const allGuides = product ? queries.getTradeGuides(selectedProductId, { ...context }) : [];
  const period = product?.item.validPeriod;
  const hasFilters = Boolean(jurisdiction || direction);
  const queryGuides = products.flatMap(entry=>queries.getTradeGuides(entry.productId,{...context}).map(view=>({productId:entry.productId,jurisdiction:view.guide.scope.jurisdictionEntityId,direction:view.guide.scope.direction})));

  return (
    <SiteShell>
      <div className="content-column wide-column">
        <Breadcrumbs items={[{ label: "进出口指南" }]} />
        {product && period ? <ContextBanner period={period.label} datasetVersion={product.datasetVersion.version} /> : null}
        <PageIntro
          eyebrow="进出口查询"
          title="进出口指南"
          description="选择商品、国家和方向，查看基础税费、手续与文件清单。"
          actions={<Link className="button button-secondary" href="/products">查看商品背景</Link>}
        />

        <section className="trade-guide-workbench" aria-label="贸易指南查询条件">
          <div className="trade-guide-workbench-heading"><div><p className="eyebrow">查询条件</p><h2>你要查哪一组进出口要求？</h2></div><span>当前已发布：{allGuides.length} 组指南</span></div>
          {allGuides.length ? <div className="trade-guide-presets" aria-label="快捷查询任务">
            <span className="trade-guide-presets-label">快捷任务</span>
            {allGuides.slice(0, 4).map((view) => <Link className="trade-guide-preset" href={`/trade-guide?product=${encodeURIComponent(selectedProductId)}&jurisdiction=${encodeURIComponent(view.guide.scope.jurisdictionEntityId)}&direction=${view.guide.scope.direction}`} key={view.guide.id}>{view.directionLabel} · {view.jurisdiction?.name ?? "未指定国家/地区"} <span>→</span></Link>)}
          </div> : null}
          <GuideQueryForm products={products.filter(entry=>queryGuides.some(guide=>guide.productId===entry.productId)).map(entry=>({id:entry.productId,name:itemLabel(entry.item)}))} countries={countries.map(({entity})=>({id:entity.id,name:entity.name}))} guides={queryGuides} productId={selectedProductId} jurisdiction={jurisdiction} direction={direction}/>
          <div className="trade-guide-task-note"><strong>{direction === "import" ? "进口查询" : direction === "export" ? "出口查询" : "查询提示"}</strong><span>{direction === "import" ? "这里选择的是进口目的地；原产地、商品细分和申报日期仍需在官方系统中继续选择。" : direction === "export" ? "这里选择的是出口起运地；目的地规则和原产地待遇仍需在官方系统中继续核验。" : "进口时选择目的地，出口时选择起运地；具体原产地和日期需要在官方系统中进一步核验。"}</span></div>

        </section>


        <div className="trade-guide-results-heading"><div><p className="eyebrow">指南资料</p><h2>{hasFilters ? "筛选结果" : "选择一组示范指南"}</h2></div><span>{guides.length} 组结果</span></div>
        {hasFilters ? <TradeGuideResults views={guides} productId={selectedProductId} /> : <TradeGuideDirectory views={guides} productId={selectedProductId} />}


      </div>
    </SiteShell>
  );
}
