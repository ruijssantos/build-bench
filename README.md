# The Build Bench

A companion app for 1:24 scale model car building — airbrush thinning ratios,
paint inventory, kit research and build logs, built around a Tamiya 74540 HG
Trigger workflow.

The architecture and phased build plan live in [`docs/PLAN.md`](docs/PLAN.md).
Design system tokens are locked in §4.1 of that file. The performance rules
every screen follows — what's prerendered, what's compiled in, and what's
allowed to touch the database — are in
[`docs/PERFORMANCE.md`](docs/PERFORMANCE.md).

## Status

Shipped so far: the foundations (Phase 0), the Thinner Bench (Phase 1), the
paint shelf (Phase 2) — the Google Sheet imported, CRUD over form and state,
one-tap running low, and "do I own this?" on the Thinner Bench result card —
the wishlist (Phase 3): kits searched by number or name and resolved
through Claude with web search, saved with box art and a Scalemates link, plus
a free-text list for tools and supplies, both ticking over to bought — and the
stash (Phase 4a): the kits you own, a status pipeline (stash → building →
built) with a detail page per kit, manual PDF upload with an **Extract paint
list** action (Claude Opus 5), and the resulting paint list checked against
the shelf on every card and on the kit's own page — and cross-brand paint
equivalence (Phase 5): a Mr. Color, Vallejo, Hataka (and seven more brands')
code resolves to its Tamiya equivalent automatically during extraction, so a
Japanese kit's manual doesn't dead-end in the Unresolved bucket just for
calling out the "wrong" brand.

Most recently the dashboard (Phase 6), which is now the screen the app opens
on: what's on the bench, which stashed kits have every paint they need
already on the shelf, what to buy on the next shop run, and a wishlist
glance — all read-only, all derived from what the earlier phases already
store.

Most recently kit research (Phase 7): a Research panel on each stash kit that
searches the web for what other builders say about it — difficulty, fit issues
to expect, and tips. Everything it reports carries a link to the
source it came from, difficulty only ever appears as a consensus across a
counted number of sources, and a Verify tick marks what you have checked
yourself (`docs/PLAN.md` §5.4). It is synthesised from forum posts, and the
screen never lets you forget that.

Next is Phase 8, the build log — a per-kit dated journal with photos, to be
detailed when we get there.

## Stack

Next.js (App Router) · Drizzle ORM · Neon Postgres · Vercel Blob · TypeScript

## Development

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, AUTH_SECRET, APP_PASSPHRASE
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run perf:budget` | Check a finished build against the budget in `docs/PERFORMANCE.md` |
| `npm run db:generate` | Generate a Drizzle migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` — **run this after deploying any phase that adds a column**; nothing runs it automatically (see `docs/PLAN.md` §9.3) |
| `npm run db:seed` | Load `seed/*.json` — catalogue, ratio rules, the paint shelf, paint brands, and cross-brand equivalents |
| `npm run catalogue:build` | Regenerate `seed/paints.tamiya.json` |
| `npm run catalogue:verify` | CI gate: every code the app needs is in the catalogue, and every cross-brand equivalent resolves to a real catalogue code and brand |
| `npm run equivalents:build` | Regenerate `seed/equivalents.json` from `scripts/data/cybermodeler-tamiya-cross-reference.json` |

### Environment variables

See `.env.example`. `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` come from the
Vercel project's Storage tab (Neon + Blob integrations); `AUTH_SECRET` and
`APP_PASSPHRASE` are set by hand — see `docs/PLAN.md` §9.2. `ANTHROPIC_API_KEY`
is your own Anthropic API key, billed to your own account — needed from Phase 3
onwards, where kit search on the Wishlist screen resolves a query through
Claude with web search (`docs/PLAN.md` §5.1 stage A).
