import { KitsIcon } from "@/components/icons";
import { ComingSoon } from "@/components/bench/ComingSoon";
import { getActiveAirbrush } from "@/db/repositories/airbrush";

export const metadata = { title: "Kits" };

export default async function KitsPage() {
  const airbrush = await getActiveAirbrush();
  return (
    <ComingSoon
      title="Kits"
      description="Kit stash and manual upload ship in Phase 4 — wishlist, owned, in-progress and built kits, with the manual PDF viewer and paint-list extraction."
      icon={KitsIcon}
      airbrush={airbrush ?? null}
    />
  );
}
