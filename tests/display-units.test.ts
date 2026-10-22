import { expect, it } from "vitest";
import { readableQuantity } from "../apps/web/lib/display-units";

it('converts kilograms for reading without confusing tonnes and ten-thousand tonnes',()=>{
  expect(readableQuantity(363000000,'kg')).toEqual({value:36.3,unit:'万吨'});
  expect(readableQuantity(2500,'kg')).toEqual({value:2.5,unit:'吨'});
  expect(readableQuantity(0,'kg')).toEqual({value:0,unit:'kg'});
  expect(readableQuantity(999,'kg')).toEqual({value:999,unit:'kg'});
});
it('does not reinterpret money, items or source units other than kilograms',()=>{
  expect(readableQuantity(10000000,'number')).toEqual({value:10000000,unit:'number'});
  expect(readableQuantity(10000000,'USD')).toEqual({value:10000000,unit:'USD'});
});
