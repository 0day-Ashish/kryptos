import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAddress(address: string, chars: number = 6): string {
  if (!address) return ""
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toLocaleString()
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function getRiskColor(score: number): string {
  if (score <= 30) return "text-green-500"
  if (score <= 60) return "text-yellow-500"
  return "text-red-500"
}

export function getRiskBgColor(score: number): string {
  if (score <= 30) return "bg-green-500/10 border-green-500/20"
  if (score <= 60) return "bg-yellow-500/10 border-yellow-500/20"
  return "bg-red-500/10 border-red-500/20"
}

export function getNetworkColor(network: string): string {
  switch (network.toLowerCase()) {
    case "eth":
      return "bg-violet-500"
    case "btc":
      return "bg-orange-500"
    case "sol":
      return "bg-purple-500"
    default:
      return "bg-gray-500"
  }
}
