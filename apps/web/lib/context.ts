export type PageContext = {
  period?: string;
  datasetVersion?: string;
  contentVersion?: string;
  label?: string;
};

export type SearchParamsLike = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function readPageContext(params: SearchParamsLike): PageContext {
  return {
    period: firstParam(params.period),
    datasetVersion: firstParam(params.datasetVersion),
    contentVersion: firstParam(params.contentVersion),
    label: firstParam(params.label)
  };
}

export function contextQuery(context?: PageContext): string {
  if (!context) return "";
  const values = Object.entries(context).filter(([, value]) => Boolean(value)) as [string, string][];
  const query = new URLSearchParams(values);
  return query.size ? `?${query.toString()}` : "";
}

export function contextMismatch(context: PageContext, expected: { period: string; datasetVersion: string; contentVersion?: string | null }): string[] {
  const mismatches: string[] = [];
  if (context.period && context.period !== expected.period) mismatches.push(`期间 ${context.period} 不属于当前发布数据（当前为 ${expected.period}）`);
  if (context.datasetVersion && context.datasetVersion !== expected.datasetVersion) mismatches.push(`未找到所选数据版本 ${context.datasetVersion}，当前显示 ${expected.datasetVersion}`);
  if (context.contentVersion && context.contentVersion !== (expected.contentVersion ?? "")) mismatches.push(`内容版本 ${context.contentVersion} 不属于当前路线内容（当前为 ${expected.contentVersion ?? "未提供"}）`);
  return mismatches;
}
