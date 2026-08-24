export type WebDataMode = "preview" | "published";

/**
 * Resolves the visibility boundary for the current Web request/build.
 * All environments default to published fixtures; draft data is an explicit
 * preview choice and is never silently promoted.
 */
export function getWebDataMode(): WebDataMode {
  if (process.env.GLOBECHAIN_DATA_MODE === "published") return "published";
  if (
    process.env.GLOBECHAIN_DATA_MODE === "preview" &&
    (process.env.NODE_ENV !== "production" || process.env.GLOBECHAIN_ALLOW_DRAFT === "true")
  ) {
    return "preview";
  }
  return "published";
}

export function isPreviewData(): boolean {
  return getWebDataMode() === "preview";
}
