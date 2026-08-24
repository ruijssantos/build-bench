# The Build Bench

A companion app for 1:24 scale model car building — airbrush thinning ratios,
paint inventory, kit research and build logs, built around a Tamiya 74540 HG
Trigger workflow.

The architecture and phased build plan live in [`docs/PLAN.md`](docs/PLAN.md).
Design system tokens are locked in §4.1 of that file.

## Status

**Phase 0 — Foundations.** Next.js scaffold, database schema, auth, PWA shell.
No feature screens yet — those start at Phase 1.

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
| `npm run db:generate` | Generate a Drizzle migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` |

### Environment variables

See `.env.example`. `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` come from the
Vercel project's Storage tab (Neon + Blob integrations); `AUTH_SECRET` and
`APP_PASSPHRASE` are set by hand — see `docs/PLAN.md` §9.2.
