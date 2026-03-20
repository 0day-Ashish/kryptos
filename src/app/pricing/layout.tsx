"use client"

import Sidebar from "@/components/dashboard/sidebar"
import Header from "@/components/dashboard/header"

export default function PricingLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <div className="pl-64">
        <Header />
        <main className="pt-16">
          {children}
        </main>
      </div>
    </div>
  )
}
