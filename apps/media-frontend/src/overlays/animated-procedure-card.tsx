import { AnimatePresence, motion } from "motion/react";

import { OverlayCard, overlayCardSpring } from "../components/overlay-card.tsx";
import {
  countedProcedureCodes,
  getProcedureStep,
  procedureSteps,
  type ProcedureCode,
} from "./procedure-steps.ts";

export function AnimatedProcedureCard({ code }: { code: ProcedureCode }) {
  const { title, blurb } = procedureSteps[code];
  const step = getProcedureStep(code);

  return (
    <OverlayCard
      title={
        step === undefined
          ? "Abort Procedure"
          : `Current Step ${step}/${countedProcedureCodes.length}`
      }
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          layout
          key={code}
          className="grid max-w-[40ch] grid-cols-[1fr_auto] uppercase"
          initial={{ opacity: 0, filter: "blur(8px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(8px)" }}
          transition={overlayCardSpring}
        >
          <h1>{title}</h1>
          <span className="text-base">{code}</span>
          <div className="col-span-full mb-2 h-px bg-white/25" />
          <p className="col-span-full text-pretty normal-case">{blurb}</p>
        </motion.div>
      </AnimatePresence>

      {step !== undefined && (
        <div
          className="grid grid-cols-4 gap-1 pt-2"
          aria-label={`Procedure ${step} of ${countedProcedureCodes.length}`}
        >
          {countedProcedureCodes.map((progressCode, index) => (
            <span key={progressCode} className="h-1 overflow-hidden bg-white/25" aria-hidden="true">
              <motion.span
                className="block h-full origin-left bg-white"
                initial={false}
                animate={{ scaleX: index < step ? 1 : 0 }}
                transition={overlayCardSpring}
              />
            </span>
          ))}
        </div>
      )}
    </OverlayCard>
  );
}
