import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from 'next/font/local';
import "./globals.css";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const nuqun = localFont({
  src: '../../public/fonts/Nuqun-Regular.otf',
  variable: '--font-nuqun',
});

const spacemono = localFont({
  src: '../../public/fonts/SpaceMono-Regular.ttf',
  variable: '--font-spacemono',
});

export const metadata: Metadata = {
  title: "kryptos",
  description: "Is the wallet address safe dear?",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${nuqun.variable} ${spacemono.variable} antialiased`}
      >
        {children}
        <Footer />
      </body>
    </html>
  );
}
