"use client";
import { useEffect, type RefObject, type Dispatch, type SetStateAction } from "react";
import { clampMapTransform, type MapTransform } from "../lib/map-geometry";

/** Leave ordinary wheel scrolling alone; Ctrl+wheel also covers trackpad pinch. */
export function useMapWheel(ref:RefObject<SVGSVGElement|null>,setTransform:Dispatch<SetStateAction<MapTransform>>,width=1000,height=540) {
  useEffect(()=>{
    const svg=ref.current;if(!svg)return;
    const wheel=(event:WheelEvent)=>{
      if(!event.ctrlKey&&!event.metaKey)return;
      event.preventDefault();const bounds=svg.getBoundingClientRect();
      const x=(event.clientX-bounds.left)*width/bounds.width; const y=(event.clientY-bounds.top)*height/bounds.height;
      setTransform(current=>{const scale=Math.max(1,Math.min(4,current.scale*Math.exp(-event.deltaY*.004)));return clampMapTransform({scale,x:x-(x-current.x)*scale/current.scale,y:y-(y-current.y)*scale/current.scale},width,height);});
    };
    svg.addEventListener('wheel',wheel,{passive:false});return()=>svg.removeEventListener('wheel',wheel);
  },[ref,setTransform,width,height]);
}
