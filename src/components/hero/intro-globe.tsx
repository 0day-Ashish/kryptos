"use client";

import { GlobeConfig, World } from "@/components/ui/globe";

const globeConfig: GlobeConfig = {
  pointSize: 4,
  globeColor: "#e8e8e8",
  showAtmosphere: true,
  atmosphereColor: "#888888",
  atmosphereAltitude: 0.16,
  emissive: "#cccccc",
  emissiveIntensity: 0.3,
  shininess: 0.9,
  polygonColor: "rgba(128, 128, 128, 0.45)",
  ambientLight: "#dddddd",
  directionalLeftLight: "#888888",
  directionalTopLight: "#ffffff",
  pointLight: "#ffffff",
  arcTime: 2200,
  arcLength: 0.8,
  rings: 1,
  maxRings: 4,
  autoRotate: true,
  autoRotateSpeed: 0.7,
};

const globeData = [
  {
    order: 1,
    startLat: 51.5072,
    startLng: -0.1276,
    endLat: 25.2048,
    endLng: 55.2708,
    arcAlt: 0.28,
    color: "#666666",
  },
  {
    order: 2,
    startLat: 37.7749,
    startLng: -122.4194,
    endLat: 1.3521,
    endLng: 103.8198,
    arcAlt: 0.34,
    color: "#888888",
  },
  {
    order: 3,
    startLat: 35.6762,
    startLng: 139.6503,
    endLat: 22.3193,
    endLng: 114.1694,
    arcAlt: 0.2,
    color: "#aaaaaa",
  },
  {
    order: 4,
    startLat: 40.7128,
    startLng: -74.006,
    endLat: 48.8566,
    endLng: 2.3522,
    arcAlt: 0.18,
    color: "#666666",
  },
  {
    order: 5,
    startLat: -33.8688,
    startLng: 151.2093,
    endLat: 35.6895,
    endLng: 139.6917,
    arcAlt: 0.24,
    color: "#888888",
  },
];

export default function IntroGlobe() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="h-[86vh] w-[86vh] max-h-[86vh] max-w-[94vw] opacity-80">
        <World globeConfig={globeConfig} data={globeData} />
      </div>
      <div className="absolute inset-0 bg-radial-[at_center,rgba(var(--bg-primary-rgb,255,255,255),0)_34%,rgba(var(--bg-primary-rgb,255,255,255),0.85)_100%]" />
    </div>
  );
}
