import { makeCard } from "@/lib/cards";
import { Result, useAtomValue } from "@effect-atom/atom-react";
import { linksSubscriptionAtom } from "@mrt/yamcs-atom";
import { Cause, Schema } from "effect";
import { LinksTree } from "./links-tree";

export const LinksCard = makeCard({
  id: "links",
  name: "Links Card",
  schema: Schema.Struct({}),
  component: () => {
    const links = useAtomValue(linksSubscriptionAtom);

    return Result.builder(links)
      .onInitial(() => (
        <div className="grid w-full min-h-full place-items-center text-muted-foreground uppercase animate-pulse font-mono">
          Awaiting Links
        </div>
      ))
      .onFailure((cause) => (
        <pre className="col-span-full text-error text-center min-h-full uppercase">
          {Cause.pretty(cause)}
        </pre>
      ))
      .onSuccess((links) => <LinksTree links={links} />)
      .render();
  },
});
