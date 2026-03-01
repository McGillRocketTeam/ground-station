import type { ComponentProps } from "react";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export function DataGridHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-white-text col-span-full grid h-min grid-cols-subgrid font-mono text-sm uppercase",
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
        "bg-background-secondary border-t-background-secondary-highlight border-t px-1",
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
        "text-orange-text bg-border col-span-full grid grid-cols-subgrid gap-px text-sm",
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
        "*:bg-background hover:*:bg-selection-background col-span-full grid grid-cols-subgrid font-mono *:px-1",
        className,
      )}
      {...props}
    />
  );
}

export function DataGridSearch({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <DataGridHead className={cn("relative", className)}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "placeholder:text-muted-foreground/30 h-full w-full px-2 focus:ring-0 focus:outline-none",
        )}
      />

      {value.length > 0 && (
        <button
          onClick={() => onChange("")}
          className="text-muted-foreground absolute inset-y-0 right-0.5 z-10 size-5 cursor-pointer p-1"
        >
          <X className="size-3" />
        </button>
      )}
    </DataGridHead>
  );
}
