import type { Metadata } from "next"
import "./globals.css"
import Navbar from "@/components/layout/navbar"
import LenisProvider from "@/components/providers/lenis-provider"
import PageLoader from "@/components/ui/page-loader"
import { ThemeProvider } from "@/components/providers/theme-provider"
import ClientLayout from "@/components/layout/client-layout"
import { WalletProvider } from "@/lib/wallet"
import { SessionProvider } from "@/lib/session"

export const metadata: Metadata = {
  title: "Kryptos — Onchain Intelligence",
  description:
    "Full-stack blockchain intelligence platform combining ML, graph neural networks, and on-chain data analysis across 14 EVM chains.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <SessionProvider>
            <WalletProvider>
              <PageLoader />
              <LenisProvider>
                <ClientLayout>
                  {children}
                </ClientLayout>
              </LenisProvider>
            </WalletProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
