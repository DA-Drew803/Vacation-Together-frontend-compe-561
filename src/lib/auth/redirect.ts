export function safeAuthRedirect(value: string | null, fallback = "/trips"): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
