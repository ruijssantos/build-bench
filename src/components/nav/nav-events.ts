/**
 * Fired on `window` whenever a primary nav item is clicked (`NavRail`,
 * `NavTabBar`) — including a click on the item for the screen already
 * showing. `detail` is that item's `href`.
 *
 * A plain DOM event rather than React context: the nav lives in the root
 * layout and a screen's own state lives well below it, and there is no
 * shared ancestor worth wrapping in a client provider just to pass this one
 * signal down (`docs/PERFORMANCE.md` §4 — client islands, not client trees).
 * Nav dispatches unconditionally on every click, active or not; a screen
 * that cares only reacts when the `href` is its own, and a fresh navigation
 * already starts every screen's state from scratch on its own; this event
 * is what makes re-clicking the tab you're already on do the same.
 */
export const NAV_RECLICK_EVENT = "bench:nav-click";

export function dispatchNavClick(href: string): void {
  window.dispatchEvent(new CustomEvent<string>(NAV_RECLICK_EVENT, { detail: href }));
}
