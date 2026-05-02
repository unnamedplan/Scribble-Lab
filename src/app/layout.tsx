import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "乱画实验室",
  description: "从真实，到随性。把照片变成随手涂鸦。",
  icons: {
    icon: [{ url: "/samples/generated/logo.jpg", type: "image/jpeg" }],
    apple: [{ url: "/samples/generated/logo.jpg", type: "image/jpeg" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
