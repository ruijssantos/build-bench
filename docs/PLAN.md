# Bench & Build — Architecture & Build Plan

A companion app for 1:24 scale model car building, centred on a Tamiya 74540 HG Trigger
airbrush workflow and pre-build kit research.

**Status:** revision 2, awaiting review. No implementation code written yet.
**Planning pass:** Opus. **Implementation:** Sonnet, phase by phase.

> **Changed in r2** — Hosting moved to Vercel, and the storage layer changed with it:
> Neon Postgres instead of SQLite, Vercel Blob instead of a mounted volume, and feature 2's
> research pipeline restructured into stages to live inside Vercel's function time limit.
> Phase order now starts with the Thinner Bench. Paint catalogue scope widened to the whole
> Tamiya range, with a cross-brand import from Cybermodeler.

---

## 1. Decisions taken

| Question | Decision |
|---|---|
| Hosting | **Vercel**, Hobby plan |
| Framework | **Next.js (App Router) + React** — the lowest-friction thing on Vercel |
| Database | **Neon Postgres**, via Vercel's native marketplace integration |
| File storage | **Vercel Blob** — manual PDFs and build photos |
| Auth | App-level signed cookie, one passphrase |
| Kit research | Claude API with server-side web search, staged to fit the function limit |
| Paint inventory source of truth | App database, one-time import from the Google Sheet |
| Phone | PWA / responsive web. Desktop for manuals, phone for quick lookups |

Everything below is downstream of "must run on Vercel with minimal setup".

### 1.1 Making Vercel work

Vercel imposes three constraints on the original design. Each has a clean answer.

**Problem 1 — no persistent filesystem, so SQLite is out.** Serverless functions get an
ephemeral disk that is wiped between deployments and not shared across invocations. The
database has to be a managed service.

**Neon Postgres, not Supabase.** You raised Supabase, and for many projects it would be the
right call — Postgres plus auth plus file storage in one free tier is a genuinely good
package. It loses here on one specific behaviour:

> **Supabase pauses free projects after 7 days of inactivity, and restoring is a manual
> click in their dashboard.** Neon scales to zero after 5 minutes idle and resumes
> automatically on the next query, in roughly 300–800 ms.

That difference is decisive for *this* app. Model building happens in bursts — you might not
open this for three weeks between kits. With Supabase, the trip where you most need it (in a
shop, phone in hand, "do I own XF-64?") is exactly the trip where you find a paused project
and a dashboard login. The standard workaround is a scheduled job pinging the database twice
a week, which is precisely the "new system to maintain" you said you didn't want.

Neon's other advantages here are incidental but real: it installs from the Vercel marketplace
in a couple of clicks, injects `DATABASE_URL` into all three environments automatically, and
bills through Vercel so there's one dashboard and one invoice. Free tier is 0.5 GB storage
and 100 compute-hours/month — this app will use a rounding error of both.

What you give up by not choosing Supabase is its built-in auth and storage. Both are replaced
below at lower total effort, because a single-user app doesn't need what Supabase Auth does.

**Problem 2 — files still need somewhere to live.** Manual PDFs and build photos.
**Vercel Blob**: 1 GB storage, 10 GB transfer/month on Hobby, `put()` is a one-liner, and
it's the same vendor as the host. Photos get resized on upload (long edge ~2000 px) so 1 GB
comfortably holds several hundred build shots. `build_photo` stores the returned blob URL.

**Problem 3 — auth.** Vercel's own Password Protection is Pro/Enterprise only, so it isn't an
option on Hobby. Vercel Authentication (available on Hobby) protects preview deployments but
leaves the production domain public, which is the wrong way round for this.

So: **app-level auth, one passphrase, a signed HTTP-only cookie**, checked in Next.js
middleware. About thirty lines with `jose` or `iron-session`, no accounts table, no OAuth.
Set a long cookie lifetime so the phone never logs you out at the bench with wet hands. The
threat model is "a crawler finds the URL", not a targeted attacker.

### 1.2 The 300-second ceiling — the one that actually shapes the design

Vercel Hobby caps function execution at **300 seconds**, with Fluid compute on by default.
Streaming does not buy extra time; the clock covers the whole invocation including the
streamed response.

