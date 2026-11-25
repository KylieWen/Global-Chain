"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import type { MapTransform } from "../lib/map-geometry";
import type { FlowSettings } from "../lib/flow-config";
import type { AdaptiveLevel } from "../lib/flow-encoding";
import type { BeamDiagnostics, BeamFlow, BeamRenderer } from "./beam-types";
import { BeamCanvas2DLayer } from "./beam-canvas2d-layer";

export type { BeamFlow, BeamDiagnostics, BeamFlowState } from "./beam-types";

/**
 * Force-renderer switch for regression scripts and manual fallback. Stored
 * separately from the serializable theme config so it never touches URL sync
 * or token validation:
 * - `localStorage.getItem("globechain-map-renderer") === "canvas2d"` forces the
 *   Canvas2D fallback; any other value (including unset) uses WebGL when available.
 */
export const RENDERER_STORAGE_KEY = "globechain-map-renderer";

type LayerProps = {
  flows: readonly BeamFlow[];
  transform: MapTransform;
  settings: FlowSettings;
  level: AdaptiveLevel;
  nodeColor: string;
  scheme?: "dark" | "light";
  onDiagnostics?: (info: BeamDiagnostics) => void;
  onFrameSample?: (frameMs: number) => void;
};

type WebGLLayerProps = LayerProps & { onFallback?: () => void };

function readForcedRenderer(): BeamRenderer | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(RENDERER_STORAGE_KEY);
    if (value === "canvas2d" || value === "webgl") return value;
  } catch {
    /* restricted storage: keep the default path */
  }
  return null;
}

/**
 * Orchestrator for the beam flow overlay. Tries the WebGL (three.js) renderer
 * first; falls back to the Canvas2D implementation when WebGL is unavailable,
 * the force-fallback switch is set, the adaptive tier drops past the WebGL
 * range, or the GL context is lost at runtime. The SVG keeps country geometry,
 * hit targets, keyboard access and the record drawer; this overlay stays
 * pointer-transparent.
 */
export function BeamFlowLayer(props: LayerProps) {
  const [renderer, setRenderer] = useState<BeamRenderer | null>(null);
  const webglRef = useRef<ComponentType<WebGLLayerProps> | null>(null);
  const { level } = props;

  useEffect(() => {
    const forced = readForcedRenderer();
    if (forced === "canvas2d" || level >= 2) {
      setRenderer("canvas2d");
      return;
    }
    let cancelled = false;
    import("./beam-webgl-layer")
      .then(mod => {
        if (cancelled) return;
        if (mod.probeWebGLAvailable()) {
          webglRef.current = mod.BeamWebGLLayer;
          setRenderer("webgl");
        } else {
          setRenderer("canvas2d");
        }
      })
      .catch(() => {
        if (!cancelled) setRenderer("canvas2d");
      });
    return () => { cancelled = true; };
  }, [level]);

  const WebGLLayer = webglRef.current;
  const activeRenderer = renderer ?? "pending";

  return (
    <div className="beam-layer-host" data-renderer={activeRenderer} aria-hidden="true">
      {renderer === "webgl" && WebGLLayer
        ? <WebGLLayer {...props} onFallback={() => setRenderer("canvas2d")} />
        : <BeamCanvas2DLayer {...props} />}
    </div>
  );
}
