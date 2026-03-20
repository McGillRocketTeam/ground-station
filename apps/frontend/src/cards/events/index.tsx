import type { EventsEvent } from "@mrt/yamcs-effect";

import { useAtomValue } from "@effect/atom-react";
import { Cause, Schema } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

import { eventsSubscriptionAtom } from "@/lib/atom";
import { makeCard } from "@/lib/cards";

import { EventsTable } from "./events-table";

export type Event = (typeof EventsEvent.Type)["data"];

export const EventsCard = makeCard({
  id: "events",
  name: "Events Card",
  schema: Schema.Struct({}),
  component: () => {
    const result = useAtomValue(eventsSubscriptionAtom);

    return AsyncResult.builder(result)
      .onInitial(() => (
        <div className="grid min-h-full w-full animate-pulse place-items-center font-mono text-muted-foreground uppercase">
          Awaiting Events
        </div>
      ))
      .onFailure((cause) => (
        <pre className="col-span-full min-h-full text-center text-error uppercase">
          {Cause.pretty(cause)}
        </pre>
      ))
      .onSuccess((events) => <EventsTable events={events} />)
      .render();
  },
});
