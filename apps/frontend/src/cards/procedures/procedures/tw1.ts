import { ProcedureStack } from "@mrt/yamcs-effect";

import { propAvAndTestingSteps } from "./tw1/01-prop-av-and-testing";
import { avPropulsionIntegrationAndTelemetryVerificationSteps } from "./tw1/02-av-propulsion-integration-and-telemetry-verification";
import { basicVentValveVerificationSteps } from "./tw1/03-basic-vent-valve-verification";
import { basicMovVerificationSteps } from "./tw1/04-basic-mov-verification";
import { basicFdovVerificationSteps } from "./tw1/05-basic-fdov-verification";
import { abortFunctionalVerificationSteps } from "./tw1/06-abort-functional-verification";
import { avPropSubAssemblyCompleteSteps } from "./tw1/07-av-prop-sub-assembly-complete";
import { finalRocketAssemblyProcedureSteps } from "./tw1/08-final-rocket-assembly-procedures";
import { recoverySubSystemCommandAndTelemetryVerificationSteps } from "./tw1/09-recovery-sub-system-command-and-telemetry-verification";
import { sradAvionicsSystemValidatedForFlightSteps } from "./tw1/10-srad-avionics-system-validated-for-flight";

export const TW1 = ProcedureStack.make({
  steps: [
    ...propAvAndTestingSteps,
    ...avPropulsionIntegrationAndTelemetryVerificationSteps,
    ...basicVentValveVerificationSteps,
    ...basicMovVerificationSteps,
    ...basicFdovVerificationSteps,
    ...abortFunctionalVerificationSteps,
    ...avPropSubAssemblyCompleteSteps,
    ...finalRocketAssemblyProcedureSteps,
    ...recoverySubSystemCommandAndTelemetryVerificationSteps,
    ...sradAvionicsSystemValidatedForFlightSteps,
  ],
});
