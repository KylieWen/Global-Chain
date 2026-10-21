import "./industry.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { IndustryConnectionView, IndustryParticipantView, IndustryTopicView } from "@globe-chain/domain";
import { getQueryService } from "../../../../lib/data";
import { firstParam, readPageContext, type PageContext, type SearchParamsLike } from "../../../../lib/context";
import { industryPath, manufacturingProcessPath, productPath, supplyChainPath, provenancePath } from "../../../../lib/paths";
import { Breadcrumbs, ContextBanner, SiteShell } from "../../../../components/site-shell";

const kindLabels: Record<string,string> = {material:"材料",component:"部件",process:"工艺",equipment:"设备",product:"产品与应用",channel:"销售渠道",service:"服务"};
const relationLabels: Record<string,string> = {process_input:"投入与加工",equipment_for:"制造设备",used_in:"用途与加工",sold_through:"销售入口"};

function TopicMark({kind}: {kind:string}) {
  return <svg className={"industry-mark industry-mark-" + kind} viewBox="0 0 48 48" aria-hidden="true"><rect x="2" y="2" width="44" height="44" rx="13" fill="currentColor" opacity=".10"/>{kind === "equipment" || kind === "process" ? <><path d="M13 31V17h8v7h7V13h7v22H13Z" fill="none" stroke="currentColor" strokeWidth="2.2"/><path d="M17 29h4m5 0h4" stroke="currentColor" strokeWidth="2.2"/></> : kind === "channel" || kind === "service" ? <><path d="M13 21h22l-3-8H16l-3 8Zm2 0v14h18V21M21 35V25h7v10" fill="none" stroke="currentColor" strokeWidth="2.2"/></> : <><path d="m13 18 11-6 11 6v13l-11 6-11-6V18Zm0 0 11 7 11-7M24 25v12" fill="none" stroke="currentColor" strokeWidth="2.2"/></>}</svg>;
}

function Sources({sources, period, description}: {sources: IndustryTopicView["sources"];period:IndustryTopicView["period"];description?:string}) {
  const year = period.end.slice(0,4);
  const dateLabel = period.start === period.end ? period.end : period.start.slice(0,4) === year ? year : period.start.slice(0,4) + "–" + year;
  const historical = Number(year) < new Date().getUTCFullYear();
  return <details className="industry-evidence"><summary>资料 · {dateLabel}{historical ? " · 历史" : ""}</summary><p>{period.label}</p>{description && <p>{description}</p>}<ul>{sources.map(source => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a> : source.name}<small>{source.publisher}{source.publishedAt ? " · " + source.publishedAt : ""}</small></li>)}</ul></details>;
}

function ConnectionCard({connection,productId,context}: {connection:IndustryConnectionView;productId:string;context:PageContext}) {
  const {topic,relation,sources} = connection;
  return <article className="industry-connection"><Link href={industryPath(productId, topic.id, context) + "#industry-focus"}><TopicMark kind={topic.kind}/><span className="industry-connection-copy"><small>{relationLabels[relation.kind]}</small><strong>{topic.label}</strong><span>{topic.description}</span></span><span className="industry-arrow">→</span></Link><Sources sources={sources} period={relation.period} description={relation.description}/></article>;
}

