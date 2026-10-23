import { describe, expect, it } from "vitest";
import { getPersonaDefinition, orderPersonaNavigation, parsePersonaPreference, personaRecommendationHref, personas } from "../apps/web/lib/persona-experience";

describe("audience browsing preferences", () => {
  it("treats missing, corrupt and privilege-like values as a public browsing preference", () => {
    for (const value of [null, undefined, "", "admin", "root", { id: "industry" }, "{\"role\":\"researcher\"}"]) {
      expect(parsePersonaPreference(value)).toBeNull();
      expect(getPersonaDefinition(value).id).toBe("explorer");
    }
    for (const persona of personas) expect(parsePersonaPreference(persona.id)).toBe(persona.id);
  });

  it("offers distinct useful starts without dropping or mutating navigation groups", () => {
    const groups = [{ id: "maps" }, { id: "products" }, { id: "data" }, { id: "future-module" }];
    expect(orderPersonaNavigation(groups, "explorer")[0]?.id).toBe("maps");
    expect(orderPersonaNavigation(groups, "industry")[0]?.id).toBe("products");
    expect(orderPersonaNavigation(groups, "researcher")[0]?.id).toBe("data");
    for (const persona of personas) {
      const ordered = orderPersonaNavigation(groups, persona.id);
      expect(ordered).toHaveLength(groups.length);
      expect(new Set(ordered)).toEqual(new Set(groups));
      expect(ordered.at(-1)?.id).toBe("future-module");
    }
    expect(groups.map(group => group.id)).toEqual(["maps", "products", "data", "future-module"]);
  });

  it("resolves research recommendations from the selected published product context", () => {
    const research = getPersonaDefinition("researcher").recommendations.find(item => item.destination === "provenance")!;
    expect(personaRecommendationHref(research, { provenance: "/products/another-product/provenance" })).toBe("/products/another-product/provenance");
    expect(personaRecommendationHref(research, {})).toBe("/products");
    for (const persona of personas) for (const recommendation of persona.recommendations) {
      expect(personaRecommendationHref(recommendation, { provenance: "/products/example/provenance" })).toMatch(/^\/(?!\/)/);
    }
  });
});
