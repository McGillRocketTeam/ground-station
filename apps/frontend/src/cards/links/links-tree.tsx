import {
  buildLinkTree,
  colorByStatus,
  type Link,
  type LinkNode,
} from "./utils";
import { Fragment } from "react/jsx-runtime";
import {
  DataGridBody,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
} from "@/components/ui/data-grid";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover as PopoverPrimitive } from "@base-ui/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LinkDetail } from "./link-detail";

const linksPopover = PopoverPrimitive.createHandle<Link>();
export function LinksTree({ links }: { links: ReadonlyArray<Link> }) {
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
                  "absolute left-0 top-0 w-px bg-current",
                  isLast ? "h-1/2" : "h-full",
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
						bg-current
						"
                style={{
                  left: depth * 16 - 8,
                  transform: "translateY(-50%)",
                }}
              />
            )}

            <span
              className="break-all text-ellipsis line-clamp-2"
              style={{ paddingLeft: depth * 26 }}
            >
              {link.parentName ? link.name.split("/")[1] : link.name}
            </span>
          </div>

          <div className="text-ellipsis line-clamp-1">
            {!link.detailedStatus?.startsWith(link.status) &&
              link.status + ", "}
            {link.detailedStatus}
          </div>

          <div className="text-right">{link.dataInCount.toLocaleString()}</div>

          <div className="text-right">{link.dataOutCount.toLocaleString()}</div>

          <button className="grid place-items-center text-muted-foreground cursor-pointer">
            <Ellipsis className="size-3" />
          </button>
        </DataGridRow>
      }
    />
  );
}
