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
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-hidden">
        <defs>
          <linearGradient id="conn-grad-new" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ADE80" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4ADE80" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#4ADE80" stopOpacity="0" />
          </radialGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Glow */}
        <motion.circle cx="50" cy="50" r="25" fill="url(#core-glow)"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Outer orbital rings */}
        <motion.circle cx="50" cy="50" r="38" stroke="#374151" strokeWidth="0.5" fill="none"
          strokeDasharray="4 6"
          animate={{ rotate: 360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          style={{ originX: "50px", originY: "50px" }}
        />
        <motion.circle cx="50" cy="50" r="32" stroke="#4ADE80" strokeWidth="1" fill="none" opacity="0.3"
          strokeDasharray="20 10 5 10"
          animate={{ rotate: -360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ originX: "50px", originY: "50px" }}
        />

        {/* Central Core */}
        <motion.circle cx="50" cy="50" r="12" fill="#18181B" stroke="url(#conn-grad-new)" strokeWidth="2" filter="url(#glow)" />
        <motion.circle cx="50" cy="50" r="6" fill="#4ADE80"
          animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Floating Peripheral Nodes */}
        {[
          { cx: 50, cy: 15, delay: 0 },
          { cx: 85, cy: 50, delay: 0.5 },
          { cx: 50, cy: 85, delay: 1 },
          { cx: 15, cy: 50, delay: 1.5 }
        ].map((node, i) => (
          <g key={i}>
            <motion.line
              x1="50" y1="50" x2={node.cx} y2={node.cy}
              stroke="url(#conn-grad-new)" strokeWidth="1.5"
              strokeDasharray="4 4"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: 2, delay: node.delay, repeat: Infinity }}
            />
            <motion.circle cx={node.cx} cy={node.cy} r="4" fill="#18181B" stroke="#4ADE80" strokeWidth="1.5" />
            <motion.circle cx={node.cx} cy={node.cy} r="2" fill="#4ADE80"
              animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 2, delay: node.delay, repeat: Infinity }}
            />
          </g>
        ))}
      </svg>
    )
  },
  {
    title: "Deep Scan",
    description: "Our AI-driven engine scans thousands of data points across multiple blockchains.",
    icon: <BrainCircuit className="w-8 h-8 text-black" />,
    svg: (
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-hidden">
        <defs>
          <linearGradient id="radar-scan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4ADE80" stopOpacity="0" />
            <stop offset="100%" stopColor="#4ADE80" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="grid-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#374151" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#374151" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#374151" stopOpacity="0.1" />
          </linearGradient>
          <clipPath id="circle-clip">
            <circle cx="50" cy="50" r="40" />
          </clipPath>
        </defs>

        {/* Global Grid */}
        <path d="M10,50 L90,50 M50,10 L50,90 M20,20 L80,80 M20,80 L80,20" stroke="url(#grid-grad)" strokeWidth="0.5" fill="none" />
        <circle cx="50" cy="50" r="40" stroke="#27272A" strokeWidth="1" fill="none" />
        <circle cx="50" cy="50" r="30" stroke="#27272A" strokeWidth="1" fill="none" strokeDasharray="2 4" />
        <circle cx="50" cy="50" r="20" stroke="#27272A" strokeWidth="1" fill="none" />

        {/* Radar Scanner Area */}
        <g clipPath="url(#circle-clip)">
          {/* Translate origin to (50,50) first, then rotate around that point */}
          <g transform="translate(50,50)">
            <motion.g
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "0px 0px" }}
            >
              {/* Sweep drawn around (0,0) which is now the circle center */}
              <path d="M0,0 L0,-40 A40,40 0 0,1 40,0 Z" fill="url(#radar-scan)" />
              <line x1="0" y1="0" x2="0" y2="-40" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" />
            </motion.g>
          </g>
        </g>

        {/* Detected Threats / Nodes */}
        {[
          { x: 70, y: 35, color: "#EF4444", delay: 0.5 },
          { x: 30, y: 65, color: "#F59E0B", delay: 2.5 },
          { x: 60, y: 70, color: "#3B82F6", delay: 1.5 },
          { x: 25, y: 40, color: "#4ADE80", delay: 3.2 }
        ].map((node, i) => (
          <g key={i}>
            <motion.circle cx={node.x} cy={node.y} r="2" fill={node.color}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
              transition={{ duration: 4, delay: node.delay, repeat: Infinity }}
            />
            <motion.circle cx={node.x} cy={node.y} r="6" stroke={node.color} strokeWidth="1" fill="none"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 0.5, 0], scale: [0, 2, 3] }}
              transition={{ duration: 4, delay: node.delay, repeat: Infinity }}
            />
          </g>
        ))}
      </svg>
    )
  },
  {
    title: "Risk Analysis",
    description: "Identify potential vulnerabilities, rug pulls, and security threats in real-time.",
    icon: <Activity className="w-8 h-8 text-black" />,
    svg: (
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-hidden">
        <defs>
          <linearGradient id="chart-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Background Grid */}
        {[20, 40, 60, 80].map(y => (
          <line key={y} x1="10" y1={y} x2="90" y2={y} stroke="#27272A" strokeWidth="0.5" strokeDasharray="2 2" />
        ))}

        {/* Animated Line Graph */}
        <motion.path
          d="M 10 70 C 20 70, 25 40, 35 45 C 45 50, 50 20, 60 30 C 70 40, 75 60, 90 55"
          stroke="#EF4444" strokeWidth="2" fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />

        {/* Graph Area Fill */}
        <motion.path
          d="M 10 70 C 20 70, 25 40, 35 45 C 45 50, 50 20, 60 30 C 70 40, 75 60, 90 55 L 90 90 L 10 90 Z"
          fill="url(#chart-grad)"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 2, delay: 0.5 }}
        />

        {/* High Risk Pulse Node */}
        <motion.circle cx="50" cy="20" r="3" fill="#EF4444"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        />
        <motion.circle cx="50" cy="20" r="8" stroke="#EF4444" strokeWidth="1" fill="none"
          animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />

        {/* Analysis Reticule */}
        <motion.g
          animate={{ x: [0, 40, -20, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <rect x="40" y="10" width="20" height="20" stroke="#4ADE80" strokeWidth="1" fill="none" rx="2" strokeDasharray="4 4" />
          <line x1="50" y1="5" x2="50" y2="10" stroke="#4ADE80" strokeWidth="1" />
          <line x1="50" y1="30" x2="50" y2="35" stroke="#4ADE80" strokeWidth="1" />
          <line x1="35" y1="20" x2="40" y2="20" stroke="#4ADE80" strokeWidth="1" />
          <line x1="60" y1="20" x2="65" y2="20" stroke="#4ADE80" strokeWidth="1" />
        </motion.g>

        {/* Data Bars */}
        {[20, 35, 65, 80].map((x, i) => (
          <motion.rect
            key={i} x={x} y="85" width="4" height="0" fill="#3B82F6" rx="1"
            initial={{ height: 0, y: 85 }}
            whileInView={{ height: [10, 25, 15], y: [75, 60, 70] }}
            transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", delay: i * 0.2 }}
          />
        ))}
      </svg>
    )
  },
  {
    title: "Actionable Insights",
    description: "Receive a comprehensive report with a clear trust score and safety recommendations.",
    icon: <ShieldCheck className="w-8 h-8 text-black" />,
    svg: (
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-hidden">
        <defs>
          <linearGradient id="shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ADE80" stopOpacity="1" />
            <stop offset="100%" stopColor="#059669" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="shield-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ADE80" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Hexagonal Tech Background */}
        <path d="M50 5 L90 25 L90 75 L50 95 L10 75 L10 25 Z" stroke="#27272A" strokeWidth="1" fill="none" />
        <path d="M50 15 L80 30 L80 70 L50 85 L20 70 L20 30 Z" stroke="#374151" strokeWidth="0.5" fill="none" strokeDasharray="2 2" />

        {/* Main Shield Outline */}
        <motion.path
          d="M50,20 C 65,20 75,28 75,28 V55 C75,72 50,85 50,85 C50,85 25,72 25,55 V28 C 25,28 35,20 50,20 Z"
          stroke="url(#shield-grad)" strokeWidth="2" fill="url(#shield-glow)"
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
        />

        {/* Inner Tech Lines */}
        <motion.path
          d="M50 20 L50 85 M25 40 L75 40 M25 55 L75 55"
          stroke="#4ADE80" strokeWidth="0.5" strokeOpacity="0.3" fill="none"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        />

        {/* Animated Checkmark */}
        <motion.path
          d="M40,52 L47,59 L62,42"
          stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
        />

        {/* Glowing Success Particles */}
        {[
          { x: 30, y: 30, delay: 1 },
          { x: 70, y: 35, delay: 1.2 },
          { x: 40, y: 75, delay: 1.4 },
          { x: 65, y: 65, delay: 1.6 }
        ].map((p, i) => (
          <motion.circle key={i} cx={p.x} cy={p.y} r="2" fill="#4ADE80"
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: [0, 1, 0], scale: [0, 1.5, 0], y: p.y - 15 }}
            transition={{ duration: 2, delay: p.delay, repeat: Infinity }}
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
