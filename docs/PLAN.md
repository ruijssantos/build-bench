# The Build Bench — Architecture

A companion app for 1:24 scale model car building, centred on a Tamiya 74540 HG Trigger
airbrush workflow and pre-build kit research.

**Status:** Phases 0–6 shipped (foundations, Thinner Bench, paint inventory, wishlist, stash,
cross-brand equivalence, dashboard). Phase 7 (kit research) is next. This file is the standing
architecture and technical approach — how the app is hosted, how data and screens are
structured, and the rules any new phase builds against. It is not a decision log; for that,
`git log docs/PLAN.md`.

Section numbers below are stable and cited from code (`schema.ts`, `PERFORMANCE.md`,
`README.md` all reference specific `§N`s) — sections get edited, not renumbered.

---

## 1. Decisions taken

| Question | Decision |
|---|---|
| Hosting | **Vercel**, Hobby plan |
| Framework | **Next.js (App Router) + React** |
| Database | **Neon Postgres**, via Vercel's marketplace integration |
| File storage | **Vercel Blob** — uploaded manuals and build photos |
| Auth | App-level signed cookie, one passphrase |
| Airbrush | **Single-rig: Tamiya 74540 HG Trigger** |
| Phone | PWA / responsive web. Desktop for manuals, phone for quick lookups |
| Visual design | Cutting-mat paper, one manual blue, tonal livery, Saira Condensed display — §4.1 |
| Theme | Light only |
| Performance | Partial Prerendering, compiled reference data, client islands — `PERFORMANCE.md` |

### 1.1 Making Vercel work

Vercel imposes three constraints. Each has a clean answer.

**No persistent filesystem, so SQLite is out.** Serverless functions get an ephemeral disk,
wiped between deployments and not shared across invocations. The database has to be a
managed service.

**Neon Postgres, not Supabase.** Supabase looks better on paper — Postgres, auth and storage
in one free tier — and loses on one behaviour: it pauses free projects after 7 days idle,
and restoring is a manual dashboard click. Neon scales to zero after 5 minutes idle and
resumes automatically on the next query, in roughly 300–800 ms. Decisive for an app used in
bursts — the trip where you most need it (in a shop, checking "do I own this?") is exactly
the trip where a paused project would bite. Neon also installs from the Vercel marketplace,
injects `DATABASE_URL` automatically, and bills through Vercel.

**Files.** Vercel Blob — 1 GB storage, 10 GB transfer/month on Hobby, same vendor as the
host. Holds uploaded manual PDFs and build photos (resized on upload, long edge ~2000 px).

**Auth.** Vercel's Password Protection is Pro/Enterprise only; Vercel Authentication (on
Hobby) protects preview deployments but leaves production public. So: app-level auth, one
passphrase, a signed HTTP-only cookie, checked in `src/proxy.ts`. No accounts table, no
OAuth. Long cookie lifetime — the threat model is "a crawler finds the URL," not a targeted
attacker.

### 1.2 The 300-second ceiling

Vercel Hobby caps function execution at 300 seconds, Fluid compute on by default. Streaming
doesn't buy extra time — the clock covers the whole invocation. Any future feature that
calls an LLM with web search or does other genuinely long work (§5's kit research is the
first one) needs to be staged into separate requests under that ceiling rather than assumed
to fit. No queue, no cron, no worker — Fluid compute bills active CPU, not wall-clock, so a
mostly-idle-waiting-on-an-API call is cheap regardless of how it's staged.

---

## 2. Domain reference data

Several things this app needs don't come from a live API and never will: the Tamiya paint
catalogue and its ratio rules (shipped, §2.2), the airbrush it's all stated for (§2.3), and
the cross-brand equivalence chart (Phase 5, not yet built). They all follow one shape —
generated once, committed, read from the file rather than a table — covered generically in
§4's "Reference data rule" and in `PERFORMANCE.md` §2. Kits are the exception and §2.4 says
why. This section has only the domain-specific facts a future phase needs that live nowhere
else.

### 2.1 Your inventory as imported

From the Google Sheet — 33 paints. This is the Phase 2 seed (`seed/inventory.initial.json`).

- **Gloss (18):** X-2, X-3, X-6, X-7, X-8, X-9, X-10, X-11, X-12, X-13, X-14, X-18, X-19,
  X-21, X-22, X-24, X-26, X-27. The sheet files X-21 under Gloss and X-19/X-22/X-24/X-26/X-27
  as smoke/clears, but the importer classifies by catalogue family, not sheet column — they
  land as `additive`/`clear`, not `gloss`.
- **Flat (11):** XF-1, XF-2, XF-7, XF-16, XF-24, XF-53, XF-56, XF-60, XF-64, XF-83, XF-84.
- **Sprays (2):** TS-7, TS-8.
- **Primers (2):** Liquid Surface Primer Grey, Liquid Surface Primer White.

### 2.2 The full Tamiya catalogue, and cross-brand matching

`seed/paints.tamiya.json` holds the full current catalogue — not just what's on the shelf.
Generated once by `scripts/build-catalogue.ts` from the prototype's known-good paint table
plus a round of verification against Tamiya's own product pages, then committed and checked
in CI by `scripts/verify-catalogue.ts`: every code in the real inventory (§2.1) and every
family a paint references must resolve to a catalogue entry / `ratio_rule`, or the build
fails. This is the check that would have caught the XF-83/XF-84 gap in the prototype this
catalogue replaces.

Lines, approximately: X- (gloss, 1–35), XF- (flat, 1–93), LP- (lacquer, 1–85), TS- (spray,
1–102), AS- (aircraft spray, 1–33), PS- (polycarbonate spray, 1–63), plus a small Primers
set outside the numbered lines. Every numbered line has real gaps — `verify-catalogue.ts`
reports them per line as a non-failing sanity check, not a hunt-by-hand job.

