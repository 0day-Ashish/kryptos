"use client"

import { usePathname } from "next/navigation"
import Navbar from "@/components/layout/navbar"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLandingPage = pathname === "/"

  return (
    <>
      {isLandingPage && <Navbar />}
      {children}
    </>
  )
}
