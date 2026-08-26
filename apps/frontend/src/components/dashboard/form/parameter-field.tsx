import type { AnyFieldApi } from "@tanstack/react-form";

import { useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import Fuse, { type FuseResultMatch } from "fuse.js";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parameterListAtom } from "@/lib/atom";
import { ParameterField } from "@/lib/dashboard-field-types";
import { cn } from "@/lib/utils";

export type DashboardParameterFieldValue = Schema.Codec.Encoded<typeof ParameterField>;

export type DashboardParameterFieldApi = AnyFieldApi & {
  state: AnyFieldApi["state"] & {
    value: DashboardParameterFieldValue | undefined;
  };
  handleChange: (value: DashboardParameterFieldValue) => void;
};

type ParameterTreeNode = {
  readonly segment: string;
  readonly qualifiedName: string;
  readonly children: Map<string, ParameterTreeNode>;
  parameter?: DashboardParameterFieldValue | undefined;
};

type ParameterTreeColumn = {
  readonly items: ReadonlyArray<ParameterTreeNode>;
  readonly parentSegments: ReadonlyArray<string>;
};

type ParameterBrowseColumn =
  | {
      readonly type: "tree";
      readonly key: string;
      readonly items: ReadonlyArray<ParameterTreeNode>;
      readonly parentSegments: ReadonlyArray<string>;
    }
  | {
      readonly type: "flat";
      readonly key: string;
      readonly items: ReadonlyArray<DashboardParameterFieldValue>;
    };

const PARAMETER_SELECTOR_RESULTS_HEIGHT_CLASS = "h-80";
const PARAMETER_SELECTOR_COLUMN_WIDTH = 208;
const PARAMETER_SELECTOR_SEARCH_WIDTH = 512;
const PARAMETER_SELECTOR_MIN_WIDTH = 320;

type SearchableParameter = {
  readonly qualifiedName: string;
  readonly shortDescription?: string | undefined;
};

function HighlightedMatches({
  matches,
  searchKey,
  text,
}: {
  matches: ReadonlyArray<FuseResultMatch> | undefined;
  searchKey: "qualifiedName" | "shortDescription";
  text: string;
}) {
  const indices = matches?.find((match) => match.key === searchKey)?.indices;
  if (!indices || indices.length === 0) return text;

  const fragments: Array<React.ReactNode> = [];
  let offset = 0;

  for (const [start, end] of indices) {
    if (start > offset) fragments.push(text.slice(offset, start));
    fragments.push(
      <mark className="rounded-sm bg-selection-background text-inherit" key={`${start}-${end}`}>
        {text.slice(start, end + 1)}
      </mark>,
    );
    offset = end + 1;
  }

  if (offset < text.length) fragments.push(text.slice(offset));
  return fragments;
}

function getQualifiedNameSegments(qualifiedName: string) {
  return qualifiedName.split("/").filter((segment) => segment.length > 0);
}

function getLeafSegment(qualifiedName: string) {
  return getQualifiedNameSegments(qualifiedName).at(-1) ?? qualifiedName;
}

function buildParameterTree(parameters: ReadonlyArray<DashboardParameterFieldValue>) {
  const root: ParameterTreeNode = {
    segment: "",
    qualifiedName: "",
    children: new Map(),
  };

  for (const parameter of parameters) {
    const segments = getQualifiedNameSegments(parameter.qualifiedName);
    let node = root;
    let qualifiedName = "";

    for (const segment of segments) {
      qualifiedName = `${qualifiedName}/${segment}`;

      let child = node.children.get(segment);
      if (!child) {
        child = {
          segment,
          qualifiedName,
          children: new Map(),
        };
        node.children.set(segment, child);
      }

      node = child;
    }

    node.parameter = parameter;
  }

  return root;
}

type PreparedParameters = {
  readonly options: ReadonlyArray<DashboardParameterFieldValue>;
  readonly labels: ReadonlyMap<string, string>;
  readonly descriptions: ReadonlyMap<string, string | undefined>;
  readonly tree: ParameterTreeNode;
  readonly search: Fuse<SearchableParameter>;
};

