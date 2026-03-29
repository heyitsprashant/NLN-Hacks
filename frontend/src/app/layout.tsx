import type { Metadata } from "next";
import { Nunito, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import AppShell from "@/components/site/AppShell";
import GlobalCursorBg from "@/components/ui/GlobalCursorBg";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Antara | Your Inner Voice",
  description: "Your mental health journal, insights, and AI copilot.",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}
    >
      <body>
        <GlobalCursorBg>
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </GlobalCursorBg>
      </body>
    </html>
  );
}
