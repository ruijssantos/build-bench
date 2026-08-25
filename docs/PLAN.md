# The Build Bench — Architecture

A companion app for 1:24 scale model car building, centred on a Tamiya 74540 HG Trigger
airbrush workflow and pre-build kit research.

**Status:** Phases 0–2 shipped (foundations, Thinner Bench, paint inventory). Phase 3
(cross-brand equivalence) is next. This file is the standing architecture and technical
approach — how the app is hosted, how data and screens are structured, and the rules any new
phase builds against. It is not a decision log; for that, `git log docs/PLAN.md`.

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
| Visual design | Warm cream, one accent, tonal livery, Barlow Condensed display — §4.1 |
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

Two pieces of reference data don't come from a live API and won't ever need to: the Tamiya
paint catalogue (shipped, §2.2) and its cross-brand equivalents (Phase 3, not yet built).
Both follow the same shape — generated once, committed, verified in CI — covered generically
in §4's "Reference data rule" and in `PERFORMANCE.md` §2. This section has only the
domain-specific facts a future phase needs that live nowhere else.

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
Mig, Hataka, Lifecolor and Mission Models.

- **Direction.** The chart maps Tamiya → other brands. The real question runs the other way —
  a non-Tamiya kit calls for H12, what Tamiya code do you reach for? `paint_equivalent` is
  indexed both ways (§3.1); the UI leads with foreign → Tamiya.
- **Display order** (a call made once, revisit whenever): Gunze/Mr. Hobby, Revell, Vallejo,
  AMMO, Testors, LifeColor, XtraColour, Hataka, Mission Models. Gunze first because Japanese
  car kits (Fujimi, Aoshima, Hasegawa) call Mr. Color throughout; Revell second because
  Revell car kits are common in European shops. Stored as `sort` on `paint_brand` (§3.1), so
  it's a data change, not a code change.
- **Import once, at build time**, same pattern as the paint catalogue — `equivalents.json`,
  committed, never scraped at runtime. The Cybermodeler page was unreachable from the
  planning sandbox that first drafted this, so its exact table markup is unverified; expect
  one adjustment pass against the real HTML when building the import script.
- Where the chart has no row, fall back to a Claude lookup, written with
  `source = 'claude-research'` and a lower `match_quality` so it stays visibly distinct from
  chart-sourced data.

### 2.3 Single-rig, and the cheap hedge

The app is built for the Tamiya 74540 HG Trigger alone. Every ratio, pressure and distance is
stated for a 0.3 mm needle, a 7 cc fixed cup and retarder thinner, and `ratio_rule` gets no
rig dimension. A second airbrush (a Harder & Steenbeck Ultra, currently unused) is owned but
out of scope — noted only because it justifies one standing discipline: **rig facts are read
from the `airbrush` row, never hard-coded into copy.** If a second rig ever joins, that's a
new row and a review of the ratio windows, not a hunt through JSX for a model name.

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
  INDEX (brand, foreign_code)      -- foreign → Tamiya, the lookup that's actually made
  INDEX (tamiya_code)              -- Tamiya → foreign

vendor
  id, name, country, url, notes, sort
```

`vendor` seeds with Scalemates (research), Spot Model, KitMania (PT), Hobby Sector (PT),
Super Hobby (PT), El Taller del Modelista (ES). No pricing — see §8.

### 3.2 User data — read/write

```
inventory_item                     -- the paint shelf
  id              serial PK
  paint_code      text FK paint
  form            text             -- bottle | spray_can | decanted_jar
  decanted_from   text NULL FK     -- TS-8 can → decanted jar, keeps the lineage
  state           text             -- open | low (unset reads as "In Stock")
  quantity        integer
  purchased_from  integer NULL FK vendor
  purchased_at    date
  notes           text
  updated_at      timestamptz

