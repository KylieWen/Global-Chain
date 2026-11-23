import { describe, expect, it } from "vitest";
import { productIdFromPathname, resolvePathSteps } from "../apps/web/lib/path-steps";

describe("three-step journey navigation", () => {
  it("falls back to catalog, map and countries when no product is in scope", () => {
    const steps = resolvePathSteps({ pathname: "/" });
    expect(steps.map(step => step.id)).toEqual(["breakdown", "route", "ledger"]);
    expect(steps[0].href).toBe("/products");
    expect(steps[1].href).toBe("/map");
    expect(steps[2].href).toBe("/countries");
    expect(steps[0].active).toBe(true);
    expect(steps[1].active).toBe(false);
    expect(steps[2].active).toBe(false);
  });

  it("marks the product overview as the breakdown step", () => {
    const steps = resolvePathSteps({ pathname: "/products/generic-smartphone", productId: "generic-smartphone" });
    expect(steps[0].href).toBe("/products/generic-smartphone");
    expect(steps[0].active).toBe(true);
    expect(steps[1].href).toBe("/products/generic-smartphone/supply-chain");
    expect(steps[2].href).toBe("/countries");
  });

  it("marks the supply-chain and map routes as the route step", () => {
    const supplyChain = resolvePathSteps({ pathname: "/products/generic-smartphone/supply-chain", productId: "generic-smartphone" });
    expect(supplyChain[1].active).toBe(true);

    const map = resolvePathSteps({ pathname: "/map", searchProduct: "generic-smartphone" });
    expect(map[1].active).toBe(true);
    expect(map[1].href).toBe("/products/generic-smartphone/supply-chain");
  });

  it("marks ledger and countries as the ledger step, linking directly to an entity when known", () => {
    const withEntity = resolvePathSteps({
      pathname: "/products/generic-smartphone/ledger/country-cn",
      productId: "generic-smartphone",
      entityId: "country-cn"
    });
    expect(withEntity[2].active).toBe(true);
    expect(withEntity[2].href).toBe("/products/generic-smartphone/ledger/country-cn");

    const countries = resolvePathSteps({ pathname: "/countries" });
    expect(countries[2].active).toBe(true);
  });

  it("carries page context into every step link", () => {
    const context = { datasetVersion: "globe-chain-smartphone-2026.2", contentVersion: "route-v3" };
    const steps = resolvePathSteps({
      pathname: "/products/generic-smartphone",
      productId: "generic-smartphone",
      context
    });
    for (const step of steps) {
      expect(step.href).toContain("datasetVersion=globe-chain-smartphone-2026.2");
      expect(step.href).toContain("contentVersion=route-v3");
    }
  });

  it("reads the product id from the pathname for shell-level rendering", () => {
    expect(productIdFromPathname("/products/generic-soybean-oil")).toBe("generic-soybean-oil");
    expect(productIdFromPathname("/map")).toBeUndefined();
    expect(productIdFromPathname("/products/product%2Fwith%3Freserved")).toBe("product/with?reserved");
  });
});
