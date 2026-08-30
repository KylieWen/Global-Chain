import Link from "next/link";
import { Breadcrumbs, ContextBanner, PageIntro, SiteShell } from "../../components/site-shell";
import { TradeGuideDirectory, TradeGuideResults } from "../../components/trade-guide";
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
  const jurisdictionFieldLabel = direction === "import"
    ? "进口目的地 / 管辖区"
    : direction === "export"
      ? "出口起运地 / 管辖区"
      : "国家 / 地区";

  return (
    <SiteShell>
      <div className="content-column wide-column">
        <Breadcrumbs items={[{ label: "贸易指南" }]} />
        {product && period ? <ContextBanner period={period.label} datasetVersion={product.datasetVersion.version} /> : null}
        <PageIntro
          eyebrow="Trade guide · 查询工作台"
          title="进出口贸易指南针"
          description="选择商品、国家和方向，先得到核验顺序、资料清单与官方入口。GlobeChain 负责整理查询路径，不替你作法律判断或报关承诺。"
          actions={<Link className="button button-secondary" href="/products">查看商品背景</Link>}
        />

        <section className="trade-guide-workbench" aria-label="贸易指南查询条件">
          <div className="trade-guide-workbench-heading"><div><p className="eyebrow">Start with three choices</p><h2>你要查哪一组进出口要求？</h2></div><span>当前已发布：{allGuides.length} 组指南</span></div>
          <form className="trade-guide-form" method="get">
            <label><span>商品</span><select name="product" defaultValue={selectedProductId}>{products.map((entry) => <option value={entry.productId} key={entry.productId}>{entry.item.name}</option>)}</select></label>
            <label><span>{jurisdictionFieldLabel}</span><select name="jurisdiction" defaultValue={jurisdiction ?? ""}><option value="">全部已收录国家</option>{countries.map(({ entity }) => <option value={entity.id} key={entity.id}>{entity.name}</option>)}</select></label>
            <label><span>方向</span><select name="direction" defaultValue={direction ?? ""}><option value="">进口 + 出口</option><option value="import">进口</option><option value="export">出口</option></select></label>
            <button className="button button-primary" type="submit">开始查询 →</button>
          </form>
          <p className="trade-guide-form-note">进口时选择目的地，出口时选择起运地。当前只发布了智能手机的少量国家示范指南；没有收录不代表该国没有规则，税率也不会用默认值填充。</p>
        </section>

        <section className="trade-guide-intro-grid" aria-label="贸易指南说明">
          <article><span className="card-kicker">01 · 先定位</span><h2>商品 + 目的地</h2><p>先确定 HS/产品范围和目的地，再查看需要核验的关税、产品准入与申报步骤。</p></article>
          <article><span className="card-kicker">02 · 再准备</span><h2>手续 + 文件</h2><p>把商业发票、装箱单、运输资料和可能需要的合规/原产地资料列成待办。</p></article>
          <article><span className="card-kicker">03 · 最后复核</span><h2>官方入口</h2><p>每组指南都链接到官方门户；实际申报前请按当前日期、原产地和规格重新核验。</p></article>
        </section>

        <div className="trade-guide-results-heading"><div><p className="eyebrow">Published guidance</p><h2>{hasFilters ? "筛选结果" : "选择一组示范指南"}</h2></div><span>{guides.length} 组结果 · 不是交易撮合</span></div>
        {hasFilters ? <TradeGuideResults views={guides} productId={selectedProductId} /> : <TradeGuideDirectory views={guides} productId={selectedProductId} />}

        <aside className="trade-guide-disclaimer"><strong>重要边界</strong><span>指南内容是静态、部分覆盖的研究起点；税率、许可、认证和手续可能随 HS 细分、原产地、日期和目的地政策变化。请以官方系统、海关或专业报关/法律意见为准。页面不会把供应链示意或贸易统计自动解释成某家企业的供货关系。</span></aside>
      </div>
    </SiteShell>
  );
}
