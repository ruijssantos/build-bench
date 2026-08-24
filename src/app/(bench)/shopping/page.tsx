import { ShoppingIcon } from "@/components/icons";
import { ComingSoon } from "@/components/bench/ComingSoon";

export const metadata = { title: "Shopping" };

export default function ShoppingPage() {
  return (
    <ComingSoon
      title="Shopping"
      description="The buy list ships in Phase 5 — kit requirements minus your inventory, with cross-brand equivalents offered as substitutes."
      icon={ShoppingIcon}
    />
  );
}