kit                                -- the stash
  id              serial PK
  brand, kit_number, name, scale
  status          text             -- wishlist | owned | in_progress | built | shelved
  purchased_from  integer NULL FK vendor
  purchased_price numeric, currency text, purchased_at date
  notes           text
  created_at      timestamptz

kit_manual                         -- user-uploaded, §4.3 — never auto-downloaded
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

shopping_list_item                 -- persisted so it can be ticked off
  id              serial PK
  paint_code      text FK paint
  kit_id          integer NULL FK
  reason          text
  substitute_for  text NULL        -- set when this is a cross-brand equivalent
  status          text             -- needed | ordered | bought | skipped
  vendor_id       integer NULL FK  -- a note, not a price
  added_at        timestamptz

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

airbrush                           -- one row today: the 74540. §2.3
  id              serial PK
  model           text             -- "Tamiya 74540 HG Trigger"
  nozzle_mm       real             -- 0.3
  cup_cc          real             -- 7
  is_active       boolean
  acquired_at     date

maintenance_log
  id              serial PK
  airbrush_id     integer FK
  type            text             -- session_flush | deep_clean | needle_replace |
                                   -- oring_replace | lube | repair
  performed_on    date
  notes, parts_used text

spray_session                      -- closes the loop, §3.3
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

### 3.3 Why `spray_session` exists before anything reads it

It's the table that closes a loop across three otherwise-separate features: log what was
actually mixed and how it turned out, and the Thinner Bench can surface "last three times you
sprayed this you went wetter than the rule" next to the starting ratio, offering to promote
that into a `ratio_override`. It also feeds `maintenance_log` (sessions since last deep
clean) and `build_log_entry` (what was sprayed on which kit, dated). Modelled now so nothing
needs reshaping when Phase 8 builds against it.

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
├── seed/                           ← generated + committed, loaded by scripts/seed.mts
│   ├── paints.tamiya.json
│   ├── ratio-rules.json
│   ├── inventory.initial.json
│   └── equivalents.json, brands.json, vendors.json   ← Phase 3+
├── scripts/
│   ├── build-catalogue.ts          ← generates seed/paints.tamiya.json, §2.2
│   ├── verify-catalogue.ts         ← runs in CI, fails the build on a missing code
│   ├── migrate.mts  ·  seed.mts
│   └── check-perf-budget.ts        ← runs in CI after `next build`, PERFORMANCE.md §10
├── src/
│   ├── app/
│   │   ├── (bench)/                ← the authenticated app shell (nav rail + tab bar)
│   │   │   ├── layout.tsx
│   │   │   ├── thinner/            ← feature 1, page.tsx + actions.ts
│   │   │   ├── inventory/          ← feature 4a, page.tsx + actions.ts
│   │   │   ├── kits/                ← feature 4b (Phase 4)
│   │   │   ├── shopping/           ← feature 3 (Phase 5)
│   │   │   ├── log/                ← feature 5 (Phase 7)
│   │   │   └── airbrush/           ← feature 6 (Phase 8)
│   │   ├── api/                    ← only where a Server Action doesn't fit (search,
│   │   │                             external callbacks, kit research's staged calls)
│   │   ├── login/  ·  page.tsx  ·  layout.tsx  ·  manifest.ts
│   ├── catalogue/                  ← reference data compiled into the build, not queried —
│   │                                 see "Reference data rule" below and PERFORMANCE.md §2
│   ├── components/                 ← one folder per feature (thinner/, inventory/, ...),
│   │                                 plus bench/ for shared chrome and nav/ for the shell
│   ├── db/
│   │   ├── schema.ts  ·  client.ts        ← Neon serverless driver
│   │   └── repositories/                  ← only truly runtime-mutable tables: airbrush,
│   │                                         inventory, ratio-overrides, and their future
│   │                                         siblings. Reference tables live in catalogue/.
│   ├── domain/                     ← pure functions: ratio.ts, paint-code.ts,
│   │                                 paint-search.ts, inventory.ts, and their future
│   │                                 siblings (equivalence.ts, shopping.ts, ...)
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
(`paint`, `ratio_rule`, and Phase 3's `paint_equivalent`) stay: they're the seed target and
the foreign key every user-owned row hangs off. Only the *read* path for identity moves.
This is what lets a screen prerender, keeps type-ahead off the network, and keeps `next
build` from needing a database — the full reasoning is `PERFORMANCE.md` §2. Any phase adding
its own generated-and-committed reference data (Phase 3's `equivalents.json`, Phase 5's
`vendors.json`) follows the same shape.

### 4.1 Design system

Reference canvas (mockups for the screens built so far, and the rejected visual directions):
<https://claude.ai/code/artifact/9081aef8-94df-49d5-9ec9-d72df184865e>

Clean product UI (Apple / Airbnb / Revolut as reference points) carrying a classic-car
palette, rather than imitating a dashboard.

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
low). Nothing is coloured for decoration; the livery is a tonal neutral. That leaves **paint
swatches as the only saturated colour on screen**, from `paint.hex` — content, not chrome.
Adding a fourth chrome colour breaks this; don't.

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