A kit-research call — Claude Opus 5 running six to eight web searches and reading pages — can
plausibly run several minutes. Assuming it fits inside 300 s and discovering otherwise in a
hobby shop is how this feature becomes something you stop trusting.

**The fix is to stage the pipeline** (§5). It was already four logical stages; making each
one its own HTTP request means no single invocation approaches the limit, a failure retries
one stage rather than the whole job, and the UI gets a real progress indicator for free. No
queue, no cron, no background worker.

One happy accident: Fluid compute bills *active CPU*, not wall-clock. A research call spends
almost all its time waiting on the Claude API, which is idle time. Long calls are cheap under
this billing model — the 4 CPU-hours/month on Hobby is not a constraint we'll approach.

---

## 2. What the MVP proved, and what it hid

The attached `tamiyathinnerbench.html` is a good reference and its visual language carries
over wholesale. Three things it establishes worth keeping:

1. **The ratio model is right.** Family-based rules (gloss / flat / metallic / clear /
   lacquer / decanted spray / enamel / primer), with a starting ratio *plus a workable
   window*, not a single number.
2. **The rig is a first-class input.** Every number is stated for a 0.3 mm needle, a 7 cc
   fixed cup, and retarder-type thinner. That framing is the whole value.
3. **The cup-fill maths matters.** Drops → millilitres → percentage of a 7 cc cup, with an
   over-capacity warning, is the part that actually prevents a mistake at the bench.

Two things it hides:

- **The paint library is incomplete and fails silently.** Your inventory contains **XF-83
  Medium Sea Gray** and **XF-84 Dark Iron**; neither exists in the MVP's `LIB` array. The MVP
  doesn't error — `familyFromPrefix()` infers "XF → flat" and renders a grey swatch with a
  quiet "not in the library" note. Correct fallback, wrong catalogue. §2.2 fixes it.
- **Everything is per-session.** Nothing survives a refresh — the gap features 4, 5 and 6
  exist to close.

### 2.1 Your inventory as imported

Parsed from the Google Sheet — 33 paints across four groups. This is the Phase 3 seed.

- **Gloss (18):** X-2, X-3, X-6, X-7, X-8, X-9, X-10, X-11, X-12, X-13, X-14, X-18, X-19,
  X-21, X-22, X-24, X-26, X-27
  *The sheet files X-21 Flat Base under Gloss, and X-19/X-22/X-24/X-26/X-27 are smoke and
  clears. The importer classifies by catalogue family, not by sheet column, so these land as
  `additive` and `clear` — which is what the ratio rules need.*
- **Flat (11):** XF-1, XF-2, XF-7, XF-16, XF-24, XF-53, XF-56, XF-60, XF-64, XF-83, XF-84
- **Sprays (2):** TS-7 Racing White, TS-8 Italian Red
- **Primers (2):** Liquid Surface Primer Grey, Liquid Surface Primer White

### 2.2 The full Tamiya catalogue, and cross-brand matching

**Scope: every current Tamiya paint code**, not just the ones you own — X, XF, LP, TS, AS,
PS, and the primers. Approximate ranges, *to be verified by the seed script rather than
trusted from this document*:

| Line | Range (approx.) | What it is |
|---|---|---|
| `X-` | 1–34 | Acrylic gloss & metallic, 10/23 ml |
| `XF-` | 1–93+ | Acrylic flat, 10/23 ml — **has gaps in the numbering** |
| `LP-` | 1–90+ | Lacquer, 10 ml |
| `TS-` | 1–102+ | Lacquer spray can, 100 ml |
| `AS-` | 1–33 | Aircraft lacquer spray |
| `PS-` | 1–58 | Polycarbonate spray (RC bodies — wrong for styrene, and the app should say so) |
| Primers | — | Fine Surface Primer L/M/S, Liquid Surface Primer |

Two scripts own this, and they are part of Phase 1:

- `scripts/build-catalogue.ts` — generates `seed/paints.tamiya.json` with code, name, hex,
  line, family and finish for every code.
- `scripts/verify-catalogue.ts` — run in CI. Fails the build if any code referenced by
  inventory, kit requirements or the ratio rules is missing from the catalogue, and reports
  numbering gaps for human review. **This is the check that would have caught XF-83/XF-84**,
  and it's why the catalogue stops being a maintenance problem.

