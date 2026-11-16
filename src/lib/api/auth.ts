import { apiFetch } from "@/lib/api/client";

export type CurrentUser = {
  id: string;
  email: string;
  display_name: string;
};

export function getCurrentUser() {
  return apiFetch<CurrentUser>("/auth/me");
}
