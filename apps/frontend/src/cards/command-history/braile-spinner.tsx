const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const BRAILLE_LOOP_FRAMES = [...BRAILLE_FRAMES, BRAILLE_FRAMES[0]];

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
  const durationMs = intervalMs * BRAILLE_FRAMES.length;

  return (
    <output className={className} aria-label={ariaLabel} role="status" aria-live="off">
      <span className="sr-only">{ariaLabel}</span>
      <span className="braille-spinner" aria-hidden="true">
        <span className="braille-spinner__frames" style={{ animationDuration: `${durationMs}ms` }}>
          {BRAILLE_LOOP_FRAMES.map((frame, index) => (
            <span key={`${frame}-${index}`} className="block h-[1em] leading-none">
              {frame}
            </span>
          ))}
        </span>
      </span>
    </output>
  );
}
