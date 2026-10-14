import { KitDetailPage } from "@/components/kits/detail/KitDetailPage";

/** A stashed kit's page — docs/PLAN.md §6 Phase 4a. A wishlist kit's is
 * `/wishlist/[id]`, the same page. */
export default function StashKitPage(props: PageProps<"/kits/[id]">) {
  return <KitDetailPage params={props.params} listHref="/kits" />;
}
