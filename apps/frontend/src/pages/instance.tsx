import { useAtom } from "@effect/atom-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Outlet } from "react-router";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { selectedInstanceAtom } from "@/lib/atom";

function InstanceSelector({
  currentInstance,
  onApply,
  onClear,
}: {
  currentInstance: string;
  onApply: (instance: string) => void;
  onClear?: () => void;
}) {
  const [draft, setDraft] = useState(currentInstance);

  useEffect(() => {
    setDraft(currentInstance);
  }, [currentInstance]);

  const nextInstance = draft.trim();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nextInstance) {
      return;
    }
    onApply(nextInstance);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-background/95 border-border grid gap-3 rounded-lg border p-4 shadow-lg backdrop-blur"
    >
      <div className="grid gap-0.5">
        <div className="text-xs font-semibold tracking-[0.2em] uppercase">
          YAMCS Instance
        </div>
        <div className="text-muted-foreground text-xs">
          Switch instances without reloading the frontend.
        </div>
      </div>

      <Field>
        <FieldLabel>Instance Name</FieldLabel>
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="ground_station"
          autoComplete="off"
        />
      </Field>

      <div className="flex gap-2">
        {onClear && (
          <Button type="button" variant="secondary" onClick={onClear}>
            Clear
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={!nextInstance}>
          {currentInstance ? "Switch Instance" : "Open Dashboard"}
        </Button>
      </div>
    </form>
  );
}

export function InstanceProtectedPage(): ReactNode {
  const [instance, setInstance] = useAtom(selectedInstanceAtom);

  if (!instance) {
    return (
      <div className="grid h-screen w-full place-items-center px-4">
        <div className="w-full max-w-sm">
          <InstanceSelector currentInstance={instance} onApply={setInstance} />
        </div>
      </div>
    );
  }

  return (
    <>
      <Outlet />
    </>
  );
}
