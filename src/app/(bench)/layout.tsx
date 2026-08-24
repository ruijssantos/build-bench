import { getActiveAirbrush } from "@/db/repositories/airbrush";
import { NavRail } from "@/components/nav/NavRail";
import { NavTabBar } from "@/components/nav/NavTabBar";

import styles from "./layout.module.css";

// Every screen under here reads live, per-request data (catalogue, overrides,
// the rig row) behind auth — never static. Forcing dynamic also means build
// never has to reach the DB, which it can't in CI (no DATABASE_URL there).
export const dynamic = "force-dynamic";

export default async function BenchLayout({ children }: { children: React.ReactNode }) {
  const airbrush = await getActiveAirbrush();

  return (
    <div className={styles.shell}>
      <NavRail airbrush={airbrush ?? null} />
      <div className={styles.content}>{children}</div>
      <NavTabBar />
    </div>
  );
}
