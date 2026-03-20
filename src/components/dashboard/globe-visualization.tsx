"use client"

import { useState } from "react"
import { World, GlobeConfig } from "@/components/ui/globe"

type Position = {
  order: number
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  arcAlt: number
  color: string
}

const sampleGlobeData: Position[] = [
  { order: 1, startLat: 40.7128, startLng: -74.006, endLat: 51.5074, endLng: -0.1278, arcAlt: 0.1, color: "#888888" },
  { order: 1, startLat: 1.3521, startLng: 103.8198, endLat: 25.2048, endLng: 55.2708, arcAlt: 0.15, color: "#666666" },
  { order: 1, startLat: 19.076, startLng: 72.8777, endLat: 19.4326, endLng: -81.2149, arcAlt: 0.08, color: "#999999" },
  { order: 1, startLat: 35.6762, startLng: 139.6503, endLat: 37.7749, endLng: -122.4194, arcAlt: 0.12, color: "#777777" },
  { order: 1, startLat: 52.52, startLng: 13.405, endLat: 48.8566, endLng: 2.3522, arcAlt: 0.06, color: "#AAAAAA" },
  { order: 1, startLat: 55.7558, startLng: 37.6173, endLat: 39.9042, endLng: 116.4074, arcAlt: 0.1, color: "#555555" },
  { order: 1, startLat: -33.8688, startLng: 151.2093, endLat: 36.7783, endLng: -119.4179, arcAlt: 0.14, color: "#888888" },
  { order: 1, startLat: 19.4326, startLng: -99.1332, endLat: 25.2048, endLng: 55.2708, arcAlt: 0.09, color: "#666666" },
]

const globeConfig: GlobeConfig = {
  pointSize: 1,
  globeColor: "#111111",
  showAtmosphere: true,
  atmosphereColor: "#666666",
  atmosphereAltitude: 0.15,
  emissive: "#333333",
  emissiveIntensity: 0.5,
  shininess: 0.9,
  arcTime: 2000,
  arcLength: 0.8,
  rings: 1,
  maxRings: 3,
  autoRotate: true,
  autoRotateSpeed: 0.5,
}

export default function GlobeVisualization() {
  return (
    <div className="relative h-full w-full">
      <World globeConfig={globeConfig} data={sampleGlobeData} />
    </div>
  )
}
