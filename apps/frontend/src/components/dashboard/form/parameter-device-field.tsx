import type { AnyFieldApi } from "@tanstack/react-form";

import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { parameterListAtom } from "@/lib/atom";

export type DashboardParameterDeviceFieldApi = AnyFieldApi & {
  state: AnyFieldApi["state"] & { value: string | undefined };
  handleChange: (value: string) => void;
};

export function parameterDevicePath(qualifiedName: string) {
  const segments = qualifiedName.split("/").filter(Boolean);
  return segments.length < 4 ? null : `/${segments.slice(0, 3).join("/")}`;
}

export function DashboardParameterDeviceField({
  field,
  requiredParameterNames = [],
}: {
  field: DashboardParameterDeviceFieldApi;
  requiredParameterNames?: ReadonlyArray<string>;
}) {
  const parametersResult = useAtomValue(parameterListAtom);

  return AsyncResult.builder(parametersResult)
    .onInitial(() => <div className="text-muted-foreground">Loading devices...</div>)
    .onFailure((cause) => <div className="text-error">Unable to load devices: {String(cause)}</div>)
    .onSuccess((parameters) => {
      const qualifiedNames = new Set(parameters.map((parameter) => parameter.qualifiedName));
      const devices = [
        ...new Set(
          parameters
            .map((parameter) => parameterDevicePath(parameter.qualifiedName))
            .filter((device): device is string => device !== null),
        ),
      ]
        .filter((device) =>
          requiredParameterNames.every((name) => qualifiedNames.has(`${device}/${name}`)),
        )
        .sort((left, right) => left.localeCompare(right));

      return (
        <Combobox<string>
          id={field.name}
          isItemEqualToValue={(item, value) => item === value}
          itemToStringLabel={(item) => item}
          itemToStringValue={(item) => item}
          items={devices}
          name={field.name}
          onValueChange={(device) => {
            if (device) field.handleChange(device);
          }}
          value={field.state.value ?? null}
        >
          <ComboboxInput
            placeholder={requiredParameterNames.length > 0 ? "Select a switch" : "Select a device"}
          />
          <ComboboxContent>
            <ComboboxEmpty>No devices found.</ComboboxEmpty>
            <ComboboxList>
              {(device: string) => (
                <ComboboxItem key={device} value={device}>
                  {device}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      );
    })
    .render();
}
