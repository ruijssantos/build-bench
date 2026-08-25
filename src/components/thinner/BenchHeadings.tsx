import Link from "next/link";

import { resolvePaintIdentity } from "@/lib/thinner-bench";

import { SearchBox } from "./SearchBox";
import { resolveBenchParams, type BenchSearchParams } from "./bench-params";
import styles from "./ThinnerBench.module.css";

/**
 * The two bits of the screen that depend on the URL but not on the database.
 *
 * `resolvePaintIdentity` reads the compiled catalogue, so both of these resolve
 * with no I/O at all: at request time they land in the very first flush of HTML
 * alongside the static shell, and nothing about them can shift later. During a
 * prerender they're simply left behind their fallback.
 */

export async function SearchArea({
  scope,
  searchParams,
}: {
  scope: "phone" | "desktop";
  searchParams: Promise<BenchSearchParams>;
}) {
  const { code, line } = await resolveBenchParams(searchParams);
  const { paint } = resolvePaintIdentity(code, line);
  const label = paint?.known ? `${paint.code} ${paint.name}` : code;

  return <SearchBox scope={scope} initialQuery={label} />;
}

/** Only shown for a code sold as both an acrylic and an enamel bottle. */
export async function LineToggle({ searchParams }: { searchParams: Promise<BenchSearchParams> }) {
  const { code, line } = await resolveBenchParams(searchParams);
  const { paint } = resolvePaintIdentity(code, line);
  if (!paint?.ambiguous) return null;

  const options = [
    { value: "acrylic", label: "Acrylic (bottle)" },
    { value: "enamel", label: "Enamel (bottle)" },
  ] as const;

  return (
    <div className={styles.lineToggle}>
      {options.map((option) => (
        <Link
          key={option.value}
          href={`/thinner?code=${encodeURIComponent(paint.code)}&line=${option.value}`}
          replace
          scroll={false}
          className={`${styles.lineButton} ${line === option.value ? styles.lineButtonActive : ""}`}
          aria-current={line === option.value ? "true" : undefined}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
