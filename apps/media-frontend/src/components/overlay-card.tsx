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
  layoutMode?: boolean | "position" | "size";
};

export function OverlayCard({
  title,
  children,
  className,
  style,
  animateAppearance = true,
  layoutMode = true,
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
        "relative grid max-w-fit grid-rows-[auto_1fr] overflow-hidden border border-white/35 text-white",
        className,
      )}
      style={{
        ...style,
        clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)",
      }}
      {...props}
    >
      <div className="absolute inset-0 bg-black/80" aria-hidden="true" />
      <motion.header
        layout
        className="relative py-1 px-2 font-bold uppercase"
        style={{ background: "linear-gradient(90deg, #B20606 0%, #d13232 100%)" }}
        transition={overlayCardSpring}
      >
        {title}
      </motion.header>
      <motion.div layout className="relative min-w-0 p-2" transition={overlayCardSpring}>
        {children}
      </motion.div>
    </motion.article>
  );
}
