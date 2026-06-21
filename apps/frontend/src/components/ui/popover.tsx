import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import * as React from "react";

import { cn } from "@/lib/utils";

function Popover<Payload>({ ...props }: PopoverPrimitive.Root.Props<Payload>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function ArrowSvg(props: React.ComponentProps<"svg">) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66 2.6L4.81 6.97C4.07 7.63 3.12 8 2.13 8H0V10H20V8H18.53C17.55 8 16.59 7.63 15.86 6.97L11 2.6C10.62 2.26 10.04 2.26 9.66 2.6Z"
        className="fill-popover"
      />
      <path
        d="M9 1.86C9.76 1.17 10.91 1.17 11.67 1.86L16.53 6.23C17.08 6.73 17.79 7 18.53 7H15.89L11 2.6C10.62 2.26 10.04 2.26 9.66 2.6L4.78 7H2.13C2.87 7 3.59 6.73 4.14 6.23L9 1.86Z"
        className="fill-border"
      />
      <path
        d="M10.33 3.35L5.48 7.72C4.56 8.54 3.37 9 2.13 9H0V8H2.13C3.12 8 4.07 7.63 4.81 6.97L9.66 2.6C10.04 2.26 10.62 2.26 11 2.6L15.86 6.97C16.59 7.63 17.55 8 18.53 8H20V9H18.53C17.3 9 16.11 8.54 15.19 7.72L10.33 3.35Z"
        className="dark:fill-ring-foreground/20"
      />
    </svg>
  );
}

function PopoverArrow(props: PopoverPrimitive.Arrow.Props) {
  return (
    <PopoverPrimitive.Arrow
      data-slot="popover-arrow"
      className={cn(
        "pointer-events-none absolute",
        "data-[side=bottom]:-top-2",
        "data-[side=top]:-bottom-2 data-[side=top]:rotate-180",
        "data-[side=left]:-right-3.25 data-[side=left]:rotate-90",
        "data-[side=right]:-left-3.25 data-[side=right]:-rotate-90",
      )}
      {...props}
    >
      <ArrowSvg />
    </PopoverPrimitive.Arrow>
  );
}

function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 flex origin-(--transform-origin) flex-col gap-4 rounded-lg bg-popover p-2.5 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-1 text-xs", className)}
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  );
}

function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
