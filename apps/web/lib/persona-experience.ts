import experience from "../../../content/audience-experience.json";

export type PersonaId = "explorer" | "industry" | "researcher";
export type PersonaRecommendation = { label: string; description: string; href?: string; destination?: string };
export type PersonaDefinition = {
  id: PersonaId;
  label: string;
  symbol: string;
  summary: string;
  focus: string;
  navigationOrder: readonly string[];
  recommendedHrefs: readonly string[];
  recommendations: readonly PersonaRecommendation[];
};

export const PERSONA_STORAGE_KEY = "global-chain.audience.v1";
export const personas = experience.personas as readonly PersonaDefinition[];
export const defaultPersona = experience.defaultPersona as PersonaId;

/** A browser preference never grants permissions or removes access to a module. */
export function parsePersonaPreference(value: unknown): PersonaId | null {
  return typeof value === "string" && personas.some(persona => persona.id === value) ? value as PersonaId : null;
}

export function getPersonaDefinition(value: unknown): PersonaDefinition {
  const id = parsePersonaPreference(value) ?? defaultPersona;
  return personas.find(persona => persona.id === id)!;
}

export function orderPersonaNavigation<T extends { id: string }>(groups: readonly T[], value: unknown): T[] {
  const order = getPersonaDefinition(value).navigationOrder;
  const rank = (id: string) => { const index = order.indexOf(id); return index < 0 ? order.length : index; };
  return [...groups].sort((left, right) => rank(left.id) - rank(right.id));
}

export function personaRecommendationHref(recommendation: PersonaRecommendation, destinations: Readonly<Record<string, string>>): string {
  return recommendation.href ?? (recommendation.destination ? destinations[recommendation.destination] : undefined) ?? "/products";
}
