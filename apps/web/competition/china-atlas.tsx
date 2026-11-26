import type { RegionalAtlas } from "@globe-chain/contracts";
import type { IndustryConnectionView, IndustryNetworkView } from "@globe-chain/domain";
import regionAtlas from "../../../content/geography/china-supply-atlas-2026-10-23.json";
import { ChinaSupplyMap } from "../components/china-supply-map";
import { industryPath } from "../lib/paths";
import Link, { useRouter } from "./navigation";

// The published atlas is validated in regional-review-supplement.test.ts.
const atlas = regionAtlas as RegionalAtlas;

type ProductOption = { id: string; name: string };

export function CompetitionChinaAtlas({ product, products, industry, worldSearch }: {
  product: string;
  products: ProductOption[];
  industry: IndustryNetworkView | null;
  worldSearch?: string;
}) {
  const router = useRouter();
  const productName = products.find(entry => entry.id === product)?.name ?? product;
  const organizations = industry?.directory.map(org => ({
    id: org.id, name: org.name, description: org.description, links: org.links, topicId: org.entryTopicId
  })) ?? [];
  return <ChinaSupplyMap key={product} atlas={atlas} productId={product} productName={productName}
    products={products} organizations={organizations} context={{}} originMap={worldSearch} navigate={(href, options) => {
      const target = new URL(href, window.location.origin);
      if (worldSearch) target.searchParams.set("map", worldSearch);
      const destination = target.pathname + target.search;
      if (destination !== window.location.pathname + window.location.search) router.push(destination, options);
    }} />;
}

function IndustrySources({ sources, period }: { sources: IndustryNetworkView["sources"]; period: string }) {
  return <details className="industry-evidence"><summary>资料与年份</summary><p>{period}</p>
    <ul>{sources.map(source => <li key={source.id}>{source.url
      ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a> : source.name}</li>)}</ul>
  </details>;
}

export function CompetitionIndustry({ product, view }: { product: string; view: IndustryNetworkView }) {
  const { selectedTopic, upstream, downstream } = view;
  const organizations = view.participants.length ? view.participants : view.adjacentParticipants;
  const topicLink = (topicId: string) => industryPath(product, topicId);
  const connections = (title: string, entries: readonly IndustryConnectionView[]) => entries.length > 0 && <section>
    <h2>{title}</h2>
    <div className="industry-connection-list">{entries.map(({ topic, relation, sources }) => <article key={relation.id} className="industry-connection">
      <Link href={topicLink(topic.id)}><strong>{topic.label} →</strong></Link>
      <p>{relation.description}</p>
      <IndustrySources sources={sources} period={relation.period.label} />
    </article>)}</div>
  </section>;
  return <div className="industry-focus">
    <section className="industry-selected"><div><h2>{selectedTopic.label}</h2><p>{selectedTopic.description}</p>
      <IndustrySources sources={selectedTopic.sources} period={selectedTopic.period.label} />
    </div></section>
    <div className="industry-flow-columns">
      {connections("上游投入与设备", upstream)}
      {connections("下游加工、应用与渠道", downstream)}
    </div>
    {organizations.length > 0 && <section className="industry-relevant">
      <h2>{view.participants.length ? "这个环节的企业" : "相邻环节的企业"}</h2>
      <div className="industry-company-grid">{organizations.map(org => <article key={org.id} className="industry-company">
        <h3>{org.name}</h3><p>{org.description}</p>
        <div className="industry-company-topics">{org.topics.map(topic => <Link key={topic.id} href={topicLink(topic.id)}>{topic.label}</Link>)}</div>
        <div className="industry-official-links">{org.links.map(link => <a key={link.url + link.label} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}</div>
        <IndustrySources sources={org.sources} period={org.period.label} />
      </article>)}</div>
    </section>}
  </div>;
}
