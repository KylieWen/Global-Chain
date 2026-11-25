"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteNavigation } from "./site-navigation";
import { PersonaSwitcher } from "./persona-switcher";
import { SiteSearch } from "./site-search";
import { ThemeSwitcher } from "./theme-switcher";

/**
 * Top-level header shell. It is the first navigation layer on every page.
 * On the home page and the full world map the header floats over the page
 * canvas (transparent glass) instead of sitting on a solid bar.
 */
export function SiteHeader({ preview }: { preview: boolean }) {
  const pathname = usePathname() ?? "/";
  const overlay = pathname === "/" || pathname === "/map";
  // Scope the slimmer 64px header to the map pages only; the shared shell keeps
  // its default height everywhere else.
  const mapScope = pathname === "/map" || pathname.startsWith("/map/");
  return (
    <header className={`site-header${overlay ? " site-header--overlay" : ""}${mapScope ? " site-header--map" : ""}`}>
      <div className="site-header-inner">
        <Link className="brand" href="/" aria-label="Global Chain 首页">
          <span className="brand-mark" aria-hidden="true">G</span>
          <span className="brand-copy">
            <strong>Global Chain</strong>
            <small>全球商品供应链与贸易可视化</small>
          </span>
        </Link>
        <SiteNavigation />
        <PersonaSwitcher />
        <ThemeSwitcher />
        <SiteSearch />
        {preview ? <span className="mode-pill mode-preview">开发预览</span> : null}
      </div>
    </header>
  );
}
