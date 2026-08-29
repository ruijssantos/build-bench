import { STASH_STATUSES, type StashStatus } from "@/domain/kit";

export type KitsSearchParams = Record<string, string | string[] | undefined>;

/** `null` means "All" — every stash status at once. */
export type KitsStatusFilter = StashStatus | null;

function isStashStatus(value: unknown): value is StashStatus {
  return typeof value === "string" && (STASH_STATUSES as readonly string[]).includes(value);
}

/**
 * The Stash's one filter lives in the URL, not client state — same rule as
 * the shelf's family pills (docs/PERFORMANCE.md §6): a status pill is a real
 * destination the router can prefetch while merely hovered, and "just the
 * kits I'm building" is a link you can come back to.
 */
export function readKitsStatusFilter(searchParams: KitsSearchParams): KitsStatusFilter {
  const raw = searchParams.status;
  return isStashStatus(raw) ? raw : null;
}

export function kitsHref(status: KitsStatusFilter): string {
  return status ? `/kits?status=${status}` : "/kits";
}
