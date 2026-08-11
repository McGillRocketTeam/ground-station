import type { ComponentProps } from "react";

import { cn } from "../lib/utils.ts";

export function OverlayCard({ className, ...props }: ComponentProps<"article">) {
  return (
    <article
      className={cn(
        "overflow-hidden border border-border bg-[#111513]/88 font-sans text-white shadow-[0_1.25rem_4rem_rgb(0_0_0/35%)] backdrop-blur-md",
        className,
      )}
      {...props}
    />
  );
}

export function OverlayCardHeader({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "overlay-card-header flex items-center justify-between p-2 text-sm font-medium tracking-[0.12em] uppercase",
        className,
      )}
      {...props}
    />
  );
}
