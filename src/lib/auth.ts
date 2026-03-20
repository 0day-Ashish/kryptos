import { BrowserProvider } from "ethers"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface NonceResponse {
  nonce: string
  message: string
}

export interface VerifyResponse {
  token: string
  address: string
}

export interface MeResponse {
  address: string
  created_at: string
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, callback: (...args: unknown[]) => void) => void
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void
      isMetaMask?: boolean
    }
  }
}

export async function requestNonce(address: string): Promise<NonceResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/wallet/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || "Failed to get nonce")
  }
  
  return response.json()
}

export async function verifySignature(
  address: string,
  signature: string,
  message: string
): Promise<VerifyResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/wallet/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature, message }),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || "Signature verification failed")
  }
  
  return response.json()
}

export async function getCurrentUser(token: string): Promise<MeResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || "Failed to get user")
  }
  
  return response.json()
}

export async function signMessage(message: string): Promise<string> {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed")
  }
  
  const provider = new BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  return signer.signMessage(message)
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("kryptos_token")
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem("kryptos_token", token)
}

export function removeStoredToken(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem("kryptos_token")
}

export async function authenticateWithWallet(address: string): Promise<string> {
  const { nonce, message } = await requestNonce(address)
  const signature = await signMessage(message)
  const { token } = await verifySignature(address, signature, message)
  setStoredToken(token)
  return token
}
