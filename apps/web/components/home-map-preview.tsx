import Link from "next/link";
import { geoCentroid, geoEqualEarth, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import type { MapViewModel } from "../lib/map-view-model";
import { mapPath } from "../lib/paths";

const atlas=world as unknown as Topology<{countries:GeometryCollection}>;
const countries=feature(atlas,atlas.objects.countries).features;
const projection=geoEqualEarth().fitExtent([[12,20],[748,390]],{type:'Sphere'});
const path=geoPath(projection);
const centers=new Map(countries.map(country=>[String(country.id).padStart(3,'0'),projection(geoCentroid(country))]));

export function HomeMapPreview({view,productId}:{view:MapViewModel;productId:string}) {
  const ids=new Set(view.countries.filter(country=>country.hasRouteNodes).map(country=>country.m49));
  return <Link href={mapPath({product:productId})} className="home-map-preview" aria-label="进入可交互世界供应链地图">
    <div className="home-map-heading"><span>一件商品的全球连接</span><strong>打开交互地图 ↗</strong></div>
    <svg viewBox="0 0 760 410" role="img" aria-label="由已收录生产环节生成的世界供应链预览"><defs><marker id="home-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10Z" fill="#79dfc9"/></marker></defs>{countries.map(country=><path key={country.id} d={path(country)??undefined} className={ids.has(String(country.id).padStart(3,'0'))?'covered':''}/>)}{view.lines.slice(0,22).map((line,index)=>{const a=centers.get(line.fromM49);const b=centers.get(line.toM49);if(!a||!b||line.fromM49===line.toM49)return null;return <path className="home-map-line" key={line.id} d={`M${a[0]},${a[1]} Q${(a[0]+b[0])/2},${(a[1]+b[1])/2-20-index%4*10} ${b[0]},${b[1]}`} markerEnd="url(#home-arrow)"/>;})}</svg>
    <div className="home-map-footer"><span>原料 · 部件 · 制造 · 市场</span><span>点击国家，继续向内探索 →</span></div>
  </Link>;
}
