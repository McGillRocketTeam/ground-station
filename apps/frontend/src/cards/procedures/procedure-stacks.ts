import { Schema } from "effect";

import { TW1 } from "./procedures/tw1";
import { TW2 } from "./procedures/tw2";

export const ProcedureTypeSchema = Schema.Literals(["tw1", "tw2"]);
export type ProcedureType = typeof ProcedureTypeSchema.Type;

export const getProcedureStack = (procedureType: ProcedureType) =>
  procedureType === "tw2" ? TW2 : TW1;
