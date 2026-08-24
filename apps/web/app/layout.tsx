import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GlobeChain",
  description: "GlobeChain engineering foundation"
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
