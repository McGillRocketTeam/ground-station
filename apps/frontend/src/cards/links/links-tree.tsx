import { Popover as PopoverPrimitive } from "@base-ui/react";
import { Ellipsis } from "lucide-react";
import { Fragment } from "react/jsx-runtime";

import {
  DataGridBody,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
} from "@/components/ui/data-grid";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { LinkDetail } from "./link-detail";
import {
  buildLinkTree,
  colorByStatus,
  type Link,
  type LinkNode,
} from "./utils";

const linksPopover = PopoverPrimitive.createHandle<Link>();
export function LinksTree({ links }: { links: ReadonlyArray<Link> }) {
  const linkTree = buildLinkTree(links);

  return (
    <div className="grid grid-cols-[1.5rem_auto_1fr_auto_auto_1.5rem] gap-x-px">
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

      <Popover handle={linksPopover}>
        {({ payload }) =>
          payload && (
            <PopoverContent className="w-80">
              <LinkDetail link={payload} />
            </PopoverContent>
          )
        }
      </Popover>
    </div>
  );
}

export function LinkRows({
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
    <PopoverTrigger
      payload={link}
      handle={linksPopover}
      nativeButton={false}
      render={
        <DataGridRow
          className={cn(
            "cursor-default data-popup-open:*:bg-[color-mix(in_oklab,var(--color-selection-background)_50%,var(--background))]",
            colorByStatus(link.status),
          )}
        >
          <div className="grid place-items-center">
            <div className="size-2 bg-current" />
          </div>

          <div className="relative">
            {/* Vertical continuation line */}
            {depth > 0 && (
              <span
                className={cn(
                  "absolute top-0 left-0 w-px bg-current",
                  isLast ? "h-1/2" : "h-full",
                )}
                style={{ left: depth * 16 - 8 }}
              />
            )}

            {/* Horizontal elbow */}
            {depth > 0 && (
              <span
                className="absolute top-1/2 h-px w-4 -translate-y-1/2 bg-current"
                style={{
                  left: depth * 16 - 8,
                  transform: "translateY(-50%)",
                }}
              />
            )}

            <span
              className="line-clamp-2 break-all text-ellipsis"
              style={{ paddingLeft: depth * 26 }}
            >
              {link.parentName ? link.name.split("/")[1] : link.name}
            </span>
          </div>

          <div className="line-clamp-1 text-ellipsis">
            {!link.detailedStatus?.startsWith(link.status) &&
              link.status + ", "}
            {link.detailedStatus}
          </div>

          <div className="text-right">{link.dataInCount.toLocaleString()}</div>

          <div className="text-right">{link.dataOutCount.toLocaleString()}</div>

          <button className="text-muted-foreground grid cursor-pointer place-items-center">
            <Ellipsis className="size-3" />
          </button>
        </DataGridRow>
      }
    />
  );
}
