import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const defaultRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));
export const reviewSupplementConfig='content/data-refresh/review-supplement-2026-10-23.json';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const period=year=>({granularity:'annual',start:`${year}-01-01`,end:`${year}-12-31`,label:String(year)});
const series=[['TX.VAL.MRCH.CD.WT','merchandise_exports_current_usd'],['TM.VAL.MRCH.CD.WT','merchandise_imports_current_usd'],['FI.RES.TOTL.CD','official_reserves_including_gold_current_usd']];
const balance='merchandise_trade_balance_current_usd';
function remap(value,previous,next){
 if(Array.isArray(value))return value.map(item=>remap(item,previous,next));
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='datasetVersionId'&&item===previous?next:remap(item,previous,next)]));
}
function addExportGuide(fixture,descriptor,config){
 const label=config.exportGuideProducts?.[fixture.productId];if(!label)return [];
 const id=`review23-${fixture.productId}-cn-export`,procedureId=`${id}-procedure`;
 const snapshot={granularity:'monthly',start:config.reviewedAt,end:config.reviewedAt,label:'2026-10-23 官方入口复核'};
 const sourceIds=config.policySources.map(source=>source.id);
 for(const source of config.policySources)fixture.sources.push({id:source.id,name:source.name,publisher:source.publisher,url:source.url,retrievedAt:source.retrievedAt,publishedAt:source.id.endsWith('export-tax-query')?'2025-06-03':null,datasetVersion:'official-navigation-snapshot-2026-10-23',license:'公开官方页面；保留原网站权利，仅转述核验导航。',notes:`raw=${source.rawFile}; SHA256=${source.sha256}; no product-specific tax or licensing conclusion is asserted.`});
 const metadata={period:snapshot,method:'curated',sourceIds,evidenceIds:[],dataStatus:'observed',datasetVersionId:descriptor.datasetVersionId,contentVersionId:null,limitations:['通用官方核验导航，部分覆盖；完整归类、监管条件与税率需按实际商品、目的地和申报日期查询。']};
 const guide={id,scope:{jurisdictionEntityId:'country-cn',direction:'export',itemId:fixture.productId,classification:null,originScope:'unknown',originEntityId:null,destinationEntityId:null,regime:'standard',period:snapshot},title:`${label}：中国出口核验导航`,summary:'先确认商品归类，再查监管和税务事项，沿官方入口准备申报。',coverageStatus:'partial',reviewStatus:'published',lastReviewedAt:config.reviewedAt,nextReviewAt:null,disclaimer:'以官方系统按实际申报条件返回的结果为准。',...metadata};
 fixture.tradeGuides.push(guide);
 const steps=[['核对商品描述与完整申报码','在海关查询入口查看归类决定、税则及品目注释，结合实际商品规格核验完整编码。'],['查询监管条件与适用税费','按完整商品编码、目的地和日期查询监管事项目录及税率；本导航不预填税率或许可结论。'],['复核出口税务事项','按税务局说明进入电子税务局“出口文库查询”，以商品代码或名称查询，并核对商品码详情中的特殊标识。']];
 const stepIds=steps.map((_,index)=>`${procedureId}-${index+1}`);
 fixture.tradeProcedures.push({id:procedureId,guideId:id,title:'中国出口：从归类到官方核验',purpose:'建立可继续核验的归类、监管和税务查询顺序。',authority:'海关总署 / 税务机关',officialUrl:config.policySources[0].url,stepIds,processingTime:{value:null,unit:null,dataStatus:'unknown'},...metadata});
 steps.forEach(([action,notes],index)=>fixture.tradeProcedureSteps.push({id:stepIds[index],procedureId,order:index+1,action,actorType:'trader',mandatoryStatus:'recommended',documentRequirementIds:[],channel:'online',notes,...metadata}));
 fixture.tradeDocumentRequirements.push({id:`${id}-product-description`,guideId:id,documentType:'product_description',label:'查询前准备：商品描述、规格与用途',mandatoryStatus:'recommended',issuer:'查询人整理',purpose:'用于核对商品归类和检索条件；不等同于海关强制随附单证清单。',format:null,conditions:[],...metadata});
 fixture.tariffMeasures.push({id:`${id}-export-tax`,guideId:id,measureType:'export_tax',rateType:'unknown',rateValue:null,rateCurrency:null,rateUnit:null,calculationBasis:'unknown',formula:null,applicability:'unknown',lifecycleStatus:'unknown',...metadata,dataStatus:'unknown'});
 config.policySources.forEach((source,index)=>fixture.policyDocuments.push({id:`${id}-official-document-${index+1}`,jurisdictionEntityId:'country-cn',documentType:index===0?'portal':'official_notice',title:source.name,issuingAuthority:source.publisher,identifier:null,sourceId:source.id,language:'zh-CN',effectiveFrom:null,effectiveTo:null,retrievedAt:source.retrievedAt,redistributionRestriction:'链接官方原文，未复制全文。',...metadata}));
 return [guide];
}
function addIndustryRecords(fixture,descriptor,config){
 const addition=config.industryAppend;if(!addition)return null;
 const network=fixture.industryNetwork;assert(network,'Industry expansion requires an existing network');
 for(const source of addition.sources){assert(!fixture.sources.some(row=>row.id===source.id),'Duplicate industry source');const {rawFile,sha256,captureMethod,...record}=source;fixture.sources.push({...record,license:'厂商公开技术说明；保留原网页权利，仅转述结构和用途。',publishedAt:null,datasetVersion:'technical-snapshot-2026-10-23',notes:`raw=${rawFile}; SHA256=${sha256}; capture=${captureMethod}. Representative technical context; no Chinese supplier/customer relationship is asserted.`})}
 const meta=sourceIds=>({period:{granularity:'monthly',start:config.reviewedAt,end:config.reviewedAt,label:'2026-10-23 公开技术资料复核'},unit:'not_applicable',method:'curated',dataStatus:'observed',datasetVersionId:descriptor.datasetVersionId,sourceIds});
 for(const topic of addition.topics){assert(!network.topics.some(row=>row.id===topic.id),'Duplicate industry topic');network.topics.push({...topic,...meta(topic.sourceIds)})}
 for(const relation of addition.relations){assert(!network.relations.some(row=>row.id===relation.id),'Duplicate industry relation');network.relations.push({...relation,...meta(relation.sourceIds)})}
 network.sourceIds=[...new Set([...network.sourceIds,...addition.sources.map(source=>source.id)])];
 network.period={...network.period,end:config.reviewedAt,label:'2026-10-21 至 2026-10-23 整理；各条目保留来源期间'};
 return addition;
}

