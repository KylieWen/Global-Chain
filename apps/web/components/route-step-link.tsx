"use client";

export function RouteStepLink({ targetId, children, className }: { targetId: string; children: React.ReactNode; className: string }) {
  return <a className={className} href={`#${targetId}`} onClick={() => {
    const target = document.getElementById(targetId);
    if (target instanceof HTMLDetailsElement) target.open = true;
  }}>{children}</a>;
}
