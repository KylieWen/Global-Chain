import { describe, expect, it } from "vitest";
import sample from "../data/samples/smartphone/fixture.json";
import { ProductFixtureSchema } from "@globe-chain/contracts";
import { createInMemoryFixtureRepository, createProductQueryService } from "@globe-chain/domain";

const fact = { period:{granularity:"monthly",start:"2026-10-21",end:"2026-10-21",label:"2026-10-21"},unit:"not_applicable",sourceIds:[sample.sources[0]!.id],datasetVersionId:sample.datasetVersion.id,method:"curated",dataStatus:"observed" };
const network = {...fact,schemaVersion:"industry-network.v1",id:"test-network",title:"测试网络",regionEntityId:sample.entities[0]!.id,defaultTopicId:"coil",
 topics:[{...fact,id:"tube",label:"铜管",description:"换热管",kind:"component"},{...fact,id:"coil",label:"换热器",description:"管翅换热器",kind:"component"},{...fact,id:"press",label:"翅片冲压",description:"加工设备",kind:"equipment"}],
 relations:[{...fact,id:"input",fromTopicId:"tube",toTopicId:"coil",kind:"process_input",description:"管材输入"},{...fact,id:"machine",fromTopicId:"press",toTopicId:"coil",kind:"equipment_for",description:"翅片冲压设备"}],
 organizations:[{...fact,id:"tube-maker",name:"管材企业",description:"铜管产品",topicIds:["tube"],links:[{kind:"product",label:"产品",url:"https://example.com/tube"}]},{...fact,id:"coil-maker",name:"换热器企业",description:"换热器",topicIds:["coil","press"],links:[{kind:"procurement",label:"采购入口",url:"https://example.com/purchase"}]}]};
const fixture = ProductFixtureSchema.parse({...sample,industryNetwork:network});
const queries = createProductQueryService(createInMemoryFixtureRepository([fixture]));
describe("industry participant browsing", () => {
 it("resolves topics and evidence without treating adjacent companies as direct suppliers", () => {
   const view = queries.getIndustryNetwork(sample.productId)!;
   expect(view.selectedTopic.id).toBe("coil");
   expect(view.upstream.map(entry => entry.topic.id)).toEqual(["tube","press"]);
   expect(view.downstream).toHaveLength(0);
   expect(view.participants.map(entry => entry.id)).toEqual(["coil-maker"]);
   expect(view.adjacentParticipants.map(entry => entry.id)).toEqual(["tube-maker"]);
   expect(view.upstream[0]!.sources[0]!.id).toBe(sample.sources[0]!.id);
   expect(view.participants[0]!.topics[0]!.label).toBe("换热器");
   expect(Object.isFrozen(view)).toBe(true);
   const exported = queries.getProductResearchExport(sample.productId)!;
   expect(exported.includedModules).toContain("industry_network");
   expect(exported.recordCounts.industryParticipants).toBe(2);
   expect(exported.snapshot.industryNetwork?.relations).toHaveLength(2);
 });
 it("browses both directions, searches capabilities, and leaves legacy products without a network", () => {
   const tube = queries.getIndustryNetwork(sample.productId,{topicId:"tube",search:"铜管"})!;
   expect(tube.downstream[0]!.topic.id).toBe("coil");
   expect(tube.directory.map(entry => entry.id)).toEqual(["tube-maker"]);
   expect(tube.matchingTopics.map(entry => entry.id)).toEqual(["tube"]);
   expect(queries.getIndustryNetwork(sample.productId,{search:"冲压"})?.directory[0]?.entryTopicId).toBe("press");
   expect(queries.getIndustryNetwork(sample.productId,{search:"管材企业"})?.matchingTopics.map(topic=>topic.id)).toEqual(["tube"]);
   expect(queries.getIndustryNetwork(sample.productId,{topicId:"unknown"})).toBeNull();
   const old = createProductQueryService(createInMemoryFixtureRepository([ProductFixtureSchema.parse(sample)]));
   expect(old.getIndustryNetwork(sample.productId)).toBeNull();
   expect(queries.getIndustryNetwork("missing")).toBeNull();
 });
});
