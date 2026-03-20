"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import DashboardCarousel from "@/components/ui/dashboard-carousel";

gsap.registerPlugin(ScrollTrigger);

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(contentRef.current?.children || [], {
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(carouselRef.current, {
        y: 60,
        opacity: 0,
        duration: 1,
        delay: 0.3,
        ease: "power3.out",
        scrollTrigger: {
          trigger: carouselRef.current,
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
      className="relative overflow-hidden bg-[var(--bg-primary)] px-4 py-16 sm:px-8 lg:px-12"
    >
      <div ref={contentRef} className="relative mx-auto max-w-6xl text-center">
        <p className="font-sans text-xs uppercase tracking-[0.4em] text-[var(--text-secondary)]">
          Product Demo
        </p>
        
        <h2 className="mt-6 font-sans text-4xl font-medium leading-tight tracking-tight text-[var(--text-primary)] sm:text-5xl lg:text-6xl">
          Your operations, visualized
        </h2>
        
        <p className="mx-auto mt-6 max-w-2xl font-sans text-lg text-[var(--text-secondary)]">
          Experience the power of unified intelligence. Watch as wallet flows, 
          risk signals, and compliance data come together in real-time.
        </p>
      </div>

      <div ref={carouselRef} className="relative mx-auto mt-12 max-w-4xl">
        <DashboardCarousel />
      </div>
    </section>
  );
}
