import { readFile } from "node:fs/promises";
import { describe,expect,it } from "vitest";
import { ProductFixtureSchema } from "@globe-chain/contracts";
import { createInMemoryFixtureRepository,createProductQueryService } from "@globe-chain/domain";

describe("manufacturing steps to published industry navigation",()=>{
 it("uses explicit item associations and resolves source-backed topic entries",async()=>{
  const fixture=ProductFixtureSchema.parse(JSON.parse(await readFile("data/published/releases/generic-home-air-conditioner/globe-chain-home-air-conditioner-2026.2/fixture.json","utf8")));
  const query=createProductQueryService(createInMemoryFixtureRepository([fixture]));
  const chain=query.getManufacturingProcessChain(fixture.productId,fixture.manufacturingProcessChains[0]!.id)!;
  const copperStep=chain.steps.find(step=>step.step.inputItemIds.includes("ac-copper-tube"))!;
  expect(copperStep.relatedIndustryTopics.map(topic=>topic.id)).toContain("copper-tube");
  expect(copperStep.relatedIndustryTopics.every(topic=>topic.sources.length>0)).toBe(true);
  expect(copperStep.relatedIndustryTopics.every(topic=>topic.itemIds?.some(id=>[...copperStep.step.inputItemIds,...copperStep.step.outputItemIds].includes(id)))).toBe(true);
  expect(copperStep.relatedIndustryTopics.some(topic=>topic.id==="evaporative-condenser")).toBe(false);
  expect(chain.chain.period.start).toBe("1997-01-01");
 });
 it("keeps older product processes usable without inventing industry links",async()=>{
  const fixture=ProductFixtureSchema.parse(JSON.parse(await readFile("data/published/releases/generic-smartphone/globe-chain-smartphone-2023.16/fixture.json","utf8")));
  const query=createProductQueryService(createInMemoryFixtureRepository([fixture]));
  const chain=query.getManufacturingProcessChain(fixture.productId,fixture.manufacturingProcessChains[0]!.id)!;
  expect(chain.steps.length).toBeGreaterThan(0);
  expect(chain.steps.every(step=>step.relatedIndustryTopics.length===0)).toBe(true);
 });
});
