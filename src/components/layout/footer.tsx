"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Send, Loader2, CheckCircle2, Twitter, Github } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const DATA_CHARS = "u/)(L0DMCQj}{ZXYVIJK";
const COLS = 80;
const ROWS = 24;

function DataArtGraphic() {
  const rows = useMemo(() => {
    const result: string[][] = [];
    for (let r = 0; r < ROWS; r++) {
      const row: string[] = [];
      for (let c = 0; c < COLS; c++) {
        row.push(DATA_CHARS[Math.floor(Math.random() * DATA_CHARS.length)]);
      }
      result.push(row);
    }
    return result;
  }, []);

  return (
    <div
      className="relative mx-auto max-w-5xl overflow-hidden py-16"
      style={{
        maskImage:
          "radial-gradient(ellipse 70% 50% at 50% 50%, black 20%, transparent 70%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 70% 50% at 50% 50%, black 20%, transparent 70%)",
      }}
    >
      <pre
        className="font-mono text-[10px] leading-[14px] text-[var(--text-secondary)] font-features-[normal] sm:text-xs sm:leading-[16px]"
        style={{ letterSpacing: "0.08em" }}
      >
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-center">
            {row.map((char, ci) => {
              const dist = Math.sqrt(
                Math.pow(ci - COLS / 2, 2) + Math.pow(ri - ROWS / 2, 2),
              );
              const maxDist = Math.sqrt(
                Math.pow(COLS / 2, 2) + Math.pow(ROWS / 2, 2),
              );
              const opacity = Math.max(0.15, 0.7 - (dist / maxDist) * 0.6);
              return (
                <span key={ci} style={{ opacity }} className="inline-block">
                  {char}
                </span>
              );
            })}
          </div>
        ))}
      </pre>
    </div>
  );
}

const INPUT_CLASS =
  "w-full border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 font-sans text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--text-primary)] focus:outline-none";

