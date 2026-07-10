import type { AnyFieldApi } from "@tanstack/react-form";

import { useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

import { CameraField } from "@/lib/dashboard-field-types";
import { mediaPathsAtom } from "@/lib/media-mtx/atom";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "../../ui/combobox";

export type DashboardCameraFieldValue = Schema.Codec.Encoded<typeof CameraField>;

export type DashboardCameraFieldApi = AnyFieldApi & {
  state: AnyFieldApi["state"] & {
    value: DashboardCameraFieldValue | undefined;
  };
  handleChange: (value: DashboardCameraFieldValue) => void;
};

export function DashboardCameraField({ field }: { field: DashboardCameraFieldApi }) {
  return (
    <CameraSelector
      id={field.name}
      name={field.name}
      value={field.state.value ?? null}
      onChange={field.handleChange}
    />
  );
}

export function CameraSelector({
  id,
  name,
  value,
  onChange,
}: {
  id?: string;
  name?: string;
  value: DashboardCameraFieldValue | null;
  onChange: (value: DashboardCameraFieldValue) => void;
}) {
  const pathsResult = useAtomValue(mediaPathsAtom);

  return AsyncResult.builder(pathsResult)
    .onInitial(() => <div className="text-muted-foreground">Loading cameras...</div>)
    .onFailure((cause) => <div className="text-error">Unable to load cameras: {String(cause)}</div>)
    .onSuccess((paths) => {
      const items: Array<DashboardCameraFieldValue> = [...paths.items]
        .sort(
          (left, right) =>
            Number(right.ready) - Number(left.ready) || left.name.localeCompare(right.name),
        )
        .map((path) => path.name);
      const labels = new Map<string, string>(
        paths.items.map((path) => [path.name, path.ready ? `${path.name} (live)` : path.name]),
      );

      return (
        <Combobox<DashboardCameraFieldValue>
          id={id}
          isItemEqualToValue={(item, currentValue) => item === currentValue}
          itemToStringLabel={(item) => labels.get(item) ?? item}
          itemToStringValue={(item) => item}
          items={items}
          name={name}
          onValueChange={(nextValue) => {
            if (nextValue) {
              onChange(nextValue);
            }
          }}
          value={value}
        >
          <ComboboxInput placeholder="Select a camera" />
          <ComboboxContent>
            <ComboboxEmpty>No cameras found.</ComboboxEmpty>
            <ComboboxList>
              {(item: DashboardCameraFieldValue) => (
                <ComboboxItem key={item} value={item}>
                  {labels.get(item) ?? item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      );
    })
    .render();
}
