import type { ProductFixture } from "@globe-chain/contracts";

/** Recursively read-only representation used by query consumers. */
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? ReadonlyArray<DeepReadonly<U>>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type ReadonlyProductFixture = DeepReadonly<ProductFixture>;

export interface FixtureRepository {
  listProductIds(): readonly string[];
  getProductFixture(productId: string): ReadonlyProductFixture | undefined;
}

export class RepositoryInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryInvariantError";
  }
}

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }

  return value as DeepReadonly<T>;
}

/**
 * Creates an immutable in-memory repository. It is deliberately free of file
 * system concerns so the same domain queries can later use a database adapter.
 */
export function createInMemoryFixtureRepository(
  fixtures: readonly ReadonlyProductFixture[]
): FixtureRepository {
  const byProductId = new Map<string, ReadonlyProductFixture>();

  for (const fixture of fixtures) {
    if (byProductId.has(fixture.productId)) {
      throw new RepositoryInvariantError(
        `Duplicate product fixture: ${fixture.productId}`
      );
    }
    byProductId.set(fixture.productId, deepFreeze(fixture));
  }

  const productIds = Object.freeze([...byProductId.keys()]);

  return Object.freeze({
    listProductIds: () => productIds,
    getProductFixture: (productId: string) => byProductId.get(productId)
  });
}