export default function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dataArtRef = useRef<HTMLDivElement>(null);
  const copyrightRef = useRef<HTMLDivElement>(null);
  const watermarkRef = useRef<HTMLDivElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(contentRef.current?.children || [], {
        y: 50,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: {
          trigger: footerRef.current,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(dataArtRef.current, {
        opacity: 0,
        y: 30,
        duration: 1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: dataArtRef.current,
          start: "top 90%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(copyrightRef.current, {
        opacity: 0,
        y: 20,
        duration: 0.6,
        delay: 0.3,
        ease: "power2.out",
        scrollTrigger: {
          trigger: copyrightRef.current,
          start: "top 95%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.from(watermarkRef.current, {
        opacity: 0,
        scale: 0.8,
        duration: 1.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: watermarkRef.current,
          start: "top 95%",
          toggleActions: "play none none reverse",
        },
      });
    }, footerRef);

    return () => ctx.revert();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.append("access_key", "YOUR_WEB3FORMS_KEY");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.message ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    }
    setSubmitting(false);
  };

  return (
    <footer
      id="contact"
      ref={footerRef}
      className="relative overflow-hidden bg-[var(--bg-primary)] pt-24 pb-24"
    >
      <div
        ref={contentRef}
        className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-16 px-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8 lg:px-8 xl:px-12"
      >
        {/* Left column — Contact form */}
        <div>
          <h3 className="font-sans text-2xl tracking-[-0.02em] text-[var(--text-primary)] sm:text-3xl">
            Send us a message
          </h3>

          {success ? (
            <div className="mt-8 flex items-start gap-3 rounded-sm border border-green-500/30 bg-green-500/10 px-4 py-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
              <p className="font-sans text-sm text-green-500">
                Message sent! We&apos;ll get back to you soon.
              </p>
            </div>
          ) : (
            <form className="mt-8 space-y-3" onSubmit={handleSubmit}>
              <input
                type="hidden"
                name="access_key"
                value="YOUR_WEB3FORMS_KEY"
              />

              <input
                type="text"
                name="name"
                placeholder="Name"
                required
                disabled={submitting}
                className={INPUT_CLASS}
              />
              <input
                type="email"
                name="email"
                placeholder="Email"
                required
                disabled={submitting}
                className={INPUT_CLASS}
              />
              <textarea
                name="message"
                placeholder="Message"
                rows={4}
                required
                disabled={submitting}
                className={`${INPUT_CLASS} resize-none`}
              />

              {error && (
                <p className="font-sans text-xs text-red-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 border border-[var(--text-primary)] bg-[var(--text-primary)] px-6 py-3 font-sans text-xs uppercase tracking-[0.2em] text-[var(--bg-primary)] transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Message
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Middle column — Nav links */}
        <div>
          <nav className="flex flex-col gap-4 font-sans text-sm uppercase tracking-[0.2em] text-[var(--text-primary)]">
            <Link href="/" className="transition hover:opacity-60">
              Home
            </Link>
            <Link href="/team" className="transition hover:opacity-60">
              Team
            </Link>
            <Link href="/pricing" className="transition hover:opacity-60">
              Pricing
            </Link>
            <Link href="/docs" className="transition hover:opacity-60">
              Docs
            </Link>
            <a href="#contact" className="transition hover:opacity-60">
              Contact
            </a>
          </nav>
        </div>

        {/* Right column — Emails + social links */}
        <div>
          <div className="space-y-3 font-sans text-sm text-[var(--text-primary)]">
            <a
              href="mailto:contact@kryptos.io"
              className="block underline transition hover:no-underline hover:opacity-60"
            >
              contact@kryptos.io
            </a>
            <a
              href="mailto:team@kryptos.io"
              className="block underline transition hover:no-underline hover:opacity-60"
            >
              team@kryptos.io
            </a>
            <a
              href="mailto:partners@kryptos.io"
              className="block underline transition hover:no-underline hover:opacity-60"
            >
              partners@kryptos.io
            </a>
          </div>

          <div className="mt-8 space-y-2 font-sans text-sm text-[var(--text-primary)]">
            <Link
              href="/privacy"
              className="block underline transition hover:no-underline hover:opacity-60"
            >
              Privacy Policy
            </Link>
            <Link
              href="/legal"
              className="block underline transition hover:no-underline hover:opacity-60"
            >
              Legal Notice
            </Link>
          </div>

          {/* Social links */}
          <div className="mt-8 flex items-center gap-4">
            <a
              href="https://twitter.com/kryptosapp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter / X"
              className="flex h-9 w-9 items-center justify-center border border-[var(--border)] text-[var(--text-secondary)] transition hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]"
            >
              <Twitter className="h-4 w-4" />
            </a>

            {/* Discord */}
            <a
              href="https://discord.gg/CpVk7KGz"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
              className="flex h-9 w-9 items-center justify-center border border-[var(--border)] text-[var(--text-secondary)] transition hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028ZM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38Zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38Z" />
              </svg>
            </a>

            {/* GitHub */}
            <a
              href="https://github.com/kryptos-app"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="flex h-9 w-9 items-center justify-center border border-[var(--border)] text-[var(--text-secondary)] transition hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      <div ref={dataArtRef}>
        <DataArtGraphic />
      </div>

      <div
        ref={copyrightRef}
        className="relative z-10 mt-12 text-center font-sans text-sm text-[var(--text-secondary)]"
      >
        <p>© 2026</p>
        <p className="mt-1 font-quicktext tracking-tight text-[var(--text-primary)]">
          Kryptos
        </p>
        <p className="mt-1">Onchain intelligence.</p>
      </div>

      <div
        ref={watermarkRef}
        className="pointer-events-none absolute mx-auto -bottom-8 left-1/2 -translate-x-1/2 select-none font-quicktext text-[clamp(8rem,20vw,20rem)] font-black uppercase leading-none tracking-[-0.04em] text-[var(--text-secondary)]/20"
        aria-hidden
      >
        Kryptos
      </div>
    </footer>
  );
}
