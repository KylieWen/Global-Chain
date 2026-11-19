import type { ComponentProps } from "react";
import { createContext, useContext, useSyncExternalStore } from "react";

const eventName = "globechain-static-navigation";

export const MapLinkContext = createContext<{ product: string; search: string } | null>(null);

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
  const map = useContext(MapLinkContext);
  let destination = href;
  if (map && href.startsWith("/products/")) {
    const target = new URL(href, window.location.origin);
    const productPath = `/products/${encodeURIComponent(map.product)}`;
    const isCurrentProduct = target.pathname === productPath || target.pathname.startsWith(`${productPath}/`);
    if (target.origin === window.location.origin && isCurrentProduct && target.pathname !== `${productPath}/supply-chain`) {
      target.searchParams.set("map", map.search);
      destination = target.pathname + target.search + target.hash;
    }
  }

  return <a {...props} href={destination} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || props.target || !destination.startsWith("/") || destination.startsWith("//")) return;
    event.preventDefault();
    router.push(destination);
  }} />;
}