Rules for every module, regardless of screen:

- **Module title** is the same treatment whatever the module's physical size — a four-across
  spec tile gets the identical title style as a full-width notes card. Don't shrink it to
  "fit"; if a title truncates, the layout is too narrow (the width floor under *Geometry*),
  not the type.
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

Barlow Condensed carries the app's automotive voice through type, not ornament — which is
why it works on screens (Paints, Shopping) that have nothing to do with instruments.

#### Geometry

- **Spacing:** 4px scale. Screen gutter 20px phone / 40px desktop.
- **Desktop content width:** bounded at both ends — `max-width: 1600px` (centred) so an
  ultra-wide window doesn't strand content in empty page, `min-width: 1100px` so a narrow
  desktop window never squeezes module titles into truncating. Below the floor the content
  area scrolls horizontally. Both bounds apply above the 900px breakpoint only; phone is
  fluid.
- **Radii:** card 20 (22 desktop) · tile, input 14 · chip 6–12 · pill 999.
- **Borders:** 1px `--line`. Hairlines do the separating.
- **Elevation:** exactly one shadow in the whole app, on the hero card —
  `0 1px 2px rgba(28,26,23,.04), 0 10px 28px rgba(28,26,23,.045)`. Everything else is a
  hairline. Don't add a second elevation level.
- **Touch targets:** ≥44px everywhere; tab-bar items 52px.
- **Tab bar:** 84px tall, hairline top, 5 items, active in `--accent`.
- **Left rail:** 260px, items 44px, active state is an `--accent-tint` pill at radius 12.
- **Status bar:** leave the top 44px of a phone layout empty. Never draw fake chrome.

#### Livery

The one decorative element, and it costs no colour:

- **Header sweep** — `rotate(-21deg)`, two bars 26px and 10px with a 6px gap, filled
  `--livery`, bleeding off the top-right of the header (`overflow: hidden`).
- **Card echo** — a 4px strip on the hero card's top edge: 44px bar, 9px gap, 17px bar,
  filled `--livery` on a `--card-sunken` ground — this is what makes it read as a system
  rather than a header flourish.
- On `--card` surfaces (the desktop rail) use `--livery-card` instead, one step lighter.
- The livery never uses `--accent`.

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

Mechanically: drag-drop or file-pick → `PUT` to Vercel Blob → `kit_manual` row. Viewed inline
on desktop, downloadable on phone. An **Extract paint list** action sends the stored PDF to
Claude as a base64 document block and writes `kit_paint_requirement` rows, feeding the
shopping list. Kit research still *reports* a manual URL when it finds one, as a link — it
never fetches it.

---

## 5. Kit research pipeline design

Design for Phase 6, not yet built. Three findings that shaped it:

