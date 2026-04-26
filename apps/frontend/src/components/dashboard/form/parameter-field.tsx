import type { AnyFieldApi } from "@tanstack/react-form";

import { useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";
import { ParameterField } from "@/lib/dashboard-field-types";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "../../ui/combobox";

export type DashboardParameterFieldValue = Schema.Codec.Encoded<
  typeof ParameterField
>;

export type DashboardParameterFieldApi = AnyFieldApi & {
  state: AnyFieldApi["state"] & {
    value: DashboardParameterFieldValue | undefined;
  };
  handleChange: (value: DashboardParameterFieldValue) => void;
};

export function DashboardParameterField({
  field,
}: {
  field: DashboardParameterFieldApi;
}) {
  return (
    <ParameterSelector
      id={field.name}
      name={field.name}
      value={field.state.value ?? null}
      onChange={field.handleChange}
    />
  );
}

export function ParameterSelector({
  id,
  name,
  value,
  onChange,
}: {
  id?: string;
  name?: string;
  value: DashboardParameterFieldValue | null;
  onChange: (value: DashboardParameterFieldValue) => void;
}) {
  const instance = useAtomValue(selectedInstanceAtom);

  const parametersResult = useAtomValue(
    YamcsAtomHttpClient.query("mdb", "listParameters", {
      params: { instance },
      query: {},
    }),
  );

  return AsyncResult.builder(parametersResult)
    .onInitial(() => <div>Loading Parameter Selector...</div>)
    .onSuccess(({ parameters }) => {
      const parameterOptions: ReadonlyArray<DashboardParameterFieldValue> =
        parameters.map((parameter) => ({
          qualifiedName: parameter.qualifiedName,
        }));

      const parameterLabels = new Map(
        parameters.map((parameter) => [
          parameter.qualifiedName,
          parameter.shortDescription ?? parameter.qualifiedName,
        ]),
      );

      return (
        <Combobox<DashboardParameterFieldValue>
          id={id}
          isItemEqualToValue={(item, value) =>
            item.qualifiedName === value.qualifiedName
          }
          itemToStringLabel={(item) =>
            parameterLabels.get(item.qualifiedName) ?? item.qualifiedName
          }
          itemToStringValue={(item) => item.qualifiedName}
          items={parameterOptions}
          name={name}
          onValueChange={(nextValue) => {
            if (nextValue) {
              onChange(nextValue);
            }
          }}
          value={value}
        >
          <ComboboxInput placeholder="Select a parameter" />
          <ComboboxContent>
            <ComboboxEmpty>No items found.</ComboboxEmpty>
            <ComboboxList>
              {(item: DashboardParameterFieldValue) => (
                <ComboboxItem key={item.qualifiedName} value={item}>
                  {parameterLabels.get(item.qualifiedName) ??
                    item.qualifiedName}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      );
    })
    .render();
}