const preparedParametersCache = new WeakMap<object, PreparedParameters>();

function prepareParameters(parameters: ReadonlyArray<SearchableParameter>): PreparedParameters {
  const cached = preparedParametersCache.get(parameters);
  if (cached) return cached;

  const options = parameters.map((parameter) => ({ qualifiedName: parameter.qualifiedName }));
  const prepared = {
    options,
    labels: new Map(
      parameters.map((parameter) => [
        parameter.qualifiedName,
        parameter.shortDescription ?? parameter.qualifiedName,
      ]),
    ),
    descriptions: new Map(
      parameters.map((parameter) => [parameter.qualifiedName, parameter.shortDescription]),
    ),
    tree: buildParameterTree(options),
    search: new Fuse(parameters, {
      keys: [
        { name: "shortDescription", weight: 0.6 },
        { name: "qualifiedName", weight: 0.4 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
      includeMatches: true,
    }),
  } satisfies PreparedParameters;
  preparedParametersCache.set(parameters, prepared);
  return prepared;
}

function sortTreeNodes(nodes: Iterable<ParameterTreeNode>) {
  return [...nodes].sort((left, right) => left.segment.localeCompare(right.segment));
}

function findExistingPathSegments(
  root: ParameterTreeNode,
  segments: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const next: Array<string> = [];
  let node = root;

  for (const segment of segments) {
    const child = node.children.get(segment);
    if (!child) break;

    next.push(segment);
    node = child;
  }

  return next;
}

function findFirstBranchSegments(root: ParameterTreeNode) {
  const segments: Array<string> = [];
  let node = root;

  while (node.children.size > 0) {
    const firstChild = sortTreeNodes(node.children.values())[0];
    if (!firstChild) break;

    segments.push(firstChild.segment);
    node = firstChild;
  }

  return segments;
}

function buildTreeColumns(
  root: ParameterTreeNode,
  activeSegments: ReadonlyArray<string>,
): ReadonlyArray<ParameterTreeColumn> {
  const columns: Array<ParameterTreeColumn> = [];
  let node = root;
  const parentSegments: Array<string> = [];

  while (node.children.size > 0) {
    columns.push({
      items: sortTreeNodes(node.children.values()),
      parentSegments: [...parentSegments],
    });

    const nextSegment = activeSegments[parentSegments.length];
    if (!nextSegment) break;

    const nextNode = node.children.get(nextSegment);
    if (!nextNode) break;

    parentSegments.push(nextSegment);
    node = nextNode;
  }

  return columns;
}

function findTreeNode(root: ParameterTreeNode, segments: ReadonlyArray<string>) {
  let node = root;

  for (const segment of segments) {
    const nextNode = node.children.get(segment);
    if (!nextNode) {
      return null;
    }

    node = nextNode;
  }

  return node;
}

function collectDescendantParameters(node: ParameterTreeNode) {
  const parameters: Array<DashboardParameterFieldValue> = [];
  const nodes = [node];

  while (nodes.length > 0) {
    const current = nodes.pop();
    if (!current) continue;

    if (current.parameter) {
      parameters.push(current.parameter);
    }

    nodes.push(...sortTreeNodes(current.children.values()).reverse());
  }

  return parameters;
}

export function DashboardParameterField({ field }: { field: DashboardParameterFieldApi }) {
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
  const parametersResult = useAtomValue(parameterListAtom);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [activeSegments, setActiveSegments] = React.useState<ReadonlyArray<string>>([]);

  return AsyncResult.builder(parametersResult)
    .onInitial(() => <div>Loading Parameter Selector...</div>)
    .onSuccess((parameters) => {
      const {
        descriptions: parameterDescriptions,
        labels: parameterLabels,
        options: parameterOptions,
        search: parameterSearch,
        tree: parameterTree,
      } = prepareParameters(parameters);
      const selectedLabel = value
        ? (parameterLabels.get(value.qualifiedName) ?? value.qualifiedName)
        : null;
      const selectedSegments = value ? getQualifiedNameSegments(value.qualifiedName) : [];
      const browseSegments =
        selectedSegments.length > 0
          ? findExistingPathSegments(parameterTree, selectedSegments)
          : findFirstBranchSegments(parameterTree);
      const visibleSegments =
        activeSegments.length > 0
          ? findExistingPathSegments(parameterTree, activeSegments)
          : browseSegments;
      const treeColumns = buildTreeColumns(parameterTree, visibleSegments);
      const normalizedQuery = deferredQuery.trim().toLowerCase();
      const treeBrowseColumns = treeColumns.slice(0, 4);
      const remainingBranchNode =
        treeColumns.length > 5 ? findTreeNode(parameterTree, visibleSegments.slice(0, 4)) : null;
      const browseColumns: ReadonlyArray<ParameterBrowseColumn> =
        remainingBranchNode && treeColumns.length > 5
          ? [
              ...treeBrowseColumns.map((column) => ({
                type: "tree" as const,
                key: column.parentSegments.join("/") || "root",
                items: column.items,
                parentSegments: column.parentSegments,
              })),
              {
                type: "flat" as const,
                key: `${visibleSegments.slice(0, 4).join("/")}-descendants`,
                items: collectDescendantParameters(remainingBranchNode),
              },
            ]
          : treeColumns.map((column) => ({
              type: "tree" as const,
              key: column.parentSegments.join("/") || "root",
              items: column.items,
              parentSegments: column.parentSegments,
            }));
      const browseWidth = Math.max(
        PARAMETER_SELECTOR_MIN_WIDTH,
        browseColumns.length * PARAMETER_SELECTOR_COLUMN_WIDTH + 16,
      );
      const popoverWidth = normalizedQuery ? PARAMETER_SELECTOR_SEARCH_WIDTH : browseWidth;
      const filteredParameters = normalizedQuery
        ? parameterSearch.search(normalizedQuery, { limit: 100 }).map(({ item, matches }) => ({
            parameter: { qualifiedName: item.qualifiedName },
            matches,
          }))
        : [];

      const selectParameter = (parameter: DashboardParameterFieldValue) => {
        onChange(parameter);
        setOpen(false);
        setQuery("");
        setActiveSegments(getQualifiedNameSegments(parameter.qualifiedName));
      };

      return (
        <Popover
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);

            if (nextOpen) {
              setQuery("");
              setActiveSegments(browseSegments);
            }
          }}
        >
          <input id={id} name={name} readOnly type="hidden" value={value?.qualifiedName ?? ""} />
          <PopoverTrigger
            render={
              <Button
                className="w-full justify-between truncate"
                disabled={parameterOptions.length === 0}
                size="default"
                type="button"
                variant="outline"
              />
            }
          >
            <span className="truncate text-left">
              {selectedLabel ??
                (parameterOptions.length === 0 ? "No parameters available" : "Select a parameter")}
            </span>
            <ChevronRightIcon className="ml-2 rotate-90 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="max-w-[calc(100vw-2rem)] gap-2 p-2 transition-none duration-0"
            style={{ width: `min(${popoverWidth}px, calc(100vw - 2rem))` }}
          >
            <Input
              autoFocus
              placeholder="Search parameters"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && filteredParameters[0]) {
                  event.preventDefault();
                  selectParameter(filteredParameters[0].parameter);
                }
              }}
            />

            {normalizedQuery ? (
              filteredParameters.length === 0 ? (
                <div
                  className={cn(
                    PARAMETER_SELECTOR_RESULTS_HEIGHT_CLASS,
                    "flex items-center justify-center text-muted-foreground",
                  )}
                >
                  No parameters found.
                </div>
              ) : (
                <div className={cn(PARAMETER_SELECTOR_RESULTS_HEIGHT_CLASS, "overflow-y-auto")}>
                  {filteredParameters.map(({ matches, parameter }) => {
                    const isSelected = value?.qualifiedName === parameter.qualifiedName;
                    const parameterLabel =
                      parameterLabels.get(parameter.qualifiedName) ?? parameter.qualifiedName;
                    const showQualifiedName = parameterLabel !== parameter.qualifiedName;

                    return (
                      <button
                        key={parameter.qualifiedName}
                        type="button"
                        className={cn(
                          "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border/50 px-2 py-1.5 text-left text-xs/relaxed last:border-b-0 hover:bg-accent hover:text-accent-foreground",
                          isSelected && "bg-accent text-accent-foreground",
                        )}
                        onClick={() => selectParameter(parameter)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            <HighlightedMatches
                              matches={matches}
                              searchKey={showQualifiedName ? "shortDescription" : "qualifiedName"}
                              text={parameterLabel}
                            />
                          </span>
                          {showQualifiedName ? (
                            <span className="block truncate text-[0.625rem] text-muted-foreground">
                              <HighlightedMatches
                                matches={matches}
                                searchKey="qualifiedName"
                                text={parameter.qualifiedName}
                              />
                            </span>
                          ) : null}
                        </span>
                        {isSelected ? <CheckIcon className="size-3.5" /> : null}
                      </button>
                    );
                  })}
                </div>
              )
            ) : browseColumns.length === 0 ? (
              <div
                className={cn(
                  PARAMETER_SELECTOR_RESULTS_HEIGHT_CLASS,
                  "flex items-center justify-center text-muted-foreground",
                )}
              >
                No parameters available.
              </div>
            ) : (
              <div
                className={cn(
                  PARAMETER_SELECTOR_RESULTS_HEIGHT_CLASS,
                  "grid auto-cols-fr grid-flow-col gap-0 overflow-x-auto overflow-y-hidden",
                )}
              >
                {browseColumns.map((column, columnIndex) => (
                  <div
                    key={column.key}
                    className={cn(
                      "min-w-52 overflow-y-auto p-1",
                      columnIndex > 0 && "border-l border-border/50",
                    )}
                  >
                    {column.type === "tree"
                      ? column.items.map((node) => {
                          const nextSegments = [...column.parentSegments, node.segment];
                          const isActive =
                            visibleSegments[column.parentSegments.length] === node.segment;
                          const isSelected =
                            value != null && value.qualifiedName === node.parameter?.qualifiedName;
                          const hasChildren = node.children.size > 0;
                          const treeLabel =
                            !hasChildren && node.parameter
                              ? (parameterDescriptions.get(node.parameter.qualifiedName) ??
                                node.segment)
                              : node.segment;

                          return (
                            <button
                              key={node.qualifiedName}
                              type="button"
                              className={cn(
                                "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs/relaxed hover:bg-accent hover:text-accent-foreground",
                                isActive && "bg-accent text-accent-foreground",
                              )}
                              onMouseEnter={() => setActiveSegments(nextSegments)}
                              onFocus={() => setActiveSegments(nextSegments)}
                              onClick={() => {
                                setActiveSegments(nextSegments);

                                if (node.parameter && !hasChildren) {
                                  selectParameter(node.parameter);
                                }
                              }}
                            >
                              <span className="truncate">{treeLabel}</span>
                              <span className="flex items-center gap-1">
                                {isSelected ? <CheckIcon className="size-3.5" /> : null}
                                {hasChildren ? <ChevronRightIcon className="size-3.5" /> : null}
                              </span>
                            </button>
                          );
                        })
                      : column.items.map((parameter) => {
                          const isSelected = value?.qualifiedName === parameter.qualifiedName;

                          return (
                            <button
                              key={parameter.qualifiedName}
                              type="button"
                              className={cn(
                                "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs/relaxed hover:bg-accent hover:text-accent-foreground",
                                isSelected && "bg-accent text-accent-foreground",
                              )}
                              onClick={() => selectParameter(parameter)}
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-medium">
                                  {parameterDescriptions.get(parameter.qualifiedName) ??
                                    getLeafSegment(parameter.qualifiedName)}
                                </span>
                                <span className="block truncate text-[0.625rem] text-muted-foreground">
                                  {parameter.qualifiedName}
                                </span>
                              </span>
                              {isSelected ? <CheckIcon className="size-3.5" /> : null}
                            </button>
                          );
                        })}
                  </div>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      );
    })
    .render();
}