1. **Scalemates is bot-hostile.** Best kit database on the web, doesn't want scrapers.
2. **"Difficulty and fit-issue notes from reviews and forums" is a synthesis job.** No API
   returns it; it's prose scattered across build threads and review blogs — exactly what an
   LLM with web search is for.
3. **No YouTube Data API needed.** ~100 free searches/day, plus a key and quota to manage.
   Claude's web search finds the build video in the same call.

With manuals uploaded by the user (§4.3), this feature's job narrows to: difficulty, fit
issues, and a build video. It's no longer the pipe paint lists arrive through.

### 5.1 The staged pipeline

Three stages, each its own HTTP request with its own 300s budget (§1.2), state accumulating
in `research_job`.

```
  "24345" or "Tamiya Nissan GT-R"
        │
   [A] /api/research/resolve          ~10–20 s
        │   Claude, effort medium, web_search max_uses 2
        │   → { brand, kit_number, name, scale, year }
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

**Why staged.** No invocation nears 300s; a failure retries one stage instead of re-paying
for the whole job; the UI gets a real three-step progress indicator. Stage B is the one to
watch — if it approaches the ceiling, drop `max_uses` or split "find sources" from "read
sources."

**Why two passes.** Structured outputs (`output_config.format`) are incompatible with
citations, and citations are what make the output trustworthy — a source URL next to every
claim. Splitting cited free-form research from cheap typed extraction gets both.

### 5.2 API shapes to use

Verified against current API documentation, not recalled:

- Model `claude-opus-5`; thinking `{ type: "adaptive" }` — `budget_tokens` is rejected with a
  400 on this model
- Effort via `output_config: { effort: "medium" | "high" }`
- Web tools `web_search_20260209` / `web_fetch_20260209` (dynamic-filtering variants). Don't
  additionally declare `code_execution` — these run it internally
- Stage B streams; use `.finalMessage()`
- Handle `stop_reason: "pause_turn"` — a long server-tool turn can pause, and an unhandled
  pause returns a silently truncated answer with no error raised
- Server-tool errors return HTTP 200 with an error object in the result block, not an
  exception. On web search a success `content` is an array, an error `content` is an object
  — branch before indexing
- Stage C: `client.messages.parse()` with `zodOutputFormat(KitResearchSchema)`;
  `parsed_output` is null on failure, guard it
- Manual paint extraction (§4.3) uses a base64 `document` block — no beta header needed

### 5.3 Cost

Roughly €0.20–0.45 per newly researched kit (Opus 5 at $5/$25 per MTok; search results
dominate input tokens). Cached in `kit_research`, re-run only on an explicit Refresh. Every
call records its own token counts.

### 5.4 Trust

Research output is synthesised from forum posts by a language model:

- Every fit issue stores `source_url` and `confidence`; the UI renders the source as a link
  next to the claim. No unsourced assertion appears as fact.
- Difficulty shows as "consensus from N sources," never a bare rating.
- A **Verify** action sets `verified_by_me`; verified rows visually outrank unverified.

---

## 6. Build phases

Uploading manuals (§4.3) changed this order: the shopping list needs either a hand-typed
paint list or the whole research pipeline to exist — an uploaded PDF feeds it directly, so
**shopping ships before research**, and research is an optional enhancement rather than a
blocking dependency.

### Phase 0 — Foundations ✅
Next.js scaffold, Neon + Blob via Vercel, Drizzle schema and first migration, cookie auth,
`tokens.css`, PWA manifest, CI.

### Phase 1 — Thinner Bench *(feature 1)* ✅
The full Tamiya catalogue with generation and CI verification. Paint lookup, family ratio
rules, cup-fill visualiser, `ratio_override` editing, the 74540 dry-tip panel.

### Phase 2 — Paint inventory *(feature 4a)* ✅
The paint shelf: CRUD over form/state (`open`/`low`), sortable table, one-tap running low,
"do I own this?" on the Thinner Bench card.

### Phase 3 — Cross-brand equivalence
Cybermodeler import (§2.2), `paint_equivalent`, foreign → Tamiya lookup. Self-contained.

### Phase 4 — Kit stash + manual upload & viewer *(feature 4b + §4.3)*
Kit CRUD (wishlist / owned / in-progress / built). PDF upload to Blob, desktop viewer,
**Extract paint list** → `kit_paint_requirement`.

### Phase 5 — Paint shopping *(feature 3)*
Requirements → inventory → buy list, with Phase 3's equivalents as substitutes. Persisted,
ordered/bought status. Input from Phase 4's extraction, with hand-entry as fallback.

### Phase 6 — Kit research *(feature 2)*
The staged pipeline in §5: difficulty, fit issues with sources, build video, manual link.

### Phase 7 — Build log *(feature 5)*
Per-kit dated journal by stage, photos to Blob, research and manual attached to the kit.

### Phase 8 — Airbrush maintenance & the feedback loop *(feature 6)*
`maintenance_log` against the 74540. One-tap `spray_session` logging from the Thinner Bench.
"Your last three XF-64 mixes" next to the starting ratio, promotable into a `ratio_override`.

---

## 7. Status detail

Phase 1's catalogue script caught the XF-83/XF-84 gap the original prototype missed,
confirming both codes and names by search; their hex values are still unverified estimates,
flagged as such in `scripts/build-catalogue.ts`'s own comments — fix by eye against a real
bottle whenever convenient, no phase attached. Phase 2 shipped with three deviations from the
original one-line spec, all made during review: `inventory_item.location` was dropped
entirely (a real migration, not just UI); `state` trimmed to two values (`open`/`low`, unset
reads as "In Stock"); the Paints screen carries no "recently sprayed" module — `spray_session`
stays in the schema for Phase 8, nothing on this screen reads it yet.

---

## 8. Non-goals

- **No native mobile app.** PWA covers it.
- **No dark theme.** The token structure in §4.1 supports one later as a values swap, but
  nothing in the build should assume or prepare for it.
- **No Supabase**, for the pause behaviour in §1.1 — not a worse product, just wrong for a
  bursty single-user app. Revisit if this ever goes multi-user.
- **No vendor price tracking.** Would mean hand-entering prices or scraping shops that don't
  want it, and would bloat the screen that has to be fast in a shop. `vendor_id` stays a note.
- **No automatic manual downloading.** Users upload; research links (§4.3).
- **No two-way Google Sheets sync.** One-time import, then the app owns the data.
- **No runtime scraping** of Scalemates, Cybermodeler, or shops.
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
3. Storage tab → add a Blob store → connect it to the project.
4. Environment Variables → add two secrets by hand:
   - `AUTH_SECRET` — 32 random bytes: `openssl rand -base64 32`.
   - `APP_PASSPHRASE` — whatever you want to type in to sign in.

`DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` come from steps 2–3 automatically — you never type
them. `ANTHROPIC_API_KEY` is a fifth variable, needed only once Phase 6 (kit research) lands.

### 9.3 What I do

Schema and migrations live in `src/db/schema.ts` / `drizzle-kit`, wired to Neon's HTTP driver
(`drizzle-orm/neon-http` — no connection pool to configure; it's stateless HTTP per query).
`npm run db:migrate` applies pending migrations; `npm run db:seed` (`scripts/seed.mts`) loads
the committed catalogue and ratio rules into `paint` and `ratio_rule`, plus the single
`airbrush` row (§2.3), using credentials pulled locally via `vercel env pull`. Full script
reference: `README.md`.

### 9.4 What I never need from you

I never need your connection string, a database password, or an API key typed into chat.
Every secret lives in Vercel's Environment Variables; I only ever reach it through
`vercel env pull` when running a script against the real database. If one ever ends up
pasted here anyway, rotate it.
