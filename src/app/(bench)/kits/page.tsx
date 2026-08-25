import { KitsIcon } from "@/components/icons";
import { ComingSoon } from "@/components/bench/ComingSoon";

export const metadata = { title: "Stash" };

export default function KitsPage() {
  return (
    <ComingSoon
      title="Stash"
      description="The kits you own ship in Phase 4 — stashed, building or built, with manual upload and a per-kit paint list checked against the shelf."
      icon={KitsIcon}
    />
  );
}
