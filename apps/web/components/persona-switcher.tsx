"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { personas } from "../lib/persona-experience";
import { usePersonaPreference } from "./persona-preference";

export function PersonaSwitcher() {
  const { persona, hasChosen, selectPersona } = usePersonaPreference();
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    const close = () => { if (menu.current) menu.current.open = false; };
    close();
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) close(); };
    const outsideFocus = (event: FocusEvent) => { if (!menu.current?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && menu.current?.open) { close(); menu.current.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outsideFocus);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outsideFocus); document.removeEventListener("keydown", escape); };
  }, [pathname, persona.id]);
  return <details className="persona-switcher" ref={menu} onToggle={event => {
    if (event.currentTarget.open) event.currentTarget.closest(".site-header")?.querySelectorAll(".nav-group[open]").forEach(group => group.removeAttribute("open"));
  }}>
    <summary aria-label={`切换浏览身份，当前${persona.label}`}><span aria-hidden="true">{persona.symbol}</span><span>{hasChosen ? persona.label : "选择身份"}</span><span aria-hidden="true">⌄</span></summary>
    <div className="persona-switcher-menu" role="group" aria-label="浏览身份选择">
      <p>选择你的浏览视角</p>
      {personas.map(option => <button key={option.id} type="button" aria-pressed={hasChosen && option.id === persona.id} onClick={() => { selectPersona(option.id); if (menu.current) { menu.current.open = false; menu.current.querySelector("summary")?.focus(); } }}>
        <span className="persona-option-symbol" aria-hidden="true">{option.symbol}</span>
        <span><strong>{option.label}</strong><small>{option.summary}</small></span>
        {hasChosen && option.id === persona.id ? <span aria-hidden="true">✓</span> : null}
      </button>)}
      <small className="persona-local-note">只调整推荐顺序，所有内容都可浏览。</small>
    </div>
  </details>;
}
