import { LogIcon } from "@/components/icons";
import { ComingSoon } from "@/components/bench/ComingSoon";

export const metadata = { title: "Build log" };

export default function LogPage() {
  return (
    <ComingSoon
      title="Build log"
      description="The per-kit build journal ships in Phase 7 — dated entries by stage, with photos."
      icon={LogIcon}
    />
  );
}
