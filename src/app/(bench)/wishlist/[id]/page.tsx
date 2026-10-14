import { KitDetailPage } from "@/components/kits/detail/KitDetailPage";

/** A wishlist kit's page — the same page as a stashed kit's (`/kits/[id]`),
 * under the Wishlist so the nav and the URL both say where the kit is. */
export default function WishlistKitPage(props: PageProps<"/wishlist/[id]">) {
  return <KitDetailPage params={props.params} listHref="/wishlist" />;
}
