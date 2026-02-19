"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { Wallet, ShieldCheck, Activity, BrainCircuit } from "lucide-react";
import { useRef } from "react";

const steps = [
  {
    title: "Connect Identity",
    description: "Securely link your wallet or digital identity to start the analysis process.",
    icon: <Wallet className="w-8 h-8 text-black" />,
    svg: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="conn-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ADE80" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Outer Ring */}
        <motion.circle
          cx="50" cy="50" r="35"
          stroke="#374151" strokeWidth="1" fill="none"
          strokeDasharray="4 4"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />

        {/* Inner Tech Circle */}
        <motion.path
          d="M50,25 A25,25 0 0,1 75,50 M50,75 A25,25 0 0,1 25,50"
          stroke="url(#conn-grad)" strokeWidth="2" fill="none" strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1, rotate: [0, 180] }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />

        {/* Center Nodes */}
        <motion.circle cx="50" cy="50" r="8" fill="#1F2937" stroke="url(#conn-grad)" strokeWidth="2" />
        <motion.circle
          cx="50" cy="50" r="4" fill="#4ADE80"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />

        {/* Connecting Beams */}
        {[0, 90, 180, 270].map((deg, i) => (
          <motion.line
            key={i}
            x1="50" y1="50" x2="50" y2="20"
            stroke="url(#conn-grad)" strokeWidth="1" strokeLinecap="round"
            transform={`rotate(${deg} 50 50)`}
            initial={{ opacity: 0, pathLength: 0 }}
            whileInView={{ opacity: [0, 1, 0], pathLength: [0, 1] }}
            transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity }}
          />
        ))}
      </svg>
    )
  },
  {
    title: "Deep Scan",
    description: "Our AI-driven engine scans thousands of data points across multiple blockchains.",
    icon: <BrainCircuit className="w-8 h-8 text-black" />,
    svg: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <radialGradient id="scan-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4ADE80" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#4ADE80" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Hexagon Grid Background */}
        <path
          d="M50,20 L76,35 V65 L50,80 L24,65 V35 Z"
          stroke="#374151"
          strokeWidth="1"
          fill="none"
          opacity="0.3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="M50,30 L67,40 V60 L50,70 L33,60 V40 Z"
          stroke="#374151"
          strokeWidth="1"
          fill="none"
          opacity="0.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Scanning Beam */}
        <motion.path
          d="M50,50 L50,10 A40,40 0 0,1 90,50 L50,50"
          fill="url(#scan-grad)"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          style={{ originX: "50px", originY: "50px" }}
        />

        {/* Blip Points */}
        <motion.circle cx="65" cy="35" r="2" fill="#F0B90B"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />
        <motion.circle cx="35" cy="65" r="2" fill="#627EEA"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 1.2 }}
        />
        <motion.circle cx="70" cy="60" r="2" fill="#EF4444"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: 2 }}
        />
      </svg>
    )
  },
  {
    title: "Risk Analysis",
    description: "Identify potential vulnerabilities, rug pulls, and security threats in real-time.",
    icon: <Activity className="w-8 h-8 text-black" />,
    svg: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Data Columns */}
        {[20, 35, 50, 65, 80].map((x, i) => (
          <motion.rect
            key={i}
            x={x} y="80" width="8" height="0"
            fill={i === 2 ? "#EF4444" : "#374151"}
            rx="1"
            initial={{ height: 0, y: 80 }}
            whileInView={{
              height: [10, 30 + Math.random() * 40, 20],
              y: [80, 80 - (30 + Math.random() * 40), 60]
            }}
            transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", delay: i * 0.1 }}
          />
        ))}

        {/* Analyzing Line */}
        <motion.path
          d="M10,50 L90,50"
          stroke="#4ADE80" strokeWidth="1" strokeDasharray="2 2"
          animate={{ y: [-20, 20, -20] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />

        {/* Warning Icon */}
        <motion.path
          d="M54,25 L50,18 L46,25 H54 Z"
          fill="#EF4444"
          animate={{ opacity: [0, 1, 0], y: -5 }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      </svg>
    )
  },
  {
    title: "Actionable Insights",
    description: "Receive a comprehensive report with a clear trust score and safety recommendations.",
    icon: <ShieldCheck className="w-8 h-8 text-black" />,
    svg: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Shield Outline */}
        <motion.path
          d="M50,15 C 65,15 80,25 80,25 V50 C80,70 50,85 50,85 C50,85 20,70 20,50 V25 C 20,25 35,15 50,15 Z"
          stroke="#374151" strokeWidth="2" fill="none"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          transition={{ duration: 1 }}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Holographic Fill */}
        <motion.path
          d="M50,18 C 65,18 77,27 77,27 V50 C77,68 50,82 50,82 C50,82 23,68 23,50 V27 C 23,27 35,18 50,18 Z"
          fill="#4ADE80" opacity="0.1"
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          style={{ originX: "50px", originY: "50px" }}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Checkmark */}
        <motion.path
          d="M35,50 L45,60 L65,40"
          stroke="#4ADE80" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
        />

        {/* Particles */}
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx="50" cy="50" r="2" fill="#4ADE80"
            initial={{ opacity: 0, y: 0 }}
            whileInView={{ opacity: [0, 1, 0], y: -30, x: (i - 1) * 20 }}
            transition={{ duration: 2, repeat: Infinity, delay: 1.5 + i * 0.3 }}
          />
        ))}
      </svg>
    )
  }
];

const Workflow = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const pathLength = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <section ref={containerRef} className="py-24 px-8 relative text-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-7xl font-[family-name:var(--font-nuqun)] mb-6">How Kryptos Works</h2>
          <p className="text-zinc-400 max-w-2xl mx-auto text-lg font-[family-name:var(--font-spacemono)]">
            A seamless journey from connection to protection.
          </p>
        </div>

        <div className="relative">
          {/* Glowing Curved Connecting Line */}
          <div className="absolute left-0 top-0 bottom-0 w-full hidden md:block pointer-events-none">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              <path
                d="M 0 0 C 20 5 60 15 65 30 C 70 45 30 55 35 70 C 40 85 80 95 100 100"
                stroke="#27272a"
                strokeWidth="0.8"
                fill="none"
              />
              <motion.path
                d="M 0 0 C 20 5 60 15 65 30 C 70 45 30 55 35 70 C 40 85 80 95 100 100"
                stroke="#4ADE80"
                strokeWidth="1.5"
                strokeOpacity="0.3"
                fill="none"
                style={{ pathLength }}
              />
            </svg>
          </div>

          <div className="space-y-24 relative z-10">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ margin: "-100px" }}
                transition={{ duration: 0.8 }}
                className={`flex flex-col md:flex-row items-center gap-12 ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}
              >
                {/* Visual Side */}
                <div className="flex-1 w-full flex justify-center">
                  <div className="w-64 h-64 md:w-80 md:h-80 bg-zinc-900/50 rounded-3xl border border-zinc-800 p-8 backdrop-blur-sm hover:border-green-500/30 transition-colors duration-500 group">
                    <div className="w-full h-full flex items-center justify-center">
                      {step.svg}
                    </div>
                  </div>
                </div>


                {/* Text Side */}
                <div className={`flex-1 text-center ${index % 2 === 0 ? 'md:text-left' : 'md:text-right'}`}>
                  <h3 className="text-3xl font-[family-name:var(--font-nuqun)] mb-4 text-white">{step.title}</h3>
                  <p className="text-zinc-400 text-lg font-[family-name:var(--font-spacemono)] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Workflow;
