import type { Metadata } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const res = await fetch(`${API_URL}/shared/${id}/meta`, {
      next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error("Not found");

    const meta = await res.json();
    if (meta.error) throw new Error(meta.error);

    const riskEmoji = meta.risk_score >= 75 ? "🔴" : meta.risk_score >= 40 ? "🟡" : "🟢";
    const title = `${riskEmoji} Risk Score: ${meta.risk_score}/100 — Kryptos Report`;
    const description = `Wallet ${meta.address.slice(0, 6)}...${meta.address.slice(-4)} scored ${meta.risk_score}/100 (${meta.risk_label}) on ${meta.chain_name}. Analyzed by Kryptos — AI-powered blockchain intelligence.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        siteName: "Kryptos",
        type: "website",
        url: `https://kryptos.app/report/${id}`,
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
      other: {
        "theme-color": meta.risk_score >= 75 ? "#f87171" : meta.risk_score >= 40 ? "#facc15" : "#4ADE80",
      },
    };
  } catch {
    return {
      title: "Shared Report — Kryptos",
      description: "View this wallet risk assessment on Kryptos — AI-powered blockchain intelligence.",
    };
  }
}

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
