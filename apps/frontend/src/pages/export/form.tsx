import { useAtom, useAtomValue } from "@effect/atom-react";
import { StreamArchiveHeader } from "@mrt/yamcs-effect";
import { useForm } from "@tanstack/react-form";
import { format } from "date-fns";
import { Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { ChevronDownIcon } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectedInstanceAtom, YamcsAtomHttpClient } from "@/lib/atom";

import {
  exportFormSchema,
  exportPreviewOptionsAtom,
  makeDefaultExportFormValues,
  type ExportFormValues,
} from "./state";

const headerOptions = [
  { label: "Qualified Name", value: "QUALIFIED_NAME" },
  { label: "Short Name", value: "SHORT_NAME" },
  { label: "No Header", value: "NONE" },
] as const;

function getHeaderOptionLabel(value: typeof StreamArchiveHeader.Type | "") {
  return headerOptions.find((option) => option.value === value)?.label;
}

function replaceDatePart(value: Date, nextDate: Date) {
  const nextValue = new Date(value);

  nextValue.setFullYear(
    nextDate.getFullYear(),
    nextDate.getMonth(),
    nextDate.getDate(),
  );

  return nextValue;
}

function replaceTimePart(value: Date, nextTime: string) {
  const [hours, minutes, seconds] = nextTime.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return value;
  }

  const nextValue = new Date(value);

  nextValue.setHours(hours, minutes, seconds, 0);

  return nextValue;
}

