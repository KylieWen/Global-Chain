"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { orderPersonaNavigation } from "../lib/persona-experience";
import { usePersonaPreference } from "./persona-preference";

const groups = [
  {id:"maps",label:"地图探索",items:[{label:"世界地图",href:"/map",copy:"跨越国界的生产与贸易"},{label:"中国供应链",href:"/map/china",copy:"从省市走进国内产业环节"}]},
  {id:"products",label:"商品与产业",items:[{label:"商品目录",href:"/products",copy:"拆解身边的五类商品"},{label:"商品分类",href:"/categories",copy:"按商品门类浏览"},{label:"产业上下游",href:"/industry",copy:"材料、设备、企业与官方入口"}]},
  {id:"data",label:"数据与指南",items:[{label:"国家账本",href:"/countries",copy:"进口、出口与宏观指标"},{label:"进出口指南",href:"/trade-guide",copy:"手续、文件与官方核验"},{label:"使用指南",href:"/help",copy:"了解操作和数据口径"},{label:"数据版本",href:"/versions",copy:"查看发布与历史资料"}]}
];

export function SiteNavigation() {
  const pathname = usePathname();
  const { persona, hasChosen } = usePersonaPreference();
  const orderedGroups = orderPersonaNavigation(groups, persona.id);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = () => nav.current?.querySelectorAll('details[open]').forEach(element=>element.removeAttribute('open'));
    close();
    const outside = (event: globalThis.PointerEvent) => {if(!nav.current?.contains(event.target as Node)) close();};
    const outsideFocus = (event: FocusEvent) => {if(!nav.current?.contains(event.target as Node)) close();};
    const escape = (event: KeyboardEvent) => {if(event.key==='Escape') {const open=nav.current?.querySelector('details[open]');close();(open?.querySelector('summary') as HTMLElement)?.focus();}};
    document.addEventListener('pointerdown',outside); document.addEventListener('focusin',outsideFocus); document.addEventListener('keydown',escape);
    return () => {document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outsideFocus);document.removeEventListener('keydown',escape);};
  },[pathname,persona.id]);
  const current = (href:string) => href==='/map'?pathname==='/map':href==='/products'?pathname==='/products'||pathname.startsWith('/products/'):pathname===href;
  return <nav className="site-nav hierarchical-nav" aria-label="主导航" ref={nav}>
    {orderedGroups.map(group=><details className="nav-group" key={group.label} onToggle={event=>{const selected=event.currentTarget;if(selected.open){nav.current?.querySelectorAll('details[open]').forEach(other=>{if(other!==selected)other.removeAttribute('open');});nav.current?.closest('.site-header')?.querySelectorAll('.persona-switcher[open]').forEach(other=>other.removeAttribute('open'));}}}>
      <summary className={group.items.some(item=>current(item.href))?'nav-group-active':undefined}>{group.label}<span aria-hidden="true">⌄</span></summary>
      <div className="nav-group-menu">{[...group.items].sort((left,right)=>Number(persona.recommendedHrefs.includes(right.href))-Number(persona.recommendedHrefs.includes(left.href))).map(item=><Link key={item.href} href={item.href} aria-current={current(item.href)?'page':undefined} onClick={()=>nav.current?.querySelectorAll('details[open]').forEach(element=>element.removeAttribute('open'))}><strong>{item.label}{hasChosen && persona.recommendedHrefs.includes(item.href) ? <em className="nav-recommendation">推荐</em> : null}</strong><small>{item.copy}</small></Link>)}</div>
    </details>)}
  </nav>;
}
