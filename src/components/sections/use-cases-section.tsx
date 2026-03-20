"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const useCases = [
  {
    id: "01",
    title: "Pre-Transaction Safety",
    description:
      "Paste any wallet address and get an instant 0–100 risk score powered by Isolation Forest + GNN ensemble before sending funds.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-7 w-7"
      >
        <path
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "02",
    title: "Bulk KYC/AML Screening",
    description:
      "Batch-analyze up to 50 wallet addresses at once via paste or CSV upload to flag sanctioned, mixer-linked, or high-risk wallets.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-7 w-7"
      >
        <path
          d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "03",
    title: "Fund Flow Tracing",
    description:
      "Trace the path of stolen funds through multiple intermediary wallets up to 5 hops deep across all 14 supported EVM chains.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-7 w-7"
      >
        <path
          d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "04",
    title: "Chrome Extension",
    description:
      "Coming soon: hover over any address on Etherscan, BscScan, or PolygonScan and see its risk score instantly without leaving the page.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-7 w-7"
      >
        <path
          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.257.26-2.453.725-3.541"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "05",
    title: "On-Chain Risk Registry",
    description:
      "Every analysis is stored on Base Sepolia, creating a permanent, public, decentralized database of wallet risk scores.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-7 w-7"
      >
        <path
          d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function UseCasesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(headerRef.current, {
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
      });

      if (cardsRef.current) {
        gsap.from(cardsRef.current.children, {
          y: 60,
          opacity: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.1,
          scrollTrigger: {
            trigger: cardsRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[var(--bg-primary)] px-6 py-32 sm:px-8 lg:px-12"
    >
      <div className="relative mx-auto max-w-7xl">
        <div ref={headerRef} className="max-w-3xl">
          <p className="font-sans text-xs uppercase tracking-[0.4em] text-[var(--text-secondary)]">
            Use Cases
          </p>
          <h2 className="mt-5 font-sans text-4xl leading-[0.94] tracking-[-0.03em] text-[var(--text-primary)] sm:text-6xl">
            A versatile suite for every stakeholder in Web3
          </h2>
          <p className="mt-6 font-sans text-lg leading-relaxed text-[var(--text-secondary)]">
            From everyday crypto users to exchange compliance teams — Kryptos
            provides the intelligence layer that makes blockchain safety
            accessible.
          </p>
        </div>

        <div
          ref={cardsRef}
          className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {useCases.map((uc) => (
            <div
              key={uc.id}
              className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-7 transition-colors duration-300 hover:border-[var(--text-primary)]/40 hover:bg-[var(--bg-secondary)]"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors group-hover:border-[var(--text-primary)]/30 group-hover:bg-[var(--bg-secondary)]">
                  {uc.icon}
                </div>
                <span className="font-sans text-sm tracking-tight text-[var(--text-secondary)]">
                  [{uc.id}]
                </span>
              </div>
              <h3 className="mt-5 font-sans text-xl tracking-[-0.02em] text-[var(--text-primary)]">
                {uc.title}
              </h3>
              <p className="mt-3 font-sans text-sm leading-relaxed text-[var(--text-secondary)]">
                {uc.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
