import type { RegionalAtlas } from "@globe-chain/contracts";

export const regionalStageLabels = {material:"原料与材料", component:"部件与设备", manufacturing:"加工与组装", market:"市场与流通"} as const;

export function getRegionalAtlasView(atlas: RegionalAtlas, productId: string, filters: {province?: string; stage?: string} = {}) {
  const allNodes = atlas.nodes.filter(node => node.productId === productId);
  const places = new Map(atlas.places.map(place => [place.id, place]));
  const nodes = allNodes.filter(node => (!filters.province || places.get(node.placeId)?.provinceCode === filters.province) && (!filters.stage || node.stage === filters.stage));
  // Keep adjacent endpoints when a province is selected, so context remains visible.
  const ids = new Set(nodes.map(node => node.id));
  const connections = atlas.connections.filter(edge => {
    const a = allNodes.find(node => node.id === edge.from); const b = allNodes.find(node => node.id === edge.to);
    return Boolean(a && b && (ids.has(edge.from) || ids.has(edge.to)));
  });
  return {allNodes, nodes, connections, places: atlas.places.filter(place => allNodes.some(node => node.placeId === place.id)), sources:atlas.sources, datasetVersion:atlas.datasetVersion};
}
