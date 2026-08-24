import type { ComponentType } from "react";

import {
  AirbrushIcon,
  KitsIcon,
  LogIcon,
  PaintsIcon,
  ShoppingIcon,
  ThinnerIcon,
  type IconProps,
} from "@/components/icons";

export interface NavItem {
  key: string;
  href: string;
  railLabel: string;
  tabLabel: string;
  icon: ComponentType<IconProps>;
  /** Shown on the desktop rail only — the phone tab bar has room for 5 items (§4.1). */
  railOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "thinner", href: "/thinner", railLabel: "Thinner Bench", tabLabel: "Thinner", icon: ThinnerIcon },
  { key: "inventory", href: "/inventory", railLabel: "Paints", tabLabel: "Paints", icon: PaintsIcon },
  { key: "kits", href: "/kits", railLabel: "Kits", tabLabel: "Kits", icon: KitsIcon },
  { key: "shopping", href: "/shopping", railLabel: "Shopping", tabLabel: "Shop", icon: ShoppingIcon },
  { key: "log", href: "/log", railLabel: "Build log", tabLabel: "Log", icon: LogIcon },
  { key: "airbrush", href: "/airbrush", railLabel: "Airbrush", tabLabel: "Airbrush", icon: AirbrushIcon, railOnly: true },
];