Phase 3's source for cross-brand equivalents: the
[Tamiya Color Cross-Reference](https://www.cybermodeler.com/color/tamiya_map.shtml),
covering Gunze Sangyo (GSI — i.e. Mr. Hobby), Vallejo, Revell, Testors, XtraColour, AMMO by
Mig, Hataka, Lifecolor and Mission Models — plus Mr. Paint (MRP), a tenth brand the chart
itself carries that this list hadn't anticipated; added to `paint_brand` rather than dropped.

- **Direction.** The chart maps Tamiya → other brands. The real question runs the other way —
  a non-Tamiya kit calls for H12, what Tamiya code do you reach for? `paint_equivalent` is
  indexed both ways (§3.1); resolution (HISTORY.md, Phase 5) leads with foreign → Tamiya.
- **Display order** (a call made once, revisit whenever): Gunze/Mr. Hobby, Revell, Vallejo,
  AMMO, Testors, LifeColor, XtraColour, Hataka, Mission Models, Mr. Paint. Gunze first because
  Japanese car kits (Fujimi, Aoshima, Hasegawa) call Mr. Color throughout; Revell second
  because Revell car kits are common in European shops. Stored as `sort` on `paint_brand`
  (§3.1), so it's a data change, not a code change.
- **Import once, at build time**, same pattern as the paint catalogue — `equivalents.json`,
  committed, never scraped at runtime. The Cybermodeler page turned out to be unreachable at
  build time too (blocked from both the planning sandbox and the one that built this phase),
  so the import ran against a PDF export of the page instead of live HTML — see HISTORY.md for exactly
  how, and for what that source does and doesn't cover.
- **A second source, added later: [mech9](https://www.mech9.com/)'s Aqueous Hobby Color and
  Mr. Color conversion tables**, ingested by `scripts/parse-mech9-tables.mts` into
  `scripts/data/mech9-gunze-tamiya.json`. It exists because Cybermodeler is indexed by *Tamiya*
  shade and built for aircraft and armour — 129 rows, mostly greys and greens, carrying 77 of
  Gunze's ~420 H codes. mech9's tables are indexed by the *Gunze* code, so they cover that
  range as a range. Same delivery constraint, same workaround: PDF exports of the pages.
  A pair both charts list is written `match_quality: "confirmed"`, which is what
  `resolveForeignCode` ranks on before anything else — see HISTORY.md for why a second opinion must
  earn an override rather than simply arrive.
- **Where no chart has a row at all, fall back to colour distance.** mech9's two *colour chart*
  pages give an sRGB hex per Gunze code (`seed/gunze-colours.json`, 416 of them, ingested by
  `scripts/parse-mech9-swatches.mts`); `src/catalogue/colour-match.ts` puts that in CIELAB and
  ranks the catalogue by CIEDE2000. It renders in the Unresolved bucket as a suggestion with its
  ΔE and the candidate's finish, and **never** counts towards Owned or Missing — a chart row is
  a published equivalence, this is the distance between two screen swatches, and §5.4's rule is
  that the two must not look alike.
- Where the chart has no row, fall back to a Claude lookup, written with
  `source = 'claude-research'` and a lower `match_quality` so it stays visibly distinct from
  chart-sourced data. **Not built in Phase 5** — every code the chart doesn't carry still lands
  in Unresolved, same as before this phase. See HISTORY.md.

### 2.3 The rig

The app is built for the Tamiya 74540 HG Trigger alone. Every ratio, pressure and distance is
stated for a 0.3 mm needle, a 7 cc fixed cup and retarder thinner, and `ratio_rule` gets no
rig dimension. A second airbrush (a Harder & Steenbeck Ultra, currently unused) is owned but
out of scope.

The rig lives in `seed/rig.json`, compiled into the build by `src/catalogue/rig.ts`. It was a
Postgres row until it wasn't: three fields that never change, read by the nav rail and the
phone header, which render on *every* screen — so every screen in the app paid a Neon round
trip for it. Moving it to a file removed that read from the whole app and let the rail, the
rig pill and three placeholder screens go back to being fully static.

The discipline that row was protecting is unchanged and still holds: **rig facts are read
from the rig, never hard-coded into copy.** If a second rig ever joins, or the app grows a
screen for describing a tool's characteristics, that's a shape change here and a review of
the ratio windows — not a hunt through JSX for a model name.

Deliberately *not* modelled: maintenance history (last deep clean, needle changes) and
per-session spray logging. Both were planned, neither is wanted — see §8.

### 2.4 Kits, and why they aren't compiled in

Kits are the one domain where the reference data can't be a committed file. There is no
bounded catalogue to generate: the interesting set is "any kit, any manufacturer, any
subject", it changes as manufacturers release, and the shape of a query is free text
("Tamiya Nissan GT-R") or a kit number ("24345") rather than a lookup key.

[Scalemates](https://www.scalemates.com) is the most complete reference on the web, and it is
bot-hostile by design — no API, and scrapers unwelcome. So the app does not scrape it. It
resolves a query through Claude with web search (§5.1 stage A), stores what comes back on the
`kit` row, and keeps a `scalemates_url` as the human's way through to the full reference.
Box art is fetched once at add-time into Vercel Blob and served from there; the app never
hotlinks someone else's image.

Everything about a kit is therefore *user data that happened to be machine-assisted*, and
lives in Postgres like the rest of it. Resolution is a one-off cost per kit added, not a
per-render one.

---

## 3. Data model

Postgres via Drizzle ORM — TypeScript-native schema (`src/db/schema.ts`), real migrations
(`drizzle/`), types flowing into the app with no hand-written duplicates.

### 3.1 Reference data — seeded, compiled into the build for reads (§4, `PERFORMANCE.md` §2)

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

ratio_rule
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

ratio_override                     -- user corrections
  id              serial PK
  paint_code      text NULL FK     -- override one paint...
  family          text NULL FK     -- ...or a whole family
  paint_parts     real
  thinner_parts   real
  psi_text        text
  reason          text
  created_at      timestamptz

(The cross-brand chart is *not* a table. `paint_brand` and `paint_equivalent`
were dropped in 0007 — seeded since 0000_init and never read. Every lookup goes
through `src/catalogue/equivalents.ts`, which imports seed/equivalents.json and
seed/paint-brands.json at module scope. Same rule as the rig below.)

rig                                -- seed/rig.json → src/catalogue/rig.ts, §2.3
  model           text             -- "Tamiya 74540 HG Trigger"
  nozzle_mm       real             -- 0.3
  cup_cc          real             -- 7
```

`rig` is listed here for completeness and is **not a table** — it is a committed JSON file
compiled into the build (§2.3). There is no `vendor` table either: "where did I buy this" is
a shop name, so it's plain text on the row that needs it. A table of shops would only earn
its place alongside pricing, which is a non-goal (§8).

### 3.2 User data — read/write

```
inventory_item                     -- the paint shelf
  id              serial PK
  paint_code      text FK paint
  form            text             -- bottle | spray_can | decanted_jar
  decanted_from   text NULL FK     -- TS-8 can → decanted jar, keeps the lineage
  state           text             -- low (unset reads as "In Stock")
  quantity        integer
  purchased_from  text             -- a shop name, free text
  purchased_at    date
  notes           text
  updated_at      timestamptz

kit                                -- wishlist AND stash, one table — §3.3
  id              serial PK
  brand, kit_number, name text
  scale           text             -- "1:24"
  category        text             -- cars | motorcycles | aircraft | armour | ships |
                                   -- figures | other
  status          text NOT NULL    -- wishlist | stash | building | built
  scalemates_url  text             -- the reference page, §2.4
  image_url       text             -- Vercel Blob — sourced once, never hotlinked
  purchased_from  text             -- a shop name, free text
  purchased_at    date
  notes           text
  created_at      timestamptz
  INDEX (status)                   -- every screen filters on it

wishlist_item                      -- the wishlist's "Other Items": tools, supplies
  id              serial PK
  title           text NOT NULL    -- free text, the whole point
  url             text
  notes           text
  status          text NOT NULL    -- wanted | bought
  added_at        timestamptz

kit_manual                         -- user-uploaded, §4.3 — never auto-downloaded
  id              serial PK
  kit_id          integer FK
  blob_url        text             -- Vercel Blob
  filename        text
  size_bytes      integer
  page_count      integer NULL     -- written by extraction, which counts to trim
  paint_chart_found boolean NULL   -- did the pages read hold the paint chart? §4.3
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
  difficulty      text             -- beginner | intermediate | advanced
  difficulty_note text
  fit_issues      jsonb            -- [{issue, severity, source_url, confidence}]
  tips            jsonb            -- [{tip, category, source_url, confidence}]
  sources         jsonb
  model_used      text
  input_tokens, output_tokens integer
  researched_at   timestamptz

kit_paint_requirement              -- the manual's paint callouts
  id              serial PK
  kit_id          integer FK
  manual_id       integer NULL FK
  raw_label       text             -- exactly as printed: "X-11 CHROME SILVER"
  paint_code      text NULL FK     -- resolved; null if unresolvable
  source          text             -- manual_pdf | research | manual_entry

build_log_entry
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
```

### 3.3 Why the wishlist and the stash are one table

A kit you want and a kit you own are the same object. Same brand, same number, same scale,
same category, same box art, same Scalemates page — the only thing that differs is whether
you've bought it. So buying one is `status: wishlist → stash`, a single column write, not a
copy into a second table.

That matters more than it looks. The wishlist is where you do the thinking — you found the
kit, resolved it, sourced its art, maybe left yourself a note about which boxing to get.
Copying rows on purchase would either lose all of that or force a merge, and the two tables
would drift apart field by field as each phase added to one of them.

The **product** separation the user sees is real and stays: two nav entries, two screens,
built in two phases (§6). It just doesn't need two tables to hold it up — it needs an index
on `status`, which is one line.

The same reasoning reaches the detail page. `/kits/[id]` shows a kit in **any** status,
wishlist included: uploading the manual, checking its paints against the shelf, running
research and finding build videos are all as useful for deciding whether to buy a kit as for
building it, and they stay attached when it's bought. What stays status-shaped is only what's
genuinely about ownership — the "Purchase & dates" panel appears once it's bought, the status
ladder shows a Wishlist step only while the kit is still on it, and the shop run (§6 Phase 6)
counts only kits you own. Wishlist and Stash cards share one readiness line, word for word:
"3 missing", or "Ready to build" once the shelf covers it.

`wishlist_item` is genuinely separate, and that's the test working rather than failing: a
tool or a bottle of glue has no brand, no scale, no kit number and no reference page, and it
never graduates into a stash. Nothing about it is a `kit` with empty columns.

---

## 4. Application structure

```
build-bench/
├── docs/
│   ├── PLAN.md                     ← this file
│   ├── PERFORMANCE.md              ← the standing performance rule set
│   ├── decisions/                  ← short ADRs as things change
│   └── reference/                  ← historical inputs (the original prototype)
├── drizzle/                        ← generated migrations
├── seed/                           ← generated + committed
│   ├── paints.tamiya.json          ← loaded into Postgres by scripts/seed.mts
│   ├── ratio-rules.json            ← "
│   ├── inventory.initial.json      ← "
│   ├── rig.json                    ← compiled in only, never seeded — §2.3
│   └── equivalents.json, brands.json                 ← Phase 5
├── scripts/
│   ├── build-catalogue.ts          ← generates seed/paints.tamiya.json, §2.2
│   ├── verify-catalogue.ts         ← runs in CI, fails the build on a missing code
│   ├── migrate.mts  ·  seed.mts
│   └── check-perf-budget.ts        ← runs in CI after `next build`, PERFORMANCE.md §10
├── src/
│   ├── app/
│   │   ├── (bench)/                ← the authenticated app shell (nav rail + tab bar)
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/          ← the landing screen, Phase 6
│   │   │   ├── thinner/            ← page.tsx + actions.ts
│   │   │   ├── inventory/          ← the paint shelf, page.tsx + actions.ts
│   │   │   ├── wishlist/           ← Phase 3
│   │   │   └── kits/               ← the stash + /kits/[id], Phase 4a
│   │   ├── api/                    ← only where a Server Action doesn't fit (search,
│   │   │                             external callbacks, kit research's staged calls)
│   │   ├── login/  ·  page.tsx  ·  layout.tsx  ·  manifest.ts
│   ├── catalogue/                  ← reference data compiled into the build, not queried —
│   │                                 see "Reference data rule" below and PERFORMANCE.md §2
│   ├── components/                 ← one folder per feature (thinner/, inventory/, ...),
│   │                                 plus bench/ for shared chrome and nav/ for the shell
│   ├── db/
│   │   ├── schema.ts  ·  client.ts        ← Neon serverless driver
│   │   └── repositories/                  ← only truly runtime-mutable tables: inventory,
│   │                                         ratio-overrides, and their future siblings
│   │                                         (kits, wishlist). Reference data lives in
│   │                                         catalogue/.
│   ├── domain/                     ← pure functions: ratio.ts, paint-code.ts,
│   │                                 paint-search.ts, inventory.ts, and their future
│   │                                 siblings (kit.ts, equivalence.ts, ...)
│   ├── lib/                        ← cross-cutting: session, passphrase, small per-feature
│   │                                 server helpers
│   ├── proxy.ts                    ← auth gate + the bench-memory cookie (§6 in
│   │                                 PERFORMANCE.md)
│   └── styles/tokens.css           ← the tokens in §4.1, verbatim
└── tests/
```

The tree above is the convention, not a fixed manifest — each phase adds the files its
feature needs following this shape (a route folder under `(bench)/`, a component folder
under `components/`, a repository only if the data is genuinely mutable, pure logic in
`domain/`). Three rules hold across all of it:

**Connection handling.** Neon's serverless HTTP driver (`@neondatabase/serverless`), not
node-postgres. It speaks HTTP rather than TCP, so there's no connection pool to exhaust
across serverless invocations — the most common way a Postgres-on-Vercel app falls over.

**Data access rule.** Every query goes through `src/db/repositories/*`. Route handlers and
components never import the Drizzle client directly.

**Reference data rule.** Reference data seeded from a committed, CI-verified file and only
changed on deploy is *read* from that file, not queried — `src/catalogue/*` imports
`seed/*.json` at module scope and builds a lookup once per process. The database tables
(`paint`, `ratio_rule`, and Phase 5's `paint_equivalent`) stay: they're the seed target and
the foreign key every user-owned row hangs off. Only the *read* path for identity moves.
This is what lets a screen prerender, keeps type-ahead off the network, and keeps `next
build` from needing a database — the full reasoning is `PERFORMANCE.md` §2. Any phase adding
its own generated-and-committed reference data (Phase 5's `equivalents.json`) follows the
same shape.

The rig (§2.3) is the strictest case: it isn't seeded into Postgres at all, because nothing
joins against it. When reference data has no foreign keys pointing at it, the table is pure
overhead and the file is the whole story. Apply that test before adding a table for anything
that only ever gets read.

### 4.1 Design system

Reference canvas (mockups for the screens built so far, and the rejected visual directions):
<https://claude.ai/code/artifact/9081aef8-94df-49d5-9ec9-d72df184865e>

Clean product UI (Apple / Airbnb / Revolut as reference points) carrying a classic-car
palette, rather than imitating a dashboard.

**Redesign in progress (Oct 2026).** The cream palette read as beige and generic. The
direction now is the *Instruction Sheet* palette (a cool paper ground with the faint
grid of a cutting mat, ink, one manual blue) with *Pit Board* type and, later, some of its
components. The three directions that were compared, live:
<https://claude.ai/artifact/J3swgzccXtk3WoWM8iETyy>. Step one swaps tokens and fonts
only; no component changes yet.

#### Colour

```css
/* surfaces — a cutting mat */
--bg:            #f3f4f1;   /* page, under --bg-grid (24px, ink at 4.5%) */
--card:          #ffffff;
--card-sunken:   #eceeea;   /* inset tracks, card strip ground */
--line:          #e3e5e1;   /* hairline border */
--line-strong:   #d7dad6;   /* input borders */

/* livery — a neutral, never a colour */
--livery:        #e2e4e0;   /* tonal stripe on --bg */
--livery-card:   #eef0ec;   /* tonal stripe on --card */

/* ink */
--ink:           #121417;
--ink-soft:      #3d4249;   /* body inside tinted panels */
--muted:         #697077;   /* secondary text */
--muted-2:       #8a9097;   /* labels, captions */
--muted-hover:   #4c5258;   /* --muted on hover */
--faint:         #c4c8cc;   /* separators inside text, disabled glyphs */
--icon-idle:     #9a9fa5;

/* accent — selection and primary values ONLY */
--accent:        #1d4ed8;
--accent-hover:  #1a3fae;
--accent-tint:   #e7edfc;

/* semantic — in range / owned */
--ok:            #1f7a4d;
--ok-tint:       #e6f2ea;
--ok-track:      #cfe6d8;   /* the workable-window band */

/* semantic — act on this */
--alert:         #d4231c;
--alert-tint:    #fdeceb;

/* ink at alpha — scrims over content and box art */
--scrim:         rgba(18, 20, 23, .40);
--scrim-strong:  rgba(18, 20, 23, .55);
--scrim-stronger: rgba(18, 20, 23, .72);
```

**The rule that keeps this coherent:** three colours, all of them earning their place.
Accent marks selection and the primary value. The two semantics carry meaning and nothing
else — `--ok` means *in range / owned*, `--alert` means *act on this* (warnings, running
low). Nothing is coloured for decoration; the livery is a tonal neutral. That leaves **paint
swatches as the only saturated colour on screen**, from `paint.hex` — content, not chrome.
Adding a fourth chrome colour breaks this; don't.

#### Type

Three faces, one job each. All from Google Fonts, each with a fallback stack.

| Token | Face | Used for |
|---|---|---|
| `--font-display` | Saira Condensed | Screen titles (uppercase), hero numerals, small-caps labels |
| `--font-ui` | Hanken Grotesk | Everything that is read: values, body, rows, buttons |
| `--font-mono` | Martian Mono | Paint codes only — `TS-8`, `XF-64` |

| Role | Spec |
|---|---|
| Screen title | Display 700 · 40px phone / 38px desktop · uppercase · ls .005em · lh .98 |
| Hero numeral | Display 700 · 66px phone / 86px desktop · ls −.01em |
| Section title | `ui.sectionTitle` · Display 700 · 20px phone / 22px desktop · uppercase · ls .02em · `--ink` |
| Module title | `ui.moduleTitle` · Display 600 · `--text-base` phone / `--text-md` desktop · uppercase · ls .14em · `--muted` |
| Body copy | UI · `--text-base` (14) · lh 1.5 · `--ink-soft` |
| Row title | UI 700 · `--text-md` (15) · ls −.01em |
| Field label | `ui.fieldLabel` · Display 600 · `--text-sm` (13) · uppercase · ls .12em · `--muted-2` |
| Caption | UI 500 · `--text-xs` (12) · `--muted-2` |
| Paint code | Mono 500 · `--text-xs` (12) · ls .02em · `--muted-2` |

**The scale** (`tokens.css`, whole pixels only): `--text-2xs` 11 · `--text-xs` 12 ·
`--text-sm` 13 · `--text-base` 14 · `--text-md` 15 · `--text-lg` 17; display sizes (20 and up)
stay on their roles. **12px is the floor for anything read.** 11px is only for uppercase
micro-tags, whose caps read a size larger, and the phone tab bar's labels. A text input is 16px
on a phone whatever its role, because below that iOS Safari zooms the page on focus.
`npm run lint:css` fails CI on any other font size. The Oct 2026 sweep that introduced it found
26 sizes in use, half of them on half-pixels.

Rules for every module, regardless of screen:

- **Module title** is the same treatment whatever the module's physical size — a four-across
  spec tile gets the identical title style as a full-width notes card. Don't shrink it to
  "fit"; if a title truncates, the layout is too narrow (the width floor under *Geometry*),
  not the type.
- **Section title** is reserved for a screen built from more than one top-level module stacked
  vertically — Wishlist's *Kits* and *Other items* — where each section needs its own heading
  above the module content it contains. A screen with a single module (Paints, Thinner) has no
  use for it; that module's own heading is a Module title, not a Section title.
- **Body copy** is one size for everything read as secondary or reference text: tile values,
  notes lists, modal paragraphs. Don't introduce a second body size for a new module without
  a reason that survives being asked out loud.
- **Labels are never coloured decoratively.** A label takes `--muted` (module title) or
  `--muted-2` (caption). Reach for `--ok` / `--alert` / `--accent` only when the colour
  carries the meaning defined in *Colour* — a label merely sitting near a status bar is not
  itself a status.
- **Field label** is deliberately not a module title: it names a form input, so it stays
  smaller and quieter than the title of the module containing it.
- Emphasis inside these roles is **weight, not size or colour**.

Saira Condensed carries the app's automotive voice through type, not ornament — which is
why it works on screens (Paints, Shopping) that have nothing to do with instruments.

#### Geometry

- **Spacing:** 4px scale. Screen gutter 20px phone / 40px desktop.
- **Desktop content width:** bounded at both ends — `max-width: 1600px` (centred) so an
  ultra-wide window doesn't strand content in empty page, `min-width: 1100px` so a narrow
  desktop window never squeezes module titles into truncating. Below the floor the content
  area scrolls horizontally. Both bounds apply above the 900px breakpoint only; phone is
  fluid.
- **Radii:** card 20 (22 desktop — the token itself switches, so every card follows) · tile 14 ·
  control 12 (buttons, inputs) · small control 10 · pill 999 (filters and chips only).
- **Borders:** 1px `--line`. Hairlines do the separating.
- **Elevation:** exactly one shadow in the whole app, on the hero card —
  `0 1px 2px rgba(18,20,23,.04), 0 10px 28px rgba(18,20,23,.05)`. Everything else is a
  hairline. Don't add a second elevation level.
  The same shadow is what a navigating card takes on hover (see *Motion*); it is
  never a resting second level.
- **Touch targets:** ≥44px everywhere; tab-bar items 44px.
- **Tab bar:** 60px tall, hairline top, 6 items (5 routes + sign out), active in `--accent`.
- **Left rail:** 260px, items 44px, active state is an `--accent-tint` pill at radius 12.
- **Status bar:** leave the top 44px of a phone layout empty. Never draw fake chrome.

#### Components

Every control lives once, in `src/styles/ui.module.css`, imported as `ui`. A screen's own
stylesheet adds layout to them (`flex`, `margin`, position) and never restyles them; the shared
classes set no layout, so the two never set the same property and bundle order can't matter.

| Control | Classes | Spec |
|---|---|---|
| Button | `btn` (+ `btnSm` / `btnLg`) | 44 phone / 40 desktop · small 36 · large 52 / 46 (beside `SearchField`) · `--card` ground, `--line-strong` border, UI 600 |
| Primary | `+ btnPrimary` | Filled `--accent`, `--accent-hover` on hover. One per surface. |
| Alert / ok | `+ btnAlert`, `btnOk` (`…On` for the armed / done state) | Neutral at rest; hover previews the meaning |
| Icon button | `iconBtn` (+ `iconBtnAlert`, `iconBtnScrim`) | 36px square, radius 10, 44px hit area via `::after`, 16px glyph |
| Pill | `pill` (+ `pillOn`, `pillAlert`) | 36px, filters and single choices; selected is filled accent |
| Input | `input`, `inputFocus` | Control height, 16px phone / 14 desktop, accent border plus tint halo on focus |
| Text button | `textBtn` | An action inside a sentence; inherits the text's size |

Rules that keep the family coherent:

- **Actions are rounded rectangles; pills are filters and chips.** A button is never a pill.
- **No transparent controls.** On the cutting-mat grid, a transparent button shows the grid
  through it. Every control sits on `--card`.
- **One hover per kind.** A neutral control previews the accent (border, ink and tint). A control
  with a meaning hovers to that meaning (alert for destructive, ok for bought or built). Rows and
  nav items are places, not controls, and hover to `--card-sunken`. Selected is always a step
  stronger than hover: a filled pill against a tinted one, an accent-tint nav item against a
  sunken one.
- **Icons in controls:** 16px in an icon button or a default/large button, 14px in a small one.
- **Focus** is one global ring (2px accent, 2px offset) on `:focus-visible`; inputs replace it
  with their halo.

#### Livery

The one decorative element, and it costs no colour:

- **No header sweep.** The diagonal bars that bled off the rail and the phone header
  were removed in the Oct 2026 redesign: on the cutting-mat grid they read as noise.
- **Card echo** — a 4px strip on the hero card's top edge: 44px bar, 9px gap, 17px bar,
  filled `--livery` on a `--card-sunken` ground.
- On `--card` surfaces use `--livery-card` instead, one step lighter.
- The livery never uses `--accent`.

#### Motion

Motion confirms something you did or can do; it never decorates, and nothing waits on it.
One curve, three speeds, in `tokens.css`:

- `--ease-out` `cubic-bezier(.2, 0, 0, 1)`, no overshoot. `--dur-fast` 120ms (colour, tints),
  `--dur-base` 200ms (lifts, small moves), `--dur-slow` 320ms (box art, fills).
- **Hover:** only on things that navigate. A card with the stretched link takes
  `--shadow-hero` in place (cards never move) and its box art scales to
  `--art-hover-scale` (1.04) inside its frame; a dashboard row's thumbnail scales the same
  way, and a stat tile takes the shadow. A card that doesn't navigate (a search
  candidate, the kit page's identity panel) gets no hover at all, so hover keeps meaning
  *this opens*. Keyboard focus gets the same
  shadow. Hover rules sit inside `@media (hover: hover)` so a tap never leaves a phone
  card stuck in its hover state.
- **Status bar** (`StatusBar`, shared by the dashboard's bench card and the kit page's
  Status panel): one segment per step, done in `--ok`, current in `--accent`, future an
  empty track; Built reads done. Filled segments fill left to right once on first paint
  (`--dur-slow`, 90ms stagger). On the kit page, where status changes in place, forward
  fills the next segment from the left, back drains it from the right in its own colour,
  and reaching Built runs one chequered sweep. Nothing loops.
- `prefers-reduced-motion: reduce` collapses every transition and animation to 1ms,
  globally, in `tokens.css`.

#### Icons

Inline SVG on a 24px grid, `fill="none"`, stroke 2 (1.9–2.6 where emphasis is wanted), round
caps and joins. One consistent set. No emoji anywhere in the UI.

### 4.2 Desktop and phone are different jobs

- **Desktop — reading.** Manual PDF viewer beside a kit's research notes and paint list.
  Build log writing. Inventory bulk editing. Wide, dense.
- **Phone — one-handed, at the bench or in a shop.** Thinner Bench readout, "do I own this?",
  the shopping list. Large touch targets, legible at arm's length, minimal typing.

### 4.3 Manuals: upload and view

Users upload the PDF; the app stores and displays it — rather than auto-discovering and
downloading one, which means guessing at third-party hosting that can block, move or
rate-limit, and raises copyright questions a self-supplied file doesn't. It also decouples
paint shopping from kit research (§6).

Mechanically: drag-drop or file-pick → `PUT` to Vercel Blob → `kit_manual` row. "Open" links
straight to the stored PDF — the browser's own viewer, in a new tab, phone and desktop alike;
an earlier desktop-only inline `<iframe>` toggle duplicated that for no real benefit and was
removed (HISTORY.md, round 5). An **Extract paint list** action uploads the stored PDF to Claude through
the Files API and writes `kit_paint_requirement` rows, feeding the shopping list. It runs on its
own straight after an upload (the new row triggers the same call its button makes, so the
"Extracting…" state and any error show exactly as for a click); the button stays for re-runs.
Kit research
neither fetches a manual nor links to one (HISTORY.md).

**Extraction reads the first `DEFAULT_EXTRACT_PAGES` pages, not the whole file.** Every page of
a PDF is converted to an image *and* has its text extracted, so a page costs 1,500–3,000 text
tokens plus image tokens whether or not it says anything — and on these manuals the paint chart
(every colour, its code, the cross-brand equivalence table, any custom mixes) sits in the front
matter, while the assembly steps after it only re-use codes that chart already named. Reading
twenty pages of exploded diagrams to find a table on page two is most of the bill.

The API has no page-range parameter, so `src/lib/pdf-pages.ts` trims the PDF with `pdf-lib`
before it is uploaded. That rule is about the common case, not every boxing, so it is a default
with a way out rather than a cap: extraction reports `foundPaintChart`, the answer lands on
`kit_manual.paint_chart_found`, and a `false` puts a **"read the whole manual"** link on the
manual row. The expensive path exists and costs what it costs — it just has to be asked for.

---

## 5. Kit research pipeline design

Three findings shaped this:

1. **Scalemates is bot-hostile.** Best kit database on the web, doesn't want scrapers (§2.4).
2. **"Difficulty and fit-issue notes from reviews and forums" is a synthesis job.** No API
   returns it; it's prose scattered across build threads and review blogs — exactly what an
   LLM with web search is for.
3. **No YouTube Data API needed.** ~100 free searches/day, plus a key and quota to manage.
   Claude's web search finds the build video in the same call.

With manuals uploaded by the user (§4.3), the deep-research job narrows to: difficulty, fit
issues, and a build video. It's no longer the pipe paint lists arrive through.

**The stages ship in two different phases.** Stage A — turning "24345" or "Tamiya Nissan
GT-R" into a real brand, number, name, scale, category and box art — is how a kit gets onto
the wishlist at all, so it lands in Phase 3 and is the only part of this the app needs early.
Stages B and C are the expensive, optional enhancement and wait for Phase 6. They're
documented together because they share `research_job`, the 300s budget and the API notes
below; they don't share a phase.

### 5.1 The staged pipeline

Three stages, each its own HTTP request with its own 300s budget (§1.2), state accumulating
in `research_job`.

```
  "24345" or "Tamiya Nissan GT-R"
        │
   [A] /api/research/resolve          ~10–20 s   ← Phase 3, the wishlist's search
        │   Sonnet 5, effort medium, web_search max_uses 2
        │   → { candidates: [{ brand, kit_number, name, scale, category,
        │                      scalemates_url, image_url, confidence }, …] }
        │   Structured output, no citations needed — it's extracting facts,
        │   not synthesising claims. Hand entry always available.
        ▼
   [B] /api/research/investigate      ~60–180 s  ← Phase 6, the expensive one
        │   Claude Opus 5, effort high, streaming
        │   web_search_20260209 (max_uses 6) + web_fetch_20260209
        │   Free-form, WITH citations. Finds: difficulty consensus,
        │   specific fit issues, a manual URL to link, a build video.
        ▼
   [C] /api/research/extract          ~10–20 s
            Claude + messages.parse() with a Zod schema. No web tools.
            Prose → strict typed JSON.
```

**Why staged.** No invocation nears 300s; a failure retries one stage instead of re-paying
for the whole job; the UI gets a real three-step progress indicator. Stage B is the one to
watch — if it approaches the ceiling, drop `max_uses` or split "find sources" from "read
sources."

**Why two passes (B → C).** Structured outputs (`output_config.format`) are incompatible with
citations, and citations are what make the output trustworthy — a source URL next to every
claim. Splitting cited free-form research from cheap typed extraction gets both. Stage A
skips this problem rather than solving it: resolving "what kit is this" carries no claims
that need a source, so it goes straight to structured output in one call.

**Stage A's UX.** The schema caps `candidates` at 10, ranked. A kit-number query usually
resolves to one confident match; free text ("Tamiya Nissan GT-R") can genuinely mean several
real kits — different scales, different boxings — so the wishlist screen renders whatever
comes back as cards (box art, brand + name + number, scale, category) and the user picks one,
or none. An empty `candidates` array is a normal response, not an error: the screen says no
matches, try different terms, with manual entry sitting right there either way — it was never
gated behind search failing. This has to be a submit-triggered search (a button, not
type-ahead): unlike paint search (`PERFORMANCE.md` §3), there is no free local index behind
it — every search is a real, paid, ~10–20s call, so the UI needs an explicit trigger and a
loading state, not a fetch per keystroke.

### 5.2 API shapes to use

Verified against current API documentation, not recalled:

- Model: `claude-sonnet-5` for stage A, `claude-opus-5` for stages B and C. Stage A is entity
  resolution against a couple of search results, not synthesis — Sonnet is fully capable of
  it at under half Opus's per-token cost. Thinking `{ type: "adaptive" }` on both —
  `budget_tokens` is rejected with a 400 on either model
- Effort via `output_config: { effort: "medium" | "high" }`
- Web tools `web_search_20260209` / `web_fetch_20260209` (dynamic-filtering variants). Don't
  additionally declare `code_execution` — these run it internally
- Stage B streams; use `.finalMessage()`
- Handle `stop_reason: "pause_turn"` — a long server-tool turn can pause, and an unhandled
  pause returns a silently truncated answer with no error raised
- **`allowed_callers: ["direct"]` on both web tools.** On `web_search_20260209` and later
  this defaults to `["code_execution_20260120"]` — "dynamic filtering", where the search runs
  inside code execution and only filtered results reach the model. It saves tokens and it
  broke this pipeline (HISTORY.md): under it the `web_search_tool_result` blocks arrive *nested inside
  the code execution result* rather than at the top level, and the
  `web_search_result_location` citations the trust surface is built on largely stop appearing.
  Anything that reads citations or scans top-level blocks wants `["direct"]`
- Citations are **always on for web search** and **off by default for web fetch** — the latter
  needs `citations: { enabled: true }` on the tool
- Server-tool errors return HTTP 200 with an error object in the result block, not an
  exception. On web search a success `content` is an array, an error `content` is an object
  — branch before indexing
- Stage C: `client.messages.parse()` with `zodOutputFormat(KitResearchSchema)`;
  `parsed_output` is null on failure, guard it
- Manual paint extraction (§4.3) uses the Files API — `client.files.upload` then a `document`
  block referencing `file_id`, no beta header needed either way (HISTORY.md, round 5: base64 inlining was
  the original approach and got replaced once it turned out to cap what could be extracted well
  below what could be stored)

### 5.3 Cost

Two different costs, an order of magnitude apart, because they're different jobs on different
models:

- **Stage A (Phase 3, every kit search).** ~5K input tokens (search snippets, tool overhead)
  and ~1–1.5K output tokens (a short candidate list plus some thinking) on Sonnet 5 ($2/$10
  per MTok) comes to roughly **$0.02–0.05 per search**. Not cached — every search is a fresh
  call, since the query itself changes each time.
- **Stages B+C (Phase 7, per kit researched).** This estimate was **€0.20–0.45 per kit** and
  the first real run cost **$1.60** — roughly 4× out, with the write-up citing 39 sources for
  one kit. The estimate wasn't wrong about the shape (search results dominate input); it was
  wrong about the volume, and about what a server-side tool loop does with it: every search
  and fetch result stays in context and is re-billed on every later iteration of the same
  turn, so cost grows with roughly the square of the loop's depth, not linearly with the
  number of searches. HISTORY.md has what was changed and why. The configuration is now Sonnet 5 at
  `medium` effort, 3 searches, 2 fetches capped at 6K tokens each, and prompt caching on;
  **re-baseline the figure here from `kit_research.input_tokens` / `output_tokens` after the
  next few runs** rather than trusting another estimate.

Every call records its own token counts regardless of stage, and those two columns are the
measurement — not this section. At personal-hobby volumes (a handful of kits a week) stage A
is pocket change either way; stage B is the one worth watching, and the only one where a
config change moves the bill.

**Billed to your own Anthropic account**, pay-as-you-go, through the `ANTHROPIC_API_KEY` set
in Vercel's env vars (§9.2) — the app has no billing of its own, no markup, no bundling.

### 5.4 Trust

Research output is synthesised from forum posts by a language model:

- Every fit issue stores `source_url` and `confidence`; the UI renders the source as a link
  next to the claim. No unsourced assertion appears as fact.
- ~~Difficulty shows as "consensus from N sources," never a bare rating.~~ **Half kept.** The
  rating is now a plain chip, in the same visual language as the kit's scale and category,
  because that is what it is — an attribute of the kit. The owner dropped the "consensus from N
  sources" half as noise: on a single-user app they already know every claim in this panel came
  from a model reading forum posts, the caveat at the top of it says exactly that, and every
  issue and tip below carries its own source link. The half that survives is the half still
  doing work — `difficultyRating` returns `null` when nothing was cited, so a rating with no
  backing is not shown at all rather than shown quietly.
- ~~A **Verify** action sets `verified_by_me`; verified rows visually outrank unverified.~~
  **Not built, and struck rather than deleted so the reasoning survives.** Phase 7 shipped it
  and it came straight back out (HISTORY.md): the panel holds exactly one research row per kit, so
  there is never anything for a verified row to outrank, and what the rule actually produced
  was a button that turned green and changed nothing else. The idea is sound one level down —
  a tick *per claim*, sorting verified issues and tips above unverified — and that is what to
  build if this is ever wanted. `verified_by_me` stays in the schema, unused, for that day.

---

## 6. Build phases

Each phase ships one screen that is useful on its own. The ordering rule: **want it, own it,
build it** — the wishlist comes before the stash because that's the order a kit passes
through in real life, and because resolving a kit (§5.1 stage A) is the machinery the stash
then inherits for free.

> **Before testing any phase's branch: §9.5 is the runbook.** Several phases add database
> columns, and nothing applies a migration automatically — a branch whose migration hasn't
> been run looks deployed and answers "The database didn't answer" on every screen that reads
> the changed table. §9.5 has the exact commands; the ledger there says which phases added one.

### Phase 0 — Foundations ✅
Next.js scaffold, Neon + Blob via Vercel, Drizzle schema and first migration, cookie auth,
`tokens.css`, PWA manifest, CI.

### Phase 1 — Thinner Bench ✅
The full Tamiya catalogue with generation and CI verification. Paint lookup, family ratio
rules, cup-fill visualiser, `ratio_override` editing, the 74540 dry-tip panel.

### Phase 2 — Paint inventory ✅
The paint shelf: CRUD over form/state (`low`), sortable table, one-tap running low,
"do I own this?" on the Thinner Bench card.

### Phase 3 — Wishlist ✅
Two sections on one screen. **Kits:** search by kit number or free text via §5.1 stage A,
pick from up to 10 ranked candidates, save with brand, scale, category and box art (fetched
once into Blob) plus a `scalemates_url` through to the full reference. Hand entry always
available for anything the search can't place. **Other items:** free-text `wishlist_item`
rows for tools and supplies. Kits tick over to the stash (`status: wishlist → stash`, §3.3,
one-directional — Phase 4 picks the row up from there); other items tick between wanted and
bought both ways, since there's no ownership record for a tool to move to. Needs
`ANTHROPIC_API_KEY` — this is the phase that first uses it.

### Phase 4a — Stash ✅
The kits you own: `status` of `stash`, `building` or `built`, promoted from the wishlist with
one tap (`promoteKitToStash`) or added directly (search and manual entry both save straight
to `stash`). `/kits` mirrors the wishlist's shell shape plus URL-driven status filter pills
(All/Stash/Building/Built, each with a count from one `countKitsByStatus` query); `/kits/[id]`
is the app's first detail route — identity + art + a Scalemates/YouTube-search link pair,
a three-step status stepper (`stash → building → built`, stamping `started_at`/`completed_at`
on the way in, editable after), purchase details, manual PDF upload with an **Extract paint
list** action per manual (Claude Opus 5, streaming, effort high), and the resulting
`kit_paint_requirement` rows shown as three buckets — Owned, Missing, Unresolved — against the
shelf. The per-kit bucket view is one targeted query; the Stash grid's "14 of 17 · 3 missing"
line on every card comes from one aggregate query across every kit, not N+1. Wishlist kits
later got the same detail page (§3.3, and HISTORY.md "A kit is a kit").

Manual upload does what §4.3 originally hoped for and Phase 3's photo upload couldn't:
client-direct upload via `@vercel/blob/client`'s `upload()` against a token route
(`/api/kits/manuals/upload-token`), because the private-store misdiagnosis that killed the
first attempt (HISTORY.md, Phase 3) is fixed. A `kit_manual` row is written by a Server Action the
client calls once `upload()` resolves, not from `onUploadCompleted` (no public callback URL
locally). A plain server-side `put`, capped at Vercel's ~4 MB request-body limit, is the
fallback when the direct path fails, and the UI says which path actually ran.

Deep research — difficulty, fit issues with sources, a real build video — is explicitly
**Phase 4b**, not built here: this phase ships only the free part, a plain YouTube search
link built the way `paintSearchUrl` builds its shop link (`kitYoutubeSearchUrl`, no API, no
key). Phase 7 below still owns the paid stages B/C research this link will eventually sit
beside.

### Phase 5 — Cross-brand equivalence ✅
Cybermodeler import (§2.2), `paint_equivalent`, foreign → Tamiya lookup. Sits here rather
than earlier because this is what makes Phase 4a's paint list work for Japanese kits, whose
manuals call out Mr. Color throughout — Phase 4a's own Unresolved bucket is exactly the gap
this phase closes, without re-running extraction on a single manual. HISTORY.md has the build
account: what shipped, what the data actually covers, and what's still open. The reverse
direction — one Tamiya code to every brand that sells a match — surfaced later as the Thinner
Bench's "Also sold as" card (HISTORY.md), the chart's first UI.

### Phase 6 — Dashboard ✅
`/dashboard`, and the screen the app now opens on (`/` redirects here; the Build Log's nav
slot became this one, so the phone tab bar still holds five items plus Sign out). Five
read-only modules over data Phases 2–5 already store, each behind its own `<Suspense>` inside
its own `<BenchError>`: four linked stat tiles (shelf size, running low, stash, wishlist);
**On the bench** — every `building` kit as a full card, with a status column beside the
details: days on the bench (counted on the viewer's own calendar, client-side, since the
shell is prerendered) over the shared status bar. No readiness line: you only start a kit
once its paints are in;
**What you could start** — stashed kits whose every called-for paint is already owned, which
is the module that makes this screen a decision rather than a readout; **Next shop run** —
missing paints across unfinished kits rolled up with how many kits each blocks, then bottles
marked low, split because they are different errands; and a **Wishlist** glance.

One new query (`listShopRunPaints`), no new tables and no migration — this phase is a
composition over existing cached reads, and shares their cache entries rather than adding
counts of its own. It is also the derived answer to the `shopping_list_item` table dropped after
Phase 2 (HISTORY.md): nothing to tick stale, nothing to keep in sync.

Deliberately read-only. Every module links into the screen that owns the thing; none of them
mutate, so there is no write path here to keep consistent with four other screens.

### Phase 7 — Kit research ✅
§5.1 stages B and C against a stash kit, narrowed to what only research can produce:
difficulty as a sourced consensus, and fit issues and tips each carrying the URL they came
from. A Research panel on `/kits/[id]`, below Manuals and Paints. **No build video and no
instructions link**, unlike §5.1's original sketch — the kit page already reaches YouTube and
Scalemates from `IdentityPanel`, and the uploaded manual is right there in the Manuals panel
(HISTORY.md). Optional enhancement — nothing else depends on it. HISTORY.md has the build account.

### Phase 8 — Build log
Per-kit dated journal by stage, photos to Blob, research and manual attached to the kit.
Deferred at the owner's request in favour of the Dashboard above, which took its nav slot;
to be detailed when we get there.

---

## 7. Rules from the build, and what's open

Every phase is shipped (§6 has the list), and the account of how — what each
one decided, what broke and why — is `docs/HISTORY.md`. This section keeps
what that account left behind: the rules it taught, which the rest of this
plan and the code's comments cite as "§7", and the items it left open.

### Rules

1. **Every failure returns a reason.** A paid call, an upload, an extraction:
   each failure path answers with a sentence the screen can show, never a bare
   `null`, `false` or a silent spinner, and logs one structured line per
   attempt. The shape is `Result` in `src/lib/result.ts`. Box art spent two
   review rounds stuck on "it didn't work" before this was a rule (HISTORY,
   Phases 1–6); an empty Anthropic balance had no error of its own until it
   got one (HISTORY, The Phase 6 sweep).
2. **A step that changes state reports what it changed.** `db:migrate` printed
   one hardcoded success line, and a skipped migration reached production
   behind it (HISTORY, Extraction reads five pages). Where a step can do
   nothing and still claim success it needs a verifier, as `db:verify` is for
   migrations; `AGENTS.md` carries this rule too.
3. **What a model returns is loose on the wire and coerced after.** A strict
   enum in a response schema threw away whole paid calls over one
   off-vocabulary word. Wire schemas take plain strings, and the normalisers in
   `src/domain` map them onto the vocabulary, defaulting rather than failing.
4. **§5.4 is enforced in one place.** No claim without a public source link
   ships, and that is checked in `normalizeResearch`, not remembered by each
   component, so any screen reading research rows inherits it.
5. **A public input is checked for what it is, not its shape.** A Server
   Action is a public endpoint: dates are validated by round trip
   (`2026-02-31` passes every shape test), our Blob store by the parsed
   hostname, not by a substring (HISTORY, The Phase 6 sweep).
6. **A column arrives in the commit that starts writing it.** Three sessions of
   "kept because a later phase might want it" left the schema with ten columns
   that described nothing (HISTORY, Extraction reads five pages).
7. **Before cutting a cost, find which end of the pipe the tokens are in.** The
   research bill was in the reading, not the writing; the proposed cut would
   have removed the source links and saved almost nothing. And the cheap fix
   and the expensive fix can be the same edit (HISTORY, And then it cost $1.60
   a kit).
8. **Measure what a screenshot can't show.** An 11px source link looked fine
   and was a 13px tap target (HISTORY, Phase 7 — what the spec didn't
   settle); the CSS budget, the type scale, unused code and
   the domain logic are all checked in CI for the same reason (`npm run
   perf:budget`, `lint:css`, `lint:dead`, `test`).

### Open

- **`paint_brand` and `paint_equivalent` are seeded and never read.** Every
  equivalence lookup goes through `src/catalogue/equivalents.ts` and its
  committed JSON. They are kept because `paint_equivalent.source` anticipates
  research-derived rows, which a compiled file can't hold; if nothing writes
  them, they should go (HISTORY, The Phase 6 sweep).
- **`/api/login` has no rate limiting**, and is the one route outside the
  session check. Fixing it needs somewhere to keep a counter (Vercel KV, a
  table, or the platform firewall), which is a decision rather than an edit.
- **`/wishlist` initial JS sits about 0.5 kB under its 150 kB budget.** The
  next feature on that screen hits it first, and `PERFORMANCE.md` §10's
  raise-or-split question will be about JavaScript rather than CSS when it
  does.
- **XF-83 and XF-84's swatches are estimates**, flagged in
  `scripts/build-catalogue.ts`; correct them by eye against a real bottle.

---

## 8. Non-goals

- **No native mobile app.** PWA covers it.
- **No dark theme.** The token structure in §4.1 supports one later as a values swap, but
  nothing in the build should assume or prepare for it.
- **No Supabase**, for the pause behaviour in §1.1 — not a worse product, just wrong for a
  bursty single-user app. Revisit if this ever goes multi-user.
- **No price tracking.** Would mean hand-entering prices or scraping shops that don't want it,
  and would bloat the screen that has to be fast in a shop. `purchased_from` stays a note.
- **No airbrush maintenance log.** No last-deep-clean tracking, no needle or O-ring history.
- **No spray-session logging or feedback loop.** The Thinner Bench states the rule; it does
  not learn from what you actually mixed. Both this and the line above were planned once and
  cut — see §2.3 for what remains of the rig.
- **No automatic manual downloading.** Users upload; research links (§4.3).
- **No two-way Google Sheets sync.** One-time import, then the app owns the data.
- **No runtime scraping** of Scalemates, Cybermodeler, or shops. Kit data is resolved through
  Claude and stored once (§2.4); box art is copied into Blob, never hotlinked.
- **No YouTube Data API.**
- **No queue, cron, or background worker.** The staged pipeline (§1.2, §5.1) removes the need.
- **No multi-user support, roles, or sharing.** One person, one passphrase.

---

## 9. Environment

### 9.1 What "the database" actually is here

Neon is Postgres, hosted, with a twist that matters for a Hobby-plan side project: it scales
to zero and wakes on the first query in roughly 300–800 ms, rather than staying billed and
running around the clock. That's why Neon was chosen over Supabase — Supabase's free tier
pauses after 7 days idle and needs a manual dashboard click to restore; Neon's autosuspend
and resume need nothing from you. Vercel Blob is separate: object storage for files — manual
PDFs, build photos — that don't belong in Postgres rows.

### 9.2 Your steps — about ten minutes, once

1. Import this repo into a new Vercel project.
2. Storage tab → add a Postgres database (Neon) → connect it to the project.
3. Storage tab → add a Blob store → connect it to the project. **Choose public access.**
   Box art and build photos are displayed in `<img>` tags straight from Blob's CDN, which
   needs a URL a browser can fetch on its own; a private store has no such URL — its objects
   are readable only by streaming them back through a function, which costs an invocation per
   image and gives up the CDN entirely. The store's access mode is fixed when it's created,
   so a private one has to be replaced rather than switched. Nothing here is secret: the
   filenames are random UUIDs, and the screen that lists them is behind the passphrase.
4. Environment Variables → add two secrets by hand:
   - `AUTH_SECRET` — 32 random bytes: `openssl rand -base64 32`.
   - `APP_PASSPHRASE` — whatever you want to type in to sign in.

`DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` come from steps 2–3 automatically — you never type
them. `ANTHROPIC_API_KEY` is a fifth variable, needed from Phase 3 onwards: that's when kit
search starts resolving queries through Claude (§5.1 stage A).

### 9.3 What I do

Schema and migrations live in `src/db/schema.ts` / `drizzle-kit`, wired to Neon's HTTP driver
(`drizzle-orm/neon-http` — no connection pool to configure; it's stateless HTTP per query).

> **Migrations do not run on deploy.** Nothing in CI (`.github/workflows/ci.yml`) or in the
> Vercel build applies them — `npm run db:migrate` is a manual step, run against the target
> database with its credentials pulled (`vercel env pull`). So **any phase that adds a column
> must be migrated before its deploy is usable**, and until it is, every screen reading that
> table fails: drizzle names every column explicitly in its `SELECT`, so one missing column
> takes down the whole query, and `BenchError` reports it as "The database didn't answer."
> Phase 4a shipped exactly that way — 0004 adds three columns, the preview deploy was still on
> 0003, and both `/kits` *and* `/wishlist` broke, since they share `listKitsByStatuses`.
> Diagnosing it cost a round trip that "run the migration" in the PR description would have
> saved. If a future phase wants this to be impossible rather than merely documented, the fix
> is a deploy step that runs the migrator, not more prose here.

`npm run db:migrate` applies pending migrations; `npm run db:seed` (`scripts/seed.mts`) loads
the committed catalogue and ratio rules into `paint` and `ratio_rule` and the initial paint
shelf into `inventory_item`, using credentials pulled locally via `vercel env pull`. The rig
is not seeded — it's compiled in (§2.3). Full script reference: `README.md`.

### 9.4 What I never need from you

I never need your connection string, a database password, or an API key typed into chat.
Every secret lives in Vercel's Environment Variables; I only ever reach it through
`vercel env pull` when running a script against the real database. If one ever ends up
pasted here anyway, rotate it.

### 9.5 Runbook — pulling a branch and applying its migrations

**Read this before testing any branch in preview.** A phase that adds a column does not work
until its migration is applied, and nothing applies it for you (§9.3). This is the whole
procedure; it is safe to run start to finish even when there is nothing pending, because every
migration in `drizzle/` is written to be replay-safe (`IF NOT EXISTS` throughout — re-running
one already applied prints "already exists, skipping" and changes nothing).

```bash
cd path/to/build-bench

# 0. Don't lose local work — if this prints anything, commit or stash it first.
git status

# 1. Sync main.
git checkout main
git pull origin main

# 2. Fetch and switch to the phase branch.
git fetch origin
git checkout claude/phase-4a-build-bench-stash-uv8ohp   # ← the branch from the PR
git pull

# 3. Dependencies, in case the branch changed them.
npm install

# 4. Pull the real credentials (writes .env.local — gitignored, never commit it).
#    Needs the Vercel CLI: npm i -g vercel, then `vercel link` once in this repo.
vercel env pull .env.local

# 5. Apply any pending migrations to the database those credentials point at.
npm run db:migrate

# 5a. Check that step 5 actually did what it said. `db:migrate` prints
#     "Migrations applied." whether it applied eight migrations or none, so
#     this is the step that answers "did it work?" — see the note below on
#     what it catches. Read-only; safe against production.
npm run db:verify

# 5.5. Re-run the seed when a phase changed seeded *data* rather than only
#      schema — in practice, when `paint` gains codes the app needs to
#      reference. Safe to run even when nothing changed: every table it
#      touches upserts or is scoped by `source`, never blind-appends (see the
#      file's own top-of-file comment for how each is kept re-run-safe).
#      Note this is *not* what makes a phase's screens work: everything
#      compiled from `seed/*.json` (the catalogue, ratio rules, the
#      equivalence chart, the rig) is read straight off the committed file at
#      build time, §3.1. Phase 5 was described here as needing the seed to
#      populate paint_brand and paint_equivalent — those rows are real, but
#      nothing in the app queries them; the "Also sold as" card and the
#      Unresolved bucket both read `src/catalogue/equivalents.ts`. Corrected
#      in the Phase 6 sweep (HISTORY.md).
npm run db:seed

# 6. Run it.
npm run dev
```

Step 5 prints `Migrations applied.` It applies whatever the database is missing, so a database
already up to date is a no-op. One database backs development, preview and production here
(§9.2 connects a single Neon instance to the project), so this one run covers all three — and,
by the same token, it is the *shared* schema being changed, which is why every migration is
additive and none drops a column another deploy might still be reading.

**Why step 5a exists: `Migrations applied.` is not evidence.** drizzle's migrator decides what
to run with one comparison — `max(created_at)` already in the database against each journal
entry's `when` — and it reads that maximum *once*, before the loop. It keeps no record of which
migrations ran individually. So a journal entry whose `when` is *older* than something already
recorded is skipped in silence, and stays skipped on every future run, because the maximum only
ever climbs. The success line prints regardless.

That is not hypothetical: `0007_drop_dead_columns` shipped with a `when` three and a half hours
*behind* `0006`, because 0006's timestamp had been set by hand to sit above main's `0005` after
a numbering collision, and 0007 kept whatever `db:generate` gave it. On a database that had
already recorded 0005, 0007 was skipped and could never have been applied. Corrected by raising
0007's `when` in `drizzle/meta/_journal.json`; safe to do because the migrator never re-reads
the hash it stored, and because 0007 is replay-safe, so a database that *had* applied it simply
applies it again to no effect. `db:verify` now names this condition explicitly ("STRANDED") and
tells you which number to raise the timestamp above.

The lesson generalises past this one bug: **a migration's `when` must be greater than every
`when` before it in the journal.** Nothing enforces that — not `db:generate`, which stamps the
current clock and so gets it right only by accident, and not the migrator, which treats the
violation as an instruction rather than an error. Any time a migration is renumbered or a
journal is merged by hand, check the ordering.

**The migration ledger.** What exists, and what each one is needed by:

| Migration | Adds | Needed by |
|---|---|---|
| `0000_init` | the whole schema | Phase 0 |
| `0001_drop_inventory_location` | drops `inventory_item.location` | Phase 2 |
| `0002_drop_airbrush_and_shopping` | drops four tables, retypes `purchased_from` | Phase 2 |
| `0003_wishlist_and_stash` | `wishlist_item`; `kit.category`/`scalemates_url`/`image_url` | Phase 3 |
| `0004_kit_status_dates_and_manual_label` | `kit.started_at`/`completed_at`, `kit_manual.label` | Phase 4a |
| `0005_paints_drop_open_state` | moves every `inventory_item.state = 'open'` row to unset | Paints "Open" state removal |
| `0006_kit_research_tips` | `kit_research.tips`, plus a `kit_id` index on `kit_research` and `research_job` | Phase 7 |
| `0007_drop_dead_columns` | drops `paint_brand`, `paint_equivalent` and ten unread columns; adds `kit_manual.paint_chart_found` | Phase 7 cleanup |
| `0008_dismiss_paint_requirement` | `kit_paint_requirement.dismissed_at` | Dismissing an unresolved callout |

**Phase 5 added no migration** — `paint_brand` and `paint_equivalent` have existed since
`0000_init` and were simply empty. What it needs instead is exactly step 5.5 above: a re-seed,
not a migration. Skipping it doesn't 500 anything (unlike a missing column) — it just means
every foreign-brand paint code keeps landing in Unresolved as if this phase had never shipped,
which is a much quieter failure to notice than a crashed screen. Called out here because
"forgot the one-time step nobody told me about" is exactly the mistake this section exists to
prevent, and a re-seed is that mistake's data-side twin, not covered by the migration ledger
above at all.

**A phase that adds a migration or needs a re-seed says so in its PR description, in the steps
to test it.** That is the rule this file exists to record, because it has now been broken twice
on the migration side — the branch looked fine, the deploy 500'd on a missing column, and the
reason was a step nobody had been told about. If a future phase wants the whole class of
mistake gone rather than documented, add a `vercel-build` script that runs the migrator (and,
per this phase, the seed too) before `next build`: Vercel prefers that script when present
while CI keeps calling `npm run build` directly, so the build stays database-free where it has
to be (§5 in PERFORMANCE.md) and migrates/seeds where it can.
