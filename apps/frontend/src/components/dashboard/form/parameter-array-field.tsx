import type { AnyFieldApi } from "@tanstack/react-form";

import { useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";
import {
  ParameterArrayField,
  ParameterField,
} from "@/lib/dashboard-field-types";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "../../ui/combobox";

type DashboardParameterOptionValue = Schema.Codec.Encoded<
  typeof ParameterField
>;

export type DashboardParameterArrayFieldValue = Schema.Codec.Encoded<
  typeof ParameterArrayField
>;

type DashboardParameterArrayItemValue =
  DashboardParameterArrayFieldValue[number];

export type DashboardParameterArrayFieldApi = AnyFieldApi & {
  state: AnyFieldApi["state"] & {
    value: DashboardParameterArrayFieldValue | undefined;
  };
  handleChange: (value: DashboardParameterArrayFieldValue) => void;
};

function getQualifiedName(item: DashboardParameterArrayItemValue) {
  return item.NamedObjectId.name;
}

function makeParameterItem(
  qualifiedName: string,
): DashboardParameterArrayItemValue {
  return {
    NamedObjectId: {
      name: qualifiedName,
    },
  };
}

export function DashboardParameterArrayField({
  field,
}: {
  field: DashboardParameterArrayFieldApi;
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
      const parameterOptions: ReadonlyArray<DashboardParameterOptionValue> =
        parameters.map((parameter) => ({
          qualifiedName: parameter.qualifiedName,
        }));

      const parameterLabels = new Map(
        parameters.map((parameter) => [
          parameter.qualifiedName,
          parameter.shortDescription ?? parameter.qualifiedName,
        ]),
      );

      const selectedParameters = Array.isArray(field.state.value)
        ? field.state.value
        : [];

      const selectedParameterNames = new Set(
        selectedParameters.map(getQualifiedName),
      );

      const availableParameterOptions = parameterOptions.filter(
        (parameter) => !selectedParameterNames.has(parameter.qualifiedName),
      );

      return (
        <div className="space-y-3">
          <Combobox<DashboardParameterOptionValue>
            id={field.name}
            isItemEqualToValue={(item, value) =>
              item.qualifiedName === value.qualifiedName
            }
            itemToStringLabel={(item) =>
              parameterLabels.get(item.qualifiedName) ?? item.qualifiedName
            }
            itemToStringValue={(item) => item.qualifiedName}
            items={availableParameterOptions}
            name={field.name}
            onValueChange={(value) => {
              if (!value || selectedParameterNames.has(value.qualifiedName)) {
                return;
              }

              field.handleChange([
                ...selectedParameters,
                makeParameterItem(value.qualifiedName),
              ]);
            }}
            value={null}
          >
            <ComboboxInput
              disabled={availableParameterOptions.length === 0}
              placeholder={
                availableParameterOptions.length === 0
                  ? "All parameters added"
                  : "Select a parameter"
              }
            />
            <ComboboxContent>
              <ComboboxEmpty>No items found.</ComboboxEmpty>
              <ComboboxList>
                {(item: DashboardParameterOptionValue) => (
                  <ComboboxItem key={item.qualifiedName} value={item}>
                    {parameterLabels.get(item.qualifiedName) ??
                      item.qualifiedName}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>

          {selectedParameters.length === 0 ? (
            <div>No parameters added.</div>
          ) : (
            <table className="w-full table-fixed">
              <thead>
                <tr>
                  <th className="text-left">Parameter</th>
                  <th className="w-0 text-left whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedParameters.map((parameter) => {
                  const qualifiedName = getQualifiedName(parameter);

                  return (
                    <tr key={qualifiedName}>
                      <td>
                        {parameterLabels.get(qualifiedName) ?? qualifiedName}
                      </td>
                      <td className="w-0 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            field.handleChange(
                              selectedParameters.filter(
                                (selectedParameter) =>
                                  getQualifiedName(selectedParameter) !==
                                  qualifiedName,
                              ),
                            );
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      );
    })
    .render();
}
