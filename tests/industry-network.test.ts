import { describe, expect, it } from "vitest";
import sample from "../data/samples/smartphone/fixture.json";
import { IndustryNetworkSchema, ProductFixtureSchema } from "@globe-chain/contracts";

const fact = {period:{granularity:"annual",start:"2026-01-01",end:"2026-12-31",label:"2026"},unit:"not_applicable",sourceIds:[sample.sources[0]!.id],datasetVersionId:sample.datasetVersion.id,method:"curated",dataStatus:"observed"};
const network = {
  ...fact, schemaVersion:"industry-network.v1",id:"network-test",title:"Contract test",regionEntityId:sample.entities[0]!.id,defaultTopicId:"copper",
  topics:[{...fact,id:"copper",label:"铜管",kind:"material",description:"测试输入"},{...fact,id:"coil",label:"换热器",kind:"component",description:"测试输出"}],
  relations:[{...fact,id:"input-copper",fromTopicId:"copper",toTopicId:"coil",kind:"process_input",description:"技术投入关系"}],
  organizations:[{...fact,id:"organization-test",name:"测试企业",description:"仅用于契约测试",topicIds:["copper"],links:[{label:"产品",kind:"product",url:"https://example.com/products"}]}]
};

describe("industry network provenance and safe navigation", () => {
  it("accepts an optional network without changing old fixtures and rejects missing provenance", () => {
    expect(ProductFixtureSchema.parse(sample).industryNetwork).toBeUndefined();
    expect(ProductFixtureSchema.safeParse({...sample,industryNetwork:network}).success).toBe(true);
    expect(ProductFixtureSchema.safeParse({...sample,industryNetwork:{...network,sourceIds:["missing"]}}).success).toBe(false);
    expect(ProductFixtureSchema.safeParse({...sample,industryNetwork:{...network,datasetVersionId:"wrong-version"}}).success).toBe(false);
  });
  it("rejects broken topic relations and executable contact links", () => {
    expect(IndustryNetworkSchema.safeParse({...network,defaultTopicId:"missing"}).success).toBe(false);
    expect(IndustryNetworkSchema.safeParse({...network,relations:[{...network.relations[0],toTopicId:"missing"}]}).success).toBe(false);
    expect(IndustryNetworkSchema.safeParse({...network,organizations:[{...network.organizations[0],links:[{label:"联系",kind:"contact",url:"javascript:alert(1)"}]}]}).success).toBe(false);
  });
});
