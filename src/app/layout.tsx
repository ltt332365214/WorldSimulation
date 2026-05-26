import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "世界模拟引擎 | WorldSim Engine",
  description: "一套以客观世界模拟为核心目标的通用叙事游戏框架",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-900 text-amber-100 antialiased">
        {children}
      </body>
    </html>
  );
}