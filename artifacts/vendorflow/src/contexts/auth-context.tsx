import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
  tenantId: number;
  createdAt: string;
  isActive?: boolean;
  lastLogin?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  accessToken: string | null;
  login: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ACCESS: "vf_access_token",
  REFRESH: "vf_refresh_token",
  USER: "vf_user",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, restore session from localStorage
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(STORAGE_KEYS.ACCESS);
      const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (storedToken && storedUser) {
        setAccessToken(storedToken);
        setUser(JSON.parse(storedUser));
        // Configure the global token getter so all API calls get the header
        setAuthTokenGetter(() => localStorage.getItem(STORAGE_KEYS.ACCESS));
      }
    } catch {
      // ignore parse errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback((newUser: AuthUser, token: string, refreshToken: string) => {
    localStorage.setItem(STORAGE_KEYS.ACCESS, token);
    localStorage.setItem(STORAGE_KEYS.REFRESH, refreshToken);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
    setAccessToken(token);
    setUser(newUser);
    setAuthTokenGetter(() => localStorage.getItem(STORAGE_KEYS.ACCESS));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS);
    localStorage.removeItem(STORAGE_KEYS.REFRESH);
    localStorage.removeItem(STORAGE_KEYS.USER);
    setAccessToken(null);
    setUser(null);
    setAuthTokenGetter(null);
    queryClient.clear();
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, isLoading, accessToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
