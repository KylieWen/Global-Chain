import { expect, it } from "vitest";
import { itemLabel } from "../apps/web/lib/item-label";

it("normalizes navigation labels without changing source items or future products", () => {
  const original = { id: "generic-home-air-conditioner", name: "家用房间空调" };
  expect(itemLabel(original)).toBe("家用空调");
  expect(original.name).toBe("家用房间空调");
  expect(itemLabel({ id: "future-product", name: "新增商品" })).toBe("新增商品");
});
