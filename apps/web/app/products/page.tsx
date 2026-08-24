import { getQueryService } from "../../lib/data";
import { ProductCatalogPage } from "../../components/product-catalog";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const queries = await getQueryService();
  return <ProductCatalogPage products={queries.listProducts()} />;
}
