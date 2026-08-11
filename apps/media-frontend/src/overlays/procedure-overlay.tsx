import { OverlayCard, OverlayCardHeader } from "../components/overlay-card.tsx";

type ProcedureOverlayProps = {
  code: `TW${1 | 2 | 3 | 4}`;
  title: string;
  blurb: string;
};

export function ProcedureOverlay({ code, title, blurb }: ProcedureOverlayProps) {
  const step = Number(code.slice(2));

  return (
    <main className="relative h-screen w-screen" aria-label={`${code} procedure overlay`}>
      <OverlayCard className="absolute right-8 bottom-8 w-[min(34rem,calc(100vw-6rem))]">
        <OverlayCardHeader>
          <span>Current step</span>
          <span>{step}/4</span>
        </OverlayCardHeader>

        <div className="p-4">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-xl font-medium tracking-[0.03em] uppercase">{title}</h1>
            <span className="shrink-0 text-xs font-medium tracking-[0.16em] text-white/55 uppercase">
              {code}
            </span>
          </div>

          <p className="mt-2 max-w-[52ch] text-base leading-relaxed text-white/78">{blurb}</p>
        </div>

        <footer className="border-t border-border p-2">
          <div className="grid grid-cols-4 gap-2" aria-label={`Procedure ${step} of 4`}>
            {[1, 2, 3, 4].map((index) => (
              <span
                key={index}
                className={index <= step ? "h-1 bg-white" : "h-1 bg-white/20"}
                aria-hidden="true"
              />
            ))}
          </div>
        </footer>
      </OverlayCard>
    </main>
  );
}
