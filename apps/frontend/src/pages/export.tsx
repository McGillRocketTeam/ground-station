import { useAtomSet, useAtomValue } from "@effect/atom-react";
import React from "react";

import { DashboardHeader } from "@/components/dashboard/header";
import { selectedInstanceAtom } from "@/lib/atom";

import { ExportPageForm } from "./export/form";
import { ExportPreviewTable } from "./export/preview-table";
import {
  exportPreviewOptionsAtom,
  makeDefaultExportFormValues,
} from "./export/state";

export function ExportPage() {
  const selectedInstance = useAtomValue(selectedInstanceAtom);
  const setExportOptions = useAtomSet(exportPreviewOptionsAtom);
  const hasInitialized = React.useRef(false);

  React.useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    setExportOptions(makeDefaultExportFormValues(selectedInstance));
    hasInitialized.current = true;
  }, [selectedInstance, setExportOptions]);

  return (
    <div className="grid h-screen grid-cols-[auto_1fr] grid-rows-[auto_1fr] p-1.25">
      <DashboardHeader className="col-span-full border-b" />

      <aside className="min-w-80 space-y-4 border-r p-2">
        <div className="font-mono text-lg font-semibold uppercase">
          Export Data
        </div>
        <ExportPageForm />
      </aside>
      <main className="min-w-0 p-2">
        <ExportPreviewTable />
      </main>
    </div>
  );
}
