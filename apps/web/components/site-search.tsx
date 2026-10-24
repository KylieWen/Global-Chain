"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector("input")?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="site-search" ref={root} data-open={open}><button ref={button} type="button" className="mobile-search-toggle" aria-label={open ? "关闭搜索" : "打开搜索"} aria-expanded={open} aria-controls="site-search-panel" onClick={() => setOpen(value => !value)}>⌕</button><div id="site-search-panel" className="site-search-panel"><form className="global-search" action="/search" role="search"><label className="sr-only" htmlFor="global-search-input">搜索商品、国家或企业</label><input id="global-search-input" name="q" placeholder="搜索商品 / 国家 / 企业" /><button type="submit">搜索</button></form></div></div>;
}
