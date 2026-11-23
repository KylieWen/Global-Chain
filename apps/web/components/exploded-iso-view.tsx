"use client";

import { useMemo } from "react";
import type { ExplodedModel } from "../lib/exploded-model";
import { explodedColorIndex } from "../lib/exploded-model";
import { layoutIsoSlots, type IsoSlot } from "../lib/exploded-layout";

type Tokens = {
  inkSoft: string;
  line: string;
  accent: string;
};

type Props = {
  model: ExplodedModel;
  palette: readonly string[];
  tokens: Tokens;
  selectedId: string | null;
  onSelect: (id: string) => void;
  explosion: number;
};

const ROW_GAP_MIN = 56;
const ROW_GAP_MAX = 112;

export function ExplodedIsoView({ model, palette, tokens, selectedId, onSelect, explosion }: Props) {
  const slots = useMemo(() => layoutIsoSlots(model), [model]);
  const nodeById = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model]);
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
              const color = palette[explodedColorIndex(model.nodes, node.id) % palette.length] ?? palette[0];
              const selected = selectedId === node.id;
              return (
                <button
                  type="button"
                  key={node.id}
                  className={`exploded-iso-chip${selected ? " selected" : ""}`}
                  style={{ borderColor: selected ? tokens.accent : color }}
                  aria-pressed={selected}
                  onClick={() => onSelect(node.id)}
                >
                  <span className="exploded-iso-chip-swatch" style={{ background: color }} />
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
