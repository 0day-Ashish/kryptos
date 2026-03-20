"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { BrowserProvider, JsonRpcSigner } from "ethers"
import { 
  authenticateWithWallet, 
  getStoredToken, 
  removeStoredToken,
  getCurrentUser,
} from "@/lib/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface WalletState {
  address: string | null
  chainId: number | null
  balance: string | null
  isConnected: boolean
  isConnecting: boolean
  isAuthenticated: boolean
  isAuthenticating: boolean
  error: string | null
  token: string | null
  linkedWallets: LinkedWallet[]
  selectedWallet: string | null
}

export interface LinkedWallet {
  address: string
  isPrimary: boolean
  createdAt: string
  lastUsed: string | null
}

export interface WalletContextType extends WalletState {
  connect: () => Promise<void>
  disconnect: () => void
  switchChain: (chainId: number) => Promise<void>
  addWallet: () => Promise<void>
  removeWallet: (address: string) => Promise<void>
  switchWallet: (address: string) => Promise<void>
  checkWalletLinked: (address: string) => Promise<boolean>
  signer: JsonRpcSigner | null
  provider: BrowserProvider | null
}

const WalletContext = createContext<WalletContextType | null>(null)

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

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [linkedWallets, setLinkedWallets] = useState<LinkedWallet[]>([])
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null)

  const getBalance = useCallback(async (address: string, provider: BrowserProvider) => {
    try {
      const balance = await provider.getBalance(address)
      setBalance((balance / BigInt(1e18)).toString())
    } catch {
      setBalance(null)
    }
  }, [])

  const authenticate = useCallback(async (address: string) => {
    setIsAuthenticating(true)
    try {
      const jwtToken = await authenticateWithWallet(address)
      setToken(jwtToken)
      
      try {
        await getCurrentUser(jwtToken)
      } catch {
        // Token might be valid even if user lookup fails
      }
    } catch (err) {
      console.error("Authentication failed:", err)
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  const handleAccountsChanged = useCallback(async (accounts: unknown) => {
    const accountsArray = accounts as string[]
    if (accountsArray.length === 0) {
      // User disconnected wallet - clear all state
      setAddress(null)
      setBalance(null)
      setSigner(null)
      setToken(null)
      setSelectedWallet(null)
      removeStoredToken()
    } else {
      // User switched accounts in MetaMask - just update address without re-authenticating
      const newAddress = accountsArray[0].toLowerCase()
      setAddress(newAddress)
      setSelectedWallet(newAddress)
      if (provider) {
        await getBalance(newAddress, provider)
      }
      // Don't call authenticate() - this would cause duplicate signature requests
    }
  }, [provider, getBalance])

  const handleChainChanged = useCallback((chainIdHex: unknown) => {
    const chainId = parseInt(chainIdHex as string, 16)
    setChainId(chainId)
    window.location.reload()
  }, [])

  // Check if a wallet is already linked to the user's account
  const checkWalletLinked = useCallback(async (walletAddress: string): Promise<boolean> => {
    try {
      const token = getStoredToken()
      if (!token) return false
      
      const response = await fetch(`${API_BASE_URL}/auth/wallet/check/${walletAddress}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        return data.is_linked === true
      }
      return false
    } catch (error) {
      console.error("Error checking wallet link status:", error)
      return false
    }
  }, [])

  // Link a wallet to the user's account (requires signature)
  // signerOverride: pass when calling from connect() since state won't have updated yet
  const linkWallet = useCallback(async (
    walletAddress: string,
    signerOverride?: JsonRpcSigner
  ): Promise<boolean> => {
    setIsAuthenticating(true)
    try {
      // Request nonce
      const nonceResponse = await fetch(`${API_BASE_URL}/auth/wallet/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: walletAddress }),
      })
      
      if (!nonceResponse.ok) {
        throw new Error("Failed to get nonce")
      }
      
      const { message } = await nonceResponse.json()
      
      // Sign the message (use override when called from connect before state updates)
      const activeSigner = signerOverride ?? signer
      if (!activeSigner) {
        throw new Error("No signer available")
      }
      const signature = await activeSigner.signMessage(message)
      
      // Verify and link wallet
      const verifyResponse = await fetch(`${API_BASE_URL}/auth/link-wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: walletAddress, signature, message }),
      })
      
      if (verifyResponse.ok) {
        // Add to linked wallets
        const newWallet: LinkedWallet = {
          address: walletAddress,
          isPrimary: linkedWallets.length === 0,
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
        }
        setLinkedWallets(prev => [...prev, newWallet])
        return true
      }
      
      const error = await verifyResponse.json().catch(() => ({}))
      throw new Error(error.detail || "Failed to link wallet")
    } catch (err) {
      console.error("Error linking wallet:", err)
      setError(err instanceof Error ? err.message : "Failed to link wallet")
      return false
    } finally {
      setIsAuthenticating(false)
    }
  }, [signer, linkedWallets])

  // Add a new wallet (triggers linking flow)
  const addWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask not installed")
      return
    }
    
    setIsConnecting(true)
    setError(null)
    
    try {
      const browserProvider = new BrowserProvider(window.ethereum)
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      }) as string[]
      
      if (accounts.length > 0) {
        const newAddress = accounts[0].toLowerCase()
        
        // Check if already linked
        const isLinked = await checkWalletLinked(newAddress)
        
        if (isLinked) {
          // Already linked - just add to local state
          const newWallet: LinkedWallet = {
            address: newAddress,
            isPrimary: linkedWallets.length === 0,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
          }
          setLinkedWallets(prev => [...prev, newWallet])
        } else {
          // Need to link - this will trigger signature request
          const success = await linkWallet(newAddress)
          if (!success) {
            throw new Error("Failed to link wallet")
          }
        }
        
        // Set as selected wallet
        setSelectedWallet(newAddress)
        setAddress(newAddress)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add wallet")
    } finally {
      setIsConnecting(false)
    }
  }, [checkWalletLinked, linkWallet, linkedWallets])

  // Remove a wallet (unlink from account)
  const removeWallet = useCallback(async (walletAddress: string) => {
    try {
      const token = getStoredToken()
      if (!token) return
      
      const response = await fetch(`${API_BASE_URL}/auth/wallets/${walletAddress}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })
      
      if (response.ok) {
        setLinkedWallets(prev => prev.filter(w => w.address !== walletAddress))
        
        // If removed selected wallet, clear selection
        if (selectedWallet === walletAddress) {
          setSelectedWallet(linkedWallets[0]?.address || null)
        }
      }
    } catch (error) {
      console.error("Error removing wallet:", error)
    }
  }, [selectedWallet, linkedWallets])

  // Switch between linked wallets
  const switchWallet = useCallback(async (walletAddress: string) => {
    setSelectedWallet(walletAddress)
    setAddress(walletAddress)
    
    // Update balance for new wallet
    if (provider) {
      await getBalance(walletAddress, provider)
    }
  }, [provider, getBalance])

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask not installed. Please install MetaMask to continue.")
      return
    }

    // Prevent concurrent connection attempts
    if (isConnecting || isAuthenticating) return
    
    // If already connected to the same wallet, don't reconnect
    const accounts = await window.ethereum.request({ method: "eth_accounts" }) as string[]
    if (accounts.length > 0 && address && address === accounts[0].toLowerCase()) {
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const browserProvider = new BrowserProvider(window.ethereum)
      setProvider(browserProvider)

      const accountList = await window.ethereum.request({
        method: "eth_requestAccounts",
      }) as string[]

      if (accountList.length > 0) {
        const userAddress = accountList[0].toLowerCase()
        setAddress(userAddress)
        setSelectedWallet(userAddress)

        const userSigner = await browserProvider.getSigner()
        setSigner(userSigner)

        const network = await browserProvider.getNetwork()
        setChainId(Number(network.chainId))

        await getBalance(userAddress, browserProvider)
        
        // Check if wallet is already linked before requesting signature
        const isLinked = await checkWalletLinked(userAddress)
        
        if (isLinked) {
          // Wallet already linked - try to get token (may not need signature if using stored nonce)
          try {
            const jwtToken = await authenticateWithWallet(userAddress)
            setToken(jwtToken)
          } catch {
            // Token might fail but wallet is still connected
          }
        } else {
          // Wallet not linked - need to link it (will trigger signature)
          // Pass userSigner directly - state won't have updated yet
          const success = await linkWallet(userAddress, userSigner)
          if (success) {
            // Get token after linking
            try {
              const jwtToken = await authenticateWithWallet(userAddress)
              setToken(jwtToken)
            } catch {
              // Token might fail but wallet is still linked
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet"
      setError(message)
    } finally {
      setIsConnecting(false)
    }
  }, [getBalance, checkWalletLinked, linkWallet])

  const disconnect = useCallback(() => {
    setAddress(null)
    setChainId(null)
    setBalance(null)
    setSigner(null)
    setProvider(null)
    setToken(null)
    setSelectedWallet(null)
    setLinkedWallets([])
    setError(null)
    removeStoredToken()
  }, [])

  const switchChain = useCallback(async (targetChainId: number) => {
    if (!window.ethereum) return

    const chainIdHex = `0x${targetChainId.toString(16)}`

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to switch chain"
      setError(message)
      throw err
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return

    const handleAccountsChangedWrapper = (accounts: unknown) => handleAccountsChanged(accounts)
    const handleChainChangedWrapper = (chainId: unknown) => handleChainChanged(chainId)

    window.ethereum.on("accountsChanged", handleAccountsChangedWrapper)
    window.ethereum.on("chainChanged", handleChainChangedWrapper)

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChangedWrapper)
      window.ethereum?.removeListener("chainChanged", handleChainChangedWrapper)
    }
  }, [handleAccountsChanged, handleChainChanged])

  useEffect(() => {
    let mounted = true
    let hasAttemptedConnection = false

    const checkConnection = async () => {
      if (!mounted || hasAttemptedConnection) return
      if (typeof window === "undefined" || !window.ethereum) return

      hasAttemptedConnection = true

      try {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        }) as string[]

        if (accounts.length > 0 && mounted) {
          const existingAddress = accounts[0].toLowerCase()
          
          // Check if we already have this address connected - don't reconnect
          if (address && address === existingAddress) {
            return
          }
          
          await connect()
        } else {
          const storedToken = getStoredToken()
          if (storedToken && mounted) {
            try {
              const user = await getCurrentUser(storedToken)
              setToken(storedToken)
              setAddress(user.address)
            } catch {
              removeStoredToken()
            }
          }
        }
      } catch {
        // Silent fail for auto-connect
      }
    }

    checkConnection()

    return () => {
      mounted = false
    }
  }, []) // Empty dependency - only run once on mount

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        balance,
        isConnected: !!address,
        isConnecting,
        isAuthenticated: !!token,
        isAuthenticating,
        error,
        connect,
        disconnect,
        switchChain,
        addWallet,
        removeWallet,
        switchWallet,
        checkWalletLinked,
        signer,
        provider,
        token,
        linkedWallets,
        selectedWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}

export function useAuth() {
  const { isConnected, isAuthenticated, token, address } = useWallet()
  
  const authHeaders = useCallback(() => {
    if (!token) return {}
    return {
      "Authorization": `Bearer ${token}`,
    }
  }, [token])

  return {
    isConnected,
    isAuthenticated,
    token,
    address,
    authHeaders,
  }
}

export function formatAddress(addr: string | null): string {
  if (!addr) return ""
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function formatBalance(balance: string | null): string {
  if (!balance) return "0"
  const num = parseFloat(balance)
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`
  if (num >= 1) return num.toFixed(4)
  return num.toFixed(6)
}
