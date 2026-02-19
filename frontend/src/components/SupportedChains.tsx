"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const availableChains = [
  { name: "Ethereum", logo: "/assets/ethereum.png" },
  { name: "Bitcoin", logo: "/assets/bitcoin.png" },
  { name: "Arbitrum", logo: "/assets/arbitrum.png" },
  { name: "Avalanche", logo: "/assets/avalanche.png" },
  { name: "Base", logo: "/assets/base.png" },
  { name: "Cardano", logo: "/assets/cardano.png" },
  { name: "Polkadot", logo: "/assets/polkadot.png" },
];

const SupportedChains = () => {
  return (
    <div
      className="w-full py-10 overflow-hidden relative"
      style={{
        maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)'
      }}
    >

      <div className="flex">
        <motion.div
          className="flex gap-16 pr-16 items-center"
          animate={{ x: "-50%" }}
          transition={{
            duration: 50,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{ width: "max-content" }}
        >
          {/* Create two identical sets of chains for seamless looping */}
          {[...availableChains, ...availableChains, ...availableChains, ...availableChains].map((chain, index) => (
            <div
              key={index}
              className={`relative grayscale brightness-200 hover:grayscale-0 hover:brightness-100 transition-all duration-370 opacity-50 hover:opacity-100 hover:scale-110 object-contain mx-8
                ${chain.name === 'Ethereum' ? 'w-16 h-16 md:w-20 md:h-20' : chain.name === 'Arbitrum' || chain.name === 'Avalanche' ? 'w-28 h-28 md:w-36 md:h-36' : 'w-20 h-20 md:w-28 md:h-28'}
              `}
            >
              <Image
                src={chain.logo}
                alt={chain.name}
                fill
                className="object-contain"
              />
            </div>
          ))}
          {/* Second identical set */}
          {[...availableChains, ...availableChains, ...availableChains, ...availableChains].map((chain, index) => (
            <div
              key={`duplicate-${index}`}
              className={`relative grayscale brightness-200 hover:grayscale-0 hover:brightness-100 transition-all duration-300 opacity-50 hover:opacity-100 hover:scale-110 object-contain mx-8
                ${chain.name === 'Ethereum' ? 'w-16 h-16 md:w-20 md:h-20' : chain.name === 'Arbitrum' || chain.name === 'Avalanche' ? 'w-28 h-28 md:w-36 md:h-36' : 'w-20 h-20 md:w-28 md:h-28'}
              `}
            >
              <Image
                src={chain.logo}
                alt={chain.name}
                fill
                className="object-contain"
              />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default SupportedChains;
