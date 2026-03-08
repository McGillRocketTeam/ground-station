import { useAtom, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { type ReactNode } from "react";
import { Outlet } from "react-router";

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

function InstanceSelector() {
  const [instance, setInstance] = useAtom(selectedInstanceAtom);
  const instancesResult = useAtomValue(
    YamcsAtomHttpClient.query("instances", "listInstances", {}),
  );

  return (
    <div>
      {AsyncResult.builder(instancesResult)
        .onInitial(() => <div>Loading instances...</div>)
        .onSuccess(({ instances }) => (
          <Select
            value={instance}
            onValueChange={(value) => setInstance(value ?? "")}
          >
            <SelectTrigger className="w-full max-w-48">
              <SelectValue placeholder="Select an instance" />
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
        ))
        .render()}
    </div>
  );
}

export function InstanceProtectedPage(): ReactNode {
  const instance = useAtomValue(selectedInstanceAtom);

  if (!instance) {
    return (
      <div className="grid fixed inset-0 h-screen w-full place-items-center px-4">
        <div className="w-full max-w-sm">
          <InstanceSelector />
        </div>
      </div>
    );
  }

  return <Outlet />;
}
