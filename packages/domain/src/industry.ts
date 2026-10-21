import type { IndustryNetwork } from "@globe-chain/contracts";
import type { DeepReadonly, FixtureRepository, ReadonlyProductFixture } from "./repository";

type Network = DeepReadonly<IndustryNetwork>;
type Topic = Network["topics"][number];
type Relation = Network["relations"][number];
type Participant = Network["organizations"][number];
type Source = ReadonlyProductFixture["sources"][number];
export type IndustryTopicView = Topic & { readonly sources: readonly Source[] };
export type IndustryParticipantView = Participant & {
  readonly topics: readonly IndustryTopicView[];
  readonly sources: readonly Source[];
  readonly entryTopicId: string;
};
export interface IndustryConnectionView {
  readonly topic: IndustryTopicView;
  readonly relation: Relation;
  readonly sources: readonly Source[];
}
export interface IndustryNetworkOptions { readonly topicId?: string; readonly search?: string }
export interface IndustryNetworkView {
  readonly product: ReadonlyProductFixture["items"][number];
  readonly datasetVersion: ReadonlyProductFixture["datasetVersion"];
  readonly region: ReadonlyProductFixture["entities"][number];
  readonly network: Network;
  readonly topics: readonly IndustryTopicView[];
  readonly matchingTopics: readonly IndustryTopicView[];
  readonly selectedTopic: IndustryTopicView;
  readonly upstream: readonly IndustryConnectionView[];
  readonly downstream: readonly IndustryConnectionView[];
  readonly participants: readonly IndustryParticipantView[];
  readonly adjacentParticipants: readonly IndustryParticipantView[];
  readonly directory: readonly IndustryParticipantView[];
  readonly sources: readonly Source[];
  readonly search: string;
  readonly relatedItems: readonly ReadonlyProductFixture["items"][number][];
  readonly relatedProcesses: readonly ReadonlyProductFixture["manufacturingProcessChains"][number][];
}

export function getIndustryNetwork(repository: FixtureRepository, productId: string, options: IndustryNetworkOptions = {}): IndustryNetworkView | null {
  const fixture = repository.getProductFixture(productId);
  const network = fixture?.industryNetwork;
  if (!fixture || !network) return null;
  const product = fixture.items.find(item => item.id === productId);
  const region = fixture.entities.find(entity => entity.id === network.regionEntityId);
  if (!product || !region) return null;
  const sourceById = new Map(fixture.sources.map(source => [source.id, source]));
  const resolveSources = (ids: readonly string[]) => Object.freeze(ids.flatMap(id => {
    const source = sourceById.get(id);
    return source ? [source] : [];
  }));
  const topics = Object.freeze(network.topics.map(topic => Object.freeze({...topic, sources:resolveSources(topic.sourceIds)})));
  const topicById = new Map(topics.map(topic => [topic.id, topic]));
  const selectedTopic = topicById.get(options.topicId ?? network.defaultTopicId);
  if (!selectedTopic) return null;
  const connect = (relation: Relation, id: string): IndustryConnectionView => Object.freeze({
    topic: topicById.get(id)!, relation, sources:resolveSources(relation.sourceIds)
  });
  const upstream = Object.freeze(network.relations.filter(relation => relation.toTopicId === selectedTopic.id).map(relation => connect(relation, relation.fromTopicId)));
  const downstream = Object.freeze(network.relations.filter(relation => relation.fromTopicId === selectedTopic.id).map(relation => connect(relation, relation.toTopicId)));
  const adjacentIds = new Set([...upstream, ...downstream].map(connection => connection.topic.id));
  const organizations = network.organizations.map(organization => Object.freeze({
    ...organization, entryTopicId:organization.topicIds[0]!, sources:resolveSources(organization.sourceIds),
    topics:Object.freeze(organization.topicIds.map(id => topicById.get(id)!))
  }));
  const participants = Object.freeze(organizations.filter(organization => organization.topicIds.includes(selectedTopic.id)));
  const adjacentParticipants = Object.freeze(organizations.filter(organization => !organization.topicIds.includes(selectedTopic.id) && organization.topicIds.some(id => adjacentIds.has(id))));
  const itemIds = new Set(selectedTopic.itemIds ?? []);
  const relatedItems = Object.freeze(fixture.items.filter(item => itemIds.has(item.id)));
  const relatedProcesses = Object.freeze(fixture.manufacturingProcessChains.filter(chain => itemIds.has(chain.itemId) || fixture.manufacturingProcessSteps.some(step => step.processChainId === chain.id && [...step.inputItemIds,...step.outputItemIds].some(id => itemIds.has(id)))));
  const search = options.search?.trim().slice(0, 120) ?? "";
  const needle = search.toLocaleLowerCase();
  const matches = (text: string) => !needle || text.toLocaleLowerCase().includes(needle);
  const directory = Object.freeze(organizations.filter(organization => matches([organization.name,organization.description,...organization.topics.map(topic => topic.label)].join(" "))).map(organization => Object.freeze({...organization, entryTopicId:organization.topics.find(topic => matches(topic.label))?.id ?? organization.topics.find(topic => matches(topic.description))?.id ?? organization.topicIds[0]!})));
  const matchingParticipantTopics = new Set(needle ? directory.flatMap(organization => organization.topicIds) : []);
  return Object.freeze({
    product, region, datasetVersion:fixture.datasetVersion, network, topics, selectedTopic, upstream, downstream,
    participants, adjacentParticipants, relatedItems, relatedProcesses,
    matchingTopics:Object.freeze(topics.filter(topic => matches(topic.label + " " + topic.description) || matchingParticipantTopics.has(topic.id))),
    directory,
    sources:resolveSources(network.sourceIds), search
  });
}