function ParticipantCard({organization,productId,context}: {organization:IndustryParticipantView;productId:string;context:PageContext}) {
  return <article className="industry-company"><h3>{organization.name}</h3><p>{organization.description}</p><div className="industry-company-topics">{organization.topics.map(topic => <Link key={topic.id} href={industryPath(productId,topic.id,context) + "#industry-focus"}>{topic.label}</Link>)}</div><div className="industry-official-links">{organization.links.map(link => <a className={"button " + (link.kind === "contact" || link.kind === "procurement" ? "button-primary" : "button-secondary")} key={link.url + link.label} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}</div><Sources sources={organization.sources} period={organization.period}/></article>;
}

export default async function IndustryPage({params,searchParams}: {params:Promise<{productId:string}>;searchParams:Promise<SearchParamsLike>}) {
  const {productId} = await params;
  const search = await searchParams;
  const context = readPageContext(search);
  const queries = await getQueryService(context.datasetVersion);
  const view = queries.getIndustryNetwork(productId,{topicId:firstParam(search.topic),search:firstParam(search.q)});
  if (!view) notFound();
  const groups = [...new Set(view.matchingTopics.map(topic => topic.kind))];
  const companyMap = new Map([...view.participants,...view.adjacentParticipants].map(company => [company.id,company]));
  return <SiteShell><div className="content-column wide-column industry-page">
    <Breadcrumbs items={[{label:"商品目录",href:"/products"},{label:view.product.name,href:productPath(productId,context)},{label:"产业上下游"}]}/>
    <div className="industry-heading"><div><p className="eyebrow">产业上下游 · {view.region.name}</p><h1>从一个环节，找到上下游</h1><p>查看材料、部件、制造设备和产品应用，进入企业官方产品、联系与销售入口。</p></div><div className="industry-counts"><span><strong>{view.topics.length}</strong>产业环节</span><span><strong>{view.network.organizations.length}</strong>家企业</span></div></div>
    <nav className="exploration-nav" aria-label="商品研究层级"><Link href={productPath(productId,context)}>商品总览</Link><Link href={supplyChainPath(productId,undefined,context)}>全球供应链</Link><span className="active">产业上下游</span><a href="#industry-directory">企业与官方入口</a><Link href={provenancePath(productId,context)}>来源与版本</Link></nav>
    <div className="industry-mobile-picker">
      <form className="industry-mobile-topic-form" action={industryPath(productId) + "#industry-focus"}>
        <label htmlFor="industry-topic-mobile">选择产业环节</label>
        <div><select id="industry-topic-mobile" name="topic" key={view.selectedTopic.id} defaultValue={view.selectedTopic.id}>
          {[...new Set(view.topics.map(topic => topic.kind))].map(kind => <optgroup key={kind} label={kindLabels[kind]}>{view.topics.filter(topic => topic.kind === kind).map(topic => <option key={topic.id} value={topic.id}>{topic.label}</option>)}</optgroup>)}
        </select><button type="submit">查看</button></div>
        {Object.entries(context).filter(([,value]) => value).map(([key,value]) => <input key={key} type="hidden" name={key} value={value}/>)}
      </form>
      <form className="industry-mobile-search-form" action={industryPath(productId) + "#industry-directory"}>
        <label className="sr-only" htmlFor="industry-search-mobile">搜索企业或环节</label>
        <div><input id="industry-search-mobile" name="q" key={view.search} defaultValue={view.search} placeholder="搜索企业或环节…"/><button type="submit">搜索</button></div>
        <input type="hidden" name="topic" value={view.selectedTopic.id}/>
        {Object.entries(context).filter(([,value]) => value).map(([key,value]) => <input key={key} type="hidden" name={key} value={value}/>)}
        {view.search && <Link href={industryPath(productId,view.selectedTopic.id,context)}>清除搜索</Link>}
      </form>
    </div>
    <div className="industry-workspace">
      <aside className="industry-topics" aria-label="选择产业环节"><form action={industryPath(productId) + "#industry-directory"} className="industry-search"><label htmlFor="industry-search">搜索环节或企业</label><input id="industry-search" name="q" key={view.search} defaultValue={view.search} placeholder="铜管、检漏、企业名称…"/><input type="hidden" name="topic" value={view.selectedTopic.id}/>{Object.entries(context).filter(([,value]) => value).map(([key,value]) => <input key={key} type="hidden" name={key} value={value}/>)}<button type="submit">搜索</button>{view.search && <Link href={industryPath(productId,view.selectedTopic.id,context)}>清除</Link>}</form>
      {groups.map(kind => <div className="industry-topic-group" key={kind}><h2>{kindLabels[kind]}</h2>{view.matchingTopics.filter(topic => topic.kind === kind).map(topic => <Link className={topic.id === view.selectedTopic.id ? "selected" : ""} aria-current={topic.id === view.selectedTopic.id ? "page" : undefined} key={topic.id} href={industryPath(productId,topic.id,context) + "#industry-focus"}><TopicMark kind={topic.kind}/><span>{topic.label}</span><span>›</span></Link>)}</div>)}{!view.matchingTopics.length && <p className="muted">换个名称试试，或清除搜索查看全部环节。</p>}</aside>
      <div className="industry-focus" id="industry-focus">
        <section className="industry-selected"><TopicMark kind={view.selectedTopic.kind}/><div><p className="eyebrow">{kindLabels[view.selectedTopic.kind]}</p><h2>{view.selectedTopic.label}</h2><p>{view.selectedTopic.description}</p><Sources sources={view.selectedTopic.sources} period={view.selectedTopic.period}/>{view.relatedProcesses.length > 0 && <div className="industry-process-links">{view.relatedProcesses.map(chain => <Link className="button button-secondary" key={chain.id} href={manufacturingProcessPath(productId,chain.id,context)}>查看制造工序与投入产出 →</Link>)}</div>}</div></section>
        <div className="industry-flow-columns">
          {view.upstream.length > 0 && <section><h2>上游投入与设备 <span>{view.upstream.length}</span></h2><div className="industry-connection-list">{view.upstream.map(connection => <ConnectionCard key={connection.relation.id} connection={connection} productId={productId} context={context}/>)}</div></section>}
          {view.downstream.length > 0 && <section><h2>下游加工与应用 <span>{view.downstream.length}</span></h2><div className="industry-connection-list">{view.downstream.map(connection => <ConnectionCard key={connection.relation.id} connection={connection} productId={productId} context={context}/>)}</div></section>}
        </div>
        {companyMap.size > 0 && <section className="industry-relevant"><div className="section-heading"><div><p className="eyebrow">从公开产品找到企业</p><h2>{view.participants.length ? "这个环节的企业" : "相邻环节的企业"}</h2></div><a href="#industry-directory">查看全部企业 ↓</a></div><div className="industry-company-grid">{(view.participants.length ? view.participants : view.adjacentParticipants).map(organization => <ParticipantCard key={organization.id} organization={organization} productId={productId} context={context}/>)}</div></section>}
      </div>
    </div>
    <section id="industry-directory" className="section-block industry-directory"><div className="section-heading"><div><p className="eyebrow">企业与官方入口</p><h2>{view.search ? "搜索结果" : "继续查找产业参与者"}</h2></div><span className="section-caption">{view.directory.length} 家 · 可按产品标签探索</span></div><div className="industry-company-grid">{view.directory.map(organization => <ParticipantCard key={organization.id} organization={organization} productId={productId} context={context}/>)}</div>{!view.directory.length && <p>没有匹配的企业名称或产品。<Link href={industryPath(productId,view.selectedTopic.id,context)}>查看全部企业 →</Link></p>}</section>
    <details className="industry-method"><summary>资料范围与阅读方法</summary><p>环节之间展示材料投入、加工设备、产品用途与销售渠道。企业卡片对应官网公开产品能力；点击官方入口后，可自行联系企业。</p><p>企业资料保留网页观察日期，历史技术资料保留原年份。关系来源可在各卡片的“资料”中打开。技术关系与企业间实际供货分别记录。</p><ContextBanner period={view.network.period.label} datasetVersion={view.datasetVersion.version}/></details>
  </div></SiteShell>;
}
