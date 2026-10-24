"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { geoArea, geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import type { RegionalAtlas } from "@globe-chain/contracts";
import { getRegionalAtlasView, regionalStageLabels } from "@globe-chain/domain";
import chinaGeometry from "../lib/geo/china-provinces.json";
import { chinaMapPath, industryPath, supplyChainPath } from "../lib/paths";
import type { PageContext } from "../lib/context";
import { clampMapTransform, zoomMap, type MapTransform } from "../lib/map-geometry";
import { layoutMapLabels } from "../lib/map-presentation";
import { layoutMapHitRegions } from "../lib/map-hit-regions";
import { useMapWheel } from "./use-map-wheel";

const width=900; const height=520;
type ChinaFeature={type:'Feature';properties:{name:string;adcode:string|number};geometry:{type:'Polygon';coordinates:number[][][]}|{type:'MultiPolygon';coordinates:number[][][][]}};
const geography=JSON.parse(JSON.stringify(chinaGeometry)) as {type:'FeatureCollection';features:ChinaFeature[]};
// d3 uses clockwise outer rings; preserve coordinates and holes, only normalize winding.
for(const feature of geography.features) if(geoArea(feature)>Math.PI*2) {
  if(feature.geometry.type==='Polygon') feature.geometry.coordinates.forEach(ring=>ring.reverse());
  if(feature.geometry.type==='MultiPolygon') feature.geometry.coordinates.forEach(polygon=>polygon.forEach(ring=>ring.reverse()));
}
const projection=geoMercator().fitExtent([[24,20],[width-24,height-24]],geography);
const path=geoPath(projection);
const stageColors={material:'#f2ca7a',component:'#86baff',manufacturing:'#77e0c5',market:'#e4a5d9'};
type Organization={id:string;name:string;description:string;links:readonly {label:string;url:string}[];topicId:string};
type Props={atlas:RegionalAtlas;productId:string;productName:string;products:{id:string;name:string}[];organizations:Organization[];context:PageContext;initialProvince?:string;initialStage?:string;initialNode?:string};

