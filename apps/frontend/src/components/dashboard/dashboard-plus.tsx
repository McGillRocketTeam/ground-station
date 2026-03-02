import { PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function DashboardPlus() {
  return (
    <button
      className={cn(
        "grid aspect-square h-full place-items-center focus-visible:border focus-visible:outline-none",
      )}
    >
      <PlusIcon className="size-4" />
    </button>
  );
}
