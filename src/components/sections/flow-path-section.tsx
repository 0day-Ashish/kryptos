"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const flowSteps = [
  {
    id: 1,
    title: "Wallet Input",
    description: "Paste any wallet address or batch upload CSV",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 10h.01M15 10h.01M9.5 15.5s1.5 1 2.5 1 2.5-1 2.5-1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 2,
    title: "Risk Analysis",
    description: "ML-powered risk scoring with anomaly detection",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 3,
    title: "Chain Tracing",
    description: "Trace fund flows across 14+ EVM chains",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 4,
    title: "Compliance Report",
    description: "Generate audit-ready PDF reports",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 5,
    title: "On-Chain Registry",
    description: "Permanently store results on blockchain",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function FlowPathSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 65%",
          toggleActions: "play none none reverse",
        },
      });

      if (pathRef.current) {
        const pathLength = pathRef.current.getTotalLength();
        gsap.set(pathRef.current, {
          strokeDasharray: pathLength,
          strokeDashoffset: pathLength,
        });
        tl.to(pathRef.current, {
          strokeDashoffset: 0,
          duration: 1.2,
          ease: "power2.inOut",
        });
      }

      if (stepsRef.current) {
        const children = stepsRef.current.children;
        tl.from(
          children,
          {
            y: 40,
            opacity: 0,
            duration: 0.6,
            stagger: 0.35,
            ease: "power3.out",
          },
          pathRef.current ? "-=0.6" : 0
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[var(--bg-secondary)] px-6 py-32 sm:px-8 lg:px-12"
    >
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-20 text-center">
          <p className="font-sans text-xs uppercase tracking-[0.4em] text-[var(--text-secondary)]">
            How It Works
          </p>
          <h2 className="mt-4 font-sans text-3xl tracking-[-0.03em] text-[var(--text-primary)] sm:text-5xl">
            Complete flow in 5 steps
          </h2>
        </div>

        <div className="relative">
          <svg
            className="pointer-events-none absolute left-0 right-0 top-0 h-20 w-full"
            preserveAspectRatio="none"
            viewBox="0 0 1200 200"
          >
            <path
              ref={pathRef}
              d="M 100 100 L 275 100 L 325 100 L 475 100 L 525 100 L 675 100 L 725 100 L 875 100 L 925 100 L 1100 100"
              fill="none"
              stroke="var(--text-secondary)"
              strokeLinecap="round"
              strokeWidth="2"
              className="opacity-30"
            />
          </svg>

          <div ref={stepsRef} className="relative z-10 grid grid-cols-1 gap-10 sm:grid-cols-5">
            {flowSteps.map((step) => (
              <div
                key={step.id}
                className="relative flex flex-col items-center text-center"
              >
                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] transition-all duration-300 hover:border-[var(--text-primary)] hover:scale-110">
                  {step.icon}
                </div>
                <div className="mt-6">
                  <p className="font-sans text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                    Step {step.id}
                  </p>
                  <h3 className="mt-2 font-sans text-lg font-semibold text-[var(--text-primary)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 font-sans text-sm text-[var(--text-secondary)] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
