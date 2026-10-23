"use client";

import Link from "next/link";
import { personas, personaRecommendationHref } from "../lib/persona-experience";
import { usePersonaPreference } from "./persona-preference";

export function PersonaHome({ provenanceHref }: { provenanceHref: string }) {
  const { persona, hasChosen, selectPersona } = usePersonaPreference();
  return <section className="persona-home" aria-labelledby="persona-home-title" data-persona={persona.id}>
    <div className="persona-home-heading"><div><p className="eyebrow">你的视角</p><h2 id="persona-home-title">你想怎样认识这条链？</h2></div><p>选择一个起点，也可以直接探索地图。</p></div>
    <div className="persona-choices" role="group" aria-label="选择浏览身份">
      {personas.map(option => <button className="persona-choice" key={option.id} type="button" aria-pressed={hasChosen && persona.id === option.id} onClick={() => selectPersona(option.id)}>
        <span className="persona-choice-symbol" aria-hidden="true">{option.symbol}</span><span><strong>{option.label}</strong><small>{option.summary}</small></span><span className="persona-choice-check" aria-hidden="true">{hasChosen && persona.id === option.id ? "✓" : "→"}</span>
      </button>)}
    </div>
    <div className="persona-recommendations" aria-label={`${persona.label}推荐路径`}>
      <p className="persona-focus" aria-live="polite"><span>{hasChosen ? `${persona.label} · 推荐` : "从这里开始"}</span><strong>{persona.focus}</strong></p>
      <div>{persona.recommendations.map(recommendation => <Link key={recommendation.label} href={personaRecommendationHref(recommendation, { provenance: provenanceHref })}><strong>{recommendation.label}<span aria-hidden="true"> ↗</span></strong><small>{recommendation.description}</small></Link>)}</div>
    </div>
  </section>;
}
