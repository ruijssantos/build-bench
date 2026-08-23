# Bench & Build — Architecture & Build Plan

A companion app for 1:24 scale model car building, centred on a Tamiya 74540 HG Trigger
airbrush workflow and pre-build kit research.

**Status:** revision 3, awaiting review. No implementation code written yet.
**Planning pass:** Opus. **Implementation:** Sonnet, phase by phase.

> **Changed in r3** — All four open questions answered and closed. Manual PDFs are now
> **uploaded by you and viewed in the app** rather than fetched automatically, which
> decouples paint shopping from kit research and re-orders the phases. Single-rig confirmed.
> Vendor pricing dropped. Brand ordering fixed. New §9 covers exactly what you click in
> Vercel.
>
> **Changed in r2** — Hosting moved to Vercel: Neon Postgres, Vercel Blob, and feature 2's
> pipeline split into stages to fit the function time limit.

---

## 1. Decisions taken

| Question | Decision |
|---|---|
| Hosting | **Vercel**, Hobby plan |
| Framework | **Next.js (App Router) + React** |
| Database | **Neon Postgres**, via Vercel's marketplace integration |
| File storage | **Vercel Blob** — uploaded manuals and build photos |
| Auth | App-level signed cookie, one passphrase |
| Kit research | Claude API with server-side web search, staged to fit the function limit |
| Kit manuals | **You upload the PDF; the app stores and displays it** |
| Paint inventory source of truth | App database, one-time import from the Google Sheet |
| Airbrush | **Single-rig: Tamiya 74540 HG Trigger** |
| Phone | PWA / responsive web. Desktop for manuals, phone for quick lookups |

### 1.1 Making Vercel work

Vercel imposes three constraints. Each has a clean answer.

**Problem 1 — no persistent filesystem, so SQLite is out.** Serverless functions get an
ephemeral disk, wiped between deployments and not shared across invocations. The database has
to be a managed service.

**Neon Postgres, not Supabase.** Supabase looks better on paper — Postgres, auth and storage
in one free tier — and loses on one specific behaviour:

> **Supabase pauses free projects after 7 days of inactivity, and restoring is a manual click
> in their dashboard.** Neon scales to zero after 5 minutes idle and resumes automatically on
> the next query, in roughly 300–800 ms.

Decisive for *this* app. Model building happens in bursts; three weeks between kits is
normal. With Supabase, the trip where you most need the app — in a shop, phone out, "do I own
XF-64?" — is exactly the trip where you'd find a paused project and a dashboard login. The
usual workaround is a scheduled job pinging the database twice a week, which is precisely the
new system to maintain you didn't want.

Neon also installs from the Vercel marketplace in a few clicks, injects `DATABASE_URL`
automatically, and bills through Vercel. Free tier is 0.5 GB storage and 100 compute-hours a
month; this app will use a rounding error of both.

**Problem 2 — files.** **Vercel Blob**: 1 GB storage, 10 GB transfer/month on Hobby, same
vendor as the host. Holds uploaded manual PDFs and build photos (resized on upload, long edge
~2000 px).

**Problem 3 — auth.** Vercel's own Password Protection is Pro/Enterprise only. Vercel
Authentication (on Hobby) protects preview deployments but leaves production public — the
wrong way round.

So: **app-level auth, one passphrase, a signed HTTP-only cookie**, checked in middleware.
~30 lines with `jose`, no accounts table, no OAuth. Long cookie lifetime so the phone never
logs you out at the bench with wet hands. Threat model is "a crawler finds the URL".

### 1.2 The 300-second ceiling

Vercel Hobby caps function execution at **300 seconds**, Fluid compute on by default.
Streaming doesn't buy extra time — the clock covers the whole invocation.

A kit-research call running six to eight web searches can plausibly take several minutes.
Assuming it fits and finding out otherwise in a hobby shop is how a feature stops being
trusted. **So the pipeline is staged** (§5.1): four separate requests, each with its own
budget. No queue, no cron, no worker.

