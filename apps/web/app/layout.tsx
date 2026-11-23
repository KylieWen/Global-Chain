import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import "./atlas-navigation.css";
import "./interaction.css";
import "./persona.css";
import "./mobile.css";
import "./map-focus.css";
import "./map-flow.css";

export const metadata: Metadata = {
  title: "Global Chain",
  description: "以可追溯数据阅读全球商品供应链与贸易链路"
};

// Read the persisted theme before first paint so the page does not flash
// between schemes. localStorage / matchMedia failures fall back to dark.
const themeBootScript = `(function(){try{var k="globechain-theme";var raw=null;try{raw=window.localStorage.getItem(k)}catch(e){}var mode="dark";if(raw){try{var c=JSON.parse(raw);if(c&&(c.mode==="dark"||c.mode==="light"||c.mode==="system")){mode=c.mode}}catch(e){}}var sysDark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;var dark=mode==="dark"||(mode==="system"&&sysDark);var r=document.documentElement;r.dataset.theme=dark?"dark":"light";r.style.colorScheme=r.dataset.theme;}catch(e){document.documentElement.dataset.theme="dark"}})();`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
