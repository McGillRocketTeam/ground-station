import { useAtom, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";

import { Checkbox } from "@/components/ui/checkbox";
import { FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { YamcsAtomHttpClient } from "@/lib/atom";

import { exportPreviewModelAtom, exportPreviewOptionsAtom } from "./state";

type ExportColumnTreeNode = {
  name: string;
  path: string;
  children: Array<ExportColumnTreeNode>;
  column?: string;
};

export function ExportPageForm() {
  const instancesResult = useAtomValue(
    YamcsAtomHttpClient.query("instances", "listInstances", {}),
  );

  const [exportOptions, setExportOptions] = useAtom(exportPreviewOptionsAtom);

  return (
    <div className="space-y-4">
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
          <FieldGroup className="gap-2">
            <FieldLabel>Instance</FieldLabel>
            <Select
              value={exportOptions.instance}
              onValueChange={(value) => {
                const nextValue = value ?? "";
                setExportOptions((prior) => ({
                  ...prior,
                  instance: nextValue,
                }));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {instances.find(
                    (instance) => instance.name === exportOptions.instance,
                  )?.name ?? "Select an instance"}
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
          </FieldGroup>
        ))
        .render()}
    </div>
  );
}

export function ExportColumnSelector() {
  const data = useAtomValue(exportPreviewModelAtom);
  const tree = buildExportColumnTree(data.columns);

  return (
    <div>
      <h2 className="font-mono uppercase">Selected Paramters</h2>
      <div className="text-sm text-muted-foreground">
        {tree.map((child) => (
          <TreeRow key={child.path} node={child} />
        ))}
      </div>
    </div>
  );
}

function TreeRow({ node }: { node: ExportColumnTreeNode }) {
  return (
    <div className="ml-1.5 border-l pl-3">
      <div className="flex flex-row items-center gap-2">
        <Checkbox defaultChecked={true} className="size-3" />
        <span key={node.path}>{node.name}</span>
      </div>
      {node.children.map((child) => (
        <TreeRow key={child.path} node={child} />
      ))}
    </div>
  );
}

function buildExportColumnTree(
  columns: ReadonlyArray<string>,
): Array<ExportColumnTreeNode> {
  const roots: Array<ExportColumnTreeNode> = [];
  const nodeByPath = new Map<string, ExportColumnTreeNode>();

  for (const column of columns) {
    const segments = column.split("/").filter(Boolean);
    let parentPath = "";
    let children = roots;

    segments.forEach((segment, index) => {
      const path = `${parentPath}/${segment}`;
      let node = nodeByPath.get(path);

      if (!node) {
        node = {
          name: segment,
          path,
          children: [],
        };

        nodeByPath.set(path, node);
        children.push(node);
      }

      if (index === segments.length - 1) {
        node.column = column;
      }

      parentPath = path;
      children = node.children;
    });
  }

  return roots;
}
