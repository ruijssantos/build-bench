import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DesktopHeader } from "@/components/bench/DesktopHeader";
import { PhoneHeader } from "@/components/bench/PhoneHeader";
import { GuideBody } from "@/components/guides/GuideBody";
import styles from "@/components/guides/Guides.module.css";
import { GuideSidebar } from "@/components/guides/GuideSidebar";
import { ChevronLeftIcon } from "@/components/icons";
import { getGuide, GUIDES } from "@/guides";

/**
 * `/guides/[slug]` — one guide. Every slug is known at build time, so each
 * page prerenders whole; unlike `/kits/[id]` there is no query to put behind
 * a boundary, and awaiting `params` here costs nothing at request time.
 */
export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata(props: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: getGuide(slug)?.title ?? "Guide" };
}

export default async function GuidePage(props: PageProps<"/guides/[slug]">) {
  const { slug } = await props.params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  return (
    <>
      <PhoneHeader title="Guides" />
      <DesktopHeader title="Tips & Guides" />

      <Link href="/guides" className={styles.crumb}>
        <ChevronLeftIcon size={18} /> All guides
      </Link>

      <div className={styles.layout}>
        <GuideSidebar current={guide} />
        <GuideBody guide={guide} />
      </div>
    </>
  );
}
