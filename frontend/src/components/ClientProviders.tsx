"use client";

import { AuthProvider } from "@/context/AuthContext";
import LenisScroll from "@/components/LenisScroll";
import Footer from "@/components/Footer";
import { ReactNode } from "react";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LenisScroll>
        {children}
        <Footer />
      </LenisScroll>
    </AuthProvider>
  );
}
