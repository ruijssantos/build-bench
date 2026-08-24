import { PaintsIcon } from "@/components/icons";
import { ComingSoon } from "@/components/bench/ComingSoon";

export const metadata = { title: "Paints" };

export default function InventoryPage() {
  return (
    <ComingSoon
      title="Paints"
      description="Paint inventory ships in Phase 3 — the Google Sheet import, decanted-vs-stock tracking, and the “do I own this?” check on the Thinner Bench card."
      icon={PaintsIcon}
    />
  );
}
