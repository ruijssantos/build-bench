# The Build Bench — Architecture & Build Plan

A companion app for 1:24 scale model car building, centred on a Tamiya 74540 HG Trigger
airbrush workflow and pre-build kit research.

**Status:** revision 8 — **locked, ready to build**. Phase 0, Phase 1 and Phase 2 are shipped.
**Planning pass:** Opus. **Implementation:** Sonnet, phase by phase.

> **Changed in r8** — §3.2's `inventory_item` and §6's Phase 2 entry updated to match what
> actually shipped (PR #19 plus review follow-ups), rather than the pre-build guess. Three
> real deviations, all made during review rather than re-litigated here:
>
> - **`location` dropped**, column and all — a real migration
>   (`drizzle/0001_drop_inventory_location.sql`), not just a UI change. The owner doesn't
>   track shelf position; the field was cut rather than left to sit unused.
> - **`state` trimmed from four values to two** — `open` and `low`, plus the unset default,
>   which reads as "In Stock". `sealed` added nothing over the default; `empty` added
>   nothing over removing the row.
> - **"Recently sprayed" is cut from the Paints screen entirely** — not deferred, not
>   waiting on Phase 8, gone. `spray_session` (§3.3) stays in the schema for Phase 8's own
>   feature, but nothing on this screen reads it. "Running low" is a filter pill on the same
>   table rather than a separate always-visible module, styled with the alert colour instead
>   of accent so it still reads as "act on this" rather than just another slice.
>
> Two additions past the original one-sentence scope, both small enough not to need their
> own review: sortable columns (paint / family / state, three-state cycle via the URL) and a
> one-click remove icon in the row, alongside the existing two-tap confirm inside Edit. The
> screen is single-column, full width, at every size now too — the two-column desktop split
> was carried over from the Thinner Bench as a first guess and didn't hold up once the
> modules it was built around (Running low, Recently sprayed) were gone.
>
> **Changed in r7** — §6 reordered: **Paint inventory is now Phase 2** and **Cross-brand
> equivalence is now Phase 3** (swapped from the original order). Inventory has no
> dependency on equivalence or vice versa, so nothing else in the plan needed to change
> beyond the cross-references that named them by number. §7 and §9.1's illustrations
> updated to match, and the status block now reflects that Phase 0 and Phase 1 actually
> shipped (PRs #6 and #9, plus three Phase 1 follow-ups) rather than still describing a
> plan nothing had been built against yet.
>
> **Changed in r7** — §4.1 type ramp collapsed after building Phase 1: the separate
> "section label" / "tile label" roles became one **Module title**, and the "tile value" /
> "body / value" range became one **Body copy** size. Added the rule that labels are never
> coloured decoratively, and a desktop content width floor and ceiling under *Geometry*.
> These are rules for every module built from here, not just the Thinner Bench.
>
> **Changed in r6** — Product name is now **The Build Bench** (was "Bench & Build"),
> updated in the README, this file, and everywhere the app names itself — page titles, the
> PWA manifest, the sign-in screen. The repo and package stay `build-bench`; only the
> product's own display name changed.
>
> **Changed in r5** — Repository renamed to `build-bench`; `main` is the default branch.
> Paths and setup steps updated to match.
>
> **Changed in r4** — Visual design settled and folded in: §4.1 is now the complete token
> spec (palette, type ramp, geometry, livery) replacing the prototype's dark palette. Dark
> theme dropped from scope. Everything needed for Phase 0 and Phase 1 is now decided.
>
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
| Visual design | Warm cream, one accent, tonal livery, Barlow Condensed display — locked, §4.1 |
| Theme | **Light only.** No dark theme for now |

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

[`docs/reference/tamiya-thinner-bench-prototype.html`](reference/tamiya-thinner-bench-prototype.html)
is the original single-file MVP — the source for the ratio rules (§3.1's `ratio_rule`
table) and the paint codes it already knows about. Its visual language does **not** carry
over; that was superseded in §4.1. Three things worth keeping from its logic:

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

From the Google Sheet — 33 paints. This is the Phase 2 seed.

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
  state           text             -- open | low (unset reads as "In Stock") — r8
  quantity        integer
  purchased_from  integer NULL FK vendor
  purchased_at    date
  notes           text
  updated_at      timestamptz
                                    -- `location` dropped in r8 — see the changelog

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
build-bench/
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
│   └── styles/tokens.css           ← the locked tokens in §4.1, verbatim
└── tests/
```

**Connection handling.** Neon's serverless HTTP driver (`@neondatabase/serverless`), not
node-postgres. It speaks HTTP rather than TCP, so there's no connection pool to exhaust
across serverless invocations — the most common way a Postgres-on-Vercel app falls over.
Drizzle supports it directly.

**Data access rule.** Every query goes through `src/db/repositories/*`. Route handlers and
components never import the Drizzle client directly.

**Reference data rule.** Reference data that is seeded from a committed, CI-verified file
and only changes on deploy is *read* from that file, not queried — `src/catalogue/*`
imports `seed/*.json` at module scope. The tables stay: they are the seed target and the
foreign key user-owned rows hang off. This is what lets the Thinner Bench prerender, keeps
type-ahead search off the network entirely, and keeps `next build` from needing a database.
The reasoning, and the rules the rest of the app follows, are in
[`docs/PERFORMANCE.md`](PERFORMANCE.md).

### 4.1 Design system — locked

Settled across four rounds of mockups. Reference canvas (Thinner Bench, Paints, desktop
rail, and the rejected directions):
<https://claude.ai/code/artifact/9081aef8-94df-49d5-9ec9-d72df184865e>

The prototype's dark workshop palette is **superseded** — it was period pastiche, and the
brief moved to clean product UI (Apple / Airbnb / Revolut as reference points) carrying a
classic-car palette rather than imitating a dashboard.

#### Colour

```css
/* surfaces */
--bg:            #f6f2e9;   /* page */
--card:          #fffdf8;
--card-sunken:   #f2ece0;   /* inset tracks, card strip ground */
--line:          #ece5d7;   /* hairline border */
--line-strong:   #e8e1d3;   /* input borders */

/* livery — a neutral, never a colour */
--livery:        #e3dbc8;   /* tonal stripe on --bg */
--livery-card:   #efe8d8;   /* tonal stripe on --card */

/* ink */
--ink:           #1b1a17;
--ink-soft:      #4a4437;   /* body inside tinted panels */
--muted:         #7c766a;   /* secondary text */
--muted-2:       #9c9483;   /* labels, captions */
--faint:         #c3bba8;   /* separators inside text, disabled glyphs */
--icon-idle:     #a89f8c;

/* accent — selection and primary values ONLY */
--accent:        #1b3a6b;
--accent-tint:   #edf1f7;

/* semantic — in range / owned */
--ok:            #4a6f52;
--ok-tint:       #e9eee9;
--ok-track:      #d3ded4;   /* the workable-window band */

/* semantic — act on this */
--alert:         #8c1c24;
--alert-tint:    #f7ecea;
```

**The rule that keeps this coherent:** three colours, all of them earning their place.
Accent marks selection and the primary value. The two semantics carry meaning and nothing
else — `--ok` means *in range / owned*, `--alert` means *act on this* (warnings, running
low). Nothing is coloured for decoration; the livery is a tonal neutral.

That leaves **paint swatches as the only saturated colour on screen**, and those come from
`paint.hex` — they are content, not chrome. The shelf does the colouring, the interface
stays quiet. Adding a fourth chrome colour breaks this; don't.

#### Type

Three faces, one job each. All from Google Fonts, each with a fallback stack.

| Token | Face | Used for |
|---|---|---|
| `--font-display` | Barlow Condensed | Screen titles (uppercase), hero numerals, small-caps labels |
| `--font-ui` | Plus Jakarta Sans | Everything that is read: values, body, rows, buttons |
| `--font-mono` | DM Mono | Paint codes only — `TS-8`, `XF-64` |

| Role | Spec |
|---|---|
| Screen title | Display 700 · 40px phone / 38px desktop · uppercase · ls .005em · lh .98 |
| Hero numeral | Display 700 · 66px phone / 86px desktop · ls −.01em |
| Module title | Display 600 · 13px phone / 15px desktop · uppercase · ls .14em · `--muted` |
| Body copy | UI · 13.5px · lh 1.5 · `--ink-soft` |
| Row title | UI 700 · 14.5px · ls −.01em |
| Field label | Display 600 · 12.5px · uppercase · ls .12em · `--muted-2` |
| Caption | UI 500 · 11.5px · `--muted-2` |
| Paint code | Mono 500 · 12px · ls .02em · `--muted-2` |

**One module title, one body size.** These two rows replaced a per-module sprawl (a
separate smaller "tile label", a bold 24px "tile value", a 12.5–16px body range) that made
sibling modules on the same screen read as unrelated systems.

- **Module title** is the same treatment whatever the module's physical size. A four-across
  spec tile gets the identical title style as a full-width notes card — a module title is a
  module title. Do not shrink it to "fit" a small tile; if a title truncates, the layout is
  too narrow (see the width floor in *Geometry*), not the type.
- **Body copy** is one size for everything read as secondary or reference text: tile values,
  notes lists, modal paragraphs. Do not introduce a second body size for a new module
  without a reason that survives being asked out loud.
- **Labels are never coloured decoratively.** A label takes `--muted` (module title) or
  `--muted-2` (caption). Reach for `--ok` / `--alert` / `--accent` only when the colour
  carries the meaning defined in *Colour* above — a label that merely sits near a status bar
  is not itself a status.
- **Field label** is the one label role that is deliberately *not* a module title: it names a
  form input, so it stays smaller and quieter than the title of the module containing it.
- Emphasis inside these roles is **weight, not size or colour** (e.g. a bold `--muted-2`
  caption to mark the mid-point of a range).

Barlow Condensed is what gives the app its automotive voice. It does that through type, not
through ornament — which is why it survives on screens (Paints, Shopping) that have nothing
to do with instruments.

#### Geometry

- **Spacing:** 4px scale. Screen gutter 20px phone / 40px desktop.
- **Desktop content width:** bounded at both ends — `max-width: 1600px` (centred) so an
  ultra-wide window does not strand the content in empty page, and `min-width: 1100px` so a
  narrow desktop window never squeezes modules to the point of truncating their titles. Below
  the floor the content area scrolls horizontally (`overflow-x: auto` on the scroll parent, so
  the scrollbar is real rather than clipped by the global `overflow-x: hidden`). Both bounds
  apply above the 900px breakpoint only; phone is fluid.
- **Radii:** card 20 (22 desktop) · tile, input 14 · chip 6–12 · pill 999.
- **Borders:** 1px `--line`. Hairlines do the separating.
- **Elevation:** exactly one shadow in the whole app, on the hero card —
  `0 1px 2px rgba(28,26,23,.04), 0 10px 28px rgba(28,26,23,.045)`. Everything else is a
  hairline. Do not add a second elevation level.
- **Touch targets:** ≥44px everywhere; tab-bar items 52px.
- **Tab bar:** 84px tall, hairline top, 5 items, active in `--accent`.
- **Left rail:** 260px, items 44px, active state is an `--accent-tint` pill at radius 12.
- **Status bar:** leave the top 44px of a phone layout empty. Never draw fake chrome.

#### Livery

The one decorative element, and it costs no colour:

- **Header sweep** — `rotate(-21deg)`, two bars 26px and 10px with a 6px gap, filled
  `--livery`, bleeding off the top-right of the header (which is `overflow: hidden`).
- **Card echo** — a 4px strip on the hero card's top edge: 44px bar, 9px gap, 17px bar,
  filled `--livery` on a `--card-sunken` ground. This is what makes it read as a system
  rather than a header flourish.
- On `--card` surfaces (the desktop rail) use `--livery-card` instead, one step lighter.
- The livery never uses `--accent`.

#### Icons

Inline SVG on a 24px grid, `fill="none"`, stroke 2 (1.9–2.6 where emphasis is wanted),
round caps and joins. One consistent set. **No emoji anywhere in the UI.**

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
auth + middleware, `tokens.css` written from §4.1, PWA manifest, CI running
`verify-catalogue`.
**Ships:** a deployed empty app you can log into from your phone.

### Phase 1 — Thinner Bench *(feature 1)*
The full Tamiya catalogue (§2.2) with its generation and verification scripts. Paint lookup
with type-ahead, family ratio rules from `ratio_rule`, cup-fill visualiser and drop
calculator, pressure / distance / coats, per-family bench notes, the lacquer-vs-acrylic
warning, the 74540 dry-tip panel — all reading rig facts from the `airbrush` row (§2.3).
`ratio_override` editing. Phone layout done properly.
**Ships:** the MVP, complete, persistent, and genuinely usable on your phone.

### Phase 2 — Paint inventory *(feature 4a)*
Import the Google Sheet. CRUD with decanted-vs-stock and bottle state (`open` / `low`,
`location` dropped — r8). Sortable, single-column shelf table with a one-click remove
alongside Edit's own confirm step, and "Running low" as a filter pill rather than a
standing module. "Do I own this?" on the Thinner Bench result card.
**Ships:** the standing-in-a-shop question answered.

### Phase 3 — Cross-brand equivalence
Cybermodeler import, `paint_equivalent`, foreign → Tamiya lookup. Self-contained and useful
on its own the next time you pick up a non-Tamiya kit.

### Phase 4 — Kit stash + manual upload & viewer *(feature 4b + §4.3)*
Kit CRUD with wishlist / owned / in-progress / built. PDF upload to Blob, desktop viewer,
**Extract paint list** → `kit_paint_requirement`.
**Ships:** your manuals, in the app, on the desktop where you build.

### Phase 5 — Paint shopping *(feature 3)*
Requirements → inventory → buy list, with Phase 3's equivalents offered as substitutes.
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

## 7. Locked

Nothing outstanding. Everything needed to start building is decided.

| Area | Decision | Where |
|---|---|---|
| Hosting | Vercel Hobby · Neon Postgres · Vercel Blob | §1.1, §9 |
| Framework | Next.js App Router + React + Drizzle | §1, §4 |
| Auth | One passphrase, signed cookie, middleware | §1.1 |
| Long jobs | Research staged into 3 calls, ≤300 s each | §1.2, §5.1 |
| Airbrush | Single-rig 74540; facts read from the `airbrush` row | §2.3 |
| Catalogue | Whole Tamiya range, generated + CI-verified | §2.2 |
| Equivalence | Cybermodeler, build-time import, foreign → Tamiya | §2.2 |
| Manuals | Uploaded by hand, viewed in app, never fetched | §4.3 |
| Colour | 3 semantic colours + tonal livery | §4.1 |
| Type | Barlow Condensed · Plus Jakarta Sans · DM Mono | §4.1 |
| Geometry | 4px scale · radii 20/14/999 · one shadow | §4.1 |
| Navigation | Bottom tabs on phone · 260px left rail on desktop | §4.1, §4.2 |
| Theme | Light only; no dark branch anywhere | §8 |
| Performance | PPR shell · compiled reference data · client islands · CI budget | `docs/PERFORMANCE.md` |

Phase 0, Phase 1 and Phase 2 are done — the app deploys, the Thinner Bench is real, and the
shelf answers "do I own this?" both on its own screen and on the bench result card. Phase 1's
catalogue script did catch the XF-83/XF-84 gap this plan predicted (§2.2), confirming both
codes and names by search; their hex values are still unverified estimates, flagged as such
in `scripts/build-catalogue.ts`'s own comments — fix them by eye against a real bottle
whenever convenient, no phase attached. The other open item, a parser pass against
Cybermodeler's actual HTML (§2.2 — the page was unreachable from the planning sandbox), is
Phase 3 scope now.

**Start at Phase 3** (§6) — building the app itself is well underway.

---

## 8. What I am explicitly not proposing

- **No native mobile app.** PWA covers it.
- **No dark theme.** Cut from scope. The token structure in §4.1 supports one later — it is a
  values swap, not a redraw — but nothing in the build should assume or prepare for it, and
  no component should carry a dark branch. A second theme is a future conversation.
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

Concretely: today your paint list lives in a Google Sheet. After Phase 2 the same data lives
in a table in that Postgres, and the app reads and writes it. That's the whole change.

### 9.2 Your steps — about ten minutes, once

1. **Import the repo.** Vercel dashboard → **Add New → Project** → import
   `ruijssantos/build-bench`. Accept the Next.js defaults; Vercel picks up `main` as the
   production branch on its own, and every other branch deploys as a preview. The first
   deploy will render nothing until Phase 0 lands — that's expected.
2. **Add the database.** In the project → **Storage** tab → **Create Database** → choose
   **Neon** from the Marketplace → **Free** plan → pick an **EU region** (Frankfurt is
   normally the closest to Portugal) → name it `build-bench`.
3. **Connect it.** Still in Storage → the new database → **Connect Project** → select
   `build-bench` → tick **Development, Preview and Production**.
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
