"use client";

import { useMemo } from "react";
import type { ExplodedModel } from "../lib/exploded-model";
import { layoutIsoSlots, type IsoSlot } from "../lib/exploded-layout";
import { productPrototype, resolveNodeRole, schemeMaterials, type ShapeKind } from "../lib/exploded-appearance";

type Tokens = {
  inkSoft: string;
  line: string;
  accent: string;
};

type Props = {
  model: ExplodedModel;
  productId: string;
  scheme: "dark" | "light";
  tokens: Tokens;
  selectedId: string | null;
  onSelect: (id: string) => void;
  explosion: number;
};

const ROW_GAP_MIN = 56;
const ROW_GAP_MAX = 112;

/** Decorative prototype silhouettes for the root fallback; not extra BOM parts. */
function PrototypeGlyph({ prototype, color }: { prototype: string | null; color: string }) {
  const common = {
    fill: "none",
    stroke: color,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      {prototype === "phone" && (
        <g {...common}>
          <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
          <line x1="10" y1="5" x2="14" y2="5" />
          <circle cx="12" cy="18" r="1" />
        </g>
      )}
      {prototype === "tshirt" && (
        <path {...common} d="M8 4 L3 7.5 L5.5 11 L8.5 9.5 L8.5 20 L15.5 20 L15.5 9.5 L18.5 11 L21 7.5 L16 4 L12 6.5 Z" />
      )}
      {prototype === "bottle" && (
        <g {...common}>
          <rect x="9.5" y="2.5" width="5" height="2.2" rx="0.6" />
          <path d="M10.5 4.7 L10.5 8 L8.5 10.5 L8.5 19.5 Q8.5 21 10 21 L14 21 Q15.5 21 15.5 19.5 L15.5 10.5 L13.5 8 L13.5 4.7" />
          <line x1="8.8" y1="14" x2="15.2" y2="14" />
        </g>
      )}
      {prototype === "ebike" && (
        <g {...common}>
          <circle cx="7" cy="16" r="3.6" />
          <circle cx="17" cy="16" r="3.6" />
          <path d="M7 16 L11.5 8.5 L17 16 M11.5 8.5 L13.5 16 M9.5 8.5 L13.5 8.5" />
        </g>
      )}
      {prototype === "ac-split" && (
        <g {...common}>
          <rect x="3" y="5.5" width="18" height="6.5" rx="2" />
          <line x1="5.5" y1="9.5" x2="18.5" y2="9.5" />
          <rect x="3" y="15" width="8" height="6" rx="1.2" />
        </g>
      )}
      {!prototype && <circle cx="12" cy="12" r="4" {...common} />}
    </svg>
  );
}

