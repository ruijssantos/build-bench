import { DesktopHeader } from "@/components/bench/DesktopHeader";
import { PhoneHeader } from "@/components/bench/PhoneHeader";
import { GuideCards } from "@/components/guides/GuideCards";

export const metadata = { title: "Tips & Guides" };

/**
 * `/guides` — every guide as a card. Fully static: the guides are compiled in
 * (`@/guides`), so there is nothing to stream.
 */
export default function GuidesPage() {
  return (
    <>
      <PhoneHeader title="Guides" />
      <DesktopHeader title="Tips & Guides" />
      <GuideCards />
    </>
  );
}
