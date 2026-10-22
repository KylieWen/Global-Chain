import labels from "../../../content/catalog-presentation.json";

/** Navigation labels only. Source names, classifications and research exports stay intact. */
export function itemLabel(item: { readonly id: string; readonly name: string } | null | undefined): string {
  if (!item) return "未关联商品";
  return (labels as Readonly<Record<string, string>>)[item.id] ?? item.name;
}
