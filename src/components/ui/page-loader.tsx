"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export default function PageLoader() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          setIsHidden(true);
        },
      });

      tl.fromTo(
        textRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
      )
        .fromTo(
          lineRef.current,
          { scaleX: 0 },
          { scaleX: 1, duration: 0.8, ease: "power2.inOut" },
          "-=0.3",
        )
        .to(overlayRef.current, {
          y: "-100%",
          duration: 0.8,
          ease: "power3.inOut",
          delay: 0.3,
        });
    });

    return () => ctx.revert();
  }, []);

  if (isHidden) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--bg-primary)]"
      aria-hidden
    >
      <span
        ref={textRef}
        className="font-quicktext text-4xl tracking-tight text-[var(--text-primary)] sm:text-5xl"
      >
        Kryptos
      </span>
      <div className="mt-6 h-px w-24 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          ref={lineRef}
          className="h-full origin-left bg-[var(--text-primary)]"
        />
      </div>
    </div>
  );
}
