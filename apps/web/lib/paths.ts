function segment(value: string): string {
  return encodeURIComponent(value);
}

export function productPath(productId: string): string {
  return `/products/${segment(productId)}`;
}

export function supplyChainPath(productId: string, focusItemId?: string): string {
  const path = `${productPath(productId)}/supply-chain`;
  return focusItemId ? `${path}?focus=${segment(focusItemId)}` : path;
}

export function nodePath(productId: string, nodeId: string): string {
  return `${productPath(productId)}/nodes/${segment(nodeId)}`;
}

export function ledgerPath(productId: string, entityId: string): string {
  return `${productPath(productId)}/ledger/${segment(entityId)}`;
}

export function provenancePath(productId: string): string {
  return `${productPath(productId)}/provenance`;
}