export function ExportPageForm() {
  const selectedInstance = useAtomValue(selectedInstanceAtom);
  const instancesResult = useAtomValue(
    YamcsAtomHttpClient.query("instances", "listInstances", {}),
  );
  const [exportOptions, setExportOptions] = useAtom(exportPreviewOptionsAtom);
  const initialValuesRef = React.useRef<ExportFormValues>(
    exportOptions.instance
      ? exportOptions
      : makeDefaultExportFormValues(selectedInstance),
  );
  const [startDateOpen, setStartDateOpen] = React.useState(false);
  const [endDateOpen, setEndDateOpen] = React.useState(false);

  React.useEffect(() => {
    if (exportOptions.instance) {
      return;
    }

    setExportOptions(initialValuesRef.current);
  }, [exportOptions.instance, setExportOptions]);

  const form = useForm({
    defaultValues: initialValuesRef.current,
    validators: {
      onChangeAsync: Schema.toStandardSchemaV1(exportFormSchema),
    },
  });

  const updateExportOptions = React.useCallback(
    (nextPatch: Partial<ExportFormValues>) => {
      setExportOptions({
        ...exportOptions,
        ...nextPatch,
      });
    },
    [exportOptions, setExportOptions],
  );

  return (
    <form
      className="space-y-4"
      id="export-form"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      {AsyncResult.builder(instancesResult)
        .onInitial(() => (
          <div className="text-sm text-muted-foreground">
            Loading instances...
          </div>
        ))
        .onFailure(() => (
          <div className="text-sm text-destructive">
            Unable to load instances.
          </div>
        ))
        .onSuccess(({ instances }) => (
          <form.Field name="instance">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              const selectedInstanceLabel =
                instances.find(
                  (instance) => instance.name === field.state.value,
                )?.name ?? "";

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Instance</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => {
                      const nextValue = value ?? "";

                      field.handleChange(nextValue);
                      field.handleBlur();
                      updateExportOptions({ instance: nextValue });
                    }}
                  >
                    <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                      <SelectValue>
                        {selectedInstanceLabel || "Select an instance"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Instances</SelectLabel>
                        {instances.map((instance) => (
                          <SelectItem key={instance.name} value={instance.name}>
                            {instance.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {isInvalid ? (
                    <FieldError errors={field.state.meta.errors} />
                  ) : null}
                </Field>
              );
            }}
          </form.Field>
        ))
        .render()}

      <form.Field name="header">
        {(field) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid;
          const selectedHeaderLabel = getHeaderOptionLabel(field.state.value);

          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>Header Row</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(value) => {
                  if (!value) {
                    return;
                  }

                  const nextValue = value as typeof StreamArchiveHeader.Type;

                  field.handleChange(nextValue);
                  field.handleBlur();
                  updateExportOptions({ header: nextValue });
                }}
              >
                <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                  <SelectValue>
                    {selectedHeaderLabel || "Select a header style"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Header Row</SelectLabel>
                    {headerOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {isInvalid ? (
                <FieldError errors={field.state.meta.errors} />
              ) : null}
            </Field>
          );
        }}
      </form.Field>

      <form.Field name="startDate">
        {(field) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid;
          const selectedDate = field.state.value;

          return (
            <FieldGroup className="max-w-xs flex-row">
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Start Date</FieldLabel>
                <Popover
                  open={startDateOpen}
                  onOpenChange={(open) => {
                    setStartDateOpen(open);
                    if (!open) {
                      field.handleBlur();
                    }
                  }}
                >
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        id={field.name}
                        className="w-36 justify-between font-normal"
                        aria-invalid={isInvalid}
                      >
                        {format(selectedDate, "PPP")}
                        <ChevronDownIcon />
                      </Button>
                    }
                  />
                  <PopoverContent
                    className="w-auto overflow-hidden p-0"
                    align="start"
                  >
                    <Calendar
                      mode="single"
                      required
                      selected={selectedDate}
                      captionLayout="dropdown"
                      defaultMonth={selectedDate}
                      onSelect={(date) => {
                        if (!date) {
                          return;
                        }

                        const nextValue = replaceDatePart(
                          field.state.value,
                          date,
                        );

                        field.handleChange(nextValue);
                        field.handleBlur();
                        setStartDateOpen(false);
                        updateExportOptions({ startDate: nextValue });
                      }}
                    />
                  </PopoverContent>
                </Popover>
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
              <Field className="w-32">
                <FieldLabel className="opacity-0" htmlFor="start-time">
                  Start Time
                </FieldLabel>
                <Input
                  type="time"
                  id="start-time"
                  step="1"
                  value={format(field.state.value, "HH:mm:ss")}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    const nextValue = replaceTimePart(
                      field.state.value,
                      event.target.value,
                    );

                    field.handleChange(nextValue);
                    updateExportOptions({ startDate: nextValue });
                  }}
                  className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
              </Field>
            </FieldGroup>
          );
        }}
      </form.Field>

      <form.Field name="endDate">
        {(field) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid;
          const selectedDate = field.state.value;

          return (
            <FieldGroup className="max-w-xs flex-row">
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>End Date</FieldLabel>
                <Popover
                  open={endDateOpen}
                  onOpenChange={(open) => {
                    setEndDateOpen(open);
                    if (!open) {
                      field.handleBlur();
                    }
                  }}
                >
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        id={field.name}
                        className="w-36 justify-between font-normal"
                        aria-invalid={isInvalid}
                      >
                        {format(selectedDate, "PPP")}
                        <ChevronDownIcon />
                      </Button>
                    }
                  />
                  <PopoverContent
                    className="w-auto overflow-hidden p-0"
                    align="start"
                  >
                    <Calendar
                      mode="single"
                      required
                      selected={selectedDate}
                      captionLayout="dropdown"
                      defaultMonth={selectedDate}
                      onSelect={(date) => {
                        if (!date) {
                          return;
                        }

                        const nextValue = replaceDatePart(
                          field.state.value,
                          date,
                        );

                        field.handleChange(nextValue);
                        field.handleBlur();
                        setEndDateOpen(false);
                        updateExportOptions({ endDate: nextValue });
                      }}
                    />
                  </PopoverContent>
                </Popover>
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
              <Field className="w-32">
                <FieldLabel className="opacity-0" htmlFor="end-time">
                  End Time
                </FieldLabel>
                <Input
                  type="time"
                  id="end-time"
                  step="1"
                  value={format(field.state.value, "HH:mm:ss")}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    const nextValue = replaceTimePart(
                      field.state.value,
                      event.target.value,
                    );

                    field.handleChange(nextValue);
                    updateExportOptions({ endDate: nextValue });
                  }}
                  className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
              </Field>
            </FieldGroup>
          );
        }}
      </form.Field>
    </form>
  );
}
