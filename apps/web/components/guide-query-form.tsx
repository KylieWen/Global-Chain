"use client";

import {useState} from "react";
import type { PageContext } from "../lib/context";

type Props={products:{id:string;name:string}[];countries:{id:string;name:string}[];guides:{productId:string;jurisdiction:string;direction:"import"|"export"}[];productId:string;jurisdiction?:string;direction?:string;context?:PageContext};
export function GuideQueryForm(props:Props){
 const [product,setProduct]=useState(props.productId);
 const [jurisdiction,setJurisdiction]=useState(props.jurisdiction??'');
 const [direction,setDirection]=useState(props.direction??'');
 const available=props.guides.filter(guide=>guide.productId===product);
 const countries=props.countries.filter(country=>available.some(guide=>guide.jurisdiction===country.id));
 const directions=[...new Set(available.filter(guide=>!jurisdiction||guide.jurisdiction===jurisdiction).map(guide=>guide.direction))];
 const countryLabel=direction==='import'?'进口目的地 / 管辖区':direction==='export'?'出口起运地 / 管辖区':'国家 / 地区';
 return <form className="trade-guide-form" method="get">
  {Object.entries(product===props.productId ? props.context ?? {} : {}).filter(([,value])=>value).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}
  <label><span>商品</span><select name="product" value={product} onChange={event=>{setProduct(event.target.value);setJurisdiction('');setDirection('');}}>{props.products.map(entry=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
  <label><span>{countryLabel}</span><select name="jurisdiction" value={jurisdiction} onChange={event=>{const next=event.target.value;setJurisdiction(next);if(direction&&!available.some(guide=>(!next||guide.jurisdiction===next)&&guide.direction===direction))setDirection('');}}><option value="">全部已有指南的国家</option>{countries.map(country=><option key={country.id} value={country.id}>{country.name}</option>)}</select></label>
  <label><span>方向</span><select name="direction" value={direction} onChange={event=>setDirection(event.target.value)}><option value="">全部已有方向</option>{directions.map(value=><option key={value} value={value}>{value==='import'?'进口':'出口'}</option>)}</select></label>
  <button className="button button-primary" type="submit">开始查询 →</button>
 </form>;
}
