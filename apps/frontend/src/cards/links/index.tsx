import { makeCard } from "@/lib/cards";
import { Result, useAtomValue } from "@effect-atom/atom-react";
import { linksSubscriptionAtom } from "@mrt/yamcs-atom";
import { Cause, Schema } from "effect";
import { buildLinkTree, type Link, type LinkNode } from "./utils";
import { Fragment } from "react/jsx-runtime";
import {
  DataGridBody,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
} from "@/components/ui/data-grid";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";

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

function LinksTree({ links }: { links: ReadonlyArray<Link> }) {
  const linkTree = buildLinkTree(links);

  return (
    <div className="grid gap-x-px grid-cols-[1.5rem_auto_1fr_auto_auto_1.5rem]">
      <DataGridHeader>
        <DataGridHead />
        <DataGridHead>LINK NAME</DataGridHead>
        <DataGridHead>STATUS</DataGridHead>
        <DataGridHead className="text-center">IN</DataGridHead>
        <DataGridHead className="text-center">OUT</DataGridHead>
        <DataGridHead />
      </DataGridHeader>
      <DataGridBody className="text-sm">
        <LinkRows links={linkTree} depth={0} />
      </DataGridBody>
    </div>
  );
}

function LinkRows({
  links,
  depth,
}: {
  links: ReadonlyArray<LinkNode>;
  depth: number;
}) {
  return links.map((link, index) => {
    const isLast = index === links.length - 1;

    return (
      <Fragment key={link.name}>
        <LinkRow link={link} depth={depth} isLast={isLast} />
        {link.children.length > 0 && (
          <LinkRows links={link.children} depth={depth + 1} />
        )}
      </Fragment>
    );
  });
}

function LinkRow({
  link,
  depth,
  isLast,
}: {
  link: LinkNode;
  depth: number;
  isLast: boolean;
}) {
  return (
    <DataGridRow>
      <div />

      <div className="relative">
        {/* Vertical continuation line */}
        {depth > 0 && (
          <span
            className={cn(
              "absolute left-0 top-0 w-px bg-orange-text",
              isLast ? "h-[0.5lh]" : "h-full",
            )}
            style={{ left: depth * 16 - 8 }}
          />
        )}

        {/* Horizontal elbow */}
        {depth > 0 && (
          <span
            className="
						absolute
						top-1/2
						-translate-y-1/2
						h-px
						w-4
						bg-orange-text
						"
            style={{
              left: depth * 16 - 8,
              transform: "translateY(-50%)",
            }}
          />
        )}

        <span className="inline-block" style={{ paddingLeft: depth * 26 }}>
          {link.parentName ? link.name.split("/")[1] : link.name}
        </span>
      </div>

      <div className="text-ellipsis line-clamp-1">{link.detailedStatus}</div>

      <div className="text-right">{link.dataInCount.toLocaleString()}</div>

      <div className="text-right">{link.dataOutCount.toLocaleString()}</div>

      <button className="grid place-items-center text-muted-foreground cursor-pointer">
        <Ellipsis className="size-3" />
      </button>
    </DataGridRow>
  );
}