/** Only fill countries without macro rows; retain original trade, routes and historical facts. */
export async function buildReviewSupplement(root=defaultRoot,configPath=reviewSupplementConfig){
 const configBytes=await readFile(resolve(root,configPath));const config=JSON.parse(configBytes);
 for(const source of config.policySources??[])assert(hash(await readFile(resolve(root,source.rawFile)))===source.sha256,`Policy capture changed: ${source.rawFile}`);
 for(const source of config.industryAppend?.sources??[])assert(hash(await readFile(resolve(root,source.rawFile)))===source.sha256,`Industry capture changed: ${source.rawFile}`);
 const inputs=[];
 for(const input of config.inputs){
  const bytes=await readFile(resolve(root,input.path));assert(hash(bytes)===input.sha256,`Capture changed: ${input.path}`);
  const capture=JSON.parse(bytes);assert(hash(capture.body)===capture.sha256&&capture.httpStatus===200,'Invalid official response');
  const parsed=JSON.parse(capture.body);assert(parsed[0].pages===1&&Array.isArray(parsed[1]),'Truncated official response');
  inputs.push({...input,capture,metadata:parsed[0],rows:parsed[1]});
 }
 const definitionsBase=JSON.parse(await readFile(resolve(root,config.records[0].basePath),'utf8')).indicatorDefinitions;
 const sourceId='source-world-bank-review-20261023';const results=[];
 for(const descriptor of config.records){
  const bytes=await readFile(resolve(root,descriptor.basePath));assert(hash(bytes)===descriptor.baseSha256,'Base release changed');
  const baseline=JSON.parse(bytes);assert(baseline.productId===descriptor.productId&&baseline.datasetVersion.status==='published','Base identity mismatch');
  const fixture=remap(baseline,baseline.datasetVersion.id,descriptor.datasetVersionId);const added=[];const missing=[];
  for(const entity of fixture.entities.filter(entity=>entity.kind==='country'&&!fixture.macroIndicators.some(row=>row.entityId===entity.id))){
   const countryRows=[];
   for(const [code,indicator] of series){
    const input=inputs.find(input=>input.path.includes(code));assert(input,'Missing indicator capture');
    const row=input.rows.filter(row=>row.countryiso3code===entity.iso3&&row.indicator.id===code&&typeof row.value==='number'&&Number.isFinite(row.value)&&row.value>=0).sort((a,b)=>Number(b.date)-Number(a.date))[0];
    if(!row){missing.push({entityId:entity.id,indicator,reason:'No numeric official value in reviewed 2024/2025 response'});continue}
    countryRows.push({id:`review23-${entity.id}-${code.replaceAll('.','-')}-${row.date}`,entityId:entity.id,indicator,period:period(row.date),value:row.value,quantity:null,currency:'USD',unit:'current USD',statisticalConcept:code==='FI.RES.TOTL.CD'?'official_reserve':'customs',sourceId,datasetVersionId:descriptor.datasetVersionId,method:'official',dataStatus:'observed',notes:`World Bank WDI ${code}; lastupdated=${input.metadata.lastupdated}; country=${entity.iso3}; raw=${input.path}; responseSHA256=${input.capture.sha256}. All-goods national total, not this product's trade. Reserves include gold; not foreign-exchange-only reserves.`});
   }
   const exports=countryRows.find(row=>row.indicator===series[0][1]);const imports=countryRows.find(row=>row.indicator===series[1][1]);
   if(exports&&imports&&exports.period.label===imports.period.label)countryRows.push({...exports,id:`review23-${entity.id}-trade-balance-${exports.period.label}`,indicator:balance,value:exports.value-imports.value,method:'derived',notes:`Same-country, same-year merchandise exports minus imports; inputs=${exports.id},${imports.id}. National all-goods balance; not enterprise profit.`});
   fixture.macroIndicators.push(...countryRows);added.push(...countryRows);
  }
  if(added.length){
   assert(!fixture.sources.some(source=>source.id===sourceId),'Duplicate supplement source');
   fixture.sources.push({id:sourceId,name:'World Bank WDI：商品进出口与官方储备（含黄金）',publisher:'World Bank / WTO / IMF',url:'https://databank.worldbank.org/source/world-development-indicators',license:'CC BY 4.0; indicator-specific source terms apply',publishedAt:null,retrievedAt:inputs.map(input=>input.capture.retrievedAt).sort().at(-1),datasetVersion:'WDI-snapshot-2026-10-23',notes:'Official API response URLs, retrieval timestamps and hashes are pinned in the release review audit. Only previously empty country macro coverage is filled.'});
   for(const indicator of new Set(added.map(row=>row.indicator)))if(!fixture.indicatorDefinitions.some(definition=>definition.indicator===indicator)){
    const definition=definitionsBase.find(definition=>definition.indicator===indicator);assert(definition,`Missing indicator definition ${indicator}`);
    fixture.indicatorDefinitions.push({...definition,id:`review23-definition-${indicator}`,period:period(2025),datasetVersionId:descriptor.datasetVersionId,sourceIds:[sourceId]});
   }
  }
  const aliases=[];
  if(fixture.industryNetwork)for(const topic of fixture.industryNetwork.topics){
   const terms=config.topicAliases[topic.id];if(!terms)continue;
   topic.aliases=[...new Set([...(topic.aliases??[]),...terms])];aliases.push({topicId:topic.id,aliases:topic.aliases});
  }
  const addedGuides=addExportGuide(fixture,descriptor,config);
  const industryAppend=addIndustryRecords(fixture,descriptor,config);
  fixture.datasetVersion={...fixture.datasetVersion,name:fixture.datasetVersion.name.replaceAll('GlobeChain','Global Chain'),id:descriptor.datasetVersionId,version:descriptor.datasetVersion,publishedAt:config.reviewedAt,notes:config.notes};
  const audit={schemaVersion:'review-supplement-audit.v1',batchId:config.batchId,reviewedAt:config.reviewedAt,base:{path:descriptor.basePath,sha256:descriptor.baseSha256},inputs:inputs.map(({path,sha256,capture,metadata})=>({path,sha256,url:capture.url,responseSha256:capture.sha256,retrievedAt:capture.retrievedAt,lastupdated:metadata.lastupdated})),policyInputs:config.policySources,addedMacroIndicators:added,missing,topicAliases:aliases,addedGuides,...(industryAppend?{industryAppend}:{}),transformations:[config.notes,industryAppend?'Alias terms are search aids. Prior facts only rebind datasetVersionId; new technical relationships require the explicitly reviewed industry appendix and never imply commercial supply.':'Alias terms are search aids; no new technical or commercial relationships are inferred. Existing records only rebind datasetVersionId.']};
  const fixtureText=json(fixture),auditText=json(audit);
  const manifest={schemaVersion:'fixture-manifest.v1',fixtures:[{productId:descriptor.productId,path:'fixture.json'}],datasetVersion:descriptor.datasetVersion,generatedAt:config.reviewedAt,fixtureSha256:hash(fixtureText),release:{productId:descriptor.productId,datasetVersion:descriptor.datasetVersion,releasePath:`releases/${descriptor.productId}/${descriptor.datasetVersion}`,immutable:true},evidenceReview:{batchId:config.batchId,contentSource:configPath,contentPathBase:'repository-root',contentSha256:hash(configBytes),auditPath:'review-audit.json',auditPathBase:'release-directory',auditSha256:hash(auditText)}};
  results.push({descriptor,fixture,audit,manifest,files:{'fixture.json':fixtureText,'review-audit.json':auditText,'manifest.json':json(manifest)}});
 }
 return results;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const publish=process.argv.includes('--prepare-release');
 const configPath=process.argv.slice(2).find(arg=>!arg.startsWith('--'))??reviewSupplementConfig;
 for(const result of await buildReviewSupplement(defaultRoot,configPath)){
  const directory=publish?`data/published/releases/${result.descriptor.productId}/${result.descriptor.datasetVersion}`:`data/candidates/review-supplement/${result.descriptor.productId}-${result.manifest.fixtureSha256.slice(0,12)}`;
  for(const [name,bytes] of Object.entries(result.files)){
   const path=resolve(defaultRoot,directory,name);await mkdir(dirname(path),{recursive:true});
   try{await writeFile(path,bytes,{flag:'wx'})}catch(error){if(error.code!=='EEXIST'||await readFile(path,'utf8')!==bytes)throw error}
  }
  console.log(json({status:'prepared-not-activated',directory,macroAdded:result.audit.addedMacroIndicators.length,missing:result.audit.missing.length}));
 }
}
