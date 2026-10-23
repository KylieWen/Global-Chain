// Use the same browser transport as a visitor. Parse the complete response so a
// successful header or truncated download cannot count as a successful export.
export async function browserResearchExport(page, endpoint) {
  return page.evaluate(async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    const body = await response.text();
    const json = JSON.parse(body);
    return {
      status: response.status,
      datasetVersion: json.release?.datasetVersion?.version,
      bytes: new TextEncoder().encode(body).length
    };
  }, endpoint);
}
