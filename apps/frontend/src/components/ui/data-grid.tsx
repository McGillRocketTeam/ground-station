import { cn } from "@/lib/utils";
import { X } from "lucide-react";
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
        "grid col-span-full grid-cols-subgrid text-orange-text bg-border gap-px text-sm",
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
          "px-2 w-full h-full placeholder:text-muted-foreground/30 focus:outline-none focus:ring-0",
        )}
      />

      {value.length > 0 && (
        <button
          onClick={() => onChange("")}
          className="size-5 p-1 text-muted-foreground cursor-pointer z-10 absolute inset-y-0 right-0.5"
        >
          <X className="size-3" />
        </button>
      )}
    </DataGridHead>
  );
}
