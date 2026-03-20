"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const stats = [
  { value: 14, suffix: "B+", prefix: "$", label: "In crypto fraud losses (2023)" },
  { value: 14, suffix: "", prefix: "", label: "EVM chains supported" },
  { value: 50, suffix: "+", prefix: "", label: "Wallets per batch scan" },
  { value: 26, suffix: "+", prefix: "", label: "REST API endpoints" },
  { value: 32, suffix: "+", prefix: "", label: "Behavioral ML features" },
  { value: 100, suffix: "", prefix: "0–", label: "AI-powered risk scores" },
];

export default function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const countersRef = useRef<(HTMLSpanElement | null)[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(headerRef.current, {
        y: 60,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
      });

      if (gridRef.current) {
        gsap.from(gridRef.current.children, {
          y: 40,
          opacity: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: gridRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        });
      }

      countersRef.current.forEach((el, i) => {
        if (!el) return;
        const target = { val: 0 };

        gsap.to(target, {
          val: stats[i].value,
          duration: 2.5,
          ease: "power3.out",
          scrollTrigger: {
            trigger: gridRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
          onUpdate: () => {
            const num = Math.round(target.val);
            el.textContent = `${stats[i].prefix}${num}${stats[i].suffix}`;
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[var(--bg-secondary)] px-6 py-28 sm:px-8 lg:px-12"
    >
      <div className="relative mx-auto max-w-6xl">
        <div ref={headerRef} className="mb-16 text-center">
          <p className="font-sans text-xs uppercase tracking-[0.4em] text-[var(--text-secondary)]">
            By The Numbers
          </p>
        </div>
        <div ref={gridRef} className="grid grid-cols-2 gap-x-6 gap-y-14 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((stat, i) => (
            <div key={stat.label} className="text-center">
              <span
                ref={(el) => {
                  countersRef.current[i] = el;
                }}
                className="font-sans text-4xl font-medium tracking-[-0.04em] text-[var(--text-primary)] sm:text-5xl"
              >
                {stat.prefix}0{stat.suffix}
              </span>
              <p className="mt-3 font-sans text-xs leading-snug text-[var(--text-secondary)] sm:text-sm">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
