"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function CtaSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(bgRef.current, {
        opacity: 0,
        scale: 0.9,
        duration: 1.5,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(labelRef.current, {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(titleRef.current, {
        y: 50,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 70%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(descRef.current, {
        y: 40,
        opacity: 0,
        duration: 0.9,
        delay: 0.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 65%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(buttonsRef.current, {
        y: 30,
        opacity: 0,
        duration: 0.8,
        delay: 0.4,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 60%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(tagsRef.current?.children || [], {
        y: 20,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        delay: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 55%",
          toggleActions: "play none none reverse",
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[var(--bg-primary)] px-6 pb-32 pt-24 sm:px-8 lg:px-12"
    >
      <div ref={bgRef} className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-0 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[var(--text-secondary)]/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <p 
          ref={labelRef}
          className="font-sans text-xs uppercase tracking-[0.4em] text-[var(--text-secondary)]"
        >
          Get Started
        </p>

        <h2 
          ref={titleRef}
          className="mt-6 font-sans text-[clamp(2.4rem,6vw,5.8rem)] uppercase leading-[0.9] tracking-[-0.04em] text-[var(--text-primary)]"
        >
          Ready to secure your onchain operations?
        </h2>

        <p 
          ref={descRef}
          className="mt-8 max-w-2xl font-sans text-lg leading-relaxed text-[var(--text-secondary)]"
        >
          Start scanning wallets, auditing contracts, and tracing fund flows
          across 14 EVM chains — powered by ML intelligence.
        </p>

        <div ref={buttonsRef} className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/auth"
            className="rounded-full bg-[var(--text-primary)] px-8 py-3.5 font-sans text-sm tracking-tight text-[var(--bg-primary)] shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition hover:opacity-80 hover:shadow-[0_6px_24px_rgba(0,0,0,0.2)]"
          >
            Get Started
          </Link>
          <Link
            href="/docs"
            className="rounded-full border border-[var(--border)] px-8 py-3.5 font-sans text-sm tracking-tight text-[var(--text-primary)] transition hover:bg-[var(--bg-secondary)]"
          >
            Read the Docs
          </Link>
        </div>

        <div ref={tagsRef} className="mt-16 flex flex-wrap items-center justify-center gap-8 font-sans text-xs text-[var(--text-secondary)]">
          <span>14 EVM Chains</span>
          <span className="h-3 w-px bg-[var(--border)]" />
          <span>ML-Powered</span>
          <span className="h-3 w-px bg-[var(--border)]" />
          <span>On-Chain Registry</span>
          <span className="h-3 w-px bg-[var(--border)]" />
          <span>Open API</span>
        </div>
      </div>
    </section>
  );
}
