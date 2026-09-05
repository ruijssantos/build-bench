<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working on this repo

Every rule below is here because it was broken, in this repo, on work that
reached `main`. Each one names the incident so it can't be waved off as
generic caution.

## Re-check the PR state immediately before every push

Not once at the start of the turn. A turn here runs for twenty or thirty
minutes; the owner merges when the PR is ready, often from a phone, while the
turn is still going. A state read at minute one is worthless by minute twenty.

```bash
git fetch origin main
git merge-base --is-ancestor HEAD origin/main && echo "MERGED — do not push here"
```

If the branch has already merged, the follow-up is a **new change**, not more
commits on the old branch: branch again from current `main`, move the work
across, and leave the merged branch at exactly the commit that merged. A merged
PR is finished — it cannot track new work, and pushing to its branch puts
commits somewhere nobody is looking.

This has happened twice, #40 and #44, and the second time was after being told
about the first. Both times the check *was* performed — early in the turn, then
trusted long after it had gone stale. So the rule is not "remember to check".
It is **"a PR's state is only true at the moment you read it"**: read it again
in the same breath as the push.

## Don't create a pull request unless asked

Push the branch and say it's ready. Opening a PR is the owner's call.

## A migration's `when` must exceed every `when` before it

In `drizzle/meta/_journal.json`. Nothing enforces this. `db:generate` stamps the
current clock, so it gets the ordering right only by accident, and the migrator
treats a violation as an instruction rather than an error: it gates on a single
`max(created_at) < when` comparison, so an out-of-order entry is skipped in
silence, stays skipped on every future run, and `db:migrate` prints
`Migrations applied.` regardless.

`0007_drop_dead_columns` shipped this way and reached `main`, three and a half
hours behind `0006`, because `0006`'s timestamp had been set by hand after a
numbering collision and `0007` kept whatever `db:generate` gave it.

So: any time a migration is renumbered, or a journal is reconciled by hand after
a collision with `main`, check the ordering — and run `npm run db:verify`, which
names stranded migrations and diffs the live schema against drizzle's snapshot.
Mechanism and fix in `docs/PLAN.md` §9.5.

## A step that changes state must report what it changed

`db:migrate` printed one hardcoded `Migrations applied.` before anything was
checked, which is how a skipped migration reached production unnoticed. This
repo's own rule for paid API paths — every failure returns a reason, never
`null` (`docs/PLAN.md` §7) — applies just as much to anything that writes to the
shared database. If a script can do nothing and still claim success, it needs a
verifier, not a louder success message.
