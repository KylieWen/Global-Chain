import { createHash } from "node:crypto";
import { getQueryService } from "../../../../../lib/data";

function safeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "export";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  const queries = await getQueryService();
  const researchExport = queries.getProductResearchExport(productId);

  if (!researchExport) {
    return Response.json(
      { error: "not_found", message: "该商品没有可发布的研究快照。" },
      { status: 404 }
    );
  }

  const body = `${JSON.stringify(researchExport, null, 2)}\n`;
  const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
  const contentVersion = researchExport.release.contentVersions
    .map((version) => version.version)
    .join(",");

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const filename = [
    safeFilenamePart(researchExport.productId),
    safeFilenamePart(researchExport.release.datasetVersion.version),
    "research-export.json"
  ].join("-");

  return new Response(body, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/json; charset=utf-8",
      ETag: etag,
      "X-GlobeChain-Dataset-Version": researchExport.release.datasetVersion.version,
      "X-GlobeChain-Content-Version": contentVersion
    }
  });
}
