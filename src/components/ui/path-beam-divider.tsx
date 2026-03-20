"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface PathBeamDividerProps {
  className?: string;
}

export default function PathBeamDivider({ className = "" }: PathBeamDividerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        barRef.current,
        { scaleX: 0, opacity: 0 },
        {
          scaleX: 1,
          opacity: 1,
          duration: 1.5,
          ease: "power2.inOut",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        }
      );

      gsap.fromTo(
        glowRef.current,
        { x: "-100%" },
        {
          x: "100%",
          duration: 1.8,
          repeat: -1,
          ease: "power1.inOut",
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={`relative flex h-16 items-center justify-center overflow-hidden ${className}`}
    >
      <div className="relative h-1 w-40 overflow-hidden rounded-full bg-[var(--border)]">
        <div 
          ref={barRef}
          className="absolute inset-0 origin-left scale-x-0 rounded-full bg-[var(--text-primary)]"
        />
        <div 
          ref={glowRef}
          className="absolute inset-0 w-1/2 -translate-x-full rounded-full bg-gradient-to-r from-transparent via-[var(--text-primary)] to-transparent opacity-60 blur-sm"
        />
      </div>

      <div className="absolute left-0 top-1/2 h-px w-[20%] -translate-y-1/2 bg-gradient-to-r from-transparent via-[var(--border)] to-transparent opacity-30" />
      <div className="absolute right-0 top-1/2 h-px w-[20%] -translate-y-1/2 bg-gradient-to-l from-transparent via-[var(--border)] to-transparent opacity-30" />
    </div>
  );
}
