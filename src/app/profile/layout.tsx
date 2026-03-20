import type { Metadata } from "next"
import "@/app/globals.css"
import Sidebar from "@/components/dashboard/sidebar"
import Header from "@/components/dashboard/header"

export const metadata: Metadata = {
  title: "KRYPTOS — Profile",
  description: "Manage your account and subscription",
}

export default function ProfileLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-black">
        <Sidebar />
        <div className="pl-64">
          <Header />
          <main className="pt-16">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}