"use client";
import { publishUsageEvent } from "../lib/usage-events";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { getPersonaDefinition, personas, type PersonaId } from "../lib/persona-experience";
import { chinaMapPath, mapPath, provenancePath } from "../lib/paths";
import { usePersonaPreference } from "./persona-preference";
import { ProductArtwork } from "./product-artwork";
import "./first-visit-guide.css";

const storageKey = "global-chain.first-visit-guide.v1";
const openEvent = "global-chain:open-first-visit-guide";
let dismissedThisVisit = false;

function hasSeenGuide(): boolean {
  if (dismissedThisVisit) return true;
  for (const store of ["localStorage", "sessionStorage"] as const) {
    try {
      const value = window[store].getItem(storageKey);
      if (value === "completed" || value === "skipped") return true;
    } catch { /* Browser storage can be restricted; the guide stays optional. */ }
  }
  return false;
}

function rememberGuide(value: "completed" | "skipped") {
  dismissedThisVisit = true;
  for (const store of ["localStorage", "sessionStorage"] as const) {
    try { window[store].setItem(storageKey, value); return; }
    catch { /* The in-memory preference still lasts for this visit. */ }
  }
}

export function GuideLauncher({ className }: { className?: string }) {
  return <button type="button" className={["guide-launcher", className].filter(Boolean).join(" ")} data-guide-action="open" onClick={() => window.dispatchEvent(new Event(openEvent))}>新手引导 <span aria-hidden="true">↗</span></button>;
}

type GuideProduct = { id: string; name: string };
const steps = ["挑一件商品", "选择视角", "开始探索"];

function keepGuideFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab" || event.ctrlKey || event.altKey || event.metaKey) return;
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (!first) { event.preventDefault(); event.currentTarget.focus(); return; }
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

export function FirstVisitGuide({ products }: { products: readonly GuideProduct[] }) {
  const router = useRouter();
  const { persona, selectPersona } = usePersonaPreference();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [personaId, setPersonaId] = useState<PersonaId>(persona.id);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const currentPersona = useRef(persona.id);
  currentPersona.current = persona.id;
  const firstProduct = products[0]?.id ?? "";
  const selectedProduct = products.find(product => product.id === productId) ?? products[0];
  const selectedPersona = getPersonaDefinition(personaId);

  const begin = useCallback(() => {
    if (!firstProduct) return;
    setProductId(firstProduct);
    setPersonaId(currentPersona.current);
    setStep(0);
    setOpen(true);
  }, [firstProduct]);

  useEffect(() => {
    window.addEventListener(openEvent, begin);
    if (!hasSeenGuide()) begin();
    return () => window.removeEventListener(openEvent, begin);
  }, [begin]);

  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!element.open) element.showModal();
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (open) title.current?.focus({ preventScroll: true });
  }, [open, step]);

  const dismiss = () => { publishUsageEvent("guide_skip"); rememberGuide("skipped"); setOpen(false); };
  const destination = personaId === "industry"
    ? { label: "中国地图", action: "进入中国地图", copy: "从省市和生产环节，继续查上下游与企业资料。", href: chinaMapPath({ product: selectedProduct?.id }) }
    : personaId === "researcher"
      ? { label: "来源与版本", action: "查看研究来源", copy: "对照资料年份与来源，再回到地图核验每条连接。", href: selectedProduct ? provenancePath(selectedProduct.id) : "/products" }
      : { label: "世界地图", action: "进入世界地图", copy: "先看跨国连接，再点开国家与生产环节。", href: mapPath({ product: selectedProduct?.id }) };
  const start = () => {
    selectPersona(personaId);
    rememberGuide("completed");
    publishUsageEvent("guide_complete");
    setOpen(false);
    router.push(destination.href);
  };

  if (!products.length) return null;
  return <dialog ref={dialog} className="first-visit-guide" aria-label="Global Chain 新手引导" aria-describedby="first-visit-guide-description" data-step={(["product", "persona", "preview"] as const)[step]} onKeyDown={keepGuideFocus} onCancel={event => { event.preventDefault(); dismiss(); }}>
    <div className="guide-layout">
      <aside className="guide-world" aria-hidden="true">
        <div className="guide-world-brand"><span>G</span> Global Chain</div>
        <GuideGlobe />
        <div className="guide-world-copy"><strong>把看不见的连接，<br />变成可以探索的地图。</strong><p>从身边出发，走进材料、制造与贸易。</p></div>
      </aside>
      <section className="guide-content">
        <div className="guide-topline"><span>欢迎来到 Global Chain</span><button type="button" className="guide-skip" data-guide-action="skip" onClick={dismiss}>跳过引导 <span aria-hidden="true">×</span></button></div>
        <ol className="guide-progress" aria-label="引导进度">{steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} data-complete={index < step}><span aria-hidden="true">{index < step ? "✓" : index + 1}</span><small>{label}</small></li>)}</ol>
        <div className="guide-step-content" key={step}>
          <h2 ref={title} tabIndex={-1}>{step === 0 ? "从一件商品，打开世界" : step === 1 ? "选择你的观察视角" : "准备好，沿着这条链出发"}</h2>
          <p id="first-visit-guide-description" className="guide-description">{step === 0 ? "选一件你熟悉的商品，看看它怎样连接原料、工厂与国家。" : step === 1 ? "你的兴趣决定探索的起点。进入后，随时可以切换视角。" : "这就是你的第一条探索路径。每一步都可以继续深入。"}</p>
          {step === 0 && <div className="guide-products" role="group" aria-label="选择探索商品">{products.map(product => <button type="button" className="guide-product" key={product.id} data-guide-product={product.id} aria-pressed={selectedProduct?.id === product.id} onClick={() => setProductId(product.id)}><ProductArtwork productId={product.id} decorative /><strong>{product.name}</strong><span className="guide-option-check" aria-hidden="true">{selectedProduct?.id === product.id ? "✓" : "+"}</span></button>)}</div>}
          {step === 1 && <div className="guide-personas" role="group" aria-label="选择浏览视角">{personas.map(option => <button type="button" key={option.id} data-guide-persona={option.id} aria-pressed={personaId === option.id} onClick={() => setPersonaId(option.id)}><span className="guide-persona-symbol" aria-hidden="true">{option.symbol}</span><span><strong>{option.label}</strong><small>{option.summary}</small></span><span className="guide-option-check" aria-hidden="true">{personaId === option.id ? "✓" : "+"}</span></button>)}</div>}
          {step === 2 && <div className="guide-preview"><div className="guide-preview-product"><ProductArtwork productId={selectedProduct?.id} decorative /><div><small>你的探索对象</small><h3>{selectedProduct?.name}</h3><span>{selectedPersona.label}</span></div></div><ol className="guide-path"><li><div><strong>{selectedProduct?.name}</strong><small>从一件熟悉的商品出发</small></div></li><li><div><strong>{selectedPersona.label}</strong><small>{selectedPersona.focus}</small></div></li><li><div><strong>{destination.label}</strong><small>{destination.copy}</small></div></li></ol></div>}
        </div>
        <footer className="guide-footer"><div>{step > 0 && <button type="button" className="guide-back" data-guide-action="back" onClick={() => setStep(value => value - 1)}>上一步</button>}{step < 2 ? <button type="button" className="guide-next" data-guide-action="next" onClick={() => setStep(value => value + 1)}>继续 <span aria-hidden="true">→</span></button> : <button type="button" className="guide-next" data-guide-action="start" onClick={start}>{destination.action} <span aria-hidden="true">→</span></button>}</div></footer>
        <p className="guide-footnote">无需注册，即可探索。引导可随时从“新手引导”重新打开。</p>
      </section>
    </div>
  </dialog>;
}