Happy accident: Fluid compute bills *active CPU*, not wall-clock, and a research call is
almost entirely idle waiting on the API. Long calls are cheap here.

---

## 2. What the MVP proved, and what it hid

`tamiyathinnerbench.html` is a good reference and its visual language carries over wholesale.
Three things worth keeping:

1. **The ratio model is right.** Family-based rules, with a starting ratio *plus a workable
   window*, not a single number.
2. **The rig is a first-class input.** Every number is stated for a 0.3 mm needle, a 7 cc
   fixed cup, retarder thinner. That framing is the whole value.
3. **The cup-fill maths matters.** Drops → millilitres → percentage of a 7 cc cup, with an
   over-capacity warning, is what actually prevents a mistake at the bench.

Two things it hides:

- **The paint library is incomplete and fails silently.** Your inventory contains **XF-83
  Medium Sea Gray** and **XF-84 Dark Iron**; neither is in the MVP's `LIB`.
  `familyFromPrefix()` infers "XF → flat" and renders a grey swatch with a quiet note.
  Correct fallback, wrong catalogue. §2.2 fixes it.
- **Everything is per-session.** Nothing survives a refresh.

### 2.1 Your inventory as imported

From the Google Sheet — 33 paints. This is the Phase 3 seed.

- **Gloss (18):** X-2, X-3, X-6, X-7, X-8, X-9, X-10, X-11, X-12, X-13, X-14, X-18, X-19,
  X-21, X-22, X-24, X-26, X-27
  *The sheet files X-21 Flat Base under Gloss, and X-19/X-22/X-24/X-26/X-27 are smoke and
  clears. The importer classifies by catalogue family, not sheet column, so these land as
  `additive` and `clear` — which is what the ratio rules need.*
- **Flat (11):** XF-1, XF-2, XF-7, XF-16, XF-24, XF-53, XF-56, XF-60, XF-64, XF-83, XF-84
- **Sprays (2):** TS-7 Racing White, TS-8 Italian Red
- **Primers (2):** Liquid Surface Primer Grey, Liquid Surface Primer White

### 2.2 The full Tamiya catalogue, and cross-brand matching

**Scope: every current Tamiya paint code.** Approximate ranges, *to be verified by the seed
script rather than trusted from this document*:

| Line | Range (approx.) | What it is |
|---|---|---|
| `X-` | 1–34 | Acrylic gloss & metallic, 10/23 ml |
| `XF-` | 1–93+ | Acrylic flat, 10/23 ml — **has gaps in the numbering** |
| `LP-` | 1–90+ | Lacquer, 10 ml |
| `TS-` | 1–102+ | Lacquer spray can, 100 ml |
| `AS-` | 1–33 | Aircraft lacquer spray |
| `PS-` | 1–58 | Polycarbonate spray (RC bodies — wrong for styrene, and the app says so) |
| Primers | — | Fine Surface Primer L/M/S, Liquid Surface Primer |

Two scripts own this, both part of Phase 1:

- `scripts/build-catalogue.ts` — generates `seed/paints.tamiya.json`: code, name, hex, line,
  family, finish for every code.
- `scripts/verify-catalogue.ts` — runs in CI. Fails the build if any code referenced by
  inventory, kit requirements or ratio rules is missing from the catalogue, and reports
  numbering gaps for review. **This is the check that would have caught XF-83/XF-84.**

