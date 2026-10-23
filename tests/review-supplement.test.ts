import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {beforeAll,describe,expect,it} from "vitest";
import {ProductFixtureSchema,type ProductFixture} from "@globe-chain/contracts";
import {createInMemoryFixtureRepository,createProductQueryService} from "@globe-chain/domain";
import {buildReviewSupplement} from "../scripts/build-review-supplement.mjs";
import smallCountries from "../content/geography/world-small-country-geometry.json";

const rebind=(value:unknown,previous:string,next:string):unknown=>Array.isArray(value)?value.map(item=>rebind(item,previous,next)):value&&typeof value==="object"?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==="datasetVersionId"&&item===previous?next:rebind(item,previous,next)])):value;
describe("reviewed country coverage supplement",()=>{
 let results:Awaited<ReturnType<typeof buildReviewSupplement>>;
 let fixtures:ProductFixture[];
 beforeAll(async()=>{results=await buildReviewSupplement();fixtures=results.map(result=>ProductFixtureSchema.parse(result.fixture));});
 it.each([0,1,2,3,4])("retains source facts and passes contracts for product %i",async index=>{
  const result=results[index];const bytes=await readFile(result.descriptor.basePath);expect(createHash('sha256').update(bytes).digest('hex')).toBe(result.descriptor.baseSha256);
  const base=ProductFixtureSchema.parse(JSON.parse(bytes.toString('utf8')));const retained=rebind(base,base.datasetVersion.id,fixtures[index].datasetVersion.id) as ProductFixture;
  expect(fixtures[index].tradeObservations).toEqual(retained.tradeObservations);
  expect(fixtures[index].storyGraph).toEqual(retained.storyGraph);
  expect(fixtures[index].macroIndicators.slice(0,base.macroIndicators.length)).toEqual(retained.macroIndicators);
  expect(fixtures[index].datasetVersion.version).not.toBe(base.datasetVersion.version);
 });
 it("fills twelve country/product gaps while leaving unavailable Taiwan data unknown",()=>{
  expect(results.reduce((sum,result)=>sum+result.audit.addedMacroIndicators.length,0)).toBe(48);
  expect(results[0].audit.missing).toHaveLength(3);
  expect(results[0].audit.missing.every(row=>row.entityId==='country-tw')).toBe(true);
  for(const result of results)for(const row of result.audit.addedMacroIndicators){expect(Number.isFinite(row.value)).toBe(true);expect(row.currency).toBe('USD');expect(row.quantity).toBeNull();expect(row.period.label).toMatch(/^202[45]$/);}
 });
 it("derives balances only from same-country same-year inputs",()=>{
  for(const result of results)for(const row of result.audit.addedMacroIndicators.filter(row=>row.method==='derived')){
   const matched=result.audit.addedMacroIndicators.filter(input=>input.entityId===row.entityId&&input.period.label===row.period.label);
   expect(row.value).toBe(matched.find(input=>input.indicator==='merchandise_exports_current_usd')!.value-matched.find(input=>input.indicator==='merchandise_imports_current_usd')!.value);
  }
 });
 it("finds the condenser and its enterprise through the user's alias",()=>{
  const queries=createProductQueryService(createInMemoryFixtureRepository(fixtures));
  const view=queries.getIndustryNetwork('generic-home-air-conditioner',{search:'蒸发冷'});
  expect(view?.matchingTopics.some(topic=>topic.id==='evaporative-condenser')).toBe(true);
  expect(view?.directory.some(org=>org.id==='org-snowman')).toBe(true);
 });
 it("adds four partial export guides without inventing rates or mandatory documents",()=>{
  const queries=createProductQueryService(createInMemoryFixtureRepository(fixtures));
  for(const fixture of fixtures.slice(1)){
   const guide=fixture.tradeGuides.at(-1)!;
   expect(guide.coverageStatus).toBe('partial');expect(guide.scope.direction).toBe('export');
   expect(queries.getTradeGuides(fixture.productId,{jurisdictionEntityId:'country-cn',direction:'export'})).toHaveLength(1);
   expect(fixture.tariffMeasures.every(rate=>rate.rateValue===null&&rate.dataStatus==='unknown')).toBe(true);
   expect(fixture.tradeDocumentRequirements.every(document=>document.mandatoryStatus==='recommended')).toBe(true);
   expect(fixture.tradeProcedureSteps).toHaveLength(3);
  }
 });
 it("includes a real Singapore outline and unique supplementary country IDs",()=>{
  expect(smallCountries.features.some(item=>String(item.id)==='702')).toBe(true);
  expect(new Set(smallCountries.features.map(item=>item.id)).size).toBe(smallCountries.features.length);
  expect(smallCountries.source.inputs.every(input=>/^[a-f0-9]{64}$/.test(input.sha256))).toBe(true);
 });
 it("adds a sourced material-to-condenser-to-ice path while preserving published statistics",async()=>{
  const [built]=await buildReviewSupplement(process.cwd(),'content/data-refresh/evaporative-condenser-2026-10-23.json');
  const fixture=ProductFixtureSchema.parse(built.fixture);
  const base=ProductFixtureSchema.parse(JSON.parse(await readFile(built.descriptor.basePath,'utf8')));
  const retained=rebind(base,base.datasetVersion.id,fixture.datasetVersion.id) as ProductFixture;
  expect(fixture.macroIndicators).toEqual(retained.macroIndicators);expect(fixture.tradeGuides).toEqual(retained.tradeGuides);
  const queries=createProductQueryService(createInMemoryFixtureRepository([fixture]));
  const condenser=queries.getIndustryNetwork(fixture.productId,{topicId:'evaporative-condenser'})!;
  expect(condenser.upstream.filter(connection=>connection.relation.kind!=='sold_through')).toHaveLength(3);
  expect(condenser.downstream.some(connection=>connection.topic.id==='ice-machine')).toBe(true);
  const coil=queries.getIndustryNetwork(fixture.productId,{topicId:'review23-evaporative-coil'})!;
  expect(coil.upstream.some(connection=>connection.topic.id==='review23-stainless-coil-tube')).toBe(true);
  expect(condenser.participants.some(org=>org.id==='org-snowman')).toBe(true);
 });
});
