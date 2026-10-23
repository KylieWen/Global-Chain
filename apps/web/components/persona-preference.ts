"use client";

import { useSyncExternalStore } from "react";
import { getPersonaDefinition, parsePersonaPreference, PERSONA_STORAGE_KEY, type PersonaId } from "../lib/persona-experience";

const changeEvent = "global-chain:audience-change";
let memoryPreference: PersonaId | null = null;
let memoryOnly = false;

function snapshot(): PersonaId | null {
  if (typeof window === "undefined") return null;
  if (memoryOnly) return memoryPreference;
  try { return parsePersonaPreference(window.localStorage.getItem(PERSONA_STORAGE_KEY)); }
  catch { memoryOnly = true; return memoryPreference; }
}

function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === PERSONA_STORAGE_KEY || event.key === null) listener(); };
  window.addEventListener(changeEvent, listener);
  window.addEventListener("storage", storage);
  return () => { window.removeEventListener(changeEvent, listener); window.removeEventListener("storage", storage); };
}

function selectPersona(id: PersonaId) {
  if (!parsePersonaPreference(id)) return;
  memoryPreference = id;
  try { window.localStorage.setItem(PERSONA_STORAGE_KEY, id); } catch { memoryOnly = true; /* A restricted browser can still switch for this visit. */ }
  window.dispatchEvent(new Event(changeEvent));
}

export function usePersonaPreference() {
  const selected = useSyncExternalStore(subscribe, snapshot, () => null);
  return { persona: getPersonaDefinition(selected), hasChosen: selected !== null, selectPersona };
}
