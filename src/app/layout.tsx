import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vacation Together | Plan a trip everyone agrees on",
  description:
    "Bring your group's dates, budget, and interests together to plan a trip everyone can look forward to.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const saved = localStorage.getItem("vacation-together-theme"); document.documentElement.dataset.theme = saved === "light" || saved === "dark" ? saved : "dark"; } catch (_) { document.documentElement.dataset.theme = "dark"; } })();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