**Cross-brand equivalence — Cybermodeler.** Your
[Tamiya Color Cross-Reference](https://www.cybermodeler.com/color/tamiya_map.shtml) is a good
source and the plan uses it. Its columns cover Gunze Sangyo (GSI — i.e. Mr. Hobby, which is
the brand you named), Vallejo, Revell, Testors, XtraColour, AMMO by Mig, Hataka, Lifecolor and
Mission Models.

Two notes on using it:

- **Direction.** The chart maps Tamiya → other brands. Your actual question is the reverse:
  a non-Tamiya kit's manual calls for H12, what Tamiya do you reach for? Same data, indexed
  the other way — `paint_equivalent` is keyed to support both, and the UI leads with
  foreign → Tamiya.
- **Import once, at build time.** `scripts/import-cybermodeler.ts` fetches and parses the
  page into `seed/equivalents.json`, which is committed to the repo. **Nothing scrapes it at
  runtime.** The chart changes rarely; re-run the script when you want a refresh.

  *Caveat: cybermodeler.com is blocked by this planning sandbox's egress policy, so I could
  not fetch the page to confirm its exact table markup. The column list above comes from
  secondary sources. The parser will need one pass of adjustment against the real HTML —
  run the script on your machine, where there's no such block.*

Where Cybermodeler has no row for a paint, feature 3 falls back to a Claude lookup, and the
resulting row is written to `paint_equivalent` with `source = 'claude-research'` and a lower
`match_quality` so it's visibly distinct from chart-sourced data.

---

## 3. Data model

**Postgres via Drizzle ORM** — TypeScript-native schema, real migrations, types flow into the
app with no hand-written duplicates. Drizzle's Postgres and SQLite dialects are close enough
that the r1 schema survived the move essentially intact.

### 3.1 Reference data — seeded, read-mostly

```
paint
  code            text PK          -- "XF-64", canonical, normalised
  line            text             -- X | XF | LP | TS | AS | PS | PRIMER
  name            text
  hex             text             -- swatch
  family          text FK          -- ratio family (see ratio_rule)
  finish          text             -- gloss | flat | semi | metallic | clear
  size_ml         integer
  discontinued    boolean
  verified_at     timestamptz

ratio_rule                         -- the MVP's R{} table, promoted to data
  family          text PK          -- gloss | flat | semi | metallic | clear | lacquer |
                                   -- sprayDecant | polycarb | enamel | primer | additive
  thinner_type    text             -- acrylic_retarder | lacquer_retarder | enamel_x20
  paint_parts     real
  thinner_parts   real
  window_lo       real
  window_hi       real
  psi_text        text
  coats_text      text
  distance_text   text
  notes           jsonb            -- the "On the bench · 1:24" bullets

ratio_override                     -- your rig, your corrections
  id              serial PK
  paint_code      text NULL FK     -- override one paint...
  family          text NULL        -- ...or a whole family
  paint_parts     real
  thinner_parts   real
  psi_text        text
  reason          text
  created_at      timestamptz

paint_equivalent                   -- cross-brand, both directions
  id              serial PK
  brand           text             -- gunze_mr_hobby | vallejo | revell | testors |
                                   -- xtracolour | ammo | hataka | lifecolor | mission
  foreign_code    text             -- "H12"
  foreign_name    text
  tamiya_code     text FK paint
  match_quality   text             -- exact | close | approximate
  source          text             -- 'cybermodeler' | 'manufacturer' | 'claude-research'
  notes           text
  INDEX (brand, foreign_code)      -- foreign → Tamiya, the lookup you actually make
  INDEX (tamiya_code)              -- Tamiya → foreign

vendor
  id, name, country, url, notes, sort
```

`vendor` seeds with Scalemates (research), Spot Model, KitMania (PT), Hobby Sector (PT),
Super Hobby (PT), El Taller del Modelista (ES).

### 3.2 Your data — read/write

```
inventory_item                     -- feature 4, paint half
  id              serial PK
  paint_code      text FK paint
  form            text             -- bottle | spray_can | decanted_jar
  decanted_from   text NULL FK     -- TS-8 can → decanted jar, keeps the lineage
  state           text             -- sealed | open | low | empty
  quantity        integer
  location        text
  purchased_from  integer NULL FK vendor
  purchased_at    date
  notes           text
  updated_at      timestamptz

kit                                -- feature 4, stash half
  id              serial PK
  brand, kit_number, name, scale
  status          text             -- wishlist | owned | in_progress | built | shelved
  purchased_from  integer NULL FK vendor
  purchased_price numeric, currency text, purchased_at date
  notes           text
  created_at      timestamptz

research_job                       -- drives the staged pipeline (§5)
  id              uuid PK
  kit_id          integer NULL FK
  query           text
  stage           text             -- resolve | investigate | extract | manual | done | failed
  stage_status    jsonb            -- per-stage: ok / error / duration_ms / tokens
  partial         jsonb            -- accumulated result between stages
  error           text
  started_at, updated_at timestamptz

kit_research                       -- the finished, cached result
  id              serial PK
  kit_id          integer NULL FK
  job_id          uuid FK research_job
  resolved_brand, resolved_number, resolved_name text
  manual_url      text
  manual_blob_url text NULL        -- Vercel Blob, once downloaded
  difficulty      text             -- beginner | intermediate | advanced
  difficulty_note text
  fit_issues      jsonb            -- [{issue, severity, source_url, confidence}]
  build_video_url text
  sources         jsonb
  model_used      text
  input_tokens, output_tokens integer
  verified_by_me  boolean          -- see §5.4
  researched_at   timestamptz
  expires_at      timestamptz

kit_paint_requirement              -- the manual's paint callouts
  id              serial PK
  kit_id          integer FK
  raw_label       text             -- exactly as printed: "X-11 CHROME SILVER"
  paint_code      text NULL FK     -- resolved; null if unresolvable
  part_hint       text
  source          text             -- manual_pdf | research | manual_entry
  confidence      real

shopping_list_item                 -- feature 3 output, persisted so you can tick it off
  id              serial PK
  paint_code      text FK paint
  kit_id          integer NULL FK
  reason          text
  substitute_for  text NULL        -- set when this is a cross-brand equivalent
  status          text             -- needed | ordered | bought | skipped
  vendor_id       integer NULL FK
  added_at        timestamptz

build_log_entry                    -- feature 5
  id              serial PK
  kit_id          integer FK
  stage           text             -- research | prep | primer | body_colour | clear |
                                   -- polish | interior | engine | chassis | decals | final
  title           text
  body_md         text
  occurred_on     date
  created_at      timestamptz

build_photo
  id              serial PK
  entry_id        integer FK
  blob_url        text             -- Vercel Blob
  caption         text
  sort            integer

airbrush                           -- feature 6; one row today, modelled for more
  id              serial PK
  model           text             -- "Tamiya 74540 HG Trigger"
  nozzle_mm       real             -- 0.3
  cup_cc          real             -- 7
  acquired_at     date

maintenance_log                    -- feature 6
  id              serial PK
  airbrush_id     integer FK
  type            text             -- session_flush | deep_clean | needle_replace |
                                   -- oring_replace | lube | repair
  performed_on    date
  notes, parts_used text

spray_session                      -- the loop that makes feature 1 learn
  id              serial PK
  kit_id          integer NULL FK
  paint_code      text FK
  ratio_paint, ratio_thinner real
  thinner_type    text
  psi             real
  coats           integer
  ambient_temp, humidity real
  outcome         integer          -- 1–5
  notes           text             -- "orange peel, needed more thinner"
  sprayed_at      timestamptz
```

### 3.3 Why `spray_session` earns its place

It's the only table that closes a loop. Log what you actually mixed and how it came out, and
the Thinner Bench can show "last three times you sprayed XF-64 you went wetter than the rule"
next to the starting ratio, and offer to promote that into a `ratio_override`. It also feeds
`maintenance_log` (sessions since last deep clean) and `build_log_entry` (what you sprayed on
which kit, dated). Without it, features 1, 5 and 6 stay three disconnected screens.

It's deliberately last in the build order — but modelling it now means nothing needs
reshaping later.

---

## 4. Application structure

```
scale-model-bench/
├── docs/
│   ├── PLAN.md                    ← this file
│   └── decisions/                 ← short ADRs as things change
├── drizzle/                       ← generated migrations
├── seed/
│   ├── paints.tamiya.json         ← full catalogue (generated, committed)
│   ├── ratio-rules.json           ← ported from the MVP's R{}
│   ├── equivalents.json           ← Cybermodeler import (generated, committed)
│   ├── vendors.json
│   └── inventory.initial.json     ← the Google Sheet, imported once
├── scripts/
│   ├── build-catalogue.ts         ← §2.2
│   ├── verify-catalogue.ts        ← §2.2, runs in CI
│   ├── import-cybermodeler.ts     ← §2.2, run locally
│   └── import-sheet.ts
├── src/
│   ├── app/
│   │   ├── (bench)/
│   │   │   ├── thinner/           ← feature 1
│   │   │   ├── inventory/         ← feature 4a
│   │   │   ├── shopping/          ← feature 3
│   │   │   ├── kits/
│   │   │   │   ├── page.tsx       ← feature 4b, the stash
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── research/  ← feature 2
│   │   │   │       └── log/       ← feature 5
│   │   │   └── airbrush/          ← feature 6
│   │   ├── api/
│   │   │   └── research/
│   │   │       ├── resolve/route.ts      ← one stage = one function = one time budget
│   │   │       ├── investigate/route.ts
│   │   │       ├── extract/route.ts
│   │   │       └── manual/route.ts
│   │   ├── login/
│   │   ├── middleware.ts          ← cookie gate
│   │   └── layout.tsx
│   ├── db/
│   │   ├── schema.ts              ← Drizzle
│   │   ├── client.ts              ← Neon serverless driver
│   │   └── repositories/          ← all queries live here, nothing else touches the db
│   ├── domain/
│   │   ├── ratio.ts               ← pure: family + overrides → ratio, window, cup fill
│   │   ├── paint-code.ts          ← normalise "xf64" / "XF 64" → "XF-64"
│   │   ├── equivalence.ts         ← foreign → Tamiya
│   │   └── shopping.ts            ← requirements − inventory → buy list
│   ├── research/                  ← feature 2, isolated (§5)
│   │   ├── stages/
│   │   ├── schema.ts              ← Zod, shared by extract + routes
│   │   └── prompts.ts
│   ├── components/
│   └── styles/tokens.css          ← the MVP's palette and type, lifted verbatim
└── tests/
```

**Connection handling.** Use Neon's serverless HTTP driver (`@neondatabase/serverless`)
rather than node-postgres. It speaks HTTP instead of TCP, so there's no connection pool to
exhaust across serverless invocations — the single most common way a Postgres-on-Vercel app
falls over. Drizzle supports it directly.

**Data access rule.** Every query goes through `src/db/repositories/*`. Route handlers and
components never import the Drizzle client directly. This is what would make a future move
off Neon a contained change rather than a rewrite.

### 4.1 Design system

The MVP's visual language transfers directly, extracted before any component is written:

- **Palette:** `--ink #14161a`, `--panel #1c1f24`, `--line #2e333a`, `--paper #e8e4da`,
  `--dim #8d8a82`, `--red #c8202a`, `--thin #5d9dc4`, `--amber #d9a441`
- **Type:** Archivo Narrow 700 for display, IBM Plex Mono for everything else
- **Idioms to keep:** hairline-bordered panel grid, uppercase letterspaced eyebrow labels,
  the red em-dash bullet list, the amber/red flag callout, the segmented cup bar

Dark, high-contrast, workshop-instrument. Exactly right for a phone under a bench lamp. Keep
it; don't introduce a second visual idea.

### 4.2 Desktop and phone are different jobs

You named the split yourself and it should be designed for, not left to a breakpoint:

- **Desktop — reading.** Manual PDF viewer beside the kit's research notes and paint list.
  Build log writing. Inventory bulk editing. Wide, two-column, dense.
- **Phone — one-handed, at the bench or in a shop.** Thinner Bench readout, "do I own this?",
  the shopping list. Large touch targets, the ratio and cup-fill legible at arm's length,
  minimal typing. The drops slider needs to work with a knuckle.

---

## 5. Feature 2: how kit research actually works

Three findings from checking the ground first:

1. **Scalemates is bot-hostile.** Best kit database on the web, doesn't want scrapers. Direct
   HTML scraping works until it abruptly doesn't.
2. **"Difficulty and fit-issue notes from reviews and forums" is a synthesis job.** No API
   returns it; it lives in prose scattered across build threads and review blogs. Exactly
   what an LLM with web search is for, and what a scraper cannot do.
3. **You don't need the YouTube Data API.** Its free tier allows ~100 searches/day and adds a
   key, a quota and a failure mode. Claude's web search finds the build video in the same
   call. Skip it.

### 5.1 The staged pipeline

Four stages, each **its own HTTP request with its own 300 s budget**, driven from the client,
with state accumulating in `research_job`.

```
  "24345" or "Tamiya Nissan GT-R"
        │
   [A] /api/research/resolve          ~10–20 s
        │   Claude, effort medium, web_search max_uses 2
        │   → { brand, kit_number, name, scale, year }
        │   Cheap disambiguation before spending on research.
        ▼
   [B] /api/research/investigate      ~60–180 s  ← the expensive one
        │   Claude Opus 5, effort high, streaming
        │   web_search_20260209 (max_uses 6) + web_fetch_20260209
        │   Free-form, WITH citations. Finds: manual PDF, difficulty
        │   consensus + specific fit issues, paint callouts, build video.
        ▼
   [C] /api/research/extract          ~10–20 s
        │   Claude + messages.parse() with a Zod schema. No web tools.
        │   Prose → strict typed JSON.
        ▼
   [D] /api/research/manual           ~20–40 s, optional
            PDF → Vercel Blob, then base64 document block → Claude
            → structured paint list → kit_paint_requirement
```

**Why staged rather than one call.** Three reasons, in order of importance: no invocation
gets near 300 s; a failure retries one stage instead of re-paying for the whole job; and the
client gets a genuine four-step progress indicator instead of a three-minute spinner. Stage B
is still the one to watch — if it ever does approach the ceiling, drop `max_uses` to 4 or
split it into "find sources" and "read sources" without disturbing anything else.

**Why two passes for research and extraction.** Structured outputs (`output_config.format`)
are incompatible with citations, and citations are what make the output trustworthy — you
need the source URL next to every "the bonnet doesn't sit flush" claim. Splitting research
(cited, free-form) from extraction (typed, cheap) gets both, and stage C costs a fraction of
stage B.

### 5.2 API shapes to use

Verified against current API documentation, not recalled:

- Model `claude-opus-5`; thinking `{ type: "adaptive" }` — **`budget_tokens` is rejected with
  a 400** on this model
- Effort via `output_config: { effort: "medium" | "high" }`
- Web tools `web_search_20260209` and `web_fetch_20260209` (dynamic-filtering variants). Do
  **not** additionally declare `code_execution` — these run it internally
- Stage B streams; use `.finalMessage()`
- **Handle `stop_reason: "pause_turn"`** — a long server-tool turn can pause, and an
  unhandled pause returns a silently truncated answer with no error raised
- Server-tool errors return HTTP 200 with an error object in the result block, not an
  exception. On web search a success `content` is an array and an error `content` is an
  object — branch on that before indexing
- Stage C: `client.messages.parse()` with `zodOutputFormat(KitResearchSchema)`;
  `parsed_output` is null on failure, so guard it

### 5.3 Cost

Roughly **€0.20–0.45 per newly researched kit** (Opus 5 at $5/$25 per MTok; web search
results dominate input tokens). Cached in `kit_research` with a long expiry — kit facts don't
change — and re-run only on an explicit **Refresh**. Across a 50-kit lifetime stash, under
€25 total. Every call records its own token counts, so the number stops being an estimate
after the first week.

### 5.4 Trust

Research output is synthesised from forum posts by a language model. Treat it accordingly:

- Every fit issue stores `source_url` and `confidence`; the UI renders the source as a link
  next to the claim. No unsourced assertion appears as fact.
- Difficulty shows as "consensus from N sources", never a bare rating.
- A **Verify** action sets `verified_by_me`, and verified rows visually outrank unverified.

You're going to cut plastic based on this. It should always be one tap to see where a claim
came from.

---

## 6. Build phases

### Phase 0 — Foundations
Next.js App Router scaffold, Neon via the Vercel marketplace integration, Drizzle schema and
first migration, cookie auth + middleware, design tokens extracted from the MVP, PWA
manifest, Vercel Blob wired up, CI running `verify-catalogue`.
**Ships:** a deployed empty app you can log into from your phone.

### Phase 1 — Thinner Bench *(feature 1)* ← starting here
The full Tamiya catalogue (§2.2) with its generation and verification scripts. Paint lookup
with type-ahead, family ratio rules from `ratio_rule`, the cup-fill visualiser and drop
calculator, pressure / distance / coats, per-family bench notes, the lacquer-vs-acrylic
thinner warning, and the 74540 dry-tip guidance panel. `ratio_override` editing so your
corrections persist. Phone layout done properly, not as an afterthought.
**Ships:** the MVP, but complete, persistent, and genuinely usable on your phone.

### Phase 2 — Cross-brand equivalence *(part of feature 3)*
The Cybermodeler import, `paint_equivalent`, and a foreign → Tamiya lookup screen. Small,
self-contained, and useful on its own the next time you pick up a non-Tamiya kit.

### Phase 3 — Paint inventory *(feature 4a)*
Import the Google Sheet. CRUD on `inventory_item` with decanted-vs-stock, bottle state and
location. "Do I own this?" surfaced directly on the Thinner Bench result card.
**Ships:** the standing-in-a-shop question answered.

### Phase 4 — Paint shopping *(rest of feature 3)*
Requirements → inventory → buy list, with equivalents from Phase 2 offered as substitutes.
Persisted list with ordered/bought status and a preferred vendor per line.
Input at this stage is manual paste-or-type of a kit's paint list; Phase 5 automates it.
**Ships:** a real buy list you can take to KitMania.

### Phase 5 — Kit research *(feature 2)*
The staged pipeline in §5. Manual PDF discovery and storage, difficulty and fit-issue
synthesis with sources, build video, and paint-list extraction feeding Phase 4 directly.
**Ships:** the thing the MVP couldn't do.

### Phase 6 — Stash & build log *(features 4b + 5)*
Kit CRUD with wishlist / owned / in-progress / built. Per-kit dated journal by stage, photos
to Blob. Research results attach to the kit record. Desktop manual-viewer layout.

### Phase 7 — Airbrush maintenance & the feedback loop *(feature 6)*
`maintenance_log` against the 74540. One-tap `spray_session` logging from the Thinner Bench.
Sessions-since-last-deep-clean as a nudge. "Your last three XF-64 mixes" next to the starting
ratio, promotable into a `ratio_override`.
**Ships:** the app stops being a reference and starts being a record.

---

## 7. Open questions

Not blocking — Phases 0 and 1 can start now.

1. **Does the 74540 stay your only airbrush?** The schema supports more, but the Thinner
   Bench copy is written *to* that rig. If a second is likely, ratio rules need a rig
   dimension — cheap in Phase 1, annoying in Phase 7.
2. **Which brands matter most for equivalence?** Cybermodeler gives nine. Gunze/Mr. Hobby is
   clearly first. Worth ranking the rest so the UI leads with the ones you actually meet?
3. **Vendor pricing.** Should `shopping_list_item` track expected price per vendor, or is the
   vendor field just a note? Price tracking means manual entry or per-shop scraping — its own
   project, and I'd keep it out of scope.
4. **Manual PDFs in Blob — copyright.** Fine for personal use; worth being deliberate that
   this app stays single-user, since redistribution is a different question entirely.

---

## 8. What I am explicitly not proposing

- **No native mobile app.** PWA covers it, per your confirmation.
- **No Supabase**, for the pause behaviour in §1.1 — not because it's a worse product. If
  this ever becomes multi-user, revisit: its auth is the reason to switch.
- **No two-way Google Sheets sync.** One-time import, then the app owns the data.
- **No runtime scraping** of Scalemates, Cybermodeler or the shops. Cybermodeler is imported
  at build time; kit research goes through Claude; vendor links are stored as links.
- **No YouTube Data API** (§5, finding 3).
- **No queue, cron, or background worker.** The staged pipeline (§5.1) removes the need.
- **No multi-user support, roles, or sharing.** One person, one passphrase. Adding it later
  is a schema migration, not an architecture change — the repository layer is what keeps that
  true.
