import { ProcedureStack } from "@mrt/yamcs-effect";

import { launchPadSetupSteps } from "./tw2/01-launch-pad-setup";
import { simultaneousOperationsSteps } from "./tw2/02-simultaneous-operations";
import { disconnectionTestingSteps } from "./tw2/03-disconnection-testing";
import { postRaiseTeamPictureSteps } from "./tw2/04-post-raise-team-picture";
import { finalSimultaneousChecksSteps } from "./tw2/05-final-simultaneous-checks";
import { goNoGoToTw3Steps } from "./tw2/06-go-no-go-to-tw3";

export const TW2 = ProcedureStack.make({
  steps: [
    ...launchPadSetupSteps,
    ...simultaneousOperationsSteps,
    ...disconnectionTestingSteps,
    ...postRaiseTeamPictureSteps,
    ...finalSimultaneousChecksSteps,
    ...goNoGoToTw3Steps,
  ],
});
