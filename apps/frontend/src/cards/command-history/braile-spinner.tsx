import { useEffect, useState } from "react";

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

type BrailleSpinnerProps = {
  intervalMs?: number;
  className?: string;
  ariaLabel?: string;
};

export function BrailleSpinner({
  intervalMs = 80,
  className,
  ariaLabel = "Loading",
}: BrailleSpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((prev) => (prev + 1) % BRAILLE_FRAMES.length);
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs]);

  return (
    <span className={className} aria-label={ariaLabel} role="status">
      {BRAILLE_FRAMES[frame]}
    </span>
  );
}
