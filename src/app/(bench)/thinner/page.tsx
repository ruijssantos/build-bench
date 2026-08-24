import { resolveThinnerBench } from "@/lib/thinner-bench";
import { ThinnerBench } from "@/components/thinner/ThinnerBench";

export const metadata = { title: "Thinner Bench" };

// TS-8 by default — matches the design reference's populated example rather
// than an empty state, so the screen is immediately useful on first open.
const DEFAULT_CODE = "TS-8";

export default async function ThinnerPage(props: PageProps<"/thinner">) {
  const searchParams = await props.searchParams;
  const code = typeof searchParams.code === "string" ? searchParams.code : DEFAULT_CODE;

  const bundle = await resolveThinnerBench(code);

  return <ThinnerBench initialBundle={bundle} />;
}
