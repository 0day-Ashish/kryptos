"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"

export default function RiskGauge({ score = 32, label = "LOW RISK" }: { score?: number; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [animatedScore, setAnimatedScore] = useState(0)
  const [size, setSize] = useState(180)

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth
        const newSize = Math.min(containerWidth - 40, 200)
        setSize(newSize)
      }
    }
    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)

    const centerX = size / 2
    const centerY = size / 2
    const radius = 70
    const lineWidth = 12

    ctx.clearRect(0, 0, size, size)

    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, Math.PI * 0.75, Math.PI * 2.25, false)
    ctx.strokeStyle = "#1A1A1A"
    ctx.lineWidth = lineWidth
    ctx.lineCap = "round"
    ctx.stroke()

    const endAngle = Math.PI * 0.75 + (Math.PI * 1.5 * animatedScore) / 100

    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, Math.PI * 0.75, endAngle, false)
    ctx.strokeStyle = "#FFFFFF"
    ctx.lineWidth = lineWidth
    ctx.lineCap = "round"
    ctx.stroke()

    if (animatedScore > 0) {
      const glowX = centerX + radius * Math.cos(endAngle)
      const glowY = centerY + radius * Math.sin(endAngle)

      const glowGradient = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 20)
      glowGradient.addColorStop(0, "rgba(255, 255, 255, 0.6)")
      glowGradient.addColorStop(1, "transparent")

      ctx.beginPath()
      ctx.arc(glowX, glowY, 20, 0, Math.PI * 2)
      ctx.fillStyle = glowGradient
      ctx.fill()
    }

    const tickCount = 10
    for (let i = 0; i <= tickCount; i++) {
      const angle = Math.PI * 0.75 + (Math.PI * 1.5 * i) / tickCount
      const innerRadius = radius - lineWidth / 2 - 8
      const outerRadius = radius - lineWidth / 2 - 4

      const x1 = centerX + innerRadius * Math.cos(angle)
      const y1 = centerY + innerRadius * Math.sin(angle)
      const x2 = centerX + outerRadius * Math.cos(angle)
      const y2 = centerY + outerRadius * Math.sin(angle)

      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.strokeStyle = i <= (animatedScore / 100) * tickCount ? "#FFFFFF" : "#333333"
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }, [animatedScore])

  useEffect(() => {
    let startTime: number
    const duration = 1500

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 4)
      setAnimatedScore(Math.round(score * easeOut))

      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [score])

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-4 lg:p-6"
    >
      <h3 className="mb-4 text-sm font-medium text-gray-400">Wallet Risk Gauge</h3>

      <div className="relative">
        <canvas ref={canvasRef} className="rotate-[-90deg]" />

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={animatedScore}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-4xl font-bold text-white"
          >
            {animatedScore}
          </motion.span>
          <span className="mt-1 text-xs text-gray-500">Risk Score</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center">
        <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-black">
          {label}
        </div>
      </div>

      <div className="mt-4 flex w-full justify-between text-xs text-gray-500">
        <span>0</span>
        <span>30</span>
        <span>60</span>
        <span>100</span>
      </div>
    </motion.div>
  )
}
