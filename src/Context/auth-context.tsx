"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  type CurrentUser,
} from "@/lib/api/auth";
import { getAccessToken } from "@/lib/auth/session";

type AuthContextValue = {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<CurrentUser>;
  register: (
    displayName: string,
    email: string,
    password: string,
  ) => Promise<CurrentUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<
  AuthContextValue | undefined
>(undefined);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      return;
    }

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refreshUser().finally(() => {
      setIsLoading(false);
    });
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const currentUser = await apiLogin(email, password);
      setUser(currentUser);
      return currentUser;
    },
    [],
  );

  const register = useCallback(
    async (
      displayName: string,
      email: string,
      password: string,
    ) => {
      const currentUser = await apiRegister(
        displayName,
        email,
        password,
      );

      setUser(currentUser);
      return currentUser;
    },
    [],
  );

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refreshUser,
    }),
    [
      user,
      isLoading,
      login,
      register,
      logout,
      refreshUser,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside an AuthProvider",
    );
  }

  return context;
}