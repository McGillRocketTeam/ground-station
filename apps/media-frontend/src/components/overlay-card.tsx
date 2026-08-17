import type { ReactNode } from "react";

import { motion, type HTMLMotionProps } from "motion/react";

import { cn } from "../lib/utils.ts";

export const overlayCardSpring = {
  type: "spring" as const,
  stiffness: 170,
  damping: 22,
  mass: 0.8,
};

type OverlayCardProps = Omit<HTMLMotionProps<"article">, "children" | "title"> & {
  title: ReactNode;
  children: ReactNode;
  animateAppearance?: boolean;
  inlineLayout?: boolean;
  layoutMode?: boolean | "position" | "size";
  showCutCornerBorder?: boolean;
};

export function OverlayCard({
  title,
  children,
  className,
  style,
  animateAppearance = true,
  inlineLayout = false,
  layoutMode = true,
  showCutCornerBorder = false,
  ...props
}: OverlayCardProps) {
  return (
    <motion.article
      layout={layoutMode}
      initial={animateAppearance ? { opacity: 0, filter: "blur(8px)" } : false}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={animateAppearance ? { opacity: 0, filter: "blur(8px)" } : undefined}
      transition={overlayCardSpring}
      className={cn(
        "relative grid max-w-fit overflow-hidden border border-white/35 text-white",
        inlineLayout ? "grid-cols-[auto_1fr] grid-rows-1" : "grid-rows-[auto_1fr]",
        className,
      )}
      style={{
        ...style,
        clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)",
      }}
      {...props}
    >
      <div className="absolute inset-0 bg-black/80" aria-hidden="true" />
      {showCutCornerBorder && (
        <svg
          className="pointer-events-none absolute top-0 right-0 z-10 size-4"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <line x1="0" y1="0" x2="16" y2="16" stroke="rgba(255, 255, 255, 0.35)" />
        </svg>
      )}
      <motion.header
        layout
        className={cn(
          "relative py-1 px-2 font-bold uppercase",
          inlineLayout && "flex items-center px-2 py-1 leading-none",
        )}
        style={{ background: "linear-gradient(90deg, #B20606 0%, #d13232 100%)" }}
        transition={overlayCardSpring}
      >
        {title}
      </motion.header>
      <motion.div
        layout
        className={cn(
          "relative min-w-0 p-2",
          inlineLayout && "flex items-center px-2 py-1 leading-none",
        )}
        transition={overlayCardSpring}
      >
        {children}
      </motion.div>
    </motion.article>
  );
}
