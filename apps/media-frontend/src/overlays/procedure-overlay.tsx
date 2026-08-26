import { OverlayCard } from "../components/overlay-card.tsx";
import { countedProcedureCodes, getProcedureStep, type ProcedureCode } from "./procedure-steps.ts";

type ProcedureOverlayProps = {
  code: ProcedureCode;
  title: string;
  blurb: string;
};

export function ProcedureOverlay({ code, title, blurb }: ProcedureOverlayProps) {
  const step = getProcedureStep(code);

  return (
    <main className="relative h-screen" aria-label={`${code} procedure overlay`}>
      <OverlayCard
        className="absolute bottom-2 left-2"
        title={
          step === undefined
            ? "Abort Procedure"
            : `Current Step ${step}/${countedProcedureCodes.length}`
        }
      >
        <div className="grid grid-cols-[1fr_auto] uppercase">
          <h1>{title}</h1>
          <span className="text-base">{code}</span>
          <div className="col-span-full mb-2 h-px bg-white/25" />
          <p className="col-span-full max-w-[40ch] text-pretty normal-case">{blurb}</p>
          {step !== undefined && (
            <div
              className="col-span-full grid grid-cols-4 gap-1 pt-2"
              aria-label={`Procedure ${step} of ${countedProcedureCodes.length}`}
            >
              {countedProcedureCodes.map((progressCode, index) => (
                <span
                  key={progressCode}
                  className={index < step ? "h-1 bg-white" : "h-1 bg-white/25"}
                  aria-hidden="true"
                />
              ))}
            </div>
          )}
        </div>
      </OverlayCard>
    </main>
  );
}
