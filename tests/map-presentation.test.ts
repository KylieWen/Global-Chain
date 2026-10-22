import { describe, expect, it } from "vitest";
import { layoutMapLabels, tradeAmountWidth } from "../apps/web/lib/map-presentation";
import { pinchMap } from "../apps/web/lib/map-geometry";

it("anchors two-finger zoom, supports midpoint pan and clamps world/China bounds", () => {
  expect(pinchMap({ x: 0, y: 0, scale: 1 }, { x: 500, y: 270 }, { x: 520, y: 290 }, 2)).toEqual({ x: -480, y: -250, scale: 2 });
  expect(pinchMap({ x: -480, y: -250, scale: 2 }, { x: 500, y: 270 }, { x: 550, y: 300 }, 1)).toEqual({ x: -430, y: -220, scale: 2 });
  expect(pinchMap({ x: 0, y: 0, scale: 1 }, { x: 450, y: 260 }, { x: 450, y: 260 }, 10, 900, 520)).toEqual({ x: -1350, y: -780, scale: 4 });
});

describe("map amount encoding", () => {
  it("distinguishes observed zero from missing, withheld and invalid amounts", () => {
    expect(tradeAmountWidth(0, "observed")).toBe(1.2);
    for (const status of ["unknown", "withheld", "invalid"]) expect(tradeAmountWidth(100000000, status)).toBeNull();
    for (const value of [null, NaN, Infinity, -1]) expect(tradeAmountWidth(value, "observed")).toBeNull();
    expect(tradeAmountWidth(1e8, "estimated")).toBe(tradeAmountWidth(1e8, "observed"));
  });

  it("uses stable absolute bands instead of rescaling when a country filter changes", () => {
    expect(tradeAmountWidth(999999, "observed")).toBe(1.2);
    expect(tradeAmountWidth(1e6, "observed")).toBe(2);
    expect(tradeAmountWidth(1e9, "observed")).toBeGreaterThan(tradeAmountWidth(1e8, "observed")!);
    expect(tradeAmountWidth(1e12, "observed")).toBe(5.2);
  });
});

describe("country label placement", () => {
  it("keeps nearby country names in separate boxes and within the viewport", () => {
    const labels = layoutMapLabels([
      {id:"a",name:"韩国",x:815,y:180}, {id:"b",name:"日本",x:831,y:176},
      {id:"c",name:"中国",x:789,y:181}, {id:"d",name:"中国台湾地区",x:811,y:206}
    ], 13);
    expect(labels.length).toBe(4);
    for (const [index, label] of labels.entries()) {
      expect(label.x).toBeGreaterThanOrEqual(5);
      expect(label.x + label.width).toBeLessThanOrEqual(995);
      for (const other of labels.slice(index + 1)) {
        expect(label.x >= other.x + other.width || label.x + label.width <= other.x || label.y >= other.y + other.height || label.y + label.height <= other.y).toBe(true);
      }
    }
  });

  it("does not place labels for panned-out countries and gives earlier labels priority", () => {
    const labels = layoutMapLabels([{id:"off",name:"移出视口",x:-30,y:20},...Array.from({length:20},(_,i)=>({id:String(i),name:"相邻国家",x:500,y:200}))], 30);
    expect(labels.some(label => label.id === "off")).toBe(false);
    expect(labels[0].id).toBe("0");
    expect(labels.length).toBeLessThan(20);
  });
});
