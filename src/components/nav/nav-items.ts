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
 * Six across a phone — §4.1 sized the bar for five; at 360px six tabs leave
 * 60px each, which the longest label ("Wishlist") fits inside at 10.5px.
 * Sign out isn't a tab: it's an icon in `PhoneHeader`'s corner.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", railLabel: "Dashboard", tabLabel: "Home", icon: HomeIcon },
  { key: "thinner", href: "/thinner", railLabel: "Thinner Bench", tabLabel: "Thinner", icon: ThinnerIcon },
  { key: "inventory", href: "/inventory", railLabel: "Paints", tabLabel: "Paints", icon: PaintsIcon },
  { key: "wishlist", href: "/wishlist", railLabel: "Wishlist", tabLabel: "Wishlist", icon: WishlistIcon },
  { key: "kits", href: "/kits", railLabel: "Stash", tabLabel: "Stash", icon: KitsIcon },
  { key: "guides", href: "/guides", railLabel: "Tips & Guides", tabLabel: "Guides", icon: GuidesIcon },
];
