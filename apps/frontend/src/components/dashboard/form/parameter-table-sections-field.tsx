import type { AnyFieldApi } from "@tanstack/react-form";

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import type { ParameterTableSection } from "@/cards/parameter-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FormTable } from "./form-table";
import { ParameterSelector } from "./parameter-field";

export type DashboardParameterTableSectionsFieldApi = AnyFieldApi & {
  state: AnyFieldApi["state"] & {
    value: ReadonlyArray<ParameterTableSection> | undefined;
  };
  handleChange: (value: ReadonlyArray<ParameterTableSection>) => void;
};

function moveItem<T>(items: ReadonlyArray<T>, from: number, to: number) {
  if (to < 0 || to >= items.length) return items;

  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;

  next.splice(to, 0, item);
  return next;
}

export function DashboardParameterTableSectionsField({
  field,
}: {
  field: DashboardParameterTableSectionsFieldApi;
}) {
  const sections = field.state.value ?? [];

  return (
    <FormTable<ParameterTableSection>
      addLabel="Add section"
      columns={[
        {
          className: "w-72 align-top",
          header: "Section",
          render: ({ row, rowIndex, updateRow }) => (
            <div className="grid gap-2">
              <Input
                value={row.title}
                onChange={(event) =>
                  updateRow({ ...row, title: event.target.value })
                }
              />
              <div className="flex gap-1">
                <Button
                  disabled={rowIndex === 0}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    field.handleChange(
                      moveItem(sections, rowIndex, rowIndex - 1),
                    )
                  }
                >
                  <ChevronUpIcon />
                  <span className="sr-only">Move section up</span>
                </Button>
                <Button
                  disabled={rowIndex === sections.length - 1}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    field.handleChange(
                      moveItem(sections, rowIndex, rowIndex + 1),
                    )
                  }
                >
                  <ChevronDownIcon />
                  <span className="sr-only">Move section down</span>
                </Button>
              </div>
            </div>
          ),
        },
        {
          className: "align-top",
          header: "Parameters",
          render: ({ row, updateRow }) => {
            const selected = new Set(row.parameters);

            return (
              <div className="grid gap-2">
                <ParameterSelector
                  value={null}
                  onChange={(parameter) => {
                    if (selected.has(parameter.qualifiedName)) return;

                    updateRow({
                      ...row,
                      parameters: [...row.parameters, parameter.qualifiedName],
                    });
                  }}
                />
                {row.parameters.length === 0 ? (
                  <div className="text-muted-foreground">
                    No parameters added.
                  </div>
                ) : (
                  <div className="grid max-h-64 gap-1 overflow-y-auto pr-2">
                    {row.parameters.map((parameter, parameterIndex) => (
                      <div
                        key={parameter}
                        className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-1"
                      >
                        <span className="truncate text-right" title={parameter}>
                          {parameter}
                        </span>
                        <Button
                          disabled={parameterIndex === 0}
                          size="icon-xs"
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            updateRow({
                              ...row,
                              parameters: moveItem(
                                row.parameters,
                                parameterIndex,
                                parameterIndex - 1,
                              ),
                            })
                          }
                        >
                          <ChevronUpIcon />
                          <span className="sr-only">Move parameter up</span>
                        </Button>
                        <Button
                          disabled={
                            parameterIndex === row.parameters.length - 1
                          }
                          size="icon-xs"
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            updateRow({
                              ...row,
                              parameters: moveItem(
                                row.parameters,
                                parameterIndex,
                                parameterIndex + 1,
                              ),
                            })
                          }
                        >
                          <ChevronDownIcon />
                          <span className="sr-only">Move parameter down</span>
                        </Button>
                        <Button
                          size="xs"
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            updateRow({
                              ...row,
                              parameters: row.parameters.filter(
                                (item) => item !== parameter,
                              ),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          },
        },
      ]}
      createRow={() => ({ title: "", parameters: [] })}
      emptyMessage="No sections configured."
      value={sections}
      onChange={field.handleChange}
    />
  );
}
