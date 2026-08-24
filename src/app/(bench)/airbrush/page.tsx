import { AirbrushIcon } from "@/components/icons";
import { ComingSoon } from "@/components/bench/ComingSoon";

export const metadata = { title: "Airbrush" };

export default function AirbrushPage() {
  return (
    <ComingSoon
      title="Airbrush"
      description="Maintenance logging ships in Phase 8 — sessions since the last deep clean, and the spray-session feedback loop that refines the Thinner Bench's ratios."
      icon={AirbrushIcon}
    />
  );
}
