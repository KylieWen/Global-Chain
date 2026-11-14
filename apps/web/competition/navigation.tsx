import type { ComponentProps } from "react";
import { useSyncExternalStore } from "react";

const eventName = "globechain-static-navigation";

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(eventName, listener);
  };
}

export function useLocation() {
  return useSyncExternalStore(subscribe, () => window.location.href);
}

export function useRouter() {
  return {
    push(href: string, options?: { scroll?: boolean }) {
      window.history.pushState(null, "", href);
      window.dispatchEvent(new Event(eventName));
      if (options?.scroll !== false) window.scrollTo(0, 0);
    }
  };
}

export default function Link({ href, onClick, ...props }: ComponentProps<"a"> & { href: string }) {
  const router = useRouter();
  return <a {...props} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || props.target || !href.startsWith("/") || href.startsWith("//")) return;
    event.preventDefault();
    router.push(href);
  }} />;
}
