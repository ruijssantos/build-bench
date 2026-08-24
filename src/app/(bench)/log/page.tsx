import { LogIcon } from "@/components/icons";
import { ComingSoon } from "@/components/bench/ComingSoon";
import { getActiveAirbrush } from "@/db/repositories/airbrush";

export const metadata = { title: "Build log" };

export default async function LogPage() {
  const airbrush = await getActiveAirbrush();
  return (
    <ComingSoon
      title="Build log"
      description="The per-kit build journal ships in Phase 7 — dated entries by stage, with photos."
      icon={LogIcon}
      airbrush={airbrush ?? null}
    />
  );
}
