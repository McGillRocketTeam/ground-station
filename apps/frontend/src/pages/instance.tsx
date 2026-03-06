import { Atom } from "@effect-atom/atom-react";
import { useState, type ReactNode } from "react";
import { Outlet } from "react-router";

export function InstanceProtectedPage(): ReactNode {
  const [instance, setInstance] = useState("");

  if (!instance) {
    return (
      <div className="w-full h-screen grid place-items-center">
        Select Instance
      </div>
    );
  }

  return <Outlet />;
}
