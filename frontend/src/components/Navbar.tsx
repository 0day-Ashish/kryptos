import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const services = [
  { title: "Wallet Analyzer", href: "/services/audio-visual" },
  { title: "Lighting Design", href: "/services/lighting" },
  { title: "Stage Production", href: "/services/staging" },
  { title: "Event Management", href: "/services/event-management" },
  { title: "Live Streaming", href: "/services/streaming" },
  { title: "Content Creation", href: "/services/content" },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isServicesHovered, setIsServicesHovered] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <nav className={`fixed top-0 w-full p-8 flex justify-between items-center z-50 transition-all duration-300 ${isScrolled ? 'bg-black/90 backdrop-blur-md py-4' : 'bg-transparent'}`}>
        <div className="text-4xl font-bold tracking-wider font-[family-name:var(--font-nuqun)]">KRYPTOS</div>
        <div className="hidden md:flex gap-12 items-center text-sm tracking-widest font-[family-name:var(--font-spacemono)] relative">
          <Link href="/" className="hover:opacity-70 transition-opacity">[ HOME ]</Link>

          {/* Services Link with Hover Area */}
          <div
            className="relative"
            onMouseEnter={() => setIsServicesHovered(true)}
            onMouseLeave={() => setIsServicesHovered(false)}
          >
            <Link href="/" className="hover:opacity-70 transition-opacity cursor-pointer">SERVICES</Link>
          </div>

          <Link href="/analyze" className="hover:opacity-70 transition-opacity">ANALYZE</Link>
          <Link href="/about" className="hover:opacity-70 transition-opacity">ABOUT US</Link>
        </div>
        <Link href="/contact" className="hidden md:block text-sm tracking-widest hover:opacity-70 transition-opacity font-[family-name:var(--font-spacemono)]">
          CONTACT
        </Link>
      </nav>

      {/* Full width mega menu */}
      <AnimatePresence>
        {isServicesHovered && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed top-0 left-0 w-full bg-black/95 backdrop-blur-xl z-40 border-b border-white/10 flex items-center justify-center pt-28 pb-12"
            onMouseEnter={() => setIsServicesHovered(true)}
            onMouseLeave={() => setIsServicesHovered(false)}
          >
            <div className="max-w-7xl mx-auto w-full px-8 md:px-24">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                {services.map((service, index) => (
                  <Link
                    key={index}
                    href={service.href}
                    className="group block"
                    onClick={() => setIsServicesHovered(false)}
                  >
                    <h3 className="text-3xl font-[family-name:var(--font-nuqun)] text-zinc-400 group-hover:text-white group-hover:translate-x-4 transition-all duration-300">
                      {service.title}
                    </h3>
                    <div className="h-[1px] w-0 group-hover:w-full bg-[#4ADE80] mt-2 transition-all duration-500 ease-out" />
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
