import { describe, expect, it } from "vitest";
import {
  chinaFiltersFromNestedSearch,
  chinaMapPath,
  chinaStateSearch,
  filtersFromNestedSearch,
  industryPath,
  mapPath,
  worldStateSearch,
  type MapFilters
} from "../apps/web/lib/paths";
import { themeTokensByScheme } from "../apps/web/lib/theme/tokens";

describe("cross-map nested state serialization", () => {
  const worldFilters: MapFilters = {
    product: "generic-home-air-conditioner",
    layer: "trade",
    scope: "bilateral",
    items: "generic-home-air-conditioner",
    year: "2024",
    currency: "USD",
    country: "country-cn",
    direction: "export",
    measure: "quantity",
    datasetVersion: "globe-chain-home-air-conditioner-2026.6"
  };

  it("serializes world filters into a nestable inner search string, dropping empty values", () => {
    const search = worldStateSearch({ ...worldFilters, focus: "", unit: undefined, label: undefined });
    const params = new URLSearchParams(search);
    expect(params.get("product")).toBe(worldFilters.product);
    expect(params.get("year")).toBe("2024");
    expect(params.get("items")).toBe(worldFilters.items);
    expect(params.get("country")).toBe("country-cn");
    expect(params.get("direction")).toBe("export");
    expect(params.get("measure")).toBe("quantity");
    expect(params.get("layer")).toBe("trade");
    expect(params.get("scope")).toBe("bilateral");
    expect(params.has("focus")).toBe(false);
    expect(params.has("unit")).toBe(false);
    expect(params.has("label")).toBe(false);
  });

  it("round-trips world filters through an outer map= parameter", () => {
    const inner = worldStateSearch(worldFilters);
    // The outer router encodes the inner string once more, mirroring contextQuery.
    const outer = new URLSearchParams({ map: inner });
    const restored = filtersFromNestedSearch(outer.get("map"));
    expect(restored.product).toBe(worldFilters.product);
    expect(restored.year).toBe("2024");
    expect(restored.items).toBe(worldFilters.items);
    expect(restored.country).toBe("country-cn");
    expect(restored.direction).toBe("export");
    expect(restored.measure).toBe("quantity");
    expect(restored.layer).toBe("trade");
    expect(restored.scope).toBe("bilateral");
    expect(restored.currency).toBe("USD");
    expect(restored.datasetVersion).toBe(worldFilters.datasetVersion);
  });

  it("keeps China province/stage/node alongside the nested upstream world search", () => {
    const innerWorld = worldStateSearch(worldFilters);
    const chinaFilters = { product: worldFilters.product, province: "330000", stage: "material", node: "ac-nb", map: innerWorld };
    const innerChina = chinaStateSearch(chinaFilters);
    const outer = new URLSearchParams({ china: innerChina });
    const nested = chinaFiltersFromNestedSearch(outer.get("china"));
    expect(nested.province).toBe("330000");
    expect(nested.stage).toBe("material");
    expect(nested.node).toBe("ac-nb");
    const worldRestored = filtersFromNestedSearch(nested.map);
    expect(worldRestored.country).toBe("country-cn");
    expect(worldRestored.direction).toBe("export");
    expect(worldRestored.year).toBe("2024");
  });

  it("builds China and industry paths with encoded nested state", () => {
    const innerWorld = worldStateSearch(worldFilters);
    const chinaHref = chinaMapPath({ product: worldFilters.product, province: "330000", stage: "material", node: "ac-nb", map: innerWorld });
    expect(chinaHref.startsWith("/map/china?")).toBe(true);
    const chinaParams = new URLSearchParams(chinaHref.split("?")[1]);
    expect(chinaParams.get("province")).toBe("330000");
    expect(chinaParams.get("node")).toBe("ac-nb");
    const decodedWorld = filtersFromNestedSearch(chinaParams.get("map"));
    expect(decodedWorld.direction).toBe("export");

    const innerChina = chinaStateSearch({ province: "330000", stage: "material", node: "ac-nb", map: innerWorld });
    const industryHref = industryPath(worldFilters.product, "copper-tube", { datasetVersion: worldFilters.datasetVersion }, { china: innerChina });
    expect(industryHref).toContain("/industry?");
    const industryParams = new URLSearchParams(industryHref.split("?")[1]);
    expect(industryParams.get("topic")).toBe("copper-tube");
    const decodedChina = chinaFiltersFromNestedSearch(industryParams.get("china"));
    expect(decodedChina.node).toBe("ac-nb");
  });

  it("normalizes invalid enum values back to undefined instead of storing them", () => {
    const restored = filtersFromNestedSearch("direction=sideways&layer=route&scope=galaxy&measure=weight");
    expect(restored.direction).toBeUndefined();
    expect(restored.layer).toBeUndefined();
    expect(restored.scope).toBeUndefined();
    expect(restored.measure).toBeUndefined();
  });

  it("treats an empty or missing nested search as an empty filter set", () => {
    expect(filtersFromNestedSearch(undefined)).toEqual({});
    expect(filtersFromNestedSearch("")).toEqual({});
    expect(chinaFiltersFromNestedSearch(undefined)).toEqual({});
    expect(mapPath()).toBe("/map");
  });

  it("keeps four regional stage colors serializable and scheme-specific", () => {
    for (const scheme of ["dark", "light"] as const) {
      const stageColors = themeTokensByScheme[scheme].map.palette.stageColors;
      expect(Object.keys(stageColors).sort()).toEqual(["component", "manufacturing", "market", "material"]);
      for (const value of Object.values(stageColors)) {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      }
      const restored = JSON.parse(JSON.stringify(stageColors)) as typeof stageColors;
      expect(restored).toEqual(stageColors);
    }
  });
});
