import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  IdSchema,
  NonEmptyStringSchema,
  ProductFixtureSchema,
  PublicationStatusSchema,
  type ProductFixture,
  type PublicationStatus
} from "@globe-chain/contracts";
import {
  createInMemoryFixtureRepository,
  type FixtureRepository,
  type ReadonlyProductFixture,
  deepFreeze
} from "@globe-chain/domain";
import { z } from "zod";

export const FixtureManifestEntrySchema = z.object({
  productId: IdSchema,
  path: NonEmptyStringSchema
});

export const FixtureManifestSchema = z
  .object({
    schemaVersion: NonEmptyStringSchema,
    fixtures: z.array(FixtureManifestEntrySchema)
  })
  .superRefine((manifest, context) => {
    const productIds = manifest.fixtures.map((entry) => entry.productId);
    const paths = manifest.fixtures.map((entry) => entry.path);
    if (new Set(productIds).size !== productIds.length) {
      context.addIssue({
        code: "custom",
        path: ["fixtures"],
        message: "Fixture manifest product IDs must be unique"
      });
    }
    if (new Set(paths).size !== paths.length) {
      context.addIssue({
        code: "custom",
        path: ["fixtures"],
        message: "Fixture manifest paths must be unique"
      });
    }
  });

export type FixtureManifest = z.infer<typeof FixtureManifestSchema>;

export const SUPPORTED_MANIFEST_SCHEMA_VERSION = "fixture-manifest.v1";
export const SUPPORTED_FIXTURE_SCHEMA_VERSION = "product-fixture.v1";

export interface FixtureLoadOptions {
  /** Defaults to published only. Draft previews must opt in explicitly. */
  readonly allowedStatuses?: readonly PublicationStatus[];
  /** Restricts fixture paths to the directory containing the manifest. */
  readonly restrictToManifestDirectory?: boolean;
}

export class FixtureLoaderError extends Error {
  readonly filePath?: string;
  readonly issues?: readonly string[];

  constructor(message: string, options?: { filePath?: string; issues?: readonly string[] }) {
    super(message);
    this.name = "FixtureLoaderError";
    this.filePath = options?.filePath;
    this.issues = options?.issues;
  }
}

function parseJson(text: string, filePath: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new FixtureLoaderError(`Invalid JSON in fixture file: ${detail}`, {
      filePath
    });
  }
}

function formatZodIssues(error: z.ZodError): readonly string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
    return `${path}: ${issue.message}`;
  });
}

export function parseFixtureManifest(input: unknown, sourcePath = "<memory>"): FixtureManifest {
  const result = FixtureManifestSchema.safeParse(input);
  if (!result.success) {
    throw new FixtureLoaderError("Invalid fixture manifest", {
      filePath: sourcePath,
      issues: formatZodIssues(result.error)
    });
  }
  if (result.data.schemaVersion !== SUPPORTED_MANIFEST_SCHEMA_VERSION) {
    throw new FixtureLoaderError(
      `Unsupported fixture manifest schema version: ${result.data.schemaVersion}`,
      { filePath: sourcePath }
    );
  }
  return result.data;
}

export function parseProductFixture(input: unknown, sourcePath = "<memory>"): ProductFixture {
  const result = ProductFixtureSchema.safeParse(input);
  if (!result.success) {
    throw new FixtureLoaderError("Invalid product fixture", {
      filePath: sourcePath,
      issues: formatZodIssues(result.error)
    });
  }
  if (result.data.schemaVersion !== SUPPORTED_FIXTURE_SCHEMA_VERSION) {
    throw new FixtureLoaderError(
      `Unsupported product fixture schema version: ${result.data.schemaVersion}`,
      { filePath: sourcePath }
    );
  }
  return result.data;
}

export async function loadFixtureManifest(filePath: string): Promise<FixtureManifest> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to read manifest";
    throw new FixtureLoaderError(`Unable to read fixture manifest: ${detail}`, { filePath });
  }
  return parseFixtureManifest(parseJson(text, filePath), filePath);
}

export async function loadFixtureFile(filePath: string): Promise<ReadonlyProductFixture> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to read fixture";
    throw new FixtureLoaderError(`Unable to read product fixture: ${detail}`, { filePath });
  }

  return deepFreeze(parseProductFixture(parseJson(text, filePath), filePath));
}

function resolveManifestEntryPath(
  manifestPath: string,
  entryPath: string,
  restrictToManifestDirectory: boolean
): string {
  if (isAbsolute(entryPath)) {
    throw new FixtureLoaderError("Fixture manifest paths must be relative", {
      filePath: manifestPath
    });
  }

  const baseDirectory = dirname(resolve(manifestPath));
  const resolvedPath = resolve(baseDirectory, entryPath);
  if (restrictToManifestDirectory) {
    const relativePath = relative(baseDirectory, resolvedPath);
    if (relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
      throw new FixtureLoaderError(
        "Fixture manifest entry resolves outside the manifest directory",
        { filePath: manifestPath }
      );
    }
  }
  return resolvedPath;
}

/**
 * Loads every fixture listed by a manifest and returns an immutable repository.
 * No partial repository is returned if any entry fails validation.
 */
export async function loadFixtureRepositoryFromManifest(
  manifestPath: string,
  options: FixtureLoadOptions = {}
): Promise<FixtureRepository> {
  const manifest = await loadFixtureManifest(manifestPath);
  const allowedStatuses = options.allowedStatuses
    ? new Set(options.allowedStatuses)
    : new Set<PublicationStatus>(["published"]);
  for (const status of allowedStatuses) {
    PublicationStatusSchema.parse(status);
  }

  const fixtures: ReadonlyProductFixture[] = [];
  for (const entry of manifest.fixtures) {
    const fixturePath = resolveManifestEntryPath(
      manifestPath,
      entry.path,
      options.restrictToManifestDirectory ?? true
    );
    const fixture = await loadFixtureFile(fixturePath);
    if (fixture.productId !== entry.productId) {
      throw new FixtureLoaderError(
        `Manifest productId does not match fixture productId: ${entry.productId} vs ${fixture.productId}`,
        { filePath: fixturePath }
      );
    }
    if (allowedStatuses.has(fixture.datasetVersion.status)) {
      fixtures.push(fixture);
    }
  }

  return createInMemoryFixtureRepository(fixtures);
}
