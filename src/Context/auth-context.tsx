"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { getAccessToken, subscribeToAuthSession } from "@/lib/auth/session";

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
  const operationId = useRef(0);

  const refreshUser = useCallback(async () => {
    const currentOperation = ++operationId.current;
    if (!getAccessToken()) {
      if (currentOperation === operationId.current) setUser(null);
      return;
    }

    try {
      const currentUser = await getCurrentUser();
      if (currentOperation === operationId.current) setUser(currentUser);
    } catch {
      if (currentOperation === operationId.current) setUser(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const restore = getAccessToken() ? getCurrentUser() : Promise.resolve(null);
    void restore.then(
      (currentUser) => { if (active) setUser(currentUser); },
      () => { if (active) setUser(null); },
    ).finally(() => { if (active) setIsLoading(false); });

    const unsubscribe = subscribeToAuthSession(() => {
      if (!getAccessToken()) {
        operationId.current += 1;
        setUser(null);
      }
    });
    const handleStorage = () => { void refreshUser(); };
    window.addEventListener("storage", handleStorage);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const currentUser = await apiLogin(email, password);
      operationId.current += 1;
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
      operationId.current += 1;
      setUser(currentUser);
      return currentUser;
    },
    [],
  );

  const logout = useCallback(() => {
    operationId.current += 1;
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
