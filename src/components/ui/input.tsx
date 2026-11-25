import type * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex min-h-11 w-full border border-[var(--page-rule)] bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-[#c79a2b] focus-visible:ring-1 focus-visible:ring-[#c79a2b] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
