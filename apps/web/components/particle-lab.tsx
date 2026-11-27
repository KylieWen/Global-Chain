"use client";

/**
 * Particle-flow encoding lab. A deliberately isolated page: each row draws the
 * same three magnitudes (100亿 / 10亿 / 1亿) through a different encoding, so
 * the variants can be compared side by side before touching the real map.
 * Nothing here reads product data; it is a pure visual study.
 */
import { useEffect, useRef, useState } from "react";

const ROW = 86;
const LINE_GAP = 20;
const LENGTH = 660;
const PAD_X = 210;

type Values = { big: number; mid: number; small: number };
const VALUES: Values = { big: 1e10, mid: 1e9, small: 1e8 };
const normalise = (value: number) => Math.min(1, Math.max(0, (Math.log10(value) - 8) / 2));

type Settings = {
  count: (v: number) => number;
  radius: (v: number) => number;
  speed: (v: number) => number;
  trail: (v: number) => number;
  filaments: (v: number) => number;
  alpha: (v: number) => number;
  shape: "dot" | "arrow" | "cluster" | "bundle";
  note: string;
};

const ar = (fn: (v: number) => number) => fn;

const VARIANTS: { id: string; name: string; settings: Settings }[] = [
  {
    id: "A", name: "基准：三条完全一样的流",
    settings: { count: ar(() => 9), radius: ar(() => 1.6), speed: ar(() => 1), trail: ar(() => 10), filaments: ar(() => 1), alpha: ar(() => 0.75), shape: "dot", note: "对照组：不编码任何数值，唯一能看出差别的是线长。" }
  },
  {
    id: "B", name: "粒子数量线性",
    settings: { count: ar(v => 3 + v * 20), radius: ar(() => 1.6), speed: ar(() => 1), trail: ar(() => 10), filaments: ar(() => 1), alpha: ar(() => 0.75), shape: "dot", note: "数量与金额成正比，小流量只剩零星几个点。" }
  },
  {
    id: "C", name: "粒子数量平方（夸张）",
    settings: { count: ar(v => 2 + Math.pow(v, 1.8) * 34), radius: ar(() => 1.6), speed: ar(() => 1), trail: ar(() => 10), filaments: ar(() => 1), alpha: ar(() => 0.75), shape: "dot", note: "更陡的曲线，小流量几乎看不见。" }
  },
  {
    id: "D", name: "粒子尺寸",
    settings: { count: ar(() => 8), radius: ar(v => 0.9 + v * 2.8), speed: ar(() => 1), trail: ar(() => 10), filaments: ar(() => 1), alpha: ar(() => 0.75), shape: "dot", note: "数量固定，靠点的大小表达，远看像不同的星等。" }
  },
  {
    id: "E", name: "粒子速度",
    settings: { count: ar(() => 8), radius: ar(() => 1.6), speed: ar(v => 0.45 + v * 2.3), trail: ar(() => 10), filaments: ar(() => 1), alpha: ar(() => 0.75), shape: "dot", note: "快慢代表规模，静止截图看不出来，动起来才有效。" }
  },
  {
    id: "F", name: "尾迹长度",
    settings: { count: ar(() => 8), radius: ar(() => 1.7), speed: ar(() => 1), trail: ar(v => 4 + v * 46), filaments: ar(() => 1), alpha: ar(() => 0.75), shape: "dot", note: "重流量拉出长光带，轻流量只剩短线。" }
  },
  {
    id: "G", name: "细丝束条数",
    settings: { count: ar(() => 0), radius: ar(() => 1.3), speed: ar(() => 1), trail: ar(() => 10), filaments: ar(v => Math.round(1 + v * 6)), alpha: ar(() => 0.7), shape: "bundle", note: "用多条平行细丝的数量表达金额，像一束光纤。" }
  },
  {
    id: "H", name: "亮度",
    settings: { count: ar(() => 9), radius: ar(() => 1.7), speed: ar(() => 1), trail: ar(() => 12), filaments: ar(() => 1), alpha: ar(v => 0.3 + v * 0.65), shape: "dot", note: "只改透明度，最省性能，但弱流容易糊进背景。" }
  },
  {
    id: "I", name: "数量 + 尾迹（组合）",
    settings: { count: ar(v => 3 + v * 22), radius: ar(() => 1.7), speed: ar(() => 1), trail: ar(v => 6 + v * 34), filaments: ar(() => 1), alpha: ar(() => 0.8), shape: "dot", note: "两条通道同时编码，弱流也有存在感。" }
  },
  {
    id: "J", name: "数量 + 尺寸（组合）",
    settings: { count: ar(v => 3 + v * 18), radius: ar(v => 1.1 + v * 1.8), speed: ar(() => 1), trail: ar(() => 12), filaments: ar(() => 1), alpha: ar(() => 0.8), shape: "dot", note: "点更多也更大，适合投影屏，一眼分得出主次。" }
  },
  {
    id: "K", name: "分档（离散五档）",
    settings: { count: ar(v => [2, 4, 7, 11, 16][Math.min(4, Math.floor(v * 5))]), radius: ar(() => 1.7), speed: ar(() => 1), trail: ar(() => 12), filaments: ar(() => 1), alpha: ar(() => 0.8), shape: "dot", note: "把金额切成五档，观众能数出来，代价是精度降低。" }
  },
  {
    id: "L", name: "箭头粒子",
    settings: { count: ar(v => 3 + v * 16), radius: ar(v => 2 + v * 3.4), speed: ar(() => 1), trail: ar(() => 14), filaments: ar(() => 1), alpha: ar(() => 0.85), shape: "arrow", note: "形状带方向，尺寸随金额，适合进出口需要区分方向的场景。" }
  },
  {
    id: "M", name: "脉冲串",
    settings: { count: ar(v => 3 + v * 12), radius: ar(() => 1.6), speed: ar(v => 0.8 + v * 0.6), trail: ar(() => 10), filaments: ar(() => 1), alpha: ar(() => 0.8), shape: "cluster", note: "粒子聚成簇，大流量簇多而密，读起来像心跳。" }
  },
  {
    id: "N", name: "束宽 + 数量",
    settings: { count: ar(v => 3 + v * 20), radius: ar(() => 1.5), speed: ar(() => 1), trail: ar(() => 12), filaments: ar(v => Math.round(1 + v * 4)), alpha: ar(() => 0.8), shape: "bundle", note: "先按金额铺开束宽，再往里填粒子，最接近现在地图的做法。" }
  }
];

