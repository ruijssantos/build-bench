import type { ComponentType } from "react";

import {
  GuidesIcon,
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

/**
 * Six, plus the tab bar's own Sign out — seven across a phone. §4.1 sized the
 * bar for five; at 360px seven tabs still leave ~51px each, which the longest
 * labels ("Wishlist", "Sign out") fit inside at 10.5px. An eighth would not.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", railLabel: "Dashboard", tabLabel: "Home", icon: HomeIcon },
  { key: "thinner", href: "/thinner", railLabel: "Thinner Bench", tabLabel: "Thinner", icon: ThinnerIcon },
  { key: "inventory", href: "/inventory", railLabel: "Paints", tabLabel: "Paints", icon: PaintsIcon },
  { key: "wishlist", href: "/wishlist", railLabel: "Wishlist", tabLabel: "Wishlist", icon: WishlistIcon },
  { key: "kits", href: "/kits", railLabel: "Stash", tabLabel: "Stash", icon: KitsIcon },
  { key: "guides", href: "/guides", railLabel: "Tips & Guides", tabLabel: "Guides", icon: GuidesIcon },
];
