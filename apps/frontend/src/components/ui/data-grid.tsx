import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

export function DataGridHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-white-text h-min grid col-span-full grid-cols-subgrid uppercase text-sm font-mono",
        className,
      )}
      {...props}
    />
  );
}

export function DataGridHead({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-background-secondary border-t border-t-background-secondary-highlight px-1",
        className,
      )}
      {...props}
    />
  );
}

export function DataGridBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid col-span-full grid-cols-subgrid text-orange-text bg-border gap-px",
        className,
      )}
      {...props}
    />
  );
}

export function DataGridRow({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid col-span-full grid-cols-subgrid *:bg-background hover:*:bg-selection-background font-mono *:px-1",
        className,
      )}
      {...props}
    />
  );
}
