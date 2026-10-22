import { itemLabel } from "../../../lib/item-label";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getQueryService } from "../../../lib/data";
import { firstParam, readPageContext, type SearchParamsLike } from "../../../lib/context";
import { getChinaAtlas } from "../../../lib/regional-atlas-data";
import { Breadcrumbs, SiteShell } from "../../../components/site-shell";
import { ProductNavigation } from "../../../components/product-navigation";
import { ChinaSupplyMap } from "../../../components/china-supply-map";
import { mapPath } from "../../../lib/paths";

export const dynamic = "force-dynamic";

export default async function ChinaMapPage({searchParams}:{searchParams:Promise<SearchParamsLike>}) {
  const params=await searchParams; const context=readPageContext(params);
  const queries=await getQueryService(context.datasetVersion); const products=queries.listProducts();
  const productId=firstParam(params.product)??products[0]?.productId;
  const overview=productId?queries.getProductOverview(productId):null;
  if(!productId||!overview)notFound();
  const atlas=getChinaAtlas(); const industry=queries.getIndustryNetwork(productId);
  const organizations=industry?.directory.map(org=>({id:org.id,name:org.name,description:org.description,links:org.links,topicId:org.entryTopicId}))??[];
  return <SiteShell><div className="content-column wide-column china-atlas-page">
    <Breadcrumbs items={[{label:'世界地图',href:mapPath({...context,product:productId})},{label:'中国供应链'}]}/>
    <header className="regional-heading"><div><p className="eyebrow">把全球分工，放大到身边</p><h1>中国供应链</h1><p>从省市走进原料、部件与制造，看见一件商品在中国的产业联系。</p></div><Link className="text-link" href={mapPath({...context,product:productId,country:atlas.regionEntityId})}>← 返回世界地图</Link></header>
    <ProductNavigation productId={productId} context={context} active="china" hasIndustry={Boolean(industry)} hasMaterials={queries.getMaterialTradeObservations(productId).length>0}/>
    <ChinaSupplyMap key={productId} atlas={atlas} productId={productId} productName={itemLabel(overview.product)} products={products.map(product=>({id:product.productId,name:itemLabel(product.item)}))} organizations={organizations} context={context} initialProvince={firstParam(params.province)} initialStage={firstParam(params.stage)} initialNode={firstParam(params.node)}/>
  </div></SiteShell>;
}
