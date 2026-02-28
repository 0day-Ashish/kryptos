"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

// ── Types ───────────────────────────────────────────────────────────────────

interface AuthState {
  address: string | null;
  token: string | null;
  isAuthenticated: boolean;
  isConnecting: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: (providerKey?: string) => Promise<void>;
  signOut: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const STORAGE_KEY = "kryptos_auth";

// ── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    address: null,
    token: null,
    isAuthenticated: false,
    isConnecting: false,
    error: null,
  });

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { address, token } = JSON.parse(raw);
        if (address && token) {
          // Validate the token hasn't expired by calling /auth/me
          fetch(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => {
              if (r.ok) {
                setState({
                  address,
                  token,
                  isAuthenticated: true,
                  isConnecting: false,
                  error: null,
                });
              } else {
                // Token expired
                localStorage.removeItem(STORAGE_KEY);
              }
            })
            .catch(() => {
              localStorage.removeItem(STORAGE_KEY);
            });
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Listen for MetaMask account changes
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth?.on) return;

    const handler = (accounts: string[]) => {
      if (accounts.length === 0 || accounts[0].toLowerCase() !== state.address) {
        // Account changed or disconnected → sign out
        setState({
          address: null,
          token: null,
          isAuthenticated: false,
          isConnecting: false,
          error: null,
        });
        localStorage.removeItem(STORAGE_KEY);
      }
    };

    eth.on("accountsChanged", handler);
    return () => eth.removeListener("accountsChanged", handler);
  }, [state.address]);

  // ── Sign in (SIWE flow) ───────────────────────────────────────────────

  const signIn = useCallback(async (providerKey?: string) => {
    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      // 1. Get wallet provider
      const eth = (window as any).ethereum;
      if (!eth) {
        setState((s) => ({
          ...s,
          isConnecting: false,
          error: "No wallet detected. Install MetaMask or another Web3 wallet.",
        }));
        return;
      }

      let provider: any = eth;

      if (providerKey === "metamask") {
        if (eth.providers?.length) {
          provider = eth.providers.find((p: any) => p.isMetaMask) || eth;
        } else if (!eth.isMetaMask) {
          setState((s) => ({ ...s, isConnecting: false, error: "MetaMask not found." }));
          return;
        }
      } else if (providerKey === "coinbase") {
        if (eth.providers?.length) {
          provider =
            eth.providers.find(
              (p: any) => p.isCoinbaseWallet || p.isCoinbaseBrowser
            ) || null;
        } else if (eth.isCoinbaseWallet || eth.isCoinbaseBrowser) {
          provider = eth;
        } else {
          provider = null;
        }
        if (!provider) {
          setState((s) => ({ ...s, isConnecting: false, error: "Coinbase Wallet not found." }));
          return;
        }
      }

      // 2. Request accounts
      const accounts: string[] = await provider.request({
        method: "eth_requestAccounts",
      });
      if (accounts.length === 0) {
        setState((s) => ({ ...s, isConnecting: false, error: "No account selected." }));
        return;
      }
      const address = accounts[0].toLowerCase();

      // 3. Request nonce from backend
      const nonceRes = await fetch(`${API}/auth/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!nonceRes.ok) {
        const err = await nonceRes.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to get nonce");
      }
      const { message } = await nonceRes.json();

      // 4. Sign the message (gasless personal_sign)
      const signature: string = await provider.request({
        method: "personal_sign",
        params: [message, address],
      });

      // 5. Verify signature with backend → get JWT
      const verifyRes = await fetch(`${API}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, message }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.detail || "Verification failed");
      }
      const { token } = await verifyRes.json();

      // 6. Save session
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ address, token }));
      setState({
        address,
        token,
        isAuthenticated: true,
        isConnecting: false,
        error: null,
      });
    } catch (err: any) {
      const msg =
        err.code === 4001
          ? "Connection rejected by user."
          : err.message || "Authentication failed.";
      setState((s) => ({ ...s, isConnecting: false, error: msg }));
    }
  }, []);

  // ── Sign out ──────────────────────────────────────────────────────────

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      address: null,
      token: null,
      isAuthenticated: false,
      isConnecting: false,
      error: null,
    });
  }, []);

  // ── Auth headers helper ───────────────────────────────────────────────

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (!state.token) return {};
    return { Authorization: `Bearer ${state.token}` };
  }, [state.token]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signOut,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