/** Small role-driven silhouette for non-root fallback chips. */
function RoleGlyph({ shape, color }: { shape: ShapeKind; color: string }) {
  const stroke = color;
  const fill = `${color}33`;
  const common = {
    fill,
    stroke,
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {shape === "frame" && <rect x="6" y="2.5" width="12" height="19" rx="2.4" {...common} />}
      {shape === "frame-part" && <rect x="7" y="3.5" width="10" height="17" rx="1.6" {...common} />}
      {(shape === "screen" || shape === "glass" || shape === "panel" || shape === "rear") && (
        <rect x="6.5" y="3" width="11" height="18" rx="2" {...common} />
      )}
      {shape === "bottle" && (
        <g {...common}>
          <rect x="10" y="2.5" width="4" height="2" rx="0.6" />
          <path d="M10.8 4.5 L10.8 7.5 L9 10 L9 19 Q9 20.5 10.5 20.5 L13.5 20.5 Q15 20.5 15 19 L15 10 L13.2 7.5 L13.2 4.5 Z" />
        </g>
      )}
      {shape === "bottle-cap" && <rect x="8" y="9" width="8" height="6" rx="1.2" {...common} />}
      {shape === "liquid" && <rect x="7" y="7" width="10" height="11" rx="3" {...common} />}
      {shape === "garment" && (
        <path {...common} d="M8.5 4.5 L4 8 L6 11 L8.5 9.5 L8.5 19.5 L15.5 19.5 L15.5 9.5 L18 11 L20 8 L15.5 4.5 L12 6.8 Z" />
      )}
      {shape === "bike" && (
        <g {...common}>
          <circle cx="7" cy="16" r="3.4" />
          <circle cx="17" cy="16" r="3.4" />
          <path d="M7 16 L11.5 8.5 L17 16 M11.5 8.5 L13.5 16" />
        </g>
      )}
      {shape === "wheel" && (
        <g {...common}>
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="1.6" fill={stroke} />
        </g>
      )}
      {shape === "ac-unit" && (
        <g {...common}>
          <rect x="3" y="6" width="18" height="7" rx="1.8" />
          <line x1="6" y1="10" x2="18" y2="10" />
          <rect x="5" y="15" width="7" height="5" rx="1" />
        </g>
      )}
      {(shape === "battery-pack" || shape === "battery-cell") && (
        <g {...common}>
          <rect x="5" y="7" width="12" height="10" rx="1.6" />
          <rect x="17" y="10" width="2" height="4" rx="0.6" fill={stroke} stroke="none" />
        </g>
      )}
      {shape === "pcb" && (
        <g {...common}>
          <rect x="5" y="6" width="14" height="12" rx="1" />
          <line x1="8" y1="10" x2="13" y2="10" stroke={stroke} />
          <line x1="13" y1="10" x2="13" y2="15" stroke={stroke} />
          <circle cx="9" cy="14" r="1" fill={stroke} stroke="none" />
        </g>
      )}
      {shape === "board-small" && <rect x="7" y="7" width="10" height="10" rx="1" {...common} />}
      {shape === "chip" && (
        <g {...common}>
          <rect x="7" y="7" width="10" height="10" rx="1" />
          {[9, 12, 15].map((y) => <line key={y} x1="7" y1={y} x2="5" y2={y} stroke={stroke} />)}
        </g>
      )}
      {shape === "wafer" && <circle cx="12" cy="12" r="5.5" {...common} />}
      {shape === "lens" && (
        <g {...common}>
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="2" fill={stroke} stroke="none" />
        </g>
      )}
      {shape === "camera-bump" && (
        <g {...common}>
          <rect x="6" y="6" width="12" height="12" rx="2.4" />
          <circle cx="9.8" cy="9.8" r="1.6" fill={stroke} stroke="none" />
          <circle cx="14.2" cy="14.2" r="1.6" fill={stroke} stroke="none" />
        </g>
      )}
      {shape === "speaker" && (
        <g {...common}>
          <rect x="6" y="8" width="12" height="8" rx="1.4" />
          <circle cx="9" cy="12" r="0.9" fill={stroke} stroke="none" />
          <circle cx="12" cy="12" r="0.9" fill={stroke} stroke="none" />
          <circle cx="15" cy="12" r="0.9" fill={stroke} stroke="none" />
        </g>
      )}
      {shape === "motor" && (
        <g {...common}>
          <circle cx="12" cy="12" r="5.5" />
          <circle cx="12" cy="12" r="1.8" fill={stroke} stroke="none" />
        </g>
      )}
      {shape === "module" && <rect x="6" y="7.5" width="12" height="9" rx="1.6" {...common} />}
      {shape === "sheet" && <rect x="5" y="9" width="14" height="6" rx="1" {...common} />}
      {shape === "wire" && <polyline points="5,15 9,9 15,13 19,7" {...common} fill="none" />}
      {shape === "note" && <rect x="6" y="7" width="12" height="10" rx="1" {...common} />}
      {shape === "material" && <rect x="7" y="8" width="10" height="8" rx="1.4" {...common} />}
    </svg>
  );
}

export function ExplodedIsoView({ model, productId, scheme, tokens, selectedId, onSelect, explosion }: Props) {
  const slots = useMemo(() => layoutIsoSlots(model), [model]);
  const nodeById = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model]);
  const materials = useMemo(() => schemeMaterials(scheme), [scheme]);
  const prototype = productPrototype(productId);
  const rows = useMemo(() => {
    const byRow = new Map<number, IsoSlot[]>();
    slots.forEach((slot) => {
      const list = byRow.get(slot.row) ?? [];
      list.push(slot);
      byRow.set(slot.row, list);
    });
    return [...byRow.entries()].sort((a, b) => a[0] - b[0]);
  }, [slots]);

  const rowGap = ROW_GAP_MIN + (ROW_GAP_MAX - ROW_GAP_MIN) * explosion;

  return (
    <div className="exploded-iso" role="img" aria-label="等距分层拆解图：按真实拆解深度分层，点击部件查看详情">
      {rows.map(([row, rowSlots]) => (
        <div className="exploded-iso-row" key={row} style={{ marginTop: row === 0 ? 0 : rowGap }}>
          <span className="exploded-iso-row-label">第 {row + 1} 层</span>
          <div className="exploded-iso-slots">
            {rowSlots.map((slot) => {
              const node = nodeById.get(slot.id);
              if (!node) return null;
              const role = resolveNodeRole(productId, node);
              const color = materials[role.material] ?? materials.material;
              const selected = selectedId === node.id;
              const isRoot = node.depth === 0;
              return (
                <button
                  type="button"
                  key={node.id}
                  className={`exploded-iso-chip${selected ? " selected" : ""}${isRoot ? " root" : ""}`}
                  style={{ borderColor: selected ? tokens.accent : color }}
                  aria-pressed={selected}
                  onClick={() => onSelect(node.id)}
                >
                  {isRoot
                    ? <PrototypeGlyph prototype={prototype} color={color} />
                    : <RoleGlyph shape={role.shape} color={color} />}
                  <span className="exploded-iso-chip-name">{node.name}</span>
                  <span className="exploded-iso-chip-type">{node.category}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
