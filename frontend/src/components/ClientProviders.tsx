"use client";

import { AuthProvider } from "@/context/AuthContext";
import LenisScroll from "@/components/LenisScroll";
import Footer from "@/components/Footer";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";

const NO_FOOTER_ROUTES = ["/docs"];

export default function ClientProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showFooter = !NO_FOOTER_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <AuthProvider>
      <LenisScroll>
        {children}
        {showFooter && <Footer />}
      </LenisScroll>
    </AuthProvider>
  );
}
