import Link from "next/link";
import type { ProductBreakdownNode } from "@globe-chain/domain";
import { supplyChainPath } from "../lib/paths";
import type { PageContext } from "../lib/context";

export function ProductTree({
  root,
  productId,
  maxDepth,
  context
}: {
  root: ProductBreakdownNode;
  productId: string;
  maxDepth?: number;
  context?: PageContext;
}) {
  return (
    <ul className="product-tree">
      <TreeNode node={root} productId={productId} maxDepth={maxDepth} context={context} />
    </ul>
  );
}

function TreeNode({
  node,
  productId,
  maxDepth,
  context
}: {
  node: ProductBreakdownNode;
  productId: string;
  maxDepth?: number;
  context?: PageContext;
}) {
  const hasChildren = node.children.length > 0 && (maxDepth === undefined || node.depth < maxDepth);
  return (
    <li>
      <div className={`tree-node ${node.depth === 0 ? "tree-root" : ""}`}>
        <div>
          <span className="tree-kicker">{node.item.category}</span>
          <strong>{node.item.name}</strong>
          {node.item.description ? <small>{node.item.description}</small> : null}
        </div>
        <Link className="text-link" href={supplyChainPath(productId, node.item.id, context)}>
          查看路径 →
        </Link>
      </div>
      {hasChildren ? (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.item.id} node={child} productId={productId} maxDepth={maxDepth} context={context} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
