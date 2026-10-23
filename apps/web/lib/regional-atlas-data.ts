import "server-only";
import { RegionalAtlasSchema } from "@globe-chain/contracts";
import atlas from "../../../content/geography/china-supply-atlas-2026-10-23.json";

export function getChinaAtlas() {
  return RegionalAtlasSchema.parse(atlas);
}
