"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { PageContext } from "../lib/context";
import {
  chinaFiltersFromNestedSearch,
  chinaMapPath,
  filtersFromNestedSearch,
  industryPath,
  ledgerPath,
  mapPath,
  materialObservationsPath,
  productPath,
  provenancePath,
  supplyChainPath
} from "../lib/paths";

export function ProductNavigation({productId,context,active,hasIndustry=false,hasMaterials=false,entityId,worldSearch,chinaSearch}:{productId:string;context:PageContext;active:string;hasIndustry?:boolean;hasMaterials?:boolean;entityId?:string;worldSearch?:string;chinaSearch?:string}) {
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navigation.current; const selected = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !selected) return;
    const reveal = () => { if (window.matchMedia("(max-width:640px)").matches) nav.scrollLeft += selected.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - selected.clientWidth) / 2; };
    reveal();
    const observer = new ResizeObserver(reveal); observer.observe(nav); observer.observe(selected);
    return () => observer.disconnect();
  }, [active]);
  const worldFilters = worldSearch ? filtersFromNestedSearch(worldSearch) : {};
  const chinaNested = chinaSearch ? chinaFiltersFromNestedSearch(chinaSearch) : {};
  const items=[
    {id:'overview',label:'商品拆解',href:productPath(productId,context)},
    {id:'world',label:'世界地图',href:mapPath({...context,product:productId,...worldFilters})},
    {id:'china',label:'中国供应链',href:chinaMapPath({...context,product:productId,...chinaNested,map:worldSearch})},
    {id:'route',label:'代表性路线',href:supplyChainPath(productId,undefined,context)},
    ...(hasIndustry?[{id:'industry',label:'产业与企业',href:industryPath(productId,undefined,context,{china:chinaSearch})}]:[]),
    ...(hasMaterials?[{id:'materials',label:'材料贸易',href:materialObservationsPath(productId,context)}]:[]),
    ...(entityId?[{id:'ledger',label:'国家账本',href:ledgerPath(productId,entityId,context)}]:[]),
    {id:'sources',label:'资料来源',href:provenancePath(productId,context)}
  ];
  return <nav ref={navigation} className="product-level-nav" aria-label="当前商品探索">{items.map(item=><Link key={item.id} href={item.href} aria-current={active===item.id?'page':undefined}>{item.label}</Link>)}</nav>;
}
