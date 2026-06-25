"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { TOPBAR_CENTER_ID } from "./top-bar";

// Portals its children into the TopBar's center slot. Lets a page (e.g. the SOP dashboard) render
// the search bar from inside its own component tree — so the bar's state changes don't re-render
// the TopBar — while it visually lives up in the persistent top bar.
export function TopBarCenter({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setEl(document.getElementById(TOPBAR_CENTER_ID));
  }, []);
  return el ? createPortal(children, el) : null;
}
