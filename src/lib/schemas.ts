import { z } from "zod"

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export const verifyOtpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d+$/, "OTP must be numeric"),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Passwords don't match",
  path: ["confirmNewPassword"],
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export interface UserProfile {
  id: number
  email: string
  is_email_verified: boolean
  premium_tier: "free" | "pro" | "enterprise"
  subscription_status: "active" | "trial" | "cancelled" | "expired"
  linked_wallets: LinkedWallet[]
  created_at: string
  avatar_url?: string | null
  display_name?: string | null
}

export interface LinkedWallet {
  address: string
  is_primary: boolean
  created_at: string
  last_used: string | null
}

export interface Subscription {
  tier: "free" | "pro" | "enterprise"
  status: "active" | "trial" | "cancelled" | "expired"
  subscription_start: string | null
  subscription_end: string | null
  features: SubscriptionFeatures
}

export interface SubscriptionFeatures {
  scans_per_day: number | "unlimited"
  chains: number
  pdf_reports: boolean
  api_access: boolean
  watchlist_limit: number | "unlimited"
  bulk_scan: number | false
}

export interface AuthState {
  isAuthenticated: boolean
  isEmailVerified: boolean
  hasWalletConnected: boolean
  user: UserProfile | null
  token: string | null
  refreshToken: string | null
}