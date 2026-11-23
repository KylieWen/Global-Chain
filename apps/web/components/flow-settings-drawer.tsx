"use client";

import { useEffect, useRef, useState } from "react";
import { FLOW_MODES, FLOW_SETTING_RANGES, type FlowMode, type FlowSettings } from "../lib/flow-config";

type SliderKey = keyof FlowSettings;

const SLIDERS: readonly { key: SliderKey; label: string; hint: string; step: number; format: (value: number) => string }[] = [
  { key: "density", label: "粒子量", hint: "单位连线的粒子密度", step: 0.05, format: value => `${Math.round(value * 100)}%` },
  { key: "speed", label: "流动速度", hint: "粒子沿弧线行进的速度", step: 0.1, format: value => `${value.toFixed(1)}×` },
  { key: "beamWidth", label: "束宽", hint: "光束粗细，随金额档位叠加", step: 0.1, format: value => `${value.toFixed(1)}×` },
  { key: "glow", label: "辉光", hint: "节点汇聚与光束发光强度", step: 0.05, format: value => `${Math.round(value * 100)}%` },
  { key: "trail", label: "拖尾", hint: "粒子轨迹残留长度", step: 0.05, format: value => `${Math.round(value * 100)}%` },
  { key: "maxParticles", label: "粒子上限", hint: "同屏活动粒子硬上限", step: 20, format: value => `${Math.round(value)}` }
];

const MODE_LABELS: Record<FlowMode, string> = { beam: "粒子流", classic: "经典箭头" };

export function FlowSettingsDrawer({
  open,
  onClose,
  settings,
  flowMode,
  reducedMotion,
  onModeChange,
  onSettingsChange,
  onReset,
  onExport,
  onImport
}: {
  open: boolean;
  onClose: () => void;
  settings: FlowSettings;
  flowMode: FlowMode;
  reducedMotion: boolean;
  onModeChange: (mode: FlowMode) => void;
  onSettingsChange: (patch: Partial<FlowSettings>) => void;
  onReset: () => void;
  onExport: () => string;
  onImport: (raw: string) => { ok: boolean; warnings: string[] };
}) {
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  // Keep the latest close callback in a ref: the parent passes an inline
  // onClose, so a re-render after import/export commit would otherwise produce
  // a new reference, re-run the open effect and wipe the success message.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  const copyExport = async () => {
    const json = onExport();
    try {
      await navigator.clipboard.writeText(json);
      setMessage({ kind: "ok", text: "流动配置已复制，可粘贴分享给他人导入" });
    } catch {
      setMessage({ kind: "warn", text: "剪贴板不可用，可手动复制下方配置文本" });
      setImportText(json);
    }
  };

  const applyImport = () => {
    if (!importText.trim()) {
      setMessage({ kind: "error", text: "请先粘贴要导入的配置 JSON" });
      return;
    }
    const result = onImport(importText);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.warnings.join("；") });
      return;
    }
    setMessage({ kind: result.warnings.length ? "warn" : "ok", text: result.warnings.length ? `已导入，部分参数被忽略：${result.warnings.join("；")}` : "配置已导入并保存到本机" });
  };

  return (
    <div className="flow-drawer-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="flow-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="调节流动"
        tabIndex={-1}
        onClick={event => event.stopPropagation()}
      >
        <header className="flow-drawer-header">
          <h2>调节流动</h2>
          <button type="button" className="flow-drawer-close" aria-label="关闭流动设置" onClick={onClose}>×</button>
        </header>

        <div className="flow-drawer-body">
          <fieldset className="flow-mode-switch" aria-label="渲染模式">
            <legend>渲染模式</legend>
            {FLOW_MODES.map(mode => (
              <button
                key={mode}
                type="button"
                aria-pressed={flowMode === mode}
                onClick={() => onModeChange(mode)}
              >
                {MODE_LABELS[mode]}
              </button>
            ))}
          </fieldset>

          {reducedMotion && (
            <p className="flow-drawer-notice" role="status">系统已开启「减少动态」，粒子流已回退为静态连线；关闭系统偏好后可恢复动画。</p>
          )}

          <div className="flow-slider-list">
            {SLIDERS.map(slider => {
              const range = FLOW_SETTING_RANGES[slider.key];
              const value = settings[slider.key];
              return (
                <label key={slider.key} className="flow-slider">
                  <span className="flow-slider-head">
                    <span>{slider.label}</span>
                    <strong>{slider.format(value)}</strong>
                  </span>
                  <input
                    type="range"
                    min={range.min}
                    max={range.max}
                    step={slider.step}
                    value={value}
                    aria-label={slider.label}
                    onChange={event => onSettingsChange({ [slider.key]: Number(event.target.value) })}
                  />
                  <small>{slider.hint}</small>
                </label>
              );
            })}
          </div>

          <div className="flow-drawer-actions">
            <button type="button" onClick={onReset}>恢复默认</button>
            <button type="button" onClick={copyExport}>复制配置 JSON</button>
          </div>

          <div className="flow-import">
            <label htmlFor="flow-import-text">导入配置</label>
            <textarea
              id="flow-import-text"
              value={importText}
              onChange={event => setImportText(event.target.value)}
              placeholder='粘贴此前复制的配置 JSON，例如 {"version":1,"tokens":{"map":{...}}}'
              rows={4}
            />
            <button type="button" onClick={applyImport}>导入配置</button>
          </div>

          {message && <p className={`flow-drawer-message flow-message-${message.kind}`} role="status">{message.text}</p>}
        </div>
      </div>
    </div>
  );
}
