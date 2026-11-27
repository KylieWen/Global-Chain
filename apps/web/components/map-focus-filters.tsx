"use client";

import { useEffect, useState } from "react";
import {
  focusFilterCount, regionOptions, valueThresholds,
  type FocusFilterState, type TradeBalance, type TradeFlowDirection
} from "../lib/trade-focus-filters";

type Props = {
  state: FocusFilterState;
  onChange: (next: FocusFilterState) => void;
  kept: number;
  total: number;
  countryName: string;
};

const directionOptions: { id: TradeFlowDirection; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "in", label: "流入该国" },
  { id: "out", label: "流出该国" }
];

const balanceOptions: { id: TradeBalance; label: string }[] = [
  { id: "all", label: "不限" },
  { id: "surplus", label: "顺差" },
  { id: "deficit", label: "逆差" }
];

export function MapFocusFilters({ state, onChange, kept, total, countryName }: Props) {
  const [open, setOpen] = useState(false);
  // Open by default on wide screens where the panel fits beside the map; on
  // phones it would cover the map, so it starts collapsed.
  useEffect(() => { setOpen(window.innerWidth >= 900); }, []);
  const active = focusFilterCount(state);
  const toggleRegion = (id: string) => {
    const next = state.regions.includes(id)
      ? state.regions.filter(region => region !== id)
      : [...state.regions, id];
    onChange({ ...state, regions: next });
  };
  return (
    <div className="atlas-focus-filters" data-open={open} data-active={active > 0}>
      <div className="atlas-focus-filters-head">
        <button type="button" className="atlas-focus-filters-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>
          筛选 {countryName} 的流向
        </button>
        <span className="atlas-focus-filters-count">保留 {kept} / {total}</span>
        {active > 0 && (
          <button type="button" className="atlas-focus-filters-reset" onClick={() => onChange({ direction: "all", regions: [], balance: "all", minValue: 0 })}>
            清除 {active}
          </button>
        )}
      </div>
      {open && (
        <div className="atlas-focus-filters-body">
          <fieldset>
            <legend>流向</legend>
            {directionOptions.map(option => (
              <button key={option.id} type="button" aria-pressed={state.direction === option.id}
                onClick={() => onChange({ ...state, direction: option.id })}>{option.label}</button>
            ))}
          </fieldset>
          <fieldset>
            <legend>伙伴地区</legend>
            {regionOptions.map(option => (
              <button key={option.id} type="button" aria-pressed={state.regions.includes(option.id)}
                onClick={() => toggleRegion(option.id)}>{option.label}</button>
            ))}
          </fieldset>
          <fieldset>
            <legend>贸易关系</legend>
            {balanceOptions.map(option => (
              <button key={option.id} type="button" aria-pressed={state.balance === option.id}
                onClick={() => onChange({ ...state, balance: option.id })}>{option.label}</button>
            ))}
          </fieldset>
          <fieldset>
            <legend>伙伴规模</legend>
            {valueThresholds.map(option => (
              <button key={option.value} type="button" aria-pressed={state.minValue === option.value}
                onClick={() => onChange({ ...state, minValue: option.value })}>{option.label}</button>
            ))}
          </fieldset>
          <p className="atlas-focus-filters-note">顺差、逆差与规模按该国与每个伙伴的进出口合计判断；流向沿用申报国口径。</p>
        </div>
      )}
    </div>
  );
}
