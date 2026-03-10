import { useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { NamedObjectId } from "@mrt/yamcs-effect";
import { Schema } from "effect";
import { Info, ListTree } from "lucide-react";
import { Suspense } from "react";
import { Fragment } from "react/jsx-runtime";

import { DashboardHeader } from "@/components/dashboard/header";
import { parameterSubscriptionAtom } from "@/lib/atom";
import { cn, stringifyValue } from "@/lib/utils";

const DangerLevel = Schema.Literals(["WARNING", "CRITICAL"]);

const InformationProcedureStep = Schema.TaggedStruct("Information", {
  danger: Schema.optional(DangerLevel),
  role: Schema.String,
  text: Schema.String,
});

const ParameterProcedureStep = Schema.TaggedStruct("Parameter", {
  danger: Schema.optional(DangerLevel),
  role: Schema.String,
  text: Schema.String,
  parameters: Schema.Array(
    Schema.Union([
      Schema.Struct({
        parameter: NamedObjectId,
        condition: Schema.optional(Schema.Literals(["==", ">=", "<="])),
        value: Schema.optional(Schema.String),
      }),
    ]),
  ),
});

const ProcedureStep = Schema.Union([
  InformationProcedureStep,
  ParameterProcedureStep,
]);
type ProcedureStep = typeof ProcedureStep.Type;

const procedures: Array<ProcedureStep> = [
  InformationProcedureStep.makeUnsafe({
    role: "AVC",
    text: "Connect the COTS power harness to the COTS Battery",
  }),
  InformationProcedureStep.makeUnsafe({
    role: "AVC",
    text: "Remove the pull pin to arm the Blue Raven and the RRC3.",
  }),
  InformationProcedureStep.makeUnsafe({
    role: "AVC",
    text: "Confirm that the Blue Raven is powered by an audible beep.",
  }),
  InformationProcedureStep.makeUnsafe({
    role: "AVC",
    text: "Confirm that the RRC3 is powered by an audible beep.",
  }),
  InformationProcedureStep.makeUnsafe({
    role: "AVC",
    text: "Insert the pull pin to disarm the Blue Raven and the RRC3.",
  }),
  InformationProcedureStep.makeUnsafe({
    danger: "WARNING",
    role: "AVC",
    text: "COTS avionics system is validated for assembly procedures.",
  }),
  InformationProcedureStep.makeUnsafe({
    role: "AVC",
    text: "Connect the SRAD e-matches to both energize channels of FC-B.",
  }),
  InformationProcedureStep.makeUnsafe({
    role: "AVC",
    text: "Pass the SRAD e-matches through the hole in the avionics plate.",
  }),
  InformationProcedureStep.makeUnsafe({
    role: "AVC",
    text: "Cover the e-matches and the wires that pass through the hole with jeans.",
  }),
  InformationProcedureStep.makeUnsafe({
    role: "AVC",
    text: "Secure the jeans to the avionics plate with duct tape.",
  }),
  InformationProcedureStep.makeUnsafe({
    role: "AVC",
    text: "Connect the SRAD power harness to the SRAD Battery.",
  }),
  InformationProcedureStep.makeUnsafe({
    role: "AVC",
    text: "Remove the pull pin from the SRAD power harness to arm the SRAD system.",
  }),
  InformationProcedureStep.makeUnsafe({
    role: "AVC",
    text: "Confirm that the LEDs on the COTSplane, the FCs, and the GPS are ON, indicating that they are powered.",
  }),
  ParameterProcedureStep.makeUnsafe({
    role: "GSC",
    text: "Confirm that telemetry packets are updating regularly from FC-A.",
    parameters: [
      {
        parameter: {
          name: "/yamcs/leo-mbp/links/SystemA/ControlStation/Radio/dataInCount",
        },
        condition: ">=",
        value: "1",
      },
    ],
  }),
  ParameterProcedureStep.makeUnsafe({
    role: "GSC",
    text: "Confirm that telemetry packets are updating regularly from FC-B.",
    parameters: [
      {
        parameter: {
          name: "/yamcs/leo-mbp/links/SystemB/ControlStation/Radio/dataInCount",
        },
        condition: ">=",
        value: "1",
      },
    ],
  }),
  InformationProcedureStep.makeUnsafe({
    role: "AVC",
    text: "Bring the system outside to allow the GPS to lock.",
  }),
  InformationProcedureStep.makeUnsafe({
    role: "AVC",
    text: "Confirm that the Time pulse LED is flashing on both GPS.",
  }),
  ParameterProcedureStep.makeUnsafe({
    role: "GSC",
    text: "Confirm that the latitude and longitude displayed on the GUI are correct.",
    parameters: [
      {
        parameter: {
          name: "/SystemA/Rocket/FlightComputer/gps_latitude",
        },
      },
      {
        parameter: {
          name: "/SystemA/Rocket/FlightComputer/gps_longitude",
        },
      },
      {
        parameter: {
          name: "/SystemA/Rocket/FlightComputer/gps_altitude",
        },
      },
    ],
  }),
];

export function ProceduresPage() {
  return (
    <div className="py-1.25 flex flex-col max-w-3xl mx-auto gap-2">
      <DashboardHeader className="sticky top-0 pt-1.25 pb-2 bg-background border-b" />
      <h1 className="font-mono uppercase text-base font-semibold">
        URRG Avionics Procedures
      </h1>

      <div className="grid grid-cols-[auto_auto_1fr_auto]">
        {procedures.map((step, index) => (
          <ProcedureRow key={step.text} step={step} index={index} />
        ))}
      </div>
    </div>
  );
}

function ProcedureRow({ step, index }: { step: ProcedureStep; index: number }) {
  return (
    <button
      className={cn(
        "grid grid-cols-subgrid col-span-full border-b gap-x-4 p-4 cursor-pointer text-left hover:bg-muted",
        step.danger === "WARNING" && "bg-warning/10 hover:bg-warning/30",
      )}
    >
      <div
        className={cn(
          "text-right text-muted-foreground",
          step.danger === "WARNING" && "text-warning",
        )}
      >
        {index + 1}.
      </div>
      <div
        className={cn(
          "font-mono text-muted-foreground",
          step.danger === "WARNING" && "text-warning",
        )}
      >
        {step.role}
      </div>
      {/* <div */}
      {/*   className={cn( */}
      {/*     "text-muted-foreground flex flex-row items-center gap-2", */}
      {/*     step.danger === "WARNING" && "text-warning", */}
      {/*   )} */}
      {/* > */}
      {/*   {step._tag === "Information" && <Info className="h-lh w-4" />} */}
      {/*   {step._tag === "Parameter" && <ListTree className="h-lh w-4" />} */}
      {/*   {step._tag} */}
      {/* </div> */}
      <div
        className={cn(
          "text-pretty",
          step.danger === "WARNING" && "text-warning",
        )}
      >
        {step.text}
      </div>
      <div>1.</div>

      {step._tag === "Parameter" &&
        step.parameters.map((value) => (
          <Fragment key={value.parameter.name}>
            <div />
            <div />
            <div className="font-mono text-sm pt-2">
              {value.parameter.name} {value.condition} {value.value}
            </div>
            <Suspense fallback={<div>...</div>}>
              <Value parameter={value.parameter} />
            </Suspense>
          </Fragment>
        ))}
    </button>
  );
}

function Value({ parameter }: { parameter: typeof NamedObjectId.Type }) {
  return (
    <div>
      {stringifyValue(
        useAtomSuspense(parameterSubscriptionAtom(parameter.name)).value
          .engValue,
      )}
    </div>
  );
}
