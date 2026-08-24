import { PaintsIcon } from "@/components/icons";
import { ComingSoon } from "@/components/bench/ComingSoon";
import { getActiveAirbrush } from "@/db/repositories/airbrush";

export const metadata = { title: "Paints" };

export default async function InventoryPage() {
  const airbrush = await getActiveAirbrush();
  return (
    <ComingSoon
      title="Paints"
      description="Paint inventory ships in Phase 3 — the Google Sheet import, decanted-vs-stock tracking, and the “do I own this?” check on the Thinner Bench card."
      icon={PaintsIcon}
      airbrush={airbrush ?? null}
    />
  );
}
