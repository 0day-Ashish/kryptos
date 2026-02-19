"use client";

import Navbar from "@/components/Navbar";
import { Mail, MapPin, Phone, Send } from "lucide-react";

export default function Contact() {
  return (
    <main className="min-h-screen text-white overflow-hidden relative font-[family-name:var(--font-nuqun)]">
      <Navbar />

      <section className="min-h-screen flex flex-col justify-center px-8 md:px-24 pt-32 pb-20 relative">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-16 lg:gap-24">

          {/* Contact Info */}
          <div className="flex flex-col justify-center">
            <h1 className="text-6xl md:text-8xl font-medium tracking-wider mb-8 leading-[0.9]">
              Get in Touch
            </h1>
            <p className="text-xl text-zinc-300 font-[family-name:var(--font-spacemono)] mb-12 max-w-lg">
              Have a project in mind? We'd love to hear from you. Let's create something extraordinary together.
            </p>

            <div className="space-y-8 font-[family-name:var(--font-spacemono)]">
              <div className="flex items-start gap-6">
                <div className="bg-white/10 p-4 rounded-full">
                  <MapPin className="w-6 h-6 text-[#4ADE80]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1">Our Studio</h3>
                  <p className="text-zinc-400">Via Cimabue, 20<br />42014, Castellarano<br />Reggio Emilia — Italy</p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="bg-white/10 p-4 rounded-full">
                  <Mail className="w-6 h-6 text-[#4ADE80]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1">Email Us</h3>
                  <a href="mailto:hello@kryptos.com" className="text-zinc-400 hover:text-white transition-colors">hello@kryptos.com</a>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="bg-white/10 p-4 rounded-full">
                  <Phone className="w-6 h-6 text-[#4ADE80]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1">Call Us</h3>
                  <a href="tel:+390555123456" className="text-zinc-400 hover:text-white transition-colors">+39 0555 123 456</a>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white/5 backdrop-blur-sm p-8 md:p-12 rounded-[2rem] border border-white/10">
            <form className="space-y-6 font-[family-name:var(--font-spacemono)]">
              <div className="space-y-2">
                <label className="text-sm uppercase tracking-wider text-zinc-400">Name</label>
                <input
                  type="text"
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-4 focus:outline-none focus:border-[#4ADE80] transition-colors text-white"
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm uppercase tracking-wider text-zinc-400">Email</label>
                <input
                  type="email"
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-4 focus:outline-none focus:border-[#4ADE80] transition-colors text-white"
                  placeholder="john@example.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm uppercase tracking-wider text-zinc-400">Message</label>
                <textarea
                  rows={4}
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-4 focus:outline-none focus:border-[#4ADE80] transition-colors text-white resize-none"
                  placeholder="Tell us about your issue..."
                />
              </div>

              <button className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-[#4ADE80] transition-colors flex items-center justify-center gap-3 group">
                Send Message
                <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </div>

        </div>
      </section>
    </main>
  );
}
