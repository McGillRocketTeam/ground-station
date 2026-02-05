import { makeCard } from "@/lib/cards";
import { Result, useAtomValue } from "@effect-atom/atom-react";
import { eventsSubscriptionAtom } from "@mrt/yamcs-atom";
import type { EventsEvent } from "@mrt/yamcs-effect";
import { Cause, Schema } from "effect";
import { EventsTable } from "./events-table";

export type Event = (typeof EventsEvent.Type)["data"];

export const EventsCard = makeCard({
  id: "events",
  name: "Events Card",
  schema: Schema.Struct({}),
  component: () => {
    const result = useAtomValue(eventsSubscriptionAtom);

    return Result.builder(result)
      .onInitial(() => (
        <div className="grid w-full min-h-full place-items-center text-muted-foreground uppercase animate-pulse font-mono">
          Awaiting Events
        </div>
      ))
      .onFailure((cause) => (
        <pre className="col-span-full text-error text-center min-h-full uppercase">
          {Cause.pretty(cause)}
        </pre>
      ))
      .onSuccess((events) => <EventsTable events={events} />)
      .render();
  },
});