export function ChinaSupplyMap({atlas,productId,productName,products,organizations,context,initialProvince,initialStage,initialNode}:Props) {
  const router=useRouter(); const svg=useRef<SVGSVGElement>(null);
  const searchParams=useSearchParams();
  const [renderedWidth,setRenderedWidth]=useState(width);
  useEffect(()=>{const element=svg.current;if(!element)return;const observer=new ResizeObserver(entries=>setRenderedWidth(entries[0].contentRect.width||width));observer.observe(element);return()=>observer.disconnect();},[]);
  // Native history updates and same-product Next links share one filter source.
  const province=searchParams?searchParams.get('province')??'':initialProvince??'';
  const stage=searchParams?searchParams.get('stage')??'':initialStage??'';
  const selected=searchParams?searchParams.get('node')??'':initialNode??'';
  const [hovered,setHovered]=useState('');
  useEffect(()=>{if(selected&&window.matchMedia('(max-width:640px)').matches)document.querySelector('.regional-details')?.scrollIntoView({block:'start'});},[selected]);
  const [transform,setTransform]=useState<MapTransform>({x:0,y:0,scale:1});
  useEffect(()=>{setHovered('');},[province,stage,selected]);
  const drag=useRef<{x:number;y:number;tx:number;ty:number;moved:boolean}|null>(null); const dragged=useRef(false);
  const view=useMemo(()=>getRegionalAtlasView(atlas,productId,{province,stage}),[atlas,productId,province,stage]);
  const placeById=new Map(view.places.map(place=>[place.id,place]));
  const allById=new Map(view.allNodes.map(node=>[node.id,node]));
  const active=allById.get(hovered||selected); const selectedNode=allById.get(selected);
  const activePlace=active?placeById.get(active.placeId):undefined;
  const coverage=new Set(view.places.map(place=>place.provinceCode));
  const provinceName=geography.features.find(feature=>String(feature.properties.adcode)===province)?.properties.name;
  const visibleIds=new Set(view.nodes.map(node=>node.id));
  const adjacentIds=new Set(view.connections.flatMap(edge=>[edge.from,edge.to]));
  const sync=(nextProvince:string,nextStage:string,nextNode:string)=>{
    const url=chinaMapPath({...context,product:productId,province:nextProvince||undefined,stage:nextStage||undefined,node:nextNode||undefined});
    if(window.location.pathname+window.location.search!==url)window.history.pushState(null,'',url);
  };
  const chooseNode=(id:string)=>{if(dragged.current)return;setHovered('');sync(province,stage,id);};
  const changeFilter=(nextProvince:string,nextStage:string)=>{setHovered('');sync(nextProvince,nextStage,'');};
  const onDown=(event:PointerEvent<SVGSVGElement>)=>{if(event.pointerType==='touch'||event.button!==0)return;dragged.current=false;if(transform.scale<=1)return;drag.current={x:event.clientX,y:event.clientY,tx:transform.x,ty:transform.y,moved:false};};
  const onMove=(event:PointerEvent<SVGSVGElement>)=>{const start=drag.current;if(!start)return;const dx=event.clientX-start.x;const dy=event.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>5)start.moved=true;dragged.current=start.moved;if(!start.moved)return;event.currentTarget.setPointerCapture(event.pointerId);const matrix=svg.current?.getScreenCTM();const ratio=matrix?1/matrix.a:1;setTransform(clampMapTransform({scale:transform.scale,x:start.tx+dx*ratio,y:start.ty+dy*ratio},width,height));};
  useMapWheel(svg,setTransform,width,height,transform,dragged);
  const labelFontSize=Math.max(14,Math.min(31,12*width/renderedWidth));
  const labels=layoutMapLabels([...view.allNodes].sort((a,b)=>Number(b.id===active?.id)-Number(a.id===active?.id)).filter(node=>!province||visibleIds.has(node.id)||adjacentIds.has(node.id)).map(node=>{const place=placeById.get(node.placeId)!;const point=projection(place.coordinates)!;return{id:node.id,name:place.name,x:point[0]*transform.scale+transform.x,y:point[1]*transform.scale+transform.y};}),labelFontSize,width,height);
  const hitRegions=layoutMapHitRegions(view.allNodes.map(node=>{const point=projection(placeById.get(node.placeId)!.coordinates)!;return{id:node.id,x:point[0],y:point[1]};}),14*width/renderedWidth/transform.scale);
  const sourceFor=(ids:string[])=>atlas.sources.filter(source=>ids.includes(source.id));
  const linkedOrganizations=organizations.filter(org=>selectedNode?.organizationIds.includes(org.id));

  return <section className="regional-workspace" aria-label="中国商品供应链地图">
    <div className="regional-toolbar"><label>探索商品<select aria-label="中国地图商品" value={productId} onChange={event=>router.push(chinaMapPath({product:event.target.value}))}>{products.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
      <label>生产环节<select aria-label="中国地图生产环节" value={stage} onChange={event=>changeFilter(province,event.target.value)}><option value="">全部环节</option>{Object.entries(regionalStageLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label>省份<select aria-label="中国地图省份" value={province} onChange={event=>changeFilter(event.target.value,stage)}><option value="">全国</option>{geography.features.filter(feature=>feature.properties.name).map(feature=><option key={feature.properties.adcode} value={feature.properties.adcode}>{feature.properties.name}{coverage.has(String(feature.properties.adcode))?' · 已收录':''}</option>)}</select></label>
      <div className="regional-stats"><strong>{view.places.length}</strong> 个区域节点<span>·</span><strong>{view.allNodes.length}</strong> 个产业环节</div>
    </div>
    <div className="regional-layout"><div className="regional-map-panel">
      <div className="regional-map-top"><span>CHINA / {productName}</span><div className="map-zoom-controls"><button aria-label="放大中国地图" onClick={()=>setTransform(t=>zoomMap(t,1.3,width,height))} disabled={transform.scale>=4}>＋</button><button aria-label="缩小中国地图" onClick={()=>setTransform(t=>zoomMap(t,1/1.3,width,height))} disabled={transform.scale<=1}>－</button><button onClick={()=>setTransform({x:0,y:0,scale:1})}>复位</button></div></div>
      <svg className="china-supply-map" ref={svg} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="可交互中国省级供应链地图" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
        <defs><marker id="china-role-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth={8/transform.scale} markerHeight={8/transform.scale} markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L10,5 L0,10Z" fill="#79dfc9"/></marker><radialGradient id="china-map-light"><stop stopColor="#335969" stopOpacity=".35"/><stop offset="1" stopColor="#162f3e" stopOpacity="0"/></radialGradient></defs>
        <rect width={width} height={height} fill="url(#china-map-light)"/>
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {geography.features.map(feature=>{const code=String(feature.properties.adcode);const name=feature.properties.name;return <path key={code} className={`china-province${coverage.has(code)?' covered':''}${province===code?' selected':''}`} d={path(feature as GeoPermissibleObjects)??undefined} vectorEffect="non-scaling-stroke" role={name?'button':undefined} tabIndex={name?0:undefined} aria-label={name?`${name} · ${coverage.has(code)?'有已收录产业环节':'当前商品尚未收录'}`:undefined} aria-pressed={name?province===code:undefined} onClick={()=>{if(!dragged.current&&name)changeFilter(province===code?'':code,stage);}} onKeyDown={event=>{if((event.key==='Enter'||event.key===' ')&&name){event.preventDefault();changeFilter(province===code?'':code,stage);}}}><title>{name||'南海诸岛与边界参考'}</title></path>;})}
          <g aria-label="代表性区域环节连接">{view.connections.map(edge=>{const a=allById.get(edge.from)!;const b=allById.get(edge.to)!;const from=projection(placeById.get(a.placeId)!.coordinates)!;const to=projection(placeById.get(b.placeId)!.coordinates)!;const selectedEdge=active&&(edge.from===active.id||edge.to===active.id);const d=`M${from[0]},${from[1]} Q${(from[0]+to[0])/2-35},${(from[1]+to[1])/2-45} ${to[0]},${to[1]}`;return <path key={edge.id} className={`regional-connection${selectedEdge?' active':''}${active&&!selectedEdge?' muted':''}`} d={d} vectorEffect="non-scaling-stroke" markerEnd="url(#china-role-arrow)"><title>{`${edge.label} · 代表性连接`}</title></path>;})}</g>
          {view.allNodes.map(node=>{const place=placeById.get(node.placeId)!;const point=projection(place.coordinates)!;const isActive=active?.id===node.id;return <g key={node.id} className={`regional-node${isActive?' active':''}${!visibleIds.has(node.id)?' outside-filter':''}`} transform={`translate(${point[0]},${point[1]})`} role="button" tabIndex={0} aria-label={`${place.name} · ${node.label}`} aria-pressed={selected===node.id} onClick={()=>chooseNode(node.id)} onMouseEnter={()=>setHovered(node.id)} onMouseLeave={()=>setHovered('')} onFocus={()=>setHovered(node.id)} onBlur={()=>setHovered('')} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();dragged.current=false;chooseNode(node.id);}}}><path className="regional-node-hit" d={hitRegions.get(node.id)}/><circle className="regional-node-halo" r={(isActive?16:11)/transform.scale} style={{fill:stageColors[node.stage]}}/><circle r={5/transform.scale} style={{fill:stageColors[node.stage]}}><title>{`${place.name} · ${node.label}`}</title></circle></g>;})}
        </g>
        <g className="regional-city-labels" aria-hidden="true">{labels.map(label=><text key={label.id} x={label.x+3} y={label.y+labelFontSize+2} style={{fontSize:labelFontSize}}>{label.name}</text>)}</g>
      </svg>
      <div className="regional-map-bottom"><span>{activePlace?`${activePlace.name} · ${active?.label}`:'点击省份或城市节点，展开当地产业环节'}</span><small>双指缩放与移动 · Ctrl + 滚轮缩放</small></div>
      <div className="regional-legend">{Object.entries(regionalStageLabels).map(([key,label])=><span key={key}><i style={{background:stageColors[key as keyof typeof stageColors]}}/>{label}</span>)}<span className="regional-line-key">虚线：代表性环节联系</span></div>
    </div><aside className="regional-details" aria-label="中国产业环节详情">
      <button type="button" className="mobile-map-return" onClick={()=>svg.current?.scrollIntoView({block:'center'})}>↑ 返回地图</button>
      {selectedNode?<><button className="regional-back" onClick={()=>{sync(province,stage,'');}}>← 返回区域列表</button><p className="eyebrow">{placeById.get(selectedNode.placeId)?.name} · {regionalStageLabels[selectedNode.stage]}</p><h2>{selectedNode.label}</h2><p>{selectedNode.description}</p><span className="regional-period">{selectedNode.period.label}</span>
        <div className="regional-adjacent"><h3>沿上下游继续看</h3>{atlas.connections.filter(edge=>edge.from===selectedNode.id||edge.to===selectedNode.id).map(edge=>{const target=allById.get(edge.from===selectedNode.id?edge.to:edge.from)!;return <button key={edge.id} onClick={()=>{dragged.current=false;chooseNode(target.id);}}><small>{edge.to===selectedNode.id?'← 上游':'下游 →'}</small><strong>{placeById.get(target.placeId)?.name} · {target.label}</strong></button>;})}</div>
        {linkedOrganizations.map(org=><article className="regional-organization" key={org.id}><h3>{org.name}</h3><Link href={industryPath(productId,selectedNode.topicIds[0]??org.topicId,context)}>查看企业能力与上下游 →</Link>{org.links.slice(0,2).map(link=><a href={link.url} key={link.url} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}</article>)}
        <details className="regional-sources"><summary>依据与适用范围</summary>{sourceFor(selectedNode.sourceIds).map(source=><p key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a><small>{source.publisher} · {source.retrievedAt.slice(0,10)}</small><span>{source.scope}</span></p>)}</details>
      </>:<><div className="regional-list-heading"><p className="eyebrow">{provinceName??'全国产业分布'}</p><h2>{productName}</h2><span>{view.nodes.length} 个已收录环节</span></div><div className="regional-node-list">{view.nodes.map(node=><button key={node.id} aria-label={`查看${placeById.get(node.placeId)?.name}的${node.label}`} onClick={()=>{dragged.current=false;chooseNode(node.id);}} onMouseEnter={()=>setHovered(node.id)} onMouseLeave={()=>setHovered('')}><i style={{background:stageColors[node.stage]}}/><span><small>{placeById.get(node.placeId)?.name} · {regionalStageLabels[node.stage]}</small><strong>{node.label}</strong><small>{node.period.label}</small></span><b>→</b></button>)}</div>{!view.nodes.length&&<div className="regional-empty" role="status"><strong>这个区域的资料还在补充</strong><p>可先查看已收录的省市，或切换商品继续探索。</p><button onClick={()=>changeFilter('','')}>返回全国全部环节</button></div>}<Link className="text-link" href={supplyChainPath(productId,undefined,context)}>查看商品完整生产路线 →</Link></>}
    </aside></div>
    <p className="regional-scope-note">城市点位为区域参考位置；虚线连接生产环节，不代表已核实的企业供货或实际运输。各环节保留原资料年份。</p>
    <details className="regional-method"><summary>地图来源、资料版本与覆盖范围</summary><p>省市边界与城市参考点来自阿里云 DataV.GeoAtlas，原始省级轮廓、港澳台和南海诸岛参考要素保留。点位不是厂址，未按产量或份额加权。当前是已收录区域的研究入口。</p><p>国内区域资料版本：{atlas.datasetVersion} · {atlas.reviewedAt.slice(0,10)}。商品数据版本与区域资料独立；历史商品页面不会改变这批区域资料的观察时间。</p><ul>{atlas.sources.map(source=><li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a> · {source.publisher}</li>)}</ul></details>
  </section>;
}
