"use client";

import { motion } from "framer-motion";

const HeroAnimation = () => {
  return (
    <div className="w-full h-full relative flex items-center justify-center translate-x-12">
      <svg
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full max-w-md drop-shadow-[0_0_15px_rgba(74,222,128,0.3)]"
      >
        <defs>
          <linearGradient id="cyber-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ADE80" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Floating Character Group */}
        <motion.g
          initial={{ y: 0 }}
          animate={{ y: [-10, 10, -10] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Character Body (Abstract/Cyber style) */}
          <path
            d="M200,120 
               C200,120 160,130 150,180 
               C140,230 130,300 130,380 
               L270,380 
               C270,300 260,230 250,180 
               C240,130 200,120 200,120 Z"
            fill="url(#cyber-grad)"
            opacity="0.1"
            stroke="url(#cyber-grad)"
            strokeWidth="2"
          />

          {/* Shoulders/Arms lines */}
          <path
            d="M150,180 L130,250 L100,280"
            stroke="url(#cyber-grad)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M250,180 L270,250 L310,240"
            stroke="url(#cyber-grad)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />

          {/* Head */}
          <circle cx="200" cy="100" r="35" stroke="url(#cyber-grad)" strokeWidth="2" fill="#000" />

          {/* Visor/Eyes */}
          <motion.path
            d="M180,100 Q200,110 220,100"
            stroke="#4ADE80"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ opacity: 0.5 }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* Wallet / Hologram Device */}
          <motion.g
            initial={{ y: 0 }}
            animate={{ y: [-5, 5, -5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            {/* The Wallet Rect */}
            <rect
              x="290"
              y="210"
              width="60"
              height="40"
              rx="5"
              stroke="#4ADE80"
              strokeWidth="2"
              fill="rgba(0,0,0,0.8)"
            />
            {/* Wallet Glow/Screen */}
            <motion.rect
              x="295"
              y="215"
              width="50"
              height="30"
              rx="3"
              fill="#4ADE80"
              initial={{ opacity: 0.2 }}
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />

            {/* Floating Coins/Data from Wallet */}
            <motion.circle
              cx="320"
              cy="200"
              r="3"
              fill="#4ADE80"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [0, 1, 0], y: -20 }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.circle
              cx="330"
              cy="205"
              r="2"
              fill="#4ADE80"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [0, 1, 0], y: -25 }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
            />
          </motion.g>
        </motion.g>

        {/* Background Circuit Lines */}
        <motion.path
          d="M50,350 L100,350 L120,330"
          stroke="url(#cyber-grad)"
          strokeWidth="1"
          opacity="0.3"
          fill="none"
        />
        <motion.path
          d="M350,50 L300,50 L280,70"
          stroke="url(#cyber-grad)"
          strokeWidth="1"
          opacity="0.3"
          fill="none"
        />

        {/* Floating Web3 Icons */}
        <motion.g>
          {/* Bitcoin */}
          <motion.g
            initial={{ x: 50, y: 80, opacity: 0 }}
            animate={{ y: [80, 70, 80], opacity: 0.6 }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <circle cx="0" cy="0" r="12" fill="none" stroke="#F7931A" strokeWidth="1.5" />
            <path d="M-2,-5 V5 M2,-5 V5 M-2,-5 H3 A2.5,2.5 0 0 1 3,0 A2.5,2.5 0 0 1 -2,0 M-2,0 H3 A2.5,2.5 0 0 1 3,5 A2.5,2.5 0 0 1 -2,5" stroke="#F7931A" strokeWidth="1.5" fill="none" transform="translate(0, 0) scale(1.2)" />
          </motion.g>

          {/* Ethereum */}
          <motion.g
            initial={{ x: 340, y: 120, opacity: 0 }}
            animate={{ y: [120, 130, 120], opacity: 0.6 }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <path d="M0,-10 L-6,0 L0,10 L6,0 Z" stroke="#627EEA" strokeWidth="1.5" fill="none" transform="translate(0,0) scale(1.2)" />
            <path d="M0,-10 L0,10" stroke="#627EEA" strokeWidth="0.5" />
          </motion.g>

          {/* Shield */}
          <motion.g
            initial={{ x: 80, y: 280, opacity: 0 }}
            animate={{ y: [280, 270, 280], opacity: 0.5 }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            <path d="M-8,-8 H8 L0,10 Z" stroke="#4ADE80" strokeWidth="1.5" fill="none" transform="translate(0, -2) scale(1)" />
            <path d="M-8,-8 V0 Q-8,8 0,10 Q8,8 8,0 V-8 Z" stroke="#4ADE80" strokeWidth="1.5" fill="none" />
          </motion.g>

          {/* Key */}
          <motion.g
            initial={{ x: 320, y: 320, opacity: 0 }}
            animate={{ y: [320, 310, 320], opacity: 0.5, rotate: [0, 10, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          >
            <circle cx="-5" cy="-5" r="4" stroke="#06b6d4" strokeWidth="1.5" />
            <path d="M-2,-2 L6,6 M6,6 L8,4 M6,6 L4,8" stroke="#06b6d4" strokeWidth="1.5" />
          </motion.g>

          {/* Solana */}
          <motion.g
            initial={{ x: 60, y: 180, opacity: 0 }}
            animate={{ y: [180, 170, 180], opacity: 0.6 }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          >
            <path d="M-10,-5 L-5,-10 L10,-10 L5,-5 Z M-5,0 L-10,5 L5,5 L10,0 Z M-10,10 L-5,5 L10,5 L5,10 Z" stroke="url(#cyber-grad)" strokeWidth="1" fill="none" transform="scale(0.8)" />
          </motion.g>

          {/* Polygon */}
          <motion.g
            initial={{ x: 350, y: 250, opacity: 0 }}
            animate={{ y: [250, 260, 250], opacity: 0.6 }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <path d="M0,-10 L9,-5 L9,5 L0,10 L-9,5 L-9,-5 Z" stroke="#8247E5" strokeWidth="1.5" fill="none" transform="rotate(30) scale(0.9)" />
            <path d="M-4,-2 L0,-5 L4,-2 L4,2 L0,5 L-4,2 Z" stroke="#8247E5" strokeWidth="1" fill="none" transform="rotate(30) scale(0.9)" />
          </motion.g>

          {/* BNB */}
          <motion.g
            initial={{ x: 120, y: 40, opacity: 0 }}
            animate={{ y: [40, 30, 40], opacity: 0.6 }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
          >
            <path d="M0,-8 L8,0 L0,8 L-8,0 Z" stroke="#F0B90B" strokeWidth="1.5" fill="none" transform="scale(1)" />
            <path d="M0,-4 L4,0 L0,4 L-4,0 Z" stroke="#F0B90B" strokeWidth="1" fill="none" />
          </motion.g>
        </motion.g>
      </svg>
    </div>
  );
};

export default HeroAnimation;
