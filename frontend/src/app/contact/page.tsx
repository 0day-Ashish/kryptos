"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Mail,
  MapPin,
  MessageSquare,
  Send,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

const queryTypes = [
  "General Inquiry",
  "Bug Report",
  "Feature Request",
  "Partnership",
  "Enterprise / Bulk Screening",
  "Other",
];

const contactInfo = [
  {
    icon: <MapPin className="w-5 h-5 text-[#4ADE80]" />,
    label: "Location",
    value: "Sector 1, Salt Lake City\nKolkata, West Bengal, India",
  },
  {
    icon: <Mail className="w-5 h-5 text-[#4ADE80]" />,
    label: "Email",
    value: "hello@kryptos.dev",
    href: "mailto:hello@kryptos.dev",
  },
  {
    icon: <MessageSquare className="w-5 h-5 text-[#4ADE80]" />,
    label: "Discord",
    value: "discord.gg/kryptos",
    href: "https://discord.gg/kryptos",
  },
];

export default function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    queryType: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate submission
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setSubmitted(true);
  };

  const inputClass =
    "w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-[#4ADE80]/60 focus:bg-zinc-900 transition-all font-[family-name:var(--font-spacemono)] text-sm";

  const labelClass =
    "block text-xs uppercase tracking-widest text-zinc-500 mb-2 font-[family-name:var(--font-spacemono)]";

  return (
    <main className="min-h-screen text-white relative font-[family-name:var(--font-nuqun)] overflow-x-hidden">
      <Navbar />

      {/* Hero */}
      <section className="pt-36 pb-16 px-8 text-center relative">
        {/* Glow blob */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#4ADE80]/5 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <span className="inline-block text-xs uppercase tracking-[0.3em] text-[#4ADE80] font-[family-name:var(--font-spacemono)] mb-6 border border-[#4ADE80]/20 px-4 py-2 rounded-full">
            Contact Us
          </span>
          <h1 className="text-5xl md:text-8xl font-medium leading-[0.9] mb-6">
            Let's Talk
          </h1>
          <p className="text-zinc-400 text-lg font-[family-name:var(--font-spacemono)] max-w-xl mx-auto">
            Have a question, found a bug, or want to partner with us? We're
            right here.
          </p>
        </motion.div>
      </section>

      {/* Main Content */}
      <section className="px-8 pb-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-12">

          {/* Left — Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col gap-6"
          >
            {/* Info Cards */}
            {contactInfo.map((info, i) => (
              <div
                key={i}
                className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex items-start gap-5 hover:border-zinc-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[#4ADE80]/10 flex items-center justify-center flex-shrink-0">
                  {info.icon}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-zinc-500 font-[family-name:var(--font-spacemono)] mb-1">
                    {info.label}
                  </p>
                  {info.href ? (
                    <a
                      href={info.href}
                      className="text-zinc-200 font-[family-name:var(--font-spacemono)] text-sm hover:text-green-400 transition-colors whitespace-pre-line"
                    >
                      {info.value}
                    </a>
                  ) : (
                    <p className="text-zinc-200 font-[family-name:var(--font-spacemono)] text-sm whitespace-pre-line">
                      {info.value}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Response Time */}
            <div className="bg-gradient-to-br from-[#4ADE80]/10 to-[#3B82F6]/5 border border-[#4ADE80]/20 rounded-2xl p-6">
              <p className="text-xs uppercase tracking-widest text-[#4ADE80] font-[family-name:var(--font-spacemono)] mb-2">
                Response Time
              </p>
              <p className="text-zinc-300 font-[family-name:var(--font-spacemono)] text-sm leading-relaxed">
                We typically respond within{" "}
                <span className="text-white font-bold">24–48 hours</span> on
                business days. For urgent issues, reach us on Discord.
              </p>
            </div>
          </motion.div>

          {/* Right — Query Form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 md:p-10 backdrop-blur-sm"
          >
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center py-16 gap-6"
              >
                <div className="w-16 h-16 rounded-full bg-[#4ADE80]/15 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-[#4ADE80]" />
                </div>
                <h3 className="text-3xl font-[family-name:var(--font-nuqun)]">
                  Message Sent!
                </h3>
                <p className="text-zinc-400 font-[family-name:var(--font-spacemono)] text-sm max-w-sm">
                  Thanks for reaching out. We'll get back to you within 24–48
                  hours.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setForm({ name: "", email: "", queryType: "", subject: "", message: "" });
                  }}
                  className="mt-4 text-[#4ADE80] text-sm font-[family-name:var(--font-spacemono)] hover:underline flex items-center gap-2"
                >
                  Send another message <ArrowRight size={14} />
                </button>
              </motion.div>
            ) : (
              <>
                <h2 className="text-2xl md:text-3xl font-[family-name:var(--font-nuqun)] mb-8">
                  Send a Query
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Name + Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className={labelClass}>Your Name *</label>
                      <input
                        name="name"
                        type="text"
                        required
                        value={form.name}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="Ashish Das"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Email Address *</label>
                      <input
                        name="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="ashish@example.com"
                      />
                    </div>
                  </div>

                  {/* Query Type */}
                  <div>
                    <label className={labelClass}>Query Type *</label>
                    <select
                      name="queryType"
                      required
                      value={form.queryType}
                      onChange={handleChange}
                      className={`${inputClass} appearance-none cursor-pointer`}
                    >
                      <option value="" disabled>
                        Select a category...
                      </option>
                      {queryTypes.map((type) => (
                        <option
                          key={type}
                          value={type}
                          className="bg-zinc-900"
                        >
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className={labelClass}>Subject *</label>
                    <input
                      name="subject"
                      type="text"
                      required
                      value={form.subject}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="Brief summary of your query"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label className={labelClass}>Message *</label>
                    <textarea
                      name="message"
                      required
                      rows={5}
                      value={form.message}
                      onChange={handleChange}
                      className={`${inputClass} resize-none`}
                      placeholder="Describe your query in detail..."
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white text-black font-bold py-4 rounded-xl hover:bg-[#4ADE80] transition-all font-[family-name:var(--font-spacemono)] text-sm disabled:opacity-60 group"
                  >
                    {loading ? (
                      <span className="animate-pulse">Sending...</span>
                    ) : (
                      <>
                        Send Message
                        <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </section>

      
    </main>
  );
}
