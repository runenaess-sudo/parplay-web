import AuthSync from "@/components/AuthSync";
import Header from "@/components/Header/Header";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ParPlay",
  description: "ParPlay Web Platform",
  openGraph: {
    title: "ParPlay",
    description: "ParPlay Web Platform",
    images: ["/og/parplay-horizontal.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ParPlay",
    description: "ParPlay Web Platform",
    images: ["/og/parplay-horizontal.png"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header />
        <AuthSync />
        {children}
      </body>
    </html>
  );
}
