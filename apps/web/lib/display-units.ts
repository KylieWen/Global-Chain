/** Display conversion only; original values/units remain in sources and exports. */
export function readableQuantity(value:number,unit?:string|null):{value:number;unit:string|null|undefined} {
  if(unit==='kg'&&Math.abs(value)>=1e7)return {value:value/1e7,unit:'万吨'};
  if(unit==='kg'&&Math.abs(value)>=1e3)return {value:value/1e3,unit:'吨'};
  return {value,unit};
}
