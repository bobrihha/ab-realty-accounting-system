import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/app/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Система учета Агенства недвижимости АБ Риэлт Групп",
  description: "Система управленческого и финансового учета для агентства недвижимости (Сделки, P&L, Казначейство, Команда).",
  keywords: ["Недвижимость", "CRM", "P&L", "Казначейство", "Сделки", "Комиссии"],
  authors: [{ name: "Realty Agency" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Система учета Агенства недвижимости АБ Риэлт Групп",
    description: "Система учета сделок, финансов и казначейства.",
    siteName: "Realty Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Система учета Агенства недвижимости АБ Риэлт Групп",
    description: "Система учета сделок, финансов и казначейства.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
