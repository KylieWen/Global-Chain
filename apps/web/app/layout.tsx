import type { Metadata } from "next";
import "./globals.css";
import "./atlas-navigation.css";
import "./interaction.css";
import "./persona.css";
import "./mobile.css";

export const metadata: Metadata = {
  title: "Global Chain",
  description: "以可追溯数据阅读全球商品供应链与贸易链路"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
