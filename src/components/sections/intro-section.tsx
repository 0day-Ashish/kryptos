"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function IntroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLSpanElement>(null);
  const scrollLabelRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(logoRef.current, {
        opacity: 0,
        scale: 0.9,
        duration: 1,
        ease: "power3.out",
      });

      gsap.from(scrollLabelRef.current, {
        opacity: 0,
        y: 20,
        duration: 0.8,
        delay: 0.5,
        ease: "power2.out",
      });

      gsap.to(scrollLabelRef.current, {
        opacity: 0.5,
        duration: 1.4,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative flex h-screen min-h-screen flex-col items-center justify-center overflow-hidden bg-[#111111] px-6 text-center sm:px-8"
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute left-1/2 top-1/2 h-[150vh] w-auto min-w-full -translate-x-1/2 -translate-y-1/2 object-contain"
      >
        <source src="/images/bg.mp4" type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-black/60" />

      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

      <span
        ref={logoRef}
        className="relative z-10 font-quicktext text-[clamp(4rem,15vw,10rem)] leading-none tracking-tight text-white"
      >
        Kryptos
      </span>

      <p
        ref={scrollLabelRef}
        className="relative z-10 mt-16 font-sans text-xs uppercase tracking-[0.34em] text-[var(--text-primary)]"
      >
        Scroll to reveal
      </p>
    </section>
  );
}