type Particle = { t: number; speed: number; lane: number; span: number };

function buildParticles(v: number, settings: Settings): Particle[] {
  const count = Math.max(1, Math.round(settings.count(v)));
  return Array.from({ length: count }, (_, index) => ({
    t: index / count + Math.random() * 0.15,
    speed: settings.speed(v) * (0.85 + Math.random() * 0.3),
    lane: settings.shape === "bundle" ? (index % Math.max(1, settings.filaments(v))) / Math.max(1, settings.filaments(v) - 1 || 1) - 0.5 : (Math.random() - 0.5) * 0.4,
    span: settings.shape === "cluster" ? 0.06 + Math.random() * 0.1 : 0
  }));
}

export function ParticleLab() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const rows = VARIANTS.length;
    const height = rows * ROW + 30;
    const width = LENGTH + PAD_X + 62;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.scale(dpr, dpr);

    const pools = VARIANTS.map(variant => [VALUES.big, VALUES.mid, VALUES.small].map(value => ({
      value, v: normalise(value), particles: buildParticles(normalise(value), variant.settings)
    })));
    const speeds = [VALUES.big, VALUES.mid, VALUES.small].map(normalise); void speeds;
    let frame = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      context.clearRect(0, 0, width, height);
      pools.forEach((row, rowIndex) => {
        const variant = VARIANTS[rowIndex];
        const settings = variant.settings;
        const top = rowIndex * ROW + 12;
        row.forEach((line, lineIndex) => {
          const y = top + 14 + lineIndex * LINE_GAP;
          const x0 = PAD_X;
          const x1 = PAD_X + LENGTH;
          context.strokeStyle = "rgba(120, 190, 190, 0.16)";
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(x0, y);
          context.lineTo(x1, y);
          context.stroke();

          const alpha = settings.alpha(line.v);
          const radius = settings.radius(line.v);
          context.fillStyle = "rgba(160, 244, 220, 0.9)";
          context.strokeStyle = "rgba(160, 244, 220, 0.9)";
          context.save();
          context.beginPath();
          context.rect(x0 - 2, y - 13, LENGTH + 4, 26);
          context.clip();

          if (settings.shape === "bundle") {
            const filaments = Math.max(1, settings.filaments(line.v));
            for (let filament = 0; filament < filaments; filament += 1) {
              const offset = filaments === 1 ? 0 : (filament / (filaments - 1) - 0.5) * 12;
              context.strokeStyle = `rgba(140, 232, 208, ${0.2 + alpha * 0.5})`;
              context.lineWidth = 0.8;
              context.beginPath();
              context.moveTo(x0, y + offset);
              context.lineTo(x1, y + offset);
              context.stroke();
            }
          }

          line.particles.forEach(particle => {
            if (!pausedRef.current) particle.t += particle.speed * speedRef.current * dt * 0.22;
            if (particle.t > 1.05) particle.t -= 1.05;
            const x = x0 + particle.t * LENGTH;
            const lane = particle.lane * LINE_GAP;
            const trail = settings.trail(line.v);
            context.globalAlpha = alpha;
            if (trail > 0) {
              context.strokeStyle = `rgba(150, 240, 214, ${alpha * 0.55})`;
              context.lineWidth = Math.max(1, radius * 0.8);
              context.beginPath();
              context.moveTo(x - trail, y + lane);
              context.lineTo(x, y + lane);
              context.stroke();
            }
            if (settings.shape === "arrow") {
              context.beginPath();
              context.moveTo(x + radius * 1.6, y + lane);
              context.lineTo(x - radius, y + lane - radius * 0.7);
              context.lineTo(x - radius, y + lane + radius * 0.7);
              context.closePath();
              context.fillStyle = `rgba(190, 255, 238, ${alpha})`;
              context.fill();
            } else if (settings.shape === "cluster") {
              for (let dot = 0; dot < 3; dot += 1) {
                const lag = dot * particle.span * LENGTH;
                context.beginPath();
                context.arc(x - lag, y + lane, radius, 0, Math.PI * 2);
                context.fillStyle = `rgba(190, 255, 238, ${alpha * (1 - dot * 0.28)})`;
                context.fill();
              }
            } else {
              context.beginPath();
              context.arc(x, y + lane, radius, 0, Math.PI * 2);
              context.fillStyle = `rgba(200, 255, 240, ${alpha})`;
              context.fill();
            }
            context.globalAlpha = 1;
          });
          context.restore();
        });
        // Left column: title plus a two-line note. Magnitude tags sit after the line end.
        context.textAlign = "left";
        context.fillStyle = "#dff6ef";
        context.font = "600 13px system-ui, sans-serif";
        context.fillText(`${variant.id} · ${variant.name}`, 14, top + 16);
        context.fillStyle = "#7ea8a6";
        context.font = "400 10.5px system-ui, sans-serif";
        const noteChars = 15;
        const note = variant.settings.note;
        context.fillText(note.slice(0, noteChars), 14, top + 32);
        context.fillText(note.slice(noteChars, noteChars * 2), 14, top + 45);
        context.font = "600 11px system-ui, sans-serif";
        context.fillStyle = "rgba(170, 236, 220, 0.55)";
        ["100 亿", "10 亿", "1 亿"].forEach((label, index) => {
          context.fillText(label, PAD_X + LENGTH + 10, top + 18 + index * LINE_GAP);
        });
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#071720", color: "#e8f4f1", padding: "1.5rem 2rem 3rem", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "baseline", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.1rem", margin: 0 }}>粒子流编码实验 · 14 版</h1>
        <p style={{ margin: 0, color: "#8fb9b6", fontSize: ".82rem", maxWidth: "46rem" }}>
          每行都是同一条直线，只改变一种视觉通道，对比 100 亿 / 10 亿 / 1 亿三档。挑出你想要的编号，我再把它移植到地图上。
        </p>
        <div style={{ display: "flex", gap: ".5rem", marginLeft: "auto" }}>
          <button type="button" onClick={() => setPaused(value => !value)} style={{ padding: ".35rem .8rem", borderRadius: ".5rem", border: "1px solid #2f4c56", background: paused ? "#2c5c52" : "transparent", color: "inherit", cursor: "pointer" }}>
            {paused ? "继续" : "暂停"}
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: ".4rem", fontSize: ".78rem", color: "#9fd0c8" }}>
            速度
            <input type="range" min="0.3" max="2.4" step="0.1" value={speed} onChange={event => setSpeed(Number(event.target.value))} />
          </label>
        </div>
      </header>
      <canvas ref={canvasRef} style={{ display: "block", borderRadius: ".75rem", border: "1px solid #17313b", background: "#0a1c26" }} />
    </main>
  );
}
