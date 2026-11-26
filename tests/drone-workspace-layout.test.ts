import { describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { resolve } from "node:path";
import { droneAllSlots, droneSlotsForNode, slotPosition } from "../apps/web/lib/drone-workspace-layout";

const root = resolve(__dirname, "..");

describe("drone workstation layout mapping", () => {
  it("maps every published drone BOM node to a deterministic slot", async () => {
    const repository = await loadFixtureRepositoryFromManifest(resolve(root, "data/published/manifest.json"));
    const fixture = repository.getProductFixture("generic-camera-drone");
    expect(fixture).toBeTruthy();
    const nodeIds = new Set(fixture!.items.map((item) => item.id));

    const slots = droneAllSlots();
    const slotNodeIds = new Set(slots.map((slot) => slot.nodeId));
    for (const nodeId of nodeIds) {
      expect(slotNodeIds.has(nodeId), `missing slot for ${nodeId}`).toBe(true);
    }
    for (const slot of slots) {
      expect(nodeIds.has(slot.nodeId), `unknown slot node ${slot.nodeId}`).toBe(true);
    }
    // The single arm-assembly node expands to four corner slots.
    const armSlots = droneSlotsForNode("drone-arm");
    expect(armSlots).toHaveLength(4);
    for (const slot of armSlots) {
      expect(slot.tip).toBeTruthy();
    }
  });

  it("interpolates between assembled home and exploded spread without inventing offsets", () => {
    const [slot] = droneSlotsForNode("drone-core-board");
    const home = slot.home;
    const spread = slot.spread;
    const atHome = slotPosition(slot, 0);
    const atSpread = slotPosition(slot, 1);
    const mid = slotPosition(slot, 0.5);
    for (let i = 0; i < 3; i += 1) {
      expect(atHome[i]).toBeCloseTo(home[i], 6);
      expect(atSpread[i]).toBeCloseTo(spread[i], 6);
      expect(mid[i]).toBeCloseTo((home[i] + spread[i]) / 2, 6);
    }
  });
});
