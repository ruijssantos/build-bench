import { KitsIcon } from "@/components/icons";
import { ComingSoon } from "@/components/bench/ComingSoon";

export const metadata = { title: "Kits" };

export default function KitsPage() {
  return (
    <ComingSoon
      title="Kits"
      description="Kit stash and manual upload ship in Phase 4 — wishlist, owned, in-progress and built kits, with the manual PDF viewer and paint-list extraction."
      icon={KitsIcon}
    />
  );
}
