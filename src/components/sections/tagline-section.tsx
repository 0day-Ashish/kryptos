"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import WorldMap from "@/components/ui/world-map";

gsap.registerPlugin(ScrollTrigger);

const floatingCoins = [
  {
    src: "/images/coin.jpeg",
    alt: "Ethereum",
    size: 120,
    top: "8%",
    left: "82%",
    rotate: -12,
    delay: 0,
  },
  {
    src: "/images/coin2.jpeg",
    alt: "Bitcoin",
    size: 90,
    top: "18%",
    left: "6%",
    rotate: 15,
    delay: 0.3,
  },
  {
    src: "/images/coin.jpeg",
    alt: "Ethereum",
    size: 70,
    top: "55%",
    left: "90%",
    rotate: 8,
    delay: 0.6,
  },
  {
    src: "/images/coin2.jpeg",
    alt: "Bitcoin",
    size: 140,
    top: "68%",
    left: "2%",
    rotate: -20,
    delay: 0.15,
  },
  {
    src: "/images/coin.jpeg",
    alt: "Ethereum",
    size: 55,
    top: "38%",
    left: "95%",
    rotate: 22,
    delay: 0.45,
  },
  {
    src: "/images/coin2.jpeg",
    alt: "Bitcoin",
    size: 65,
    top: "82%",
    left: "78%",
    rotate: -8,
    delay: 0.7,
  },
  {
    src: "/images/coin.jpeg",
    alt: "Ethereum",
    size: 50,
    top: "5%",
    left: "45%",
    rotate: 30,
    delay: 0.9,
  },
  {
    src: "/images/coin2.jpeg",
    alt: "Bitcoin",
    size: 45,
    top: "75%",
    left: "50%",
    rotate: -15,
    delay: 0.5,
  },
];

const walletFlows = [
  {
    start: { lat: 37.7749, lng: -122.4194, label: "San Francisco" },
    end: { lat: 1.3521, lng: 103.8198, label: "Singapore" },
  },
  {
    start: { lat: 51.5072, lng: -0.1276, label: "London" },
    end: { lat: 25.2048, lng: 55.2708, label: "Dubai" },
  },
  {
    start: { lat: 35.6762, lng: 139.6503, label: "Tokyo" },
    end: { lat: -33.8688, lng: 151.2093, label: "Sydney" },
  },
  {
    start: { lat: 40.7128, lng: -74.006, label: "New York" },
    end: { lat: 52.52, lng: 13.405, label: "Berlin" },
  },
];

const mapPins = [
  {
    id: "sf-dex",
    lat: 37.7749,
    lng: -122.4194,
    title: "San Francisco DEX",
    detail: "$2.4M swap",
  },
  {
    id: "singapore-otc",
    lat: 1.3521,
    lng: 103.8198,
    title: "Singapore OTC",
    detail: "USDC routing",
  },
  {
    id: "london-bridge",
    lat: 51.5072,
    lng: -0.1276,
    title: "London Bridge",
    detail: "Cross-chain",
  },
  {
    id: "dubai-fund",
    lat: 25.2048,
    lng: 55.2708,
    title: "Dubai Treasury",
    detail: "$980K inflow",
  },
];

export default function TaglineSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const coinsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const heading = headingRef.current;
      if (!heading) return;

      const text = heading.textContent || "";
      heading.innerHTML = "";

      const words = text.split(" ");
      words.forEach((word, wi) => {
        const wordSpan = document.createElement("span");
        wordSpan.className = "split-word";

        word.split("").forEach((char) => {
          const charSpan = document.createElement("span");
          charSpan.className = "split-char";
          charSpan.textContent = char;
          wordSpan.appendChild(charSpan);
        });

        heading.appendChild(wordSpan);

        if (wi < words.length - 1) {
          const space = document.createElement("span");
          space.className = "split-word";
          space.textContent = " ";
          heading.appendChild(space);
        }
      });

      gsap.from(heading.querySelectorAll(".split-char"), {
        y: 60,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.02,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(bodyRef.current, {
        y: 40,
        opacity: 0,
        duration: 0.8,
        delay: 0.4,
        ease: "power2.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(mapRef.current, {
        y: 50,
        opacity: 0,
        duration: 1,
        delay: 0.6,
        ease: "power3.out",
        scrollTrigger: {
          trigger: mapRef.current,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
      });

      coinsRef.current.forEach((coin, i) => {
        if (!coin) return;
        const config = floatingCoins[i];

        gsap.from(coin, {
          opacity: 0,
          scale: 0.5,
          duration: 0.8,
          delay: config.delay,
          ease: "back.out(1.4)",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        });

        gsap.to(coin, {
          y: "random(-18, 18)",
          duration: "random(2.5, 4)",
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: config.delay,
        });

        gsap.to(coin, {
          rotation: `random(-8, 8)`,
          duration: "random(3, 5)",
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: config.delay + 0.5,
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)] px-6 py-32 sm:px-8 lg:px-12"
    >
      {floatingCoins.map((coin, i) => (
        <div
          key={`${coin.alt}-${i}`}
          ref={(el) => {
            coinsRef.current[i] = el;
          }}
          className="pointer-events-none absolute z-0 opacity-0"
          style={{
            top: coin.top,
            left: coin.left,
            width: coin.size,
            height: coin.size,
            transform: `rotate(${coin.rotate}deg)`,
          }}
        >
          <Image
            src={coin.src}
            alt={coin.alt}
            width={coin.size}
            height={coin.size}
            className="h-full w-full rounded-full object-cover grayscale opacity-60 drop-shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
          />
        </div>
      ))}

      <div className="relative z-10 mx-auto max-w-6xl">
        <p className="font-sans text-xs uppercase tracking-[0.4em] text-[var(--text-secondary)]">
          [What is Kryptos?]
        </p>

        <h2
          ref={headingRef}
          className="mt-8 max-w-full font-sans text-4xl leading-tight tracking-tight text-[var(--text-primary)] sm:text-5xl lg:text-6xl"
        >
          Kryptos connects wallet flows, risk signals, and compliance data into
          one intelligence layer — catching threats before they escalate.
        </h2>

        <div
          ref={bodyRef}
          className="mt-12 grid gap-8 font-sans sm:grid-cols-3"
        >
          <div>
            <p className="text-lg font-medium text-[var(--text-primary)]">
              Investigators
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Trace fund flows across 14 chains with graph-based behavioral
              analysis and ML-scored risk.
            </p>
          </div>
          <div>
            <p className="text-lg font-medium text-[var(--text-primary)]">
              Compliance Teams
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Batch-screen wallets, check OFAC sanctions, and export PDF reports
              for audit trails.
            </p>
          </div>
          <div>
            <p className="text-lg font-medium text-[var(--text-primary)]">
              Everyday Users
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Verify any wallet&apos;s safety before transacting — instant risk
              score, zero expertise needed.
            </p>
          </div>
        </div>

        <div
          ref={mapRef}
          className="mt-16 rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl"
        >
          <WorldMap
            dots={walletFlows}
            pins={mapPins}
            className="aspect-[16/9]"
          />
        </div>
      </div>
    </section>
  );
}
