import { apiFetch } from "@/lib/api/client";
import { clearAccessToken, setAccessToken } from "@/lib/auth/session";

export type CurrentUser = {
  id: string;
  email: string;
  display_name: string;
};

type AuthResponse = {
  access_token: string;
  token_type: string;
  user: CurrentUser;
};

export async function login(email: string, password: string): Promise<CurrentUser> {
  const result = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(result.access_token);
  return getCurrentUser();
}

export async function register(
  displayName: string,
  email: string,
  password: string,
): Promise<CurrentUser> {
  const result = await apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ display_name: displayName, email, password }),
  });
  setAccessToken(result.access_token);
  return getCurrentUser();
}

export function getCurrentUser() {
  return apiFetch<CurrentUser>("/auth/me");
}

export function logout(): void {
  clearAccessToken();
}
