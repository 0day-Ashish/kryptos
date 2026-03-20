"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";

gsap.registerPlugin(ScrollTrigger);

const teamMembers = [
  {
    image: "/images/Ashish.jpg",
    name: "Ashish R. Das",
    role: "Full-Stack Web3 Dev",
    github: "https://github.com",
    twitter: "https://twitter.com",
    linkedin: "https://linkedin.com",
  },
  {
    image: "/images/Subham.jpeg",
    name: "Subham Karmakar",
    role: "Full-Stack Dev",
    github: "https://github.com",
    twitter: "https://twitter.com",
    linkedin: "https://linkedin.com",
  },
  {
    image: "/images/kaustav.jpeg",
    name: "Kaustav Kar",
    role: "Full-Stack Dev",
    github: "https://github.com",
    twitter: "https://twitter.com",
    linkedin: "https://linkedin.com",
  },
  {
    image: "/images/Leeza.jpg",
    name: "Leeza Bhowal",
    role: "UI/UX",
    github: "https://github.com",
    twitter: "https://twitter.com",
    linkedin: "https://linkedin.com",
  },
  {
    image: "/images/samriddhi.jpg",
    name: "Samriddhi Sinha",
    role: "Frontend & UI/UX",
    github: "https://github.com",
    twitter: "https://twitter.com",
    linkedin: "https://linkedin.com",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export default function TeamPage() {
  const sectionRef = useRef<HTMLElement>(null);
  const eyebrowRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const bgBlobRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(bgBlobRef.current, {
        opacity: 0,
        scale: 0.8,
        duration: 1.6,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(eyebrowRef.current, {
        y: 24,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(headingRef.current, {
        y: 48,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(subtitleRef.current, {
        y: 32,
        opacity: 0,
        duration: 0.9,
        delay: 0.12,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 70%",
          toggleActions: "play none none reverse",
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white">
      <Navbar />

      {/* ── Header ── */}
      <section
        ref={sectionRef}
        className="relative overflow-hidden bg-[var(--bg-primary)] px-6 pb-20 pt-32 sm:px-8 lg:px-12"
      >
        {/* Subtle background glow */}
        <div
          ref={bgBlobRef}
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden
        >
          <div
            className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/3 rounded-full blur-[160px]"
            style={{ background: "rgba(255,255,255,0.03)" }}
          />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <p
            ref={eyebrowRef}
            className="font-array text-xs uppercase tracking-[0.45em] text-[#555555]"
          >
            The Team
          </p>
          <h1
            ref={headingRef}
            className="font-array mt-5 text-[clamp(2.2rem,5.5vw,4.5rem)] leading-[1.0] tracking-[-0.03em] text-white"
          >
            Built by <span className="text-[#888888]">Team 0day</span>
          </h1>
          <p
            ref={subtitleRef}
            className="mx-auto mt-6 max-w-xl font-array text-base leading-relaxed text-[#555555] sm:text-lg"
          >
            A focused team of engineers and designers building open, trustworthy
            on-chain intelligence for everyone.
          </p>
        </div>
      </section>

      {/* ── Team grid ── */}
      <section className="bg-[var(--bg-primary)] px-6 pb-32 sm:px-8 lg:px-12">
        <motion.div
          className="mx-auto flex max-w-5xl flex-wrap justify-center gap-5"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {teamMembers.map((member) => (
            <motion.div
              key={member.name}
              variants={cardVariants}
              whileHover={{
                y: -5,
                transition: { duration: 0.22, ease: "easeOut" },
              }}
              className="group relative flex w-full flex-col items-center rounded-2xl border border-[#1A1A1A] bg-[#0A0A0A] p-8 text-center transition-colors duration-300 hover:border-[#2A2A2A] sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]"
            >
              {/* Top-edge glow on hover */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
                }}
                aria-hidden
              />

              {/* Photo */}
              <div className="relative h-24 w-24 overflow-hidden rounded-full border border-[#1A1A1A] grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:border-[#2A2A2A]">
                <Image
                  src={member.image}
                  alt={member.name}
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              </div>

              {/* Name & role */}
              <p className="mt-5 font-array text-base font-semibold leading-tight text-white">
                {member.name}
              </p>
              <span
                className="mt-2 inline-block rounded-full px-3 py-0.5 font-array text-[10px] uppercase tracking-[0.14em] text-[#888888]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {member.role}
              </span>

              {/* Social links */}
              <div className="mt-6 flex items-center gap-2">
                <Link
                  href={member.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${member.name} GitHub`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1A1A1A] text-[#444444] transition-colors duration-200 hover:border-[#333333] hover:text-white"
                >
                  <GitHubIcon />
                </Link>
                <Link
                  href={member.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${member.name} Twitter`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1A1A1A] text-[#444444] transition-colors duration-200 hover:border-[#333333] hover:text-white"
                >
                  <TwitterIcon />
                </Link>
                <Link
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${member.name} LinkedIn`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1A1A1A] text-[#444444] transition-colors duration-200 hover:border-[#333333] hover:text-white"
                >
                  <LinkedInIcon />
                </Link>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
