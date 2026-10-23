
import { itemLabel } from "../lib/item-label";
import Link from "next/link";
import type { ComponentCoverageView, ProductBreakdownNode } from "@globe-chain/domain";
import { manufacturingProcessPath, supplyChainPath } from "../lib/paths";
import type { PageContext } from "../lib/context";

export function ProductTree({
  root,
  productId,
  maxDepth,
  componentCoverage,
  explorableItemIds,
  context
}: {
  root: ProductBreakdownNode;
  productId: string;
  maxDepth?: number;
  componentCoverage?: readonly ComponentCoverageView[];
  explorableItemIds?: readonly string[];
  context?: PageContext;
}) {
  return (
    <ul className="product-tree">
      <TreeNode node={root} productId={productId} maxDepth={maxDepth} componentCoverage={componentCoverage} explorableItemIds={explorableItemIds} context={context} />
    </ul>
  );
}

function TreeNode({
  node,
  productId,
  maxDepth,
  componentCoverage,
  explorableItemIds,
  context
}: {
  node: ProductBreakdownNode;
  productId: string;
  maxDepth?: number;
  componentCoverage?: readonly ComponentCoverageView[];
  explorableItemIds?: readonly string[];
  context?: PageContext;
}) {
  const hasChildren = node.children.length > 0 && (maxDepth === undefined || node.depth < maxDepth);
  const coverage = componentCoverage?.find((entry) => entry.item.id === node.item.id);
  const hasRoute = node.depth === 0 || coverage?.hasInspectableStory === true || explorableItemIds?.includes(node.item.id) === true;
  const processChain = coverage?.processChains[0];
  const canExplore = hasRoute || Boolean(processChain);
  const actionLabel = !hasRoute ? "查看制造工序" : node.depth === 0 ? "查看全部环节" : "查看生产路线";
  return (
    <li>
      <div className={`tree-node ${node.depth === 0 ? "tree-root" : ""}`}>
        <div>
          <span className="tree-kicker">{node.item.category}</span>
          <strong>{itemLabel(node.item)}</strong>
          {node.item.description ? <small>{node.item.description}</small> : null}
          {coverage ? <small>{coverage.statusLabel} · {coverage.nodeCount} 个节点 · {coverage.flowCount} 条连接</small> : null}
        </div>
        {canExplore ? <Link className="text-link" aria-label={`${actionLabel}：${itemLabel(node.item)}`} href={hasRoute ? supplyChainPath(productId, node.depth === 0 ? undefined : node.item.id, context) : manufacturingProcessPath(productId, processChain!.id, context)}>
          {actionLabel} →
        </Link> : null}
      </div>
      {hasChildren ? (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.item.id} node={child} productId={productId} maxDepth={maxDepth} componentCoverage={componentCoverage} explorableItemIds={explorableItemIds} context={context} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
