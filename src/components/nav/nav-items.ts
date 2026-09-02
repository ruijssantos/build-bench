import type { ComponentType } from "react";

import {
  HomeIcon,
  KitsIcon,
  PaintsIcon,
  ThinnerIcon,
  WishlistIcon,
  type IconProps,
} from "@/components/icons";

export interface NavItem {
  key: string;
  href: string;
  railLabel: string;
  tabLabel: string;
  icon: ComponentType<IconProps>;
}

/** Exactly five, which is what the phone tab bar has room for (§4.1). */
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", railLabel: "Dashboard", tabLabel: "Home", icon: HomeIcon },
  { key: "thinner", href: "/thinner", railLabel: "Thinner Bench", tabLabel: "Thinner", icon: ThinnerIcon },
  { key: "inventory", href: "/inventory", railLabel: "Paints", tabLabel: "Paints", icon: PaintsIcon },
  { key: "wishlist", href: "/wishlist", railLabel: "Wishlist", tabLabel: "Wishlist", icon: WishlistIcon },
  { key: "kits", href: "/kits", railLabel: "Stash", tabLabel: "Stash", icon: KitsIcon },
];
