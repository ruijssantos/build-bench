import { AirbrushIcon } from "@/components/icons";
import { ComingSoon } from "@/components/bench/ComingSoon";
import { getActiveAirbrush } from "@/db/repositories/airbrush";

export const metadata = { title: "Airbrush" };

export default async function AirbrushPage() {
  const airbrush = await getActiveAirbrush();
  return (
    <ComingSoon
      title="Airbrush"
      description="Maintenance logging ships in Phase 8 — sessions since the last deep clean, and the spray-session feedback loop that refines the Thinner Bench's ratios."
      icon={AirbrushIcon}
      airbrush={airbrush ?? null}
    />
  );
}
