import { SearchIcon } from "@/components/icons";

import styles from "./SearchField.module.css";

/**
 * The empty search box, for a <Suspense> fallback — `SearchField`'s own
 * chrome without the input, the label or the clear button.
 *
 * It lives beside `SearchField` and shares its stylesheet on purpose. The
 * previous fallback hand-rolled the box from class names that used to live in
 * `SearchBox.module.css`; when Phase 3 lifted that chrome into `SearchField`
 * those names stopped resolving, and because a missing CSS-module key is
 * `undefined` rather than an error, the fallback quietly degraded to an
 * unstyled icon on a bare div and stayed that way. Reading the real
 * component's stylesheet is what stops that happening again.
 *
 * `.box` carries a fixed height (52px, 46px on desktop), so the reserved box
 * is exactly the right size at both breakpoints with nothing inside it —
 * there is no text to hide and nothing to measure.
 *
 * A Server Component, unlike `SearchField` itself: a fallback that ships
 * client JS to draw an empty box would be paying twice for the thing it is
 * standing in for.
 */
export function SearchFieldSkeleton() {
  return (
    <div className={styles.box} aria-hidden="true">
      <SearchIcon size={19} className={styles.icon} />
    </div>
  );
}
