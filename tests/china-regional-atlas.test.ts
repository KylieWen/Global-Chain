import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { RegionalAtlasSchema } from "@globe-chain/contracts";
import { getRegionalAtlasView } from "@globe-chain/domain";
import data from "../content/geography/china-supply-atlas-2026-10-22.json";
import geometry from "../apps/web/lib/geo/china-provinces.json";

describe("independent China supply geography",()=>{
  const atlas=RegionalAtlasSchema.parse(data);
  it("covers every product with regional evidence and preserves raw-source hashes",()=>{
    const manifest=JSON.parse(readFileSync('data/published/manifest.json','utf8'));
    const activeProducts=manifest.fixtures.map(product=>product.productId);
    // Regional atlas nodes must never reference a product absent from the active manifest.
    for(const node of atlas.nodes)expect(activeProducts).toContain(node.productId);
    // Products registered here ship a structure-only fixture whose China regional
    // coverage is an open evidence gap; they must not receive fabricated regional nodes.
    const pendingRegionalCoverage=["generic-camera-drone"];
    for(const productId of activeProducts){
      const count=atlas.nodes.filter(node=>node.productId===productId).length;
      if(pendingRegionalCoverage.includes(productId))expect(count).toBe(0);
      else expect(count).toBeGreaterThan(1);
    }
    const unregisteredPending=activeProducts.filter(id=>!pendingRegionalCoverage.includes(id)&&atlas.nodes.filter(node=>node.productId===id).length===0);
    expect(unregisteredPending).toEqual([]);
    for(const source of atlas.sources)expect(createHash('sha256').update(readFileSync(source.rawPath)).digest('hex')).toBe(source.sha256);
  });
  it("keeps all province and South China Sea source geometry",()=>{
    expect(geometry.features.filter(feature=>feature.properties.name)).toHaveLength(34);
    expect(geometry.features.some(feature=>feature.properties.adcode==='100000_JD')).toBe(true);
    for(const place of atlas.places)expect(geometry.features.some(feature=>String(feature.properties.adcode)===place.provinceCode)).toBe(true);
  });
  it("filters a province while retaining adjacent regional context",()=>{
    const view=getRegionalAtlasView(atlas,'generic-cotton-tshirt',{province:'330000'});
    expect(view.nodes.map(node=>node.placeId)).toEqual(['shaoxing']);
    expect(view.connections).toHaveLength(2);
    expect(view.allNodes).toHaveLength(3);
    expect(getRegionalAtlasView(atlas,'generic-cotton-tshirt',{province:'110000'}).nodes).toHaveLength(0);
  });
  it("never assigns flow values or bilateral certainty to regional role links",()=>{
    for(const edge of atlas.connections){expect(edge.evidenceLevel).toBe('representative');expect(edge.value).toBeNull();expect(edge.valueDataStatus).toBe('unknown');}
    for(const node of atlas.nodes)expect(node.period.label).toBeTruthy();
    expect(atlas.nodes.find(node=>node.id==='phone-zz')?.period.start).toBe('2025-01-01');
  });
  it("rejects dangling references, cross-product links and missing provenance",()=>{
    const invalid=structuredClone(data);invalid.connections[0].to='soy-harbin';
    expect(RegionalAtlasSchema.safeParse(invalid).success).toBe(false);
    const missing=structuredClone(data);missing.nodes[0].sourceIds=['not-a-source'];
    expect(RegionalAtlasSchema.safeParse(missing).success).toBe(false);
    const place=structuredClone(data);place.nodes[0].placeId='unknown';
    expect(RegionalAtlasSchema.safeParse(place).success).toBe(false);
  });
});
