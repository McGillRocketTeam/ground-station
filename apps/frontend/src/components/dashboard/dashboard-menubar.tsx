import { Suspense } from "react";

import {
  Menubar,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";

import {
  DashboardActionMenubarGroups,
  useDashboardDashboardActionGroups,
  useDashboardInstanceActionGroups,
  useDashboardViewActionGroups,
} from "./dashboard-actions";

export function DashboardMenuBar() {
  return (
    <Menubar className="w-full border-0 border-b p-0">
      <DashboardMenuBarMenu />
      <Suspense fallback={<InstanceMenuBarFallback />}>
        <InstanceMenuBarMenu />
      </Suspense>
      <ViewMenuBarMenu />
    </Menubar>
  );
}

function DashboardMenuBarMenu() {
  const groups = useDashboardDashboardActionGroups();

  return (
    <MenubarMenu>
      <MenubarTrigger>Dashboard</MenubarTrigger>
      <MenubarContent className="w-44">
        <DashboardActionMenubarGroups groups={groups} />
      </MenubarContent>
    </MenubarMenu>
  );
}

function InstanceMenuBarMenu() {
  const groups = useDashboardInstanceActionGroups();

  return (
    <MenubarMenu>
      <MenubarTrigger>Instance</MenubarTrigger>
      <MenubarContent className="w-44">
        <DashboardActionMenubarGroups groups={groups} />
      </MenubarContent>
    </MenubarMenu>
  );
}

function InstanceMenuBarFallback() {
  return (
    <MenubarMenu>
      <MenubarTrigger>Instance</MenubarTrigger>
      <MenubarContent className="w-44">
        <MenubarGroup>
          <MenubarItem disabled>Loading instances...</MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
}

function ViewMenuBarMenu() {
  const groups = useDashboardViewActionGroups();

  return (
    <MenubarMenu>
      <MenubarTrigger>View</MenubarTrigger>
      <MenubarContent className="w-44">
        <DashboardActionMenubarGroups groups={groups} />
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem>Hide Sidebar</MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
}
