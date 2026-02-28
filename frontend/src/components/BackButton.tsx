"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors font-[family-name:var(--font-spacemono)] text-sm tracking-wider group mb-6"
    >
      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
      BACK
    </button>
  );
}