**Cross-brand equivalence — Cybermodeler.** The
[Tamiya Color Cross-Reference](https://www.cybermodeler.com/color/tamiya_map.shtml) covers
Gunze Sangyo (GSI — i.e. Mr. Hobby), Vallejo, Revell, Testors, XtraColour, AMMO by Mig,
Hataka, Lifecolor and Mission Models.

- **Direction.** The chart maps Tamiya → other brands. Your real question is the reverse: a
  non-Tamiya kit calls for H12, what Tamiya do you reach for? `paint_equivalent` is indexed
  both ways and the UI leads with foreign → Tamiya.
- **UI ordering** (my call, revisit whenever): **Gunze/Mr. Hobby, Revell, Vallejo, AMMO,
  Testors, LifeColor, XtraColour, Hataka, Mission Models.** Gunze first because Japanese car
  kits — Fujimi, Aoshima, Hasegawa — call Mr. Color throughout. Revell second because Revell
  car kits are common in European shops. All nine import regardless; this is display order
  only, stored as `vendor`-style `sort` on a small `brand` lookup so it's a data change.
- **Import once, at build time.** `scripts/import-cybermodeler.ts` parses the page into
  `seed/equivalents.json`, committed to the repo. **Nothing scrapes it at runtime.**

  *Caveat: cybermodeler.com is blocked by this planning sandbox's egress policy, so I could
  not confirm the page's table markup. The column list is from secondary sources. Expect one
  adjustment pass against the real HTML — run the script on your machine.*

Where the chart has no row, feature 3 falls back to a Claude lookup, written to
`paint_equivalent` with `source = 'claude-research'` and a lower `match_quality` so it stays
visibly distinct from chart-sourced data.

### 2.3 Single-rig, and the cheap hedge

The app is built for the **Tamiya 74540 HG Trigger** alone. Every ratio, pressure and distance
is stated for a 0.3 mm needle, a 7 cc fixed cup and retarder thinner, and `ratio_rule` gets
no rig dimension.

Noted for the record: you also own a **Harder & Steenbeck Ultra (2024)**, currently set aside
while you work with the trigger. That costs nothing today, but it does justify one small
discipline: **rig facts are read from the `airbrush` row, never hard-coded into copy.** The
header, the cup-capacity maths and the maintenance panel all read from data. If the H&S ever
joins, that's a new row plus a review of the ratio windows — not a hunt through JSX for the
string "74540".

---

## 3. Data model

**Postgres via Drizzle ORM** — TypeScript-native schema, real migrations, types flowing into
the app with no hand-written duplicates.

### 3.1 Reference data — seeded, read-mostly

```
paint
  code            text PK          -- "XF-64", canonical, normalised
  line            text             -- X | XF | LP | TS | AS | PS | PRIMER
  name            text
  hex             text
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

ratio_override                     -- your corrections
  id              serial PK
  paint_code      text NULL FK     -- override one paint...
  family          text NULL        -- ...or a whole family
  paint_parts     real
  thinner_parts   real
  psi_text        text
  reason          text
  created_at      timestamptz

paint_brand                        -- display ordering, §2.2
  key             text PK          -- gunze_mr_hobby | revell | vallejo | ammo | ...
  label           text
  sort            integer

paint_equivalent                   -- cross-brand, both directions
  id              serial PK
  brand           text FK paint_brand
  foreign_code    text             -- "H12"
  foreign_name    text
  tamiya_code     text FK paint
  match_quality   text             -- exact | close | approximate
  source          text             -- cybermodeler | manufacturer | claude-research
  notes           text
  INDEX (brand, foreign_code)      -- foreign → Tamiya, the lookup you actually make
  INDEX (tamiya_code)              -- Tamiya → foreign

vendor
  id, name, country, url, notes, sort
```

`vendor` seeds with Scalemates (research), Spot Model, KitMania (PT), Hobby Sector (PT),
Super Hobby (PT), El Taller del Modelista (ES). It carries no pricing — see §8.

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

kit_manual                         -- YOU upload these (§4.3)
  id              serial PK
  kit_id          integer FK
  blob_url        text             -- Vercel Blob
  filename        text
  size_bytes      integer
  page_count      integer NULL
  paints_extracted_at timestamptz NULL
  uploaded_at     timestamptz

research_job                       -- drives the staged pipeline (§5.1)
  id              uuid PK
  kit_id          integer NULL FK
  query           text
  stage           text             -- resolve | investigate | extract | done | failed
  stage_status    jsonb            -- per-stage: ok / error / duration_ms / tokens
  partial         jsonb            -- accumulated result between stages
  error           text
  started_at, updated_at timestamptz

kit_research                       -- the finished, cached result
  id              serial PK
  kit_id          integer NULL FK
  job_id          uuid FK research_job
  resolved_brand, resolved_number, resolved_name text
  manual_url      text             -- a LINK it found; the app does not download it
  difficulty      text             -- beginner | intermediate | advanced
  difficulty_note text
  fit_issues      jsonb            -- [{issue, severity, source_url, confidence}]
  build_video_url text
  sources         jsonb
  model_used      text
  input_tokens, output_tokens integer
  verified_by_me  boolean          -- §5.4
  researched_at, expires_at timestamptz

kit_paint_requirement              -- the manual's paint callouts
  id              serial PK
  kit_id          integer FK
  manual_id       integer NULL FK kit_manual
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
  vendor_id       integer NULL FK  -- a note, not a price
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
  blob_url        text
  caption         text
  sort            integer

airbrush                           -- one row: the 74540. §2.3
  id              serial PK
  model           text             -- "Tamiya 74540 HG Trigger"
  nozzle_mm       real             -- 0.3
  cup_cc          real             -- 7
  is_active       boolean
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

Deliberately last in the build order — but modelling it now means nothing needs reshaping.

---

## 4. Application structure

```
scale-model-bench/
├── docs/PLAN.md                    ← this file
├── docs/decisions/                 ← short ADRs as things change
├── drizzle/                        ← generated migrations
├── seed/
│   ├── paints.tamiya.json          ← full catalogue (generated, committed)
│   ├── ratio-rules.json            ← ported from the MVP's R{}
│   ├── equivalents.json            ← Cybermodeler import (generated, committed)
│   ├── brands.json, vendors.json
│   └── inventory.initial.json      ← the Google Sheet, imported once
├── scripts/
│   ├── build-catalogue.ts          ← §2.2
│   ├── verify-catalogue.ts         ← §2.2, runs in CI
│   ├── import-cybermodeler.ts      ← §2.2, run locally
│   └── import-sheet.ts
├── src/
│   ├── app/
│   │   ├── (bench)/
│   │   │   ├── thinner/            ← feature 1
│   │   │   ├── inventory/          ← feature 4a
│   │   │   ├── shopping/           ← feature 3
│   │   │   ├── kits/[id]/
│   │   │   │   ├── manual/         ← upload + viewer (§4.3)
│   │   │   │   ├── research/       ← feature 2
│   │   │   │   └── log/            ← feature 5
│   │   │   └── airbrush/           ← feature 6
│   │   ├── api/
│   │   │   ├── manual/upload/route.ts
│   │   │   ├── manual/extract-paints/route.ts
│   │   │   └── research/{resolve,investigate,extract}/route.ts
│   │   ├── login/  ·  middleware.ts  ·  layout.tsx
│   ├── db/
│   │   ├── schema.ts  ·  client.ts  ← Neon serverless driver
│   │   └── repositories/           ← all queries live here
│   ├── domain/
│   │   ├── ratio.ts                ← pure: family + overrides → ratio, window, cup fill
│   │   ├── paint-code.ts           ← normalise "xf64" / "XF 64" → "XF-64"
│   │   ├── equivalence.ts          ← foreign → Tamiya
│   │   └── shopping.ts             ← requirements − inventory → buy list
│   ├── research/                   ← feature 2, isolated (§5)
│   ├── components/
│   └── styles/tokens.css           ← the MVP's palette and type, lifted verbatim
└── tests/
```

**Connection handling.** Neon's serverless HTTP driver (`@neondatabase/serverless`), not
node-postgres. It speaks HTTP rather than TCP, so there's no connection pool to exhaust
across serverless invocations — the most common way a Postgres-on-Vercel app falls over.
Drizzle supports it directly.

**Data access rule.** Every query goes through `src/db/repositories/*`. Route handlers and
components never import the Drizzle client directly.

### 4.1 Design system

- **Palette:** `--ink #14161a`, `--panel #1c1f24`, `--line #2e333a`, `--paper #e8e4da`,
  `--dim #8d8a82`, `--red #c8202a`, `--thin #5d9dc4`, `--amber #d9a441`
- **Type:** Archivo Narrow 700 for display, IBM Plex Mono for everything else
- **Idioms to keep:** hairline-bordered panel grid, uppercase letterspaced eyebrow labels,
  the red em-dash bullet list, the amber/red flag callout, the segmented cup bar

Dark, high-contrast, workshop-instrument. Right for a phone under a bench lamp. Keep it;
don't introduce a second visual idea.

### 4.2 Desktop and phone are different jobs

- **Desktop — reading.** Manual PDF viewer beside the kit's research notes and paint list.
  Build log writing. Inventory bulk editing. Wide, two-column, dense.
- **Phone — one-handed, at the bench or in a shop.** Thinner Bench readout, "do I own this?",
  the shopping list. Large touch targets, ratio and cup-fill legible at arm's length, minimal
  typing. The drops slider must work with a knuckle.

### 4.3 Manuals: upload and view

You upload the PDF; the app stores and displays it. This is both what you asked for and the
better design:

- **It removes the fragile part.** Auto-discovering and downloading a manual means guessing
  at third-party hosting that may block, move or rate-limit. You already know where your
  manuals come from.
- **It removes the copyright ambiguity.** You supply the file for your own use.
- **It decouples shopping from research.** This is the big one — see §6.

Mechanically: drag-drop or file-pick → `PUT` to Vercel Blob → `kit_manual` row. Viewed inline
on desktop (the two-column layout in §4.2), downloadable on phone. An **Extract paint list**
action sends the stored PDF to Claude as a base64 document block and writes
`kit_paint_requirement` rows, which is what feeds the shopping list.

Kit research still *reports* a manual URL when it finds one — as a link for you to follow and
download. It never fetches it.

---

## 5. Feature 2: how kit research actually works

Three findings from checking the ground first:

1. **Scalemates is bot-hostile.** Best kit database on the web, doesn't want scrapers.
2. **"Difficulty and fit-issue notes from reviews and forums" is a synthesis job.** No API
   returns it; it's prose scattered across build threads and review blogs. Exactly what an
   LLM with web search is for.
3. **You don't need the YouTube Data API.** ~100 searches/day free, plus a key and a quota to
   manage. Claude's web search finds the build video in the same call.

With manuals now uploaded by you (§4.3), this feature's job narrows usefully: **difficulty,
fit issues, and a build video.** It is no longer the pipe that paint lists arrive through.

### 5.1 The staged pipeline

Three stages, each **its own HTTP request with its own 300 s budget**, driven from the client,
state accumulating in `research_job`.

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
        │   Free-form, WITH citations. Finds: difficulty consensus,
        │   specific fit issues, a manual URL to link, a build video.
        ▼
   [C] /api/research/extract          ~10–20 s
            Claude + messages.parse() with a Zod schema. No web tools.
            Prose → strict typed JSON.
```

**Why staged.** No invocation nears 300 s; a failure retries one stage instead of re-paying
for the whole job; and the UI gets a real three-step progress indicator instead of a
three-minute spinner. Stage B is the one to watch — if it ever approaches the ceiling, drop
`max_uses` to 4 or split it into "find sources" and "read sources" without disturbing
anything else.

**Why two passes for research and extraction.** Structured outputs (`output_config.format`)
are incompatible with citations, and citations are what make the output trustworthy — you
need the source URL next to every "the bonnet doesn't sit flush" claim. Splitting research
(cited, free-form) from extraction (typed, cheap) gets both.

### 5.2 API shapes to use

Verified against current API documentation, not recalled:

- Model `claude-opus-5`; thinking `{ type: "adaptive" }` — **`budget_tokens` is rejected with
  a 400** on this model
- Effort via `output_config: { effort: "medium" | "high" }`
- Web tools `web_search_20260209` / `web_fetch_20260209` (dynamic-filtering variants). Do
  **not** additionally declare `code_execution` — these run it internally
- Stage B streams; use `.finalMessage()`
- **Handle `stop_reason: "pause_turn"`** — a long server-tool turn can pause, and an
  unhandled pause returns a silently truncated answer with no error raised
- Server-tool errors return HTTP 200 with an error object in the result block, not an
  exception. On web search a success `content` is an array and an error `content` is an
  object — branch before indexing
- Stage C: `client.messages.parse()` with `zodOutputFormat(KitResearchSchema)`;
  `parsed_output` is null on failure, so guard it
- Manual paint extraction (§4.3) uses a base64 `document` block — no beta header needed

### 5.3 Cost

Roughly **€0.20–0.45 per newly researched kit** (Opus 5 at $5/$25 per MTok; search results
dominate input tokens). Cached in `kit_research`, re-run only on an explicit **Refresh**.
Across a 50-kit lifetime stash, under €25 total. Every call records its own token counts, so
the estimate becomes a measurement after the first week.

### 5.4 Trust

Research output is synthesised from forum posts by a language model:

- Every fit issue stores `source_url` and `confidence`; the UI renders the source as a link
  next to the claim. No unsourced assertion appears as fact.
- Difficulty shows as "consensus from N sources", never a bare rating.
- A **Verify** action sets `verified_by_me`; verified rows visually outrank unverified.

You're going to cut plastic based on this. It should always be one tap to see where a claim
came from.

---

## 6. Build phases

Uploading manuals (§4.3) changed this order for the better. Previously the shopping list
needed either hand-typed paint lists or the whole research pipeline to exist first. Now an
uploaded PDF feeds it directly — so **shopping ships before research**, and research becomes
a genuinely optional enhancement rather than a blocking dependency.

### Phase 0 — Foundations
Next.js scaffold, Neon via the Vercel integration, Drizzle schema and first migration, cookie
auth + middleware, design tokens extracted from the MVP, PWA manifest, CI running
`verify-catalogue`.
**Ships:** a deployed empty app you can log into from your phone.

### Phase 1 — Thinner Bench *(feature 1)*
The full Tamiya catalogue (§2.2) with its generation and verification scripts. Paint lookup
with type-ahead, family ratio rules from `ratio_rule`, cup-fill visualiser and drop
calculator, pressure / distance / coats, per-family bench notes, the lacquer-vs-acrylic
warning, the 74540 dry-tip panel — all reading rig facts from the `airbrush` row (§2.3).
`ratio_override` editing. Phone layout done properly.
**Ships:** the MVP, complete, persistent, and genuinely usable on your phone.

### Phase 2 — Cross-brand equivalence
Cybermodeler import, `paint_equivalent`, foreign → Tamiya lookup. Self-contained and useful
on its own the next time you pick up a non-Tamiya kit.

### Phase 3 — Paint inventory *(feature 4a)*
Import the Google Sheet. CRUD with decanted-vs-stock, bottle state, location. "Do I own
this?" on the Thinner Bench result card.
**Ships:** the standing-in-a-shop question answered.

### Phase 4 — Kit stash + manual upload & viewer *(feature 4b + §4.3)*
Kit CRUD with wishlist / owned / in-progress / built. PDF upload to Blob, desktop viewer,
**Extract paint list** → `kit_paint_requirement`.
**Ships:** your manuals, in the app, on the desktop where you build.

### Phase 5 — Paint shopping *(feature 3)*
Requirements → inventory → buy list, with Phase 2's equivalents offered as substitutes.
Persisted list with ordered/bought status. Input comes from Phase 4's extraction, with
hand-entry as fallback.
**Ships:** a real buy list you can take to KitMania.

### Phase 6 — Kit research *(feature 2)*
The staged pipeline in §5: difficulty, fit issues with sources, build video, manual link.

### Phase 7 — Build log *(feature 5)*
Per-kit dated journal by stage, photos to Blob, research and manual attached to the kit.

### Phase 8 — Airbrush maintenance & the feedback loop *(feature 6)*
`maintenance_log` against the 74540. One-tap `spray_session` logging from the Thinner Bench.
Sessions-since-last-deep-clean as a nudge. "Your last three XF-64 mixes" next to the starting
ratio, promotable into a `ratio_override`.
**Ships:** the app stops being a reference and starts being a record.

---

## 7. Open questions

**None outstanding.** All four from r2 are answered and folded in: single-rig (§2.3), brand
ordering (§2.2), no vendor pricing (§8), manuals uploaded rather than fetched (§4.3).

---

## 8. What I am explicitly not proposing

- **No native mobile app.** PWA covers it.
- **No Supabase**, for the pause behaviour in §1.1 — not because it's a worse product. If this
  ever goes multi-user, revisit: its auth is the reason to switch.
- **No vendor price tracking.** Confirmed out of scope. It would mean hand-entering prices or
  scraping five shops that don't want it, and it would bloat the one screen that has to be
  fast in a shop. `vendor_id` on a shopping line stays a note.
- **No automatic manual downloading.** You upload; research links (§4.3).
- **No two-way Google Sheets sync.** One-time import, then the app owns the data.
- **No runtime scraping** of Scalemates, Cybermodeler or the shops.
- **No YouTube Data API.**
- **No queue, cron, or background worker.** The staged pipeline removes the need.
- **No multi-user support, roles, or sharing.** One person, one passphrase.

---

## 9. Setup — what you do, what I do

### 9.1 What "the database" actually is here

It is not a file, and it is not something you install or run. Neon runs a Postgres server in
the cloud. Vercel provisions one for your project and injects its connection string into the
app's environment automatically. **You will never type or copy that string**, and the app is
the only thing that reads it. It sleeps when unused and wakes on the next query in well under
a second.

Concretely: today your paint list lives in a Google Sheet. After Phase 3 the same data lives
in a table in that Postgres, and the app reads and writes it. That's the whole change.

### 9.2 Your steps — about ten minutes, once

1. **Import the repo.** Vercel dashboard → **Add New → Project** → import
   `ruijssantos/scale-model-bench`. Accept the Next.js defaults. The first deploy will fail
   or render nothing until Phase 0 lands — that's expected.
2. **Add the database.** In the project → **Storage** tab → **Create Database** → choose
   **Neon** from the Marketplace → **Free** plan → pick an **EU region** (Frankfurt is
   normally the closest to Portugal) → name it `bench-build`.
3. **Connect it.** Still in Storage → the new database → **Connect Project** → select
   `scale-model-bench` → tick **Development, Preview and Production**.
   `DATABASE_URL` now exists in all three environments. Nothing else to do.
4. **Add the Blob store** (needed from Phase 4, fine to do now). Storage → **Create** →
   **Blob** → connect to the same project. That sets `BLOB_READ_WRITE_TOKEN`.
5. **Add two secrets by hand.** Project → **Settings → Environment Variables**:
   - `AUTH_SECRET` — 32 random bytes. `openssl rand -base64 32` produces one.
   - `APP_PASSPHRASE` — whatever you want to type to log in.
6. **Later, for Phase 6 only:** `ANTHROPIC_API_KEY` from console.anthropic.com. Not needed
   before then.

### 9.3 What I do

- Write `src/db/schema.ts` and generate migrations into `drizzle/`.
- Wire the Neon serverless driver to read `DATABASE_URL` from the environment.
- Provide `npm run db:migrate` (applies migrations) and `npm run db:seed` (loads the
  catalogue, ratio rules, brands, vendors, and your inventory).
- Add `vercel env pull .env.local` to the local-dev instructions so the same variables work
  on your machine.

### 9.4 What I never need from you

Your connection string, your Vercel password, or your API key. Every secret lives in Vercel's
environment variables and is injected at build and run time. **Don't paste any of them into
chat** — if one ever appears in a transcript, rotate it.