function GuideGlobe() {
  const id = useId().replace(/:/g, "");
  return <svg className="guide-globe" viewBox="0 0 600 600" fill="none" aria-hidden="true">
    <defs><radialGradient id={`${id}-ocean`} cx=".35" cy=".28" r=".8"><stop stopColor="#256da1" /><stop offset=".55" stopColor="#123c6d" /><stop offset="1" stopColor="#06172e" /></radialGradient><radialGradient id={`${id}-halo`}><stop offset=".56" stopColor="#6fd9f9" stopOpacity=".22" /><stop offset="1" stopColor="#6fd9f9" stopOpacity="0" /></radialGradient><clipPath id={`${id}-clip`}><circle cx="300" cy="300" r="184" /></clipPath><linearGradient id={`${id}-arc`}><stop stopColor="#65e3d0" stopOpacity=".1" /><stop offset=".5" stopColor="#97fff0" /><stop offset="1" stopColor="#87aaff" stopOpacity=".2" /></linearGradient></defs>
    <circle cx="300" cy="300" r="280" fill={`url(#${id}-halo)`} />
    <g className="guide-orbit-rings" stroke="#79c9ed"><ellipse cx="300" cy="300" rx="264" ry="108" transform="rotate(-28 300 300)" opacity=".15" /><ellipse cx="300" cy="300" rx="248" ry="137" transform="rotate(40 300 300)" opacity=".12" /></g>
    <circle cx="300" cy="300" r="184" fill={`url(#${id}-ocean)`} stroke="#6cb8e8" strokeOpacity=".5" />
    <g clipPath={`url(#${id}-clip)`}><g stroke="#88d7f6" strokeOpacity=".18"><ellipse cx="300" cy="300" rx="105" ry="184" /><ellipse cx="300" cy="300" rx="45" ry="184" /><ellipse cx="300" cy="300" rx="184" ry="70" /><ellipse cx="300" cy="300" rx="184" ry="135" /><path d="M116 300h368M300 116v368" /></g><g fill="#57aaad" fillOpacity=".55" stroke="#83d9d2" strokeOpacity=".3" strokeWidth="1.5"><path d="m166 185 42-14 32 16 18 38-20 16-9 35-28-4-11 20-27-25-15-45Z" /><path d="m213 292 34 9 24 34-10 45-17 37-12-28-9-23 2-32-16-23Z" /><path d="m301 181 30-21 29 9 13 22 40 7 23 36-19 24-34-9-10 20-31-13-16-33-18 1-14-21Z" /><path d="m309 263 34-4 33 27-10 39-22 37-21-12-16-42-14-21Z" /><path d="m405 365 29-6 25 20-7 22-32 4-20-17Z" /></g><path className="guide-globe-connection" d="M192 226Q280 115 405 242M219 324Q292 209 355 283M355 283Q424 288 431 383" stroke={`url(#${id}-arc)`} strokeWidth="2.5" strokeDasharray="6 5" /><g fill="#b2fff1"><circle cx="192" cy="226" r="4" /><circle cx="405" cy="242" r="4" /><circle cx="219" cy="324" r="4" /><circle cx="355" cy="283" r="4" /><circle cx="431" cy="383" r="4" /></g></g>
    <path d="M79 373Q287 188 524 237" stroke={`url(#${id}-arc)`} strokeWidth="2" /><circle className="guide-orbit-point" cx="483" cy="237" r="5" fill="#9df8df" />
  </svg>;
}
