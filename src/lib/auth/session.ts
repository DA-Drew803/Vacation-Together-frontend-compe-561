const ACCESS_TOKEN_KEY = "vacation-together-token";
const listeners = new Set<() => void>();

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return getStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function setAccessToken(token: string): void {
  getStorage()?.setItem(ACCESS_TOKEN_KEY, token);
  listeners.forEach((listener) => listener());
}

export function clearAccessToken(): void {
  getStorage()?.removeItem(ACCESS_TOKEN_KEY);
  listeners.forEach((listener) => listener());
}

export function subscribeToAuthSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
