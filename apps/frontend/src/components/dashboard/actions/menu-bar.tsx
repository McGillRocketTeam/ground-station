import { Suspense } from "react";

import {
  Menubar,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";

import {
  DashboardActionMenubarGroups,
  useDashboardCardActionGroups,
  useDashboardDashboardActionGroups,
  useDashboardInstanceActionGroups,
  useDashboardViewActionGroups,
} from "./groups";

export function DashboardMenuBar() {
  return (
    <Menubar className="w-full border-0 border-b p-0">
      <DashboardMenuBarMenu />
      <CardMenuBarMenu />
      <ViewMenuBarMenu />
    </Menubar>
  );
}

function DashboardMenuBarMenu() {
  const groups = useDashboardDashboardActionGroups();

  return (
    <MenubarMenu>
      <MenubarTrigger>Dashboard</MenubarTrigger>
      <MenubarContent className="w-full max-w-80 min-w-44">
        <DashboardActionMenubarGroups groups={groups} />
      </MenubarContent>
    </MenubarMenu>
  );
}

function CardMenuBarMenu() {
  const groups = useDashboardCardActionGroups();

  return (
    <MenubarMenu>
      <MenubarTrigger>Card</MenubarTrigger>
      <MenubarContent className="w-full max-w-80 min-w-44">
        <DashboardActionMenubarGroups groups={groups} />
      </MenubarContent>
    </MenubarMenu>
  );
}

function InstanceSubMenuBarMenu() {
  const groups = useDashboardInstanceActionGroups();

  return (
    <MenubarSub>
      <MenubarSubTrigger>Instance</MenubarSubTrigger>
      <MenubarSubContent>
        <DashboardActionMenubarGroups groups={groups} />
      </MenubarSubContent>
    </MenubarSub>
  );
}

function InstanceSubMenuBarFallback() {
  return (
    <MenubarSub>
      <MenubarSubTrigger>Instance</MenubarSubTrigger>
      <MenubarSubContent>
        <MenubarGroup>
          <MenubarItem disabled>Loading instances...</MenubarItem>
        </MenubarGroup>
      </MenubarSubContent>
    </MenubarSub>
  );
}

function ViewMenuBarMenu() {
  const groups = useDashboardViewActionGroups();

  return (
    <MenubarMenu>
      <MenubarTrigger>View</MenubarTrigger>
      <MenubarContent className="w-full max-w-80 min-w-44">
        <Suspense fallback={<InstanceSubMenuBarFallback />}>
          <InstanceSubMenuBarMenu />
        </Suspense>
        <MenubarSeparator />
        <DashboardActionMenubarGroups groups={groups} />
        {/* <MenubarGroup> */}
        {/*   <MenubarItem>Hide Sidebar</MenubarItem> */}
        {/* </MenubarGroup> */}
      </MenubarContent>
    </MenubarMenu>
  );
}
