"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import DottedMap from "dotted-map";
import Image from "next/image";

interface MapProps {
  dots?: Array<{
    start: { lat: number; lng: number; label?: string };
    end: { lat: number; lng: number; label?: string };
  }>;
  pins?: Array<{
    id: string;
    lat: number;
    lng: number;
    title: string;
    detail: string;
    wallet?: string;
  }>;
  className?: string;
}

export default function WorldMap({
  dots = [],
  pins = [],
  className,
}: MapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [animatedDots, setAnimatedDots] = useState(dots);
  const [cycle, setCycle] = useState(0);
  const [isDark, setIsDark] = useState(false);
  const map = new DottedMap({ height: 100, grid: "diagonal" });

  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute("data-theme");
      setIsDark(theme === "dark");
    };
    checkTheme();
    
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ["data-theme"] 
    });
    
    return () => observer.disconnect();
  }, []);

  const accentColor = "#888888";
  const mapColor = "#333333";
  const bgColor = "#000000";
  const dotColor = "#555555";
  
  const svgMap = useMemo(() => {
    return map.getSVG({
      radius: 0.35,
      color: mapColor,
      shape: "circle",
      backgroundColor: "transparent",
    });
  }, [mapColor]);

  const projectPoint = (lat: number, lng: number) => {
    const x = (lng + 180) * (800 / 360);
    const y = (90 - lat) * (400 / 180);
    return { x, y };
  };

  const createCurvedPath = (
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) => {
    const midX = (start.x + end.x) / 2;
    const midY = Math.min(start.y, end.y) - 60;
    return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
  };

  useEffect(() => {
    setAnimatedDots(dots);
  }, [dots]);

  useEffect(() => {
    if (dots.length < 2) {
      return;
    }

    const pointPool = dots.flatMap((dot) => [dot.start, dot.end]);

    const randomConnections = () =>
      dots.map(() => {
        const start = pointPool[Math.floor(Math.random() * pointPool.length)];
        let end = pointPool[Math.floor(Math.random() * pointPool.length)];

        while (end === start && pointPool.length > 1) {
          end = pointPool[Math.floor(Math.random() * pointPool.length)];
        }

        return {
          start,
          end,
        };
      });

    const intervalId = window.setInterval(() => {
      setAnimatedDots(randomConnections());
      setCycle((current) => current + 1);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [dots]);

  const allPins = useMemo(() => {
    if (pins.length > 0) {
      return pins;
    }

    const generated = dots.flatMap((dot, index) => [
      {
        id: `${index}-start`,
        lat: dot.start.lat,
        lng: dot.start.lng,
        title: dot.start.label ?? "Source",
        detail: "Flow origin",
        wallet: undefined,
      },
      {
        id: `${index}-end`,
        lat: dot.end.lat,
        lng: dot.end.lng,
        title: dot.end.label ?? "Destination",
        detail: "Flow destination",
        wallet: undefined,
      },
    ]);

    return generated;
  }, [dots, pins]);

  const formatPercent = (value: number, max: number) =>
    `${(value / max) * 100}%`;

  const tooltipBg = "#111111";
  const tooltipBorder = "#333333";
  const tooltipText = "#FFFFFF";

  return (
    <div
      className={`relative w-full overflow-hidden font-sans ${className ?? "aspect-16/9"}`}
      style={{ backgroundColor: bgColor }}
    >
      <Image
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
        className="absolute inset-0 h-full w-full opacity-70"
        alt="world map"
        height="400"
        width="800"
        unoptimized
        draggable={false}
      />
      <svg
        ref={svgRef}
        viewBox="0 0 800 400"
        className="relative h-full w-full"
      >
        {animatedDots.map((dot, i) => {
          const startPoint = projectPoint(dot.start.lat, dot.start.lng);
          const endPoint = projectPoint(dot.end.lat, dot.end.lng);
          return (
            <g key={`path-group-${i}-${cycle}`}>
              <motion.path
                d={createCurvedPath(startPoint, endPoint)}
                fill="none"
                stroke="url(#path-gradient)"
                strokeWidth="1.2"
                initial={{
                  pathLength: 0,
                }}
                animate={{
                  pathLength: 1,
                }}
                transition={{
                  duration: 1.2,
                  delay: 0.3 * i,
                  ease: "easeOut",
                }}
              />
            </g>
          );
        })}

        <defs>
          <linearGradient id="path-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={dotColor} stopOpacity="0" />
            <stop offset="10%" stopColor={accentColor} stopOpacity="1" />
            <stop offset="90%" stopColor={accentColor} stopOpacity="1" />
            <stop offset="100%" stopColor={dotColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {animatedDots.map((dot, i) => (
          <g key={`points-group-${i}`}>
            <g key={`start-${i}`}>
              <circle
                cx={projectPoint(dot.start.lat, dot.start.lng).x}
                cy={projectPoint(dot.start.lat, dot.start.lng).y}
                r="2.5"
                fill={accentColor}
              />
              <circle
                cx={projectPoint(dot.start.lat, dot.start.lng).x}
                cy={projectPoint(dot.start.lat, dot.start.lng).y}
                r="2.5"
                fill={accentColor}
                opacity="0.4"
              >
                <animate
                  attributeName="r"
                  from="2.5"
                  to="10"
                  dur="2s"
                  begin="0s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  from="0.4"
                  to="0"
                  dur="2s"
                  begin="0s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
            <g key={`end-${i}`}>
              <circle
                cx={projectPoint(dot.end.lat, dot.end.lng).x}
                cy={projectPoint(dot.end.lat, dot.end.lng).y}
                r="2.5"
                fill={accentColor}
              />
              <circle
                cx={projectPoint(dot.end.lat, dot.end.lng).x}
                cy={projectPoint(dot.end.lat, dot.end.lng).y}
                r="2.5"
                fill={accentColor}
                opacity="0.4"
              >
                <animate
                  attributeName="r"
                  from="2.5"
                  to="10"
                  dur="2s"
                  begin="0s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  from="0.4"
                  to="0"
                  dur="2s"
                  begin="0s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          </g>
        ))}
      </svg>

      <div className="absolute inset-0 z-10">
        {allPins.map((pin) => {
          const point = projectPoint(pin.lat, pin.lng);
          return (
            <div
              key={pin.id}
              className="absolute"
              style={{
                left: formatPercent(point.x, 800),
                top: formatPercent(point.y, 400),
                transform: "translate(-50%, -50%)",
              }}
            >
              <button
                type="button"
                onMouseEnter={() => {}}
                onMouseLeave={() => {}}
                className="group relative flex h-3 w-3 items-center justify-center"
                aria-label={`${pin.title} details`}
              >
                <span 
                  className="absolute h-2.5 w-2.5 rounded-full" 
                  style={{ backgroundColor: accentColor }}
                />
                <span 
                  className="absolute h-6 w-6 rounded-full border transition duration-300 group-hover:scale-150"
                  style={{ borderColor: accentColor, opacity: 0.5 }}
                />
                <span 
                  className="absolute h-10 w-10 rounded-full blur-[2px]"
                  style={{ backgroundColor: accentColor, opacity: 0.15 }}
                />
              </button>

              <div
                className={`pointer-events-none absolute -top-2 left-1/2 z-30 w-48 -translate-x-1/2 -translate-y-full rounded-lg border px-3 py-2 text-xs shadow-lg transition-all duration-200`}
                style={{ 
                  backgroundColor: tooltipBg, 
                  borderColor: tooltipBorder,
                }}
              >
                <p 
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: accentColor }}
                >
                  {pin.title}
                </p>
                <p 
                  className="mt-1 text-sm"
                  style={{ color: tooltipText }}
                >
                  {pin.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
