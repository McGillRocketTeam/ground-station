import type { AnyFieldApi } from "@tanstack/react-form";

import { CameraSelector, type DashboardCameraFieldValue } from "./camera-field";
import { FormTable } from "./form-table";

export type DashboardCameraArrayFieldApi = AnyFieldApi & {
  state: AnyFieldApi["state"] & {
    value: ReadonlyArray<DashboardCameraFieldValue> | undefined;
  };
  handleChange: (value: ReadonlyArray<DashboardCameraFieldValue>) => void;
};

export function DashboardCameraArrayField({ field }: { field: DashboardCameraArrayFieldApi }) {
  return (
    <FormTable<DashboardCameraFieldValue>
      addLabel="Add camera"
      columns={[
        {
          header: "Camera",
          render: ({ row, updateRow }) => (
            <CameraSelector value={row || null} onChange={updateRow} />
          ),
        },
      ]}
      createRow={() => ""}
      emptyMessage="No cameras configured."
      reorderable
      value={field.state.value ?? []}
      onChange={field.handleChange}
    />
  );
}
