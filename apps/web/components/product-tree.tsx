import Link from "next/link";
import type { ComponentCoverageView, ProductBreakdownNode } from "@globe-chain/domain";
import { supplyChainPath } from "../lib/paths";
import type { PageContext } from "../lib/context";

export function ProductTree({
  root,
  productId,
  maxDepth,
  componentCoverage,
  context
}: {
  root: ProductBreakdownNode;
  productId: string;
  maxDepth?: number;
  componentCoverage?: readonly ComponentCoverageView[];
  context?: PageContext;
}) {
  return (
    <ul className="product-tree">
      <TreeNode node={root} productId={productId} maxDepth={maxDepth} componentCoverage={componentCoverage} context={context} />
    </ul>
  );
}

function TreeNode({
  node,
  productId,
  maxDepth,
  componentCoverage,
  context
}: {
  node: ProductBreakdownNode;
  productId: string;
  maxDepth?: number;
  componentCoverage?: readonly ComponentCoverageView[];
  context?: PageContext;
}) {
  const hasChildren = node.children.length > 0 && (maxDepth === undefined || node.depth < maxDepth);
  const coverage = componentCoverage?.find((entry) => entry.item.id === node.item.id);
  const canExplore = node.depth === 0 || coverage?.hasInspectableStory === true;
  return (
    <li>
      <div className={`tree-node ${node.depth === 0 ? "tree-root" : ""}`}>
        <div>
          <span className="tree-kicker">{node.item.category}</span>
          <strong>{node.item.name}</strong>
          {node.item.description ? <small>{node.item.description}</small> : null}
          {coverage ? <small>{coverage.statusLabel} · {coverage.nodeCount} 个节点 · {coverage.flowCount} 条连接</small> : null}
        </div>
        {canExplore ? <Link className="text-link" href={supplyChainPath(productId, node.depth === 0 ? undefined : node.item.id, context)}>
          {node.depth === 0 ? "查看全部环节" : coverage?.status === "partial_route" ? "查看已整理环节" : "查看代表性路线"} →
        </Link> : <span className="muted">仅类别说明，路线资料尚未发布</span>}
      </div>
      {hasChildren ? (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.item.id} node={child} productId={productId} maxDepth={maxDepth} componentCoverage={componentCoverage} context={context} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
