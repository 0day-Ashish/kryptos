import type { Metadata } from "next"
import "@/app/globals.css"
import PersistentBanner from "@/components/dashboard/persistent-banner"

export const metadata: Metadata = {
  title: "KRYPTOS — Blockchain Intelligence Dashboard",
  description:
    "Full-stack blockchain intelligence platform combining ML, graph neural networks, and on-chain data analysis across 14 EVM chains.",
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      {children}
      <PersistentBanner />
    </>
  )
}
