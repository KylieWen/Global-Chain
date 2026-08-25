import { afterEach, describe, expect, it } from "vitest";
import {
  ledgerPath,
  materialObservationPath,
  materialObservationsPath,
  nodePath,
  productPath,
  provenancePath,
  supplyChainPath
} from "../apps/web/lib/paths";
import { getWebDataMode } from "../apps/web/lib/runtime";

const originalMode = process.env.GLOBECHAIN_DATA_MODE;
const originalAllowDraft = process.env.GLOBECHAIN_ALLOW_DRAFT;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalMode === undefined) delete process.env.GLOBECHAIN_DATA_MODE;
  else process.env.GLOBECHAIN_DATA_MODE = originalMode;
  if (originalAllowDraft === undefined) delete process.env.GLOBECHAIN_ALLOW_DRAFT;
  else process.env.GLOBECHAIN_ALLOW_DRAFT = originalAllowDraft;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe("Web runtime boundary and route helpers", () => {
  it("defaults to published and requires explicit preview mode", () => {
    delete process.env.GLOBECHAIN_DATA_MODE;
    delete process.env.GLOBECHAIN_ALLOW_DRAFT;
    process.env.NODE_ENV = "development";
    expect(getWebDataMode()).toBe("published");

    process.env.GLOBECHAIN_DATA_MODE = "preview";
    expect(getWebDataMode()).toBe("preview");
  });

  it("does not allow production draft preview without an explicit allow flag", () => {
    process.env.NODE_ENV = "production";
    process.env.GLOBECHAIN_DATA_MODE = "preview";
    delete process.env.GLOBECHAIN_ALLOW_DRAFT;
    expect(getWebDataMode()).toBe("published");

    process.env.GLOBECHAIN_ALLOW_DRAFT = "true";
    expect(getWebDataMode()).toBe("preview");
  });

  it("encodes every dynamic route segment", () => {
    const productId = "product/with?reserved#chars";
    const nodeId = "node/one";
    const entityId = "entity?two";
    const itemId = "item#three";

    expect(productPath(productId)).toBe("/products/product%2Fwith%3Freserved%23chars");
    expect(supplyChainPath(productId, itemId)).toBe(
      "/products/product%2Fwith%3Freserved%23chars/supply-chain?focus=item%23three"
    );
    expect(nodePath(productId, nodeId)).toBe(
      "/products/product%2Fwith%3Freserved%23chars/nodes/node%2Fone"
    );
    expect(ledgerPath(productId, entityId)).toBe(
      "/products/product%2Fwith%3Freserved%23chars/ledger/entity%3Ftwo"
    );
    expect(provenancePath(productId)).toBe(
      "/products/product%2Fwith%3Freserved%23chars/provenance"
    );
    expect(materialObservationsPath(productId)).toBe(
      "/products/product%2Fwith%3Freserved%23chars/materials"
    );
    expect(materialObservationPath(productId, "observation/one")).toBe(
      "/products/product%2Fwith%3Freserved%23chars/materials/observation%2Fone"
    );
  });
});
