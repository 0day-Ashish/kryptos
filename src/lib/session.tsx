"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useMemo,
} from "react";
import type { UserProfile, AuthState } from "./schemas";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STORAGE_KEYS = {
  TOKEN: "kryptos_email_token",
  REFRESH_TOKEN: "kryptos_refresh_token",
  USER_PROFILE: "kryptos_user_profile",
  ONBOARDING_COMPLETE: "kryptos_onboarding_complete",
};

function isFetchNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    /fetch|network|failed/i.test(error.message || "")
  );
}

interface SessionContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  verifyEmail: (otp: string) => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  updateProfile: (profile: UserProfile) => void;
  refreshUserProfile: () => Promise<void>;
  completeOnboarding: () => void;
  isOnboardingComplete: boolean;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(
    null,
  );
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  const authState = useMemo<AuthState>(
    () => ({
      isAuthenticated: !!token && !!user,
      isEmailVerified: user?.is_email_verified ?? false,
      hasWalletConnected: (user?.linked_wallets?.length ?? 0) > 0,
      user,
      token,
      refreshToken: refreshTokenValue,
    }),
    [token, user, refreshTokenValue],
  );

  const loadFromStorage = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
      const storedRefreshToken = localStorage.getItem(
        STORAGE_KEYS.REFRESH_TOKEN,
      );
      const storedProfile = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      const onboardingComplete = localStorage.getItem(
        STORAGE_KEYS.ONBOARDING_COMPLETE,
      );

      if (storedToken) setToken(storedToken);
      if (storedRefreshToken) setRefreshTokenValue(storedRefreshToken);
      if (storedProfile) setUser(JSON.parse(storedProfile));
      setIsOnboardingComplete(onboardingComplete === "true");
    } catch (error) {
      console.error("Error loading session from storage:", error);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setRefreshTokenValue(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
  }, []);

  useEffect(() => {
    loadFromStorage();
    setIsLoading(false);
  }, [loadFromStorage]);

  // Refresh user profile from backend when token is available
  useEffect(() => {
    if (token && !isLoading) {
      const fetchProfile = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (response.status === 401 || response.status === 403) {
            // Token is no longer valid; clear auth state.
            logout();
            return;
          }

          if (response.ok) {
            const data = await response.json();
            const updatedProfile: UserProfile = {
              id: data.id,
              email: data.email,
              is_email_verified: data.is_email_verified,
              premium_tier: data.premium_tier,
              subscription_status: data.subscription_status,
              linked_wallets: data.linked_wallets || [],
              created_at: data.created_at,
              avatar_url: data.avatar_url,
              display_name: data.display_name,
            };
            setUser(updatedProfile);
            localStorage.setItem(
              STORAGE_KEYS.USER_PROFILE,
              JSON.stringify(updatedProfile),
            );
          }
        } catch (error) {
          // Backend might be offline in local dev; keep cached profile silently.
          if (isFetchNetworkError(error)) {
            console.warn("Profile refresh skipped: backend unreachable");
            return;
          }
          console.error("Error fetching user profile:", error);
        }
      };
      fetchProfile();
    }
  }, [token, isLoading, logout]);

  const fetchUserProfile = useCallback(async (authToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const updatedProfile: UserProfile = {
          id: data.id,
          email: data.email,
          is_email_verified: data.is_email_verified,
          premium_tier: data.premium_tier,
          subscription_status: data.subscription_status,
          linked_wallets: data.linked_wallets || [],
          created_at: data.created_at,
          avatar_url: data.avatar_url,
          display_name: data.display_name,
        };
        setUser(updatedProfile);
        localStorage.setItem(
          STORAGE_KEYS.USER_PROFILE,
          JSON.stringify(updatedProfile),
        );
        return updatedProfile;
      }
    } catch (error) {
      if (isFetchNetworkError(error)) {
        console.warn("Profile fetch skipped: backend unreachable");
        return null;
      }
      console.error("Error fetching user profile:", error);
    }
    return null;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || "Login failed");
      }

      const data = await response.json();

      setToken(data.token);
      setRefreshTokenValue(data.refresh_token);

      localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);

      // Fetch full profile from /auth/me to get correct tier and linked wallets
      await fetchUserProfile(data.token);
    },
    [fetchUserProfile],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || "Registration failed");
      }

      const data = await response.json();

      // Auto-login after registration (since we're skipping OTP)
      const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        setToken(loginData.token);
        setRefreshTokenValue(loginData.refresh_token);

        localStorage.setItem(STORAGE_KEYS.TOKEN, loginData.token);
        localStorage.setItem(
          STORAGE_KEYS.REFRESH_TOKEN,
          loginData.refresh_token,
        );

        // Fetch full profile to get correct tier and linked wallets
        await fetchUserProfile(loginData.token);
      }

      return data;
    },
    [fetchUserProfile],
  );

  const verifyEmail = useCallback(
    async (otp: string) => {
      if (!token) throw new Error("No token available");

      const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ otp }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || "Verification failed");
      }

      const data = await response.json();

      setToken(data.token);
      setRefreshTokenValue(data.refresh_token);

      localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);

      if (user) {
        const updatedUser = { ...user, is_email_verified: true };
        setUser(updatedUser);
        localStorage.setItem(
          STORAGE_KEYS.USER_PROFILE,
          JSON.stringify(updatedUser),
        );
      }
    },
    [token, user],
  );

  const refreshAccessToken = useCallback(async () => {
    if (!refreshTokenValue) return;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshTokenValue }),
      });

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();

      setToken(data.token);
      setRefreshTokenValue(data.refresh_token);

      localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
    } catch (error) {
      console.error("Token refresh failed:", error);
      logout();
    }
  }, [refreshTokenValue, logout]);

  const updateProfile = useCallback((profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  }, []);

  const refreshUserProfile = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const updatedProfile: UserProfile = {
          id: data.id,
          email: data.email,
          is_email_verified: data.is_email_verified,
          premium_tier: data.premium_tier,
          subscription_status: data.subscription_status,
          linked_wallets: data.linked_wallets || [],
          created_at: data.created_at,
          avatar_url: data.avatar_url,
          display_name: data.display_name,
        };
        setUser(updatedProfile);
        localStorage.setItem(
          STORAGE_KEYS.USER_PROFILE,
          JSON.stringify(updatedProfile),
        );
      }
    } catch (error) {
      if (isFetchNetworkError(error)) {
        console.warn("Profile refresh skipped: backend unreachable");
        return;
      }
      console.error("Error refreshing user profile:", error);
    }
  }, [token]);

  const completeOnboarding = useCallback(() => {
    setIsOnboardingComplete(true);
    localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, "true");
  }, []);

  const value = useMemo<SessionContextType>(
    () => ({
      ...authState,
      login,
      register,
      logout,
      verifyEmail,
      refreshAccessToken,
      updateProfile,
      refreshUserProfile,
      completeOnboarding,
      isOnboardingComplete,
    }),
    [
      authState,
      login,
      register,
      logout,
      verifyEmail,
      refreshAccessToken,
      updateProfile,
      refreshUserProfile,
      completeOnboarding,
      isOnboardingComplete,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
