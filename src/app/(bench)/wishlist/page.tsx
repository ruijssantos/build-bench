import { WishlistIcon } from "@/components/icons";
import { ComingSoon } from "@/components/bench/ComingSoon";

export const metadata = { title: "Wishlist" };

export default function WishlistPage() {
  return (
    <ComingSoon
      title="Wishlist"
      description="Kits you want and the rest of the shopping ship in Phase 3 — search a kit by number or name, keep it with its brand, scale, category, box art and Scalemates page, plus a free-text list for tools and supplies."
      icon={WishlistIcon}
    />
  );
}
