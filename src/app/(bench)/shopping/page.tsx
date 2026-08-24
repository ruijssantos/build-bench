import { ShoppingIcon } from "@/components/icons";
import { ComingSoon } from "@/components/bench/ComingSoon";
import { getActiveAirbrush } from "@/db/repositories/airbrush";

export const metadata = { title: "Shopping" };

export default async function ShoppingPage() {
  const airbrush = await getActiveAirbrush();
  return (
    <ComingSoon
      title="Shopping"
      description="The buy list ships in Phase 5 — kit requirements minus your inventory, with cross-brand equivalents offered as substitutes."
      icon={ShoppingIcon}
      airbrush={airbrush ?? null}
    />
  );
}
