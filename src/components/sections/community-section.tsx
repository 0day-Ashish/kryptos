"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function PuzzleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-7 w-7"
      aria-hidden="true"
    >
      <path
        d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-7 w-7"
      aria-hidden="true"
    >
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export default function CommunitySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const eyebrowRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Eyebrow label
      gsap.from(eyebrowRef.current, {
        y: 30,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
      });

      // Section heading
      gsap.from(headingRef.current, {
        y: 50,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          toggleActions: "play none none reverse",
        },
      });

      // Cards staggered entrance
      gsap.from([card1Ref.current, card2Ref.current], {
        y: 60,
        opacity: 0,
        duration: 0.85,
        stagger: 0.18,
        ease: "power3.out",
        scrollTrigger: {
          trigger: card1Ref.current,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[var(--bg-primary)] px-6 py-24 sm:px-8 lg:px-12"
    >
      {/* Section header */}
      <div className="relative mx-auto mb-16 max-w-7xl text-center">
        <p
          ref={eyebrowRef}
          className="font-array text-xs uppercase tracking-[0.4em] text-[var(--text-secondary)]"
        >
          Ecosystem
        </p>
        <h2
          ref={headingRef}
          className="font-array mt-5 text-4xl leading-[0.94] tracking-[-0.03em] text-[var(--text-primary)] sm:text-6xl"
        >
          Extend your reach
        </h2>
      </div>

      {/* Cards grid */}
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Card 1: Chrome Extension ── */}
        <div
          ref={card1Ref}
          className="group relative overflow-hidden rounded-3xl border border-[#1A1A1A] bg-[#0A0A0A] p-8 transition-colors duration-300 hover:border-[#2A2A2A] lg:p-10"
        >
          {/* Green glow blob */}
          <div
            className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full blur-[100px]"
            style={{ background: "rgba(0,255,148,0.05)" }}
            aria-hidden
          />
          {/* Top edge highlight on hover */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(0,255,148,0.4), transparent)",
            }}
            aria-hidden
          />

          <div className="relative flex flex-col gap-7 sm:flex-row sm:items-start">
            {/* Icon */}
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#1A1A1A] transition-colors duration-300 group-hover:border-[rgba(0,255,148,0.25)]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(0,255,148,0.12) 0%, rgba(0,204,118,0.06) 100%)",
                color: "#00FF94",
              }}
            >
              <PuzzleIcon />
            </div>

            <div className="flex-1">
              <p className="font-array text-xs uppercase tracking-[0.35em] text-[#00FF94]">
                Browser Extension
              </p>
              <h3 className="font-array mt-3 text-2xl leading-tight tracking-[-0.02em] text-white sm:text-3xl">
                Risk scores, right in your browser
              </h3>
              <p className="mt-4 font-array text-sm leading-relaxed text-[#888888] sm:text-base">
                Hover over any wallet address on Etherscan, BscScan, or
                PolygonScan and see its Kryptos risk score instantly — without
                leaving the page.
              </p>

              <div className="mt-8">
                <span
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-full px-6 py-3 font-array text-sm tracking-tight text-black opacity-70"
                  style={{ backgroundColor: "#00FF94" }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 4v16m8-8H4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Coming Soon
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 2: Discord Community ── */}
        <div
          ref={card2Ref}
          className="group relative overflow-hidden rounded-3xl border border-[#1A1A1A] bg-[#0A0A0A] p-8 transition-colors duration-300 hover:border-[#2A2A2A] lg:p-10"
        >
          {/* Purple glow blob */}
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full blur-[100px]"
            style={{ background: "rgba(88,101,242,0.07)" }}
            aria-hidden
          />
          {/* Top edge highlight on hover */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(88,101,242,0.5), transparent)",
            }}
            aria-hidden
          />

          <div className="relative flex flex-col gap-7 sm:flex-row sm:items-start">
            {/* Icon */}
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#1A1A1A] transition-colors duration-300 group-hover:border-[rgba(88,101,242,0.35)]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(88,101,242,0.15) 0%, rgba(88,101,242,0.06) 100%)",
                color: "#5865F2",
              }}
            >
              <DiscordIcon />
            </div>

            <div className="flex-1">
              <p
                className="font-array text-xs uppercase tracking-[0.35em]"
                style={{ color: "#5865F2" }}
              >
                Community
              </p>
              <h3 className="font-array mt-3 text-2xl leading-tight tracking-[-0.02em] text-white sm:text-3xl">
                Join 12,000+ Web3 security researchers
              </h3>
              <p className="mt-4 font-array text-sm leading-relaxed text-[#888888] sm:text-base">
                Get real-time alerts on flagged addresses, discuss emerging
                threats, and connect with the people building the future of
                on-chain security.
              </p>
              <p className="mt-2 font-array text-sm text-[#00FF94]">
                Telegram bot: @Kryptos_scan_bot
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="https://discord.gg/CpVk7KGz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-array text-sm tracking-tight text-white transition-all duration-300 hover:opacity-85 hover:shadow-[0_0_20px_rgba(88,101,242,0.4)]"
                  style={{ backgroundColor: "#5865F2" }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  Join Discord
                </Link>
                <Link
                  href="https://t.me/Kryptos_scan_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[#1A1A1A] bg-[#111111] px-6 py-3 font-array text-sm tracking-tight text-white transition-all duration-300 hover:border-[#2A2A2A] hover:bg-[#151515]"
                >
                  Open Telegram Bot
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
