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
the shelf on every card and on the kit's own page.

Next is Phase 4b, deep kit research (difficulty, fit issues, a build video —
§5.1 stages B/C), folded into Phase 6's scope.

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
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `npm run db:seed` | Load `seed/*.json` — catalogue, ratio rules, and the paint shelf |
| `npm run catalogue:build` | Regenerate `seed/paints.tamiya.json` |
| `npm run catalogue:verify` | CI gate: every code the app needs is in the catalogue |

### Environment variables

See `.env.example`. `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` come from the
Vercel project's Storage tab (Neon + Blob integrations); `AUTH_SECRET` and
`APP_PASSPHRASE` are set by hand — see `docs/PLAN.md` §9.2. `ANTHROPIC_API_KEY`
is your own Anthropic API key, billed to your own account — needed from Phase 3
onwards, where kit search on the Wishlist screen resolves a query through
Claude with web search (`docs/PLAN.md` §5.1 stage A).
