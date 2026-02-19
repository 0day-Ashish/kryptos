"use client";

import { motion } from "framer-motion";
import { Github, Twitter, Linkedin } from "lucide-react";
import Image from "next/image";

const developers = [
  {
    name: "Ashish Ranjan Das",
    role: "Full Stack Developer",
    image: "/assets/ashish.JPG", // Placeholder, will likely need actual images or placeholders
    github: "https://github.com/0day-Ashish",
    twitter: "https://twitter.com/ashishranjandas",
    linkedin: "https://linkedin.com/in/ashishranjandas",
  },
  {
    name: "Aryadeep Roy",
    role: "Frontend Developer",
    image: "/assets/aryadeep.JPG", // Placeholder
    github: "https://github.com/subham12r",
    twitter: "https://twitter.com/subham12r",
    linkedin: "https://linkedin.com/in/subham12r",
  }
];

const Card3D = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      className="relative w-full max-w-sm mx-auto h-[400px] perspective-1000"
      initial="initial"
      whileHover="hover"
    >
      <motion.div
        className="w-full h-full relative preserve-3d transition-all duration-500 ease-out"
        variants={{
          initial: { rotateY: 0, scale: 1 },
          hover: { rotateY: 10, rotateX: -10, scale: 1.05, boxShadow: "0px 20px 40px rgba(0,0,0,0.4)" }
        }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

export default function Developers() {
  return (
    <section className="py-24 px-8 md:px-24">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl md:text-7xl font-bold mb-6 font-[family-name:var(--font-nuqun)] tracking-wide">
            Meet the <span className="text-zinc-500 font-[family-name:var(--font-caveat)] px-2">minds</span> behind
          </h2>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto font-[family-name:var(--font-spacemono)]">
            Passionate developers crafting digital experiences with precision and creativity.
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-12">
          {developers.map((dev, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              viewport={{ once: true }}
              className="w-full max-w-sm"
            >
              <Card3D>
                <div className="w-full h-full relative overflow-hidden rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl">
                  {/* Image */}
                  <Image
                    src={dev.image}
                    alt={dev.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover/image:scale-110"
                  />

                  {/* Fallback pattern if image is missing/loading (behind image) */}
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black flex items-center justify-center -z-10">
                    <span className="text-8xl font-bold text-white/5 select-none">{dev.name.charAt(0)}</span>
                  </div>

                  {/* Overlay with Socials */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-6 backdrop-blur-sm z-20">
                    <a href={dev.github} target="_blank" rel="noopener noreferrer" className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform">
                      <Github size={24} />
                    </a>
                    <a href={dev.twitter} target="_blank" rel="noopener noreferrer" className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform">
                      <Twitter size={24} />
                    </a>
                    <a href={dev.linkedin} target="_blank" rel="noopener noreferrer" className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform">
                      <Linkedin size={24} />
                    </a>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-10">
                    <div className="text-center transform translate-y-2 group-hover:translate-y-0 transition-transform">
                      <h3 className="text-2xl font-bold mb-1 font-[family-name:var(--font-nuqun)] tracking-wider text-white">{dev.name}</h3>
                      <p className="text-zinc-400 font-[family-name:var(--font-spacemono)] text-xs tracking-widest uppercase">{dev.role}</p>
                    </div>
                  </div>
                </div>
              </Card3D>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
