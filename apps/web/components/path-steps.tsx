"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { productIdFromPathname, resolvePathSteps, type PathStepId } from "../lib/path-steps";

function PathStepsNav() {
  const pathname = usePathname() ?? "/";
  const params = useSearchParams();
  const productId = productIdFromPathname(pathname) ?? params.get("product") ?? undefined;
  const entityId = params.get("country") ?? undefined;
  const context = {
    period: params.get("period") ?? undefined,
    datasetVersion: params.get("datasetVersion") ?? undefined,
    contentVersion: params.get("contentVersion") ?? undefined,
    label: params.get("label") ?? undefined
  };
  const steps = resolvePathSteps({ pathname, productId, entityId, context });

  return (
    <nav className="path-steps" aria-label="探索路径：拆解 → 路线 → 账本">
      <ol>
        {steps.map((step, index) => (
          <li key={step.id} className={`path-step path-step-${step.id}${step.active ? " is-active" : ""}`}>
            {index > 0 ? <span className="path-step-separator" aria-hidden="true">→</span> : null}
            <Link href={step.href} aria-current={step.active ? "step" : undefined}>
              <span className="path-step-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="path-step-label">{step.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Three-step journey strip shared across the site; falls back to static markup outside Suspense. */
export function PathSteps() {
  return (
    <Suspense fallback={null}>
      <PathStepsNav />
    </Suspense>
  );
}

export type { PathStepId };
