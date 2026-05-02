import type { Metadata } from "next";
import { Caveat, Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-caveat",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "乱画实验室 — 把照片变成随手涂鸦",
  description: "从真实，到随性。",
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
    <html
      lang="zh-CN"
      className={`${instrumentSerif.variable} ${caveat.variable} ${inter.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
