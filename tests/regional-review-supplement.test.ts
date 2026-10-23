import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { RegionalAtlasSchema } from "@globe-chain/contracts";
import { buildRegionalReviewSupplement } from "../scripts/build-regional-review-supplement.mjs";
import previous from "../content/geography/china-supply-atlas-2026-10-22.json";
import current from "../content/geography/china-supply-atlas-2026-10-23.json";

describe("reviewed regional expansion", () => {
  it("rebuilds the immutable regional release and validates all source bytes", async () => {
    expect((await buildRegionalReviewSupplement()).atlas).toEqual(current);
    const atlas = RegionalAtlasSchema.parse(current);
    for (const source of atlas.sources) expect(createHash('sha256').update(readFileSync(source.rawPath)).digest('hex')).toBe(source.sha256);
  });
  it("adds one sourced role per product and preserves previous geography and facts", () => {
    expect(current.nodes).toHaveLength(previous.nodes.length + 5);
    for (const product of new Set(previous.nodes.map(node => node.productId))) {
      expect(current.nodes.filter(node => node.productId === product)).toHaveLength(previous.nodes.filter(node => node.productId === product).length + 1);
    }
    expect(current.places.slice(0, previous.places.length)).toEqual(previous.places);
    for (const node of previous.nodes) expect(current.nodes.find(item => item.id === node.id)).toEqual({...node, datasetVersion: current.datasetVersion});
    for (const edge of previous.connections) expect(current.connections.find(item => item.id === edge.id)).toEqual({...edge, datasetVersion: current.datasetVersion});
  });
  it("preserves historical periods, approximate locations and unknown commercial flows", () => {
    expect(current.nodes.find(node => node.id === 'ac-xx')?.period.start).toBe('2019-01-01');
    expect(current.nodes.find(node => node.id === 'phone-dg')?.period.start).toBe('2026-01-01');
    for (const id of ['soy-tj', 'ebike-sz', 'cotton-nb']) expect(current.nodes.find(node => node.id === id)?.period.granularity).toBe('snapshot');
    // Import-based processing cannot be invented as a black-soil domestic supply route.
    expect(current.connections.some(edge => edge.from === 'soy-tj' || edge.to === 'soy-tj')).toBe(false);
    for (const edge of current.connections) { expect(edge.value).toBeNull(); expect(edge.valueDataStatus).toBe('unknown'); expect(edge.evidenceLevel).toBe('representative'); }
    for (const place of current.places) expect(place.coordinateMethod).toBe('approximate_city_anchor');
  });
});
