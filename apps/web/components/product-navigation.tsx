import Link from "next/link";
import type { PageContext } from "../lib/context";
import { chinaMapPath, industryPath, ledgerPath, mapPath, materialObservationsPath, productPath, provenancePath, supplyChainPath } from "../lib/paths";

export function ProductNavigation({productId,context,active,hasIndustry=false,hasMaterials=false,entityId}:{productId:string;context:PageContext;active:string;hasIndustry?:boolean;hasMaterials?:boolean;entityId?:string}) {
  const items=[{id:'overview',label:'商品拆解',href:productPath(productId,context)},{id:'world',label:'世界地图',href:mapPath({...context,product:productId})},{id:'china',label:'中国供应链',href:chinaMapPath({...context,product:productId})},{id:'route',label:'生产路线',href:supplyChainPath(productId,undefined,context)},...(hasIndustry?[{id:'industry',label:'产业与企业',href:industryPath(productId,undefined,context)}]:[]),...(hasMaterials?[{id:'materials',label:'材料贸易',href:materialObservationsPath(productId,context)}]:[]),...(entityId?[{id:'ledger',label:'国家账本',href:ledgerPath(productId,entityId,context)}]:[]),{id:'sources',label:'资料来源',href:provenancePath(productId,context)}];
  return <nav className="product-level-nav" aria-label="当前商品探索">{items.map(item=><Link key={item.id} href={item.href} aria-current={active===item.id?'page':undefined}>{item.label}</Link>)}</nav>;
}
