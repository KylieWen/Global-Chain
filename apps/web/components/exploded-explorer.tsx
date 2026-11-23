"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PageContext } from "../lib/context";
import type { ExplodedModel } from "../lib/exploded-model";
import { explodedLinks } from "../lib/exploded-links";
import { useThemePreference } from "./theme-preference";
import { StatusBadge } from "./data-display";
import { ExplodedCanvasViewer } from "./exploded-canvas-viewer";
import { ExplodedIsoView } from "./exploded-iso-view";
import "./exploded-view.css";

type Props = {
  model: ExplodedModel;
  productId: string;
  context: PageContext;
  initialFocus?: string | null;
};

const MATERIAL_TYPES = new Set(["material", "raw_material"]);

export function ExplodedExplorer({ model, productId, context, initialFocus }: Props) {
  const { tokens, reducedMotion } = useThemePreference();
  const palette = tokens.map.palette.itemColors;
  const initialNode = initialFocus && model.nodes.some((node) => node.id === initialFocus) ? initialFocus : model.root.id;
  const [selectedId, setSelectedId] = useState<string | null>(initialNode);
  const [explosion, setExplosion] = useState(0.62);

  const nodeById = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model]);
  const selected = selectedId ? nodeById.get(selectedId) ?? model.root : model.root;
  const links = explodedLinks(productId, selected, context);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    document.querySelector(".exploded-detail-header")?.scrollIntoView({
      block: "nearest",
      behavior: reducedMotion ? "auto" : "smooth"
    });
  }, [selectedId, reducedMotion]);

  const descendantMaterials = useMemo(() => {
    const ids = new Set(selected.descendantIds);
    return model.nodes.filter((node) => ids.has(node.id) && MATERIAL_TYPES.has(node.itemType));
  }, [selected, model]);

  const laneMeta = new Map(model.lanes.map((lane) => [lane.id, lane]));
  const selectedLane = laneMeta.get(selected.lane);

  return (
    <section className="exploded-explorer" aria-labelledby="exploded-title">
      <div className="exploded-stage">
        <div className="exploded-stage-heading">
          <div>
            <p className="eyebrow">程序化拆解</p>
            <h2 id="exploded-title">商品拆解图</h2>
          </div>
          <span className="exploded-mode-badge">
            {model.renderMode === "procedural-3d" ? "可旋转 3D 爆炸图" : "等距分层图"}
          </span>
        </div>

        {model.gaps.length > 0 && (
          <ul className="exploded-gaps" aria-label="拆解数据缺口">
            {model.gaps.map((gap) => <li key={gap}>{gap}</li>)}
          </ul>
        )}

        {model.renderMode === "procedural-3d" ? (
          <ExplodedCanvasViewer
            model={model}
            palette={palette}
            tokens={tokens.palette}
            selectedId={selected.id}
            onSelect={setSelectedId}
            explosion={explosion}
            reducedMotion={reducedMotion}
          />
        ) : (
          <ExplodedIsoView
            model={model}
            palette={palette}
            tokens={tokens.palette}
            selectedId={selected.id}
            onSelect={setSelectedId}
            explosion={explosion}
          />
        )}

        <div className="exploded-controls">
          <label className="exploded-slider">
            <span>爆炸程度</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={explosion}
              onChange={(event) => setExplosion(Number(event.target.value))}
              aria-label="调节部件展开程度"
            />
          </label>
          <div className="exploded-lanes" aria-label="拆解层级">
            {model.lanes.map((lane) => (
              <span key={lane.id} className={`exploded-lane${lane.present ? "" : " missing"}`} title={lane.missingNote ?? lane.hint}>
                <i className="exploded-lane-dot" />
                {lane.label}
                <small>{lane.present ? lane.nodeIds.length : "未收录"}</small>
              </span>
            ))}
          </div>
        </div>
      </div>

      <aside className="exploded-detail" aria-live="polite">
        <header className="exploded-detail-header">
          <span className="card-kicker">{selected.category}{selectedLane ? ` · ${selectedLane.label}` : ""}</span>
          <h3>{selected.name}</h3>
          {selected.description ? <p>{selected.description}</p> : null}
          <div className="exploded-detail-badges">
            <StatusBadge status={selected.dataStatus} method={selected.method} />
            <span className="muted">第 {selected.depth + 1} 层 · {selected.routeNodeCount} 个路线节点 · {selected.routeFlowCount} 条连接</span>
          </div>
          {selected.gapNote ? <p className="exploded-detail-gap">{selected.gapNote}</p> : null}
        </header>

        <div className="exploded-actions">
          {links.routeHref && <Link className="button button-primary" href={links.routeHref}>查看代表性路线 →</Link>}
          {links.processHref && <Link className="button button-secondary" href={links.processHref}>查看制造工序 →</Link>}
          {links.tradeMapHref && <Link className="button button-secondary" href={links.tradeMapHref}>查看贸易地图 →</Link>}
          {links.materialHref && <Link className="button button-secondary" href={links.materialHref}>材料贸易观察 →</Link>}
          {links.ledgerHrefs.map((ledger) => (
            <Link className="button button-secondary" key={ledger.id} href={ledger.href}>
              国家账本 · {ledger.name} →
            </Link>
          ))}
          {!selected.explorable && <p className="muted exploded-no-route">该部件尚无已发布的路线、工序或贸易记录。</p>}
        </div>

        {descendantMaterials.length > 0 && (
          <div className="exploded-desc-materials">
            <p className="eyebrow">下属材料</p>
            <div className="exploded-material-chips">
              {descendantMaterials.map((material) => {
                const materialLinks = explodedLinks(productId, material, context);
                return (
                  <Link
                    key={material.id}
                    className={`exploded-material-chip${selected.id === material.id ? " selected" : ""}`}
                    href={materialLinks.materialHref ?? materialLinks.tradeMapHref ?? "#"}
                    onClick={() => setSelectedId(material.id)}
                  >
                    {material.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <nav className="exploded-node-list" aria-label="全部部件列表">
          {model.lanes.filter((lane) => lane.present).map((lane) => (
            <div className="exploded-node-list-group" key={lane.id}>
              <span className="exploded-node-list-label">{lane.label}</span>
              <div className="exploded-node-list-items">
                {lane.nodeIds.map((id) => {
                  const node = nodeById.get(id);
                  if (!node) return null;
                  return (
                    <button
                      type="button"
                      key={id}
                      className={`exploded-node-list-item${selected.id === id ? " selected" : ""}`}
                      aria-pressed={selected.id === id}
                      onClick={() => setSelectedId(id)}
                    >
                      {node.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </section>
  );
}
