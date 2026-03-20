"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { TrendingUp, TrendingDown, Scan, Shield, Activity, Wallet } from "lucide-react"
import { cn, formatNumber } from "@/lib/utils"
import { api } from "@/lib/api"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Scan,
  Shield,
  Activity,
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    const padding = 4

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const points = data.map((val, i) => ({
      x: padding + (i / (data.length - 1)) * (width - padding * 2),
      y: height - padding - ((val - min) / range) * (height - padding * 2),
    }))

    ctx.clearRect(0, 0, width, height)

    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.2)")
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)")

    ctx.beginPath()
    ctx.moveTo(points[0].x, height)
    points.forEach((point) => ctx.lineTo(point.x, point.y))
    ctx.lineTo(points[points.length - 1].x, height)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    points.forEach((point) => ctx.lineTo(point.x, point.y))
    ctx.strokeStyle = "#FFFFFF"
    ctx.lineWidth = 1.5
    ctx.stroke()
  }, [data])

  return <canvas ref={canvasRef} className="h-10 w-20" />
}

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isInView) return

    let startTime: number
    const duration = 2000

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 4)
      setCount(Math.round(value * easeOut))

      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [value, isInView])

  return <span ref={ref}>{formatNumber(count)}{suffix}</span>
}

export default function MetricsCards() {
  const metrics = [
    {
      label: "Total Wallet Scans",
      value: 0,
      change: 0,
      icon: "Scan",
      sparkline: [],
      positive: true,
    },
    {
      label: "Risk Alerts",
      value: 0,
      change: 0,
      icon: "Shield",
      sparkline: [],
      positive: false,
    },
    {
      label: "Safe Wallets",
      value: 0,
      change: 0,
      icon: "Shield",
      sparkline: [],
      positive: true,
    },
    {
      label: "Average Risk Score",
      value: 0,
      change: 0,
      icon: "Activity",
      sparkline: [],
      positive: true,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => {
        const Icon = iconMap[metric.icon]
        return (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="group relative overflow-hidden rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-5 transition-all duration-300 hover:border-white/20"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A1A1A]">
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm text-gray-400">{metric.label}</p>
                <p className="mt-1 text-2xl font-bold text-white">--</p>
              </div>

              <div className="mt-2 flex items-center gap-1">
                <span className="text-xs text-gray-600">Connect wallet to view metrics</span>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
