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
  DashboardActionMenubarGroup,
  useDashboardDashboardActions,
  useDashboardInstanceActions,
  useDashboardViewActions,
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
  const actions = useDashboardDashboardActions();

  return (
    <MenubarMenu>
      <MenubarTrigger>Dashboard</MenubarTrigger>
      <MenubarContent className="w-44">
        <DashboardActionMenubarGroup actions={actions} />
      </MenubarContent>
    </MenubarMenu>
  );
}

function InstanceMenuBarMenu() {
  const actions = useDashboardInstanceActions();

  return (
    <MenubarMenu>
      <MenubarTrigger>Instance</MenubarTrigger>
      <MenubarContent className="w-44">
        <DashboardActionMenubarGroup actions={actions} />
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
  const actions = useDashboardViewActions();

  return (
    <MenubarMenu>
      <MenubarTrigger>View</MenubarTrigger>
      <MenubarContent className="w-44">
        <DashboardActionMenubarGroup actions={actions} />
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem>Hide Sidebar</MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
}
