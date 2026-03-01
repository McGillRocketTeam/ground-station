import { Result, useAtomValue } from "@effect-atom/atom-react";
import { linksSubscriptionAtom } from "@mrt/yamcs-atom";
import { Cause, Schema } from "effect";

import { makeCard } from "@/lib/cards";

import { LinksTree } from "./links-tree";

export const LinksCard = makeCard({
  id: "links",
  name: "Links Card",
  schema: Schema.Struct({}),
  component: () => {
    const links = useAtomValue(linksSubscriptionAtom);

    return Result.builder(links)
      .onInitial(() => (
        <div className="text-muted-foreground grid min-h-full w-full animate-pulse place-items-center font-mono uppercase">
          Awaiting Links
        </div>
      ))
      .onFailure((cause) => (
        <pre className="text-error col-span-full min-h-full text-center uppercase">
          {Cause.pretty(cause)}
        </pre>
      ))
      .onSuccess((links) => <LinksTree links={links} />)
      .render();
  },
});
