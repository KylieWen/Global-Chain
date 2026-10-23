"use client";

export function RouteStepLink({ targetId, children, className }: { targetId: string; children: React.ReactNode; className: string }) {
  return <a className={className} href={`#${targetId}`} onClick={event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const target = document.getElementById(targetId);
    if (target instanceof HTMLDetailsElement) {
      target.open = true;
      // Let the native fragment navigation scroll first, then continue keyboard
      // reading at the new step rather than leaving focus on the document body.
      window.requestAnimationFrame(() => target.querySelector("summary")?.focus({ preventScroll: true }));
    }
  }}>{children}</a>;
}
