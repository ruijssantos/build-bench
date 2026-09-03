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
  indexed both ways (§3.1); resolution (§7, Phase 5) leads with foreign → Tamiya.
- **Display order** (a call made once, revisit whenever): Gunze/Mr. Hobby, Revell, Vallejo,
  AMMO, Testors, LifeColor, XtraColour, Hataka, Mission Models, Mr. Paint. Gunze first because
  Japanese car kits (Fujimi, Aoshima, Hasegawa) call Mr. Color throughout; Revell second
  because Revell car kits are common in European shops. Stored as `sort` on `paint_brand`
  (§3.1), so it's a data change, not a code change.
- **Import once, at build time**, same pattern as the paint catalogue — `equivalents.json`,
  committed, never scraped at runtime. The Cybermodeler page turned out to be unreachable at
  build time too (blocked from both the planning sandbox and the one that built this phase),
  so the import ran against a PDF export of the page instead of live HTML — see §7 for exactly
  how, and for what that source does and doesn't cover.
- Where the chart has no row, fall back to a Claude lookup, written with
  `source = 'claude-research'` and a lower `match_quality` so it stays visibly distinct from
  chart-sourced data. **Not built in Phase 5** — every code the chart doesn't carry still lands
  in Unresolved, same as before this phase. See §7.

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
  state           text             -- open | low (unset reads as "In Stock")
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
| Section title | Display 700 · 20px phone / 22px desktop · uppercase · ls .02em · `--ink` |
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
- **Touch targets:** ≥44px everywhere; tab-bar items 44px.
- **Tab bar:** 60px tall, hairline top, 6 items (5 routes + sign out), active in `--accent`.
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

Mechanically: drag-drop or file-pick → `PUT` to Vercel Blob → `kit_manual` row. "Open" links
straight to the stored PDF — the browser's own viewer, in a new tab, phone and desktop alike;
an earlier desktop-only inline `<iframe>` toggle duplicated that for no real benefit and was
removed (§7 round 5). An **Extract paint list** action uploads the stored PDF to Claude through
the Files API and writes `kit_paint_requirement` rows, feeding the shopping list. Kit research
still *reports* a manual URL when it finds one, as a link — it never fetches it.

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
- Server-tool errors return HTTP 200 with an error object in the result block, not an
  exception. On web search a success `content` is an array, an error `content` is an object
  — branch before indexing
- Stage C: `client.messages.parse()` with `zodOutputFormat(KitResearchSchema)`;
  `parsed_output` is null on failure, guard it
- Manual paint extraction (§4.3) uses the Files API — `client.files.upload` then a `document`
  block referencing `file_id`, no beta header needed either way (§7 round 5: base64 inlining was
  the original approach and got replaced once it turned out to cap what could be extracted well
  below what could be stored)

### 5.3 Cost

Two different costs, an order of magnitude apart, because they're different jobs on different
models:

- **Stage A (Phase 3, every kit search).** ~5K input tokens (search snippets, tool overhead)
  and ~1–1.5K output tokens (a short candidate list plus some thinking) on Sonnet 5 ($2/$10
  per MTok) comes to roughly **$0.02–0.05 per search**. Not cached — every search is a fresh
  call, since the query itself changes each time.
- **Stages B+C (Phase 6, per kit researched).** Roughly **€0.20–0.45 per newly researched
  kit** (Opus 5 at $5/$25 per MTok; search results dominate input tokens, and stage B's long
  cited synthesis dominates output). Cached in `kit_research`, re-run only on an explicit
  Refresh.

Every call records its own token counts regardless of stage. At personal-hobby volumes —
searching a handful of kits a week, plus retries for typos — stage A alone is pocket change;
even a month of active kit research through stages B/C stays well under what the Vercel and
Neon bills already are.

**Billed to your own Anthropic account**, pay-as-you-go, through the `ANTHROPIC_API_KEY` set
in Vercel's env vars (§9.2) — the app has no billing of its own, no markup, no bundling.

### 5.4 Trust

Research output is synthesised from forum posts by a language model:

- Every fit issue stores `source_url` and `confidence`; the UI renders the source as a link
  next to the claim. No unsourced assertion appears as fact.
- Difficulty shows as "consensus from N sources," never a bare rating.
- A **Verify** action sets `verified_by_me`; verified rows visually outrank unverified.

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
The paint shelf: CRUD over form/state (`open`/`low`), sortable table, one-tap running low,
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
shelf. The per-kit bucket view is one targeted query; the Stash grid's "14 of 17 · 3 to buy"
line on every card comes from one aggregate query across every stashed kit, not N+1.

Manual upload does what §4.3 originally hoped for and Phase 3's photo upload couldn't:
client-direct upload via `@vercel/blob/client`'s `upload()` against a token route
(`/api/kits/manuals/upload-token`), because the private-store misdiagnosis that killed the
first attempt (§7, Phase 3) is fixed. A `kit_manual` row is written by a Server Action the
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
this phase closes, without re-running extraction on a single manual. §7 has the build
account: what shipped, what the data actually covers, and what's still open. The reverse
direction — one Tamiya code to every brand that sells a match — surfaced later as the Thinner
Bench's "Also sold as" card (§7), the chart's first UI.

### Phase 6 — Dashboard ✅
`/dashboard`, and the screen the app now opens on (`/` redirects here; the Build Log's nav
slot became this one, so the phone tab bar still holds five items plus Sign out). Five
read-only modules over data Phases 2–5 already store, each behind its own `<Suspense>` inside
its own `<BenchError>`: four linked stat tiles (shelf size, running low, stash, wishlist);
**On the bench** — every `building` kit as a full card with its readiness line and start date;
**What you could start** — stashed kits whose every called-for paint is already owned, which
is the module that makes this screen a decision rather than a readout; **Next shop run** —
missing paints across unfinished kits rolled up with how many kits each blocks, then bottles
marked low, split because they are different errands; and a **Wishlist** glance.

One new query (`listShopRunPaints`), no new tables and no migration — this phase is a
composition over existing cached reads, and shares their cache entries rather than adding
counts of its own. It is also the derived answer to the `shopping_list_item` table dropped in
§7: nothing to tick stale, nothing to keep in sync.

Deliberately read-only. Every module links into the screen that owns the thing; none of them
mutate, so there is no write path here to keep consistent with four other screens.

### Phase 7 — Kit research ✅
§5.1 stages B and C against a stash kit: difficulty as a sourced consensus, fit issues and
tips each carrying the URL they came from, a build video and a link to the instructions
online. A Research panel on `/kits/[id]`, below Manuals and Paints. Optional enhancement —
nothing else depends on it, and a kit with no research shows the panel's empty state plus the
free YouTube search that has been there since Phase 4a. §7 has the build account.

### Phase 8 — Build log
Per-kit dated journal by stage, photos to Blob, research and manual attached to the kit.
Deferred at the owner's request in favour of the Dashboard above, which took its nav slot;
to be detailed when we get there.

---

## 7. Status detail

Phase 1's catalogue script caught the XF-83/XF-84 gap the original prototype missed,
confirming both codes and names by search; their hex values are still unverified estimates,
flagged as such in `scripts/build-catalogue.ts`'s own comments — fix by eye against a real
bottle whenever convenient, no phase attached. Phase 2 shipped with two deviations from the
original one-line spec, both made during review: `inventory_item.location` was dropped
entirely (a real migration, not just UI), and `state` was trimmed to two values
(`open`/`low`, unset reads as "In Stock").

After Phase 2, the airbrush feature was cut (§8) and the plan re-cut around the wishlist and
the stash. That removed four tables — `airbrush`, `maintenance_log`, `spray_session`,
`shopping_list_item` — plus `vendor`, and moved the rig to a committed file (§2.3).

Phase 3 shipped with a few calls the one-line spec didn't settle, made during the build:
`candidates` is capped at 10, not the 5 §5.1 originally specified — this phase's brief asked
for up to 10 explicitly, so the schema, the route and this doc all moved together. Saved kits
get a Remove action, not just Other items — not in the original spec, but the same one-tap
pattern as everywhere else a mistaken add needs undoing, and a kit hasn't graduated to the
stash yet so nothing else references the row. A wishlist kit's "mark bought" is one-directional
(`status: wishlist → stash`, §3.3) with no undo from this screen — buying a kit is a real event,
and the row it lands on is exactly where Phase 4 picks it up; an Other item's tick goes both
ways instead, since a tool has no ownership record to move to. Other items shipped with no Edit
dialog on the reasoning that three fields (title, URL, notes) were all one tap away from
"remove and re-add," so a fourth interaction pattern for the same three inputs didn't earn its
place — reversed on request once the screen was in real use: re-typing three fields to fix a
typo reads as friction in practice, not restraint, so `EditWishlistItemDialog` exists after all,
same shape as the kit-editing dialog Phase 3 already added for the same reason.

Phase 3 also turned up a migration bug predating it: `0002_drop_airbrush_and_shopping` dropped
`vendor` with `CASCADE` — which takes the foreign keys pointing at it along with it — and then
tried to drop those same constraints by name, so it failed on every database it was ever run
against. Nothing after 0001 had actually been applied anywhere, which is why the first real
wishlist deploy came up with no `wishlist_item` table. Compounding it, drizzle's migrator writes
its bookkeeping rows only after every pending migration has run, and Neon's HTTP driver has no
transactions (§9.3), so the failure left *nothing* recorded and the next run replayed the
already-applied half. 0001–0003 are now written replay-safe (`IF EXISTS` / `IF NOT EXISTS`
throughout, an explicit `USING` on the one type change); the reasoning and the rule for future
migrations are in `scripts/migrate.mts`. Editing them rather than adding a 0004 is safe because
the migrator selects by the journal's timestamp and never compares the hash it stored.

Box art needed rethinking after the first production run. §2.4 assumed stage A would return a
direct image URL to copy into Blob; it almost never can — a web search reads page text and
links, not image files, so the honest answer is usually `null` and every card rendered the
fallback glyph. The kit's *page* is the thing a search does reliably find, and essentially every
retailer and reference page declares an `og:image`: a real, direct, CDN-hosted URL that exists to
be embedded elsewhere. `saveBoxArt` now reads that (`resolveBoxArtUrl`, single-hop, same SSRF
checks on the extracted URL as on the original), the resolve route runs it across all candidates
in parallel so search results show art before you save, and `scalematesUrl` is the fallback
source everywhere `imageUrl` is absent — which also means a hand-entered kit gets art from
nothing but a pasted link. The prompt was rewritten to match: the model is told to spend its
effort on a good page URL and that a null `imageUrl` is expected, rather than being nudged toward
guessing image links.

Photo upload dropped Vercel Blob's client-upload pattern for a plain route handler that does a
server-side `put`. The client pattern is built for large files — the browser PUTs straight to
Vercel's API with a short-lived token — but that request is cross-origin, and in practice it came
back 400 with no `Access-Control-Allow-Origin`, so the browser surfaced an opaque CORS failure
with nothing readable underneath and the dialog hung on "Saving…". Since every photo is resized
to a card thumbnail in the browser first, what actually needed uploading was a few hundred kB;
streaming that through a function costs nothing, keeps the whole exchange same-origin, and drops
`@vercel/blob/client` out of the browser bundle entirely.

Both of the above shipped and neither actually fixed anything, because the real fault sat one
layer under both diagnoses. Every failure path in `saveBoxArt` returned `null` — a 403, a page
with no `og:image`, and a link never fetched were indistinguishable — so there was nothing to
debug from and two rounds went out on reasoning alone. Fixing that (every step returns a `reason`
instead of `null`, one structured `[box-art]` log line per attempt, an explicit "Fetch from link"
in the Edit dialog that runs synchronously and shows the result) is what finally produced a fact:
Scalemates returns HTTP 403 to every server-side request. `resolveBoxArtUrl` now skips it outright
— no request made — rather than spending a request and a timeout finding that out per candidate,
per search; it stays the kit's *link*, just not an art source. The upload's own error
(`describeBlobError`, mapping the SDK's typed exceptions to a message that names the fix) then
surfaced the actual root cause of *both* failures: the Blob store had been created with private
access, and every `put()` call here asks for `access: "public"` — box art is served straight to
`<img>` tags off Blob's CDN, and a private store has no URL a browser can fetch. That is a
dashboard setting, not a code bug; §9.2 now says to choose public when creating the store, since
the mode can't be changed after the fact. A pasted image address (with its own "Fetch" button,
same synchronous-and-visible shape) is the fallback for a link that won't cooperate no matter what
the store is — Scalemates chief among them.

Two more, both found in review rather than decided up front. `confidence` is listed on stage A's
candidate payload in §5.1 and is **not** implemented: the screen ranks candidates by the order
they come back in and shows no score, so the field would have been collected and never rendered.
Add it in Phase 6 if stage B's trust surface (§5.4) turns out to want it. And the wire schema the
resolve route validates against is deliberately looser than §5.1's shape — `zodOutputFormat` sends
neither the category enum nor the candidate cap to the API (both are demoted to prose), so both are
enforced by coercion after the fact rather than by rejecting the response; a strict schema threw
away whole paid searches over one off-vocabulary word.

Phase 4a's first commit to a dynamic route (`/kits/[id]`) surfaced a real gap in the shared
`(bench)` layout that nothing before it had ever exercised: `NavRail` and `NavTabBar` both call
`usePathname()` directly, unguarded, and that hook returns build-time-known data on every
static route this app had — right up until a `[id]` segment made the pathname itself genuinely
request-dependent. `next build` refused to prerender the new route at all, with the error
pointing at the *layout*, not the new page, since the nav sits above every route under it.
Fixed generically rather than special-cased to this one page: both components now wrap only
their `usePathname()`-dependent piece in an inner `<Suspense>`, with a fallback that renders
the identical nav markup with nothing marked active. On every existing static route the
boundary resolves at build time and nothing changes; only a future dynamic route (Phase 6's
kit research detail, perhaps, or Phase 7's build log entries) would ever see the fallback
flash, and only for the beat before the real pathname streams in. Worth knowing before the
next phase that adds a `[param]` route: this is now the pattern, not a one-off patch.

The CSS budget moved a third time, from 9.0 kB to 10.0 kB — see `scripts/
check-perf-budget.ts`'s own comment and `PERFORMANCE.md` §10 for the full reasoning. Short
version: this is the phase §10 already named as the one that might have to split the `(bench)`
route group's shared stylesheet instead of raising the number again, and a real split (a
Stash-only stylesheet, meaning the first navigation into it costs its own fetch instead of
reusing every other screen's already-cached one) was judged the worse trade for now. Revisit
if Phase 5 or later pushes it past 10.0 kB in turn.

Duplicate detection (`findKitByBrandNumber`, formerly `findWishlistKit`) now searches every
status, not just the one being saved into, and a hit elsewhere comes back with `existing: {id,
status}` so a caller can offer to *promote* the row instead of just failing. Only the Stash's
own search-and-save and manual-entry flows actually render a Promote button on that result,
though — saving into the *wishlist* and finding the kit already in the stash shows the
accurate "already in your stash" message and stops there, since demoting a stashed kit back to
wishlist isn't a direction this app supports (§3.3 is one-directional the other way already).
A closely related change: `findKitById` dropped its `status` parameter entirely and now reads
a row by id alone, unscoped. Every *write* still carries the same `and(id, status)` predicate
the file's own header comment has always required — the id-alone read just means a mutation
shared across two screens (`updateManualKit`, `fetchKitArt`, `updateKitArt`, `removeKit`) can
look up "whatever status this kit is actually in right now" and use that as its own write
predicate, rather than each screen hardcoding the one status it used to assume. A stale read
racing a concurrent status change still fails safely: the write's predicate simply won't match
and the action reports the same "no longer here" it always did.

`/api/kits/extract` diverges from `/api/kits/resolve`'s shape in one deliberate way: it writes
`kit_paint_requirement` and stamps `paints_extracted_at` itself, inside the route, rather than
handing the parsed list back to the client for a separate Server Action to save (the way photo
upload splits "store the bytes" from "write the row," because that split exists to let one
upload result feed either a fresh kit or an edit to an existing one). Extraction has no such
fork — there is nothing between "Claude answered" and "save it" that needs a second round
trip's worth of user input — so keeping the write in the route avoids re-serialising a
manual's whole paint list back down to the browser only to ship it straight back up.

Art editing (the camera affordance on a kit's picture) ended up on every card that shows one —
the Stash grid, the Stash detail hero, and the Wishlist's own saved-kit cards — not just the
detail page alone, on the view that "you can change a kit's photo" should be one consistent
affordance rather than a Stash-only feature with an inconsistent gap on the screen one tap
away. Its dialog (`ArtEditDialog`) is its own lazy chunk for the same reason `ManualKitDialog`
already was — every card on both grids carries the trigger, so its upload/fetch logic staying
out of the initial bundle is what kept `/wishlist`'s own JS budget from tipping over when this
landed on that screen too.

The detail page's header Edit button is a plain icon button (`.iconButton`, the same pencil
every card's own Edit already uses), not a bordered pill with its own surface — matching how
Edit already looks everywhere else in the app rather than introducing a one-off treatment for
this single spot, and it cost nothing new from the CSS budget this phase was already spending
carefully.

`kit_manual.label` is nullable free text with four suggested values (`MANUAL_LABELS` in
`src/domain/kit-manual.ts` — Instructions, Decal guide, Painting guide, Other), the same shape
as `kit.category` before it: a label the upload UI suggests, not an enum the column enforces.
`kit.started_at`/`completed_at` are `date`, not `timestamptz` — they're "which day," matching
`purchased_at`'s own existing type — and `updateKitStatus` stamps them with a `coalesce`
against `current_date` on the transition in, so a kit moved back a step and forward again
doesn't lose its original date to a second stamp.

Review after the first Phase 4a commit caught a cluster of bugs, all of them the same shape:
this is the first phase where a `kit` has *children* (manuals, paint requirements) and the
first with a Route Handler that writes. Both invalidated assumptions the earlier phases were
right to make.

`kit_manual.kit_id`, `kit_paint_requirement.kit_id` and `kit_paint_requirement.manual_id` all
reference their parents with `ON DELETE no action` (from `0000_init`), which had never mattered
because nothing created a child row. Removing a manual that had been extracted, or a kit that
had a manual, therefore raised a foreign-key violation — the trash button silently did nothing,
and on the grid the failure took the whole section down through `BenchError`. `deleteKitManual`
and `deleteKit` now clear children first, in an order chosen so a failure part-way loses only
what re-extraction rebuilds, and `deleteKit` returns each manual's blob URL so `removeKit` can
drop those objects too — before this, deleting a kit orphaned every manual PDF it owned.
`build_log_entry`, `research_job` and `kit_research` also reference `kit` and are deliberately
left alone: nothing writes them yet, and Phases 6/7 each need to add their table to `deleteKit`
in the same commit that starts writing it.

`/api/kits/extract` called `updateTag`, which **throws** in a Route Handler by design — it
exists for read-your-own-writes inside a Server Action, and Next guards it on
`workStore.page.endsWith('/route')`. The throw landed in the route's own catch, so every
*successful* extraction reported "Paint extraction hit a problem — try again" after a paid
~60s Opus call, while the caches went stale. It is `revalidateTag(tag, "max")` now. The client
also needed a `router.refresh()`: a `fetch` from a client component doesn't re-render the server
tree, so even a working extraction left the Paints panel on its empty state.

Three more worth recording because each was a silent wrong answer rather than an error. The
deferred `after()` box-art write closed over the status the kit had *before* a fetch that can
take ~10s — and `updateKitImage` had just gained a status predicate, so a kit stashed in that
window lost its art to a zero-row update; it re-reads the row now, and drops the blob if the
write still misses. "Promote to Stash" was offered for a duplicate in *any* status, so a kit
already `built` got a button that walked it two rungs backwards; the server now decides
promotability (`wishlist → stash` only) rather than each caller guessing, and
`promoteKitToStash` hardcodes that transition instead of taking a source status from the client.
And moving a kit back down the ladder left the date the forward transition stamped — a
completion date showing on a kit still being built, made permanent by the `coalesce` — so
`updateKitStatus` now clears on the way back as well as stamping on the way in.

Smaller, all real: `updateKitArt` derived `alreadyStored` from a client-supplied boolean, which
would have let a crafted call store an arbitrary third-party URL as `image_url` against §2.4's
"never hotlinked" rule (derived server-side now, matching `addManualKit`);
`replaceManualPaintRequirements` deleted before inserting, so a failed insert wiped a paint list
the user already had (inserts first now, deleting only the ids captured beforehand — a failure
leaves duplicates, which the display buckets de-duplicate anyway, rather than nothing);
`ManualRow` formatted timestamps with `toLocaleDateString`, which resolves in UTC on the server
and the viewer's zone in the browser and so produced a hydration mismatch plus an off-by-one
date near midnight (`src/domain/dates.ts` formats from ISO parts for both); the status buttons
discarded the `KitResult` their actions return, making the "that kit has moved on already"
message dead code; `ArtEditDialog.fetchFromUrl` had `try/finally` with no `catch`, so a rejected
action was an unhandled rejection with nothing on screen; and two copy bugs from splicing
`statusLabel` into fixed sentences ("already in your building.", "No kits are currently stash.")
— `statusPhrase`/`statusEmptyLine` give each status its own wording. `KitDetailSkeleton` also
renders the real `PhoneHeader`/`DesktopHeader` now: the title comes from the kit, so the header
sits inside the Suspense boundary, and a fallback without one dropped ~110px in above
already-painted cards.

A second review pass, this one from screenshots of the real thing, caught what static
checking could not. The status chips were the sharpest lesson: `.chipStatusBuilding` and
`.chipStatusBuilt` were written *above* `.chip` in the stylesheet, and since all three carry
the same single-class specificity, `.chip`'s own `background`/`color` won the tie by source
order alone — every status rendered identical grey, and nothing in typecheck, lint, build or
the budget could see it. They live below `.chip` now, with a comment saying why they must.
Stash gained its own treatment at the same time (neutral ground, darker ink, a hairline) so
all three statuses separate at a glance rather than two-plus-a-default.

The modal stacking bug had the same character — visible instantly, invisible to every check.
`Modal` was rendering in place, and every trigger that opens one sits inside a kit card's
action row, which sets a `z-index` to clear the card's stretched link. A positioned element
with a `z-index` creates a stacking context, so the overlay's `z-index: 50` stopped competing
with the page and started competing only with its siblings *inside that row* — other cards'
buttons then painted straight over an open dialog. No overlay z-index can fix that from
inside; `Modal` portals to `<body>` now, which fixes it for every caller at once and for any
future one.

Three product decisions came out of the same pass. The grid and its filter pills sort by
*attention* (Building, then Stash, then Built) rather than by progression — the stepper still
walks stash → building → built, because that's the road a kit travels, but a list has no such
obligation and sorting it that way buried what's actually on the bench; `STASH_DISPLAY_ORDER`
is the second ordering, deliberately separate from `STASH_STATUSES`. The photo field went back
into the edit dialog for add *and* edit alike, after being hidden once a kit had art — which
left no way to replace a wrong picture from the one dialog that edits everything else about
the kit. And the camera badge on the art now appears only when the art is missing, since a
permanent badge on every thumbnail was clutter on the majority of cards. Those two together
retired `ArtEditDialog` and the `updateKitArt` action entirely: the camera opens the same edit
dialog, so there is one photo code path rather than two, and `/wishlist`'s tight JS budget got
the difference back.

**What was verified, and how.** The SQL side of this phase now has real coverage: every
statement it issues was run against a local PostgreSQL 16 (the same major version Neon serves),
loaded with the migrations in order. That is what confirmed the missing-migration failure above
(0000–0003 applied, then `listKitsByStatuses`' exact `SELECT` → `column "started_at" does not
exist`, cleared by 0004, which is also a clean no-op when replayed); reproduced both
foreign-key violations on delete and confirmed the child-first ordering fixes them and returns
the manual blob URLs; walked a kit `stash → building → built → building → stash` and confirmed
the dates stamp on the way up and clear on the way back; checked `replaceManualPaintRequirements`
replaces exactly (6 rows → 2, no duplication); and confirmed `getStashReadiness` against a
fixture built for the case it exists to handle — a code owned through two shelf rows (a spray
can and the jar decanted from it) counting once, a repeated non-Tamiya callout counting once —
giving owned 2 / missing 1 / unresolved 2, i.e. "Own 2 of 3 · 1 to buy · +2 unresolved".

The UI then got the same treatment, which is what all of the above was found by: a local
Postgres seeded with the real 395-paint catalogue, a ten-bottle shelf and five kits spread
across all three statuses, with the driver temporarily pointed at it (reverted before commit —
`src/db/client.ts` is untouched). That confirmed, on phone and desktop, the display ordering,
the three chip colours, the filter pills and their counts, the readiness lines against a kit
deliberately built for the awkward case ("Own 3 of 5 · 2 to buy · +2 unresolved", with TS-8
owned through two shelf rows and one non-Tamiya callout repeated), the detail page's stepper,
manuals and three paint buckets, and the modal painting cleanly above everything. It also
exercised the foreign-key delete through the actual UI rather than through SQL: removing a kit
that had two manuals and eight paint requirements left four kits, zero manuals, and exactly
the two requirement rows belonging to the *other* kit, then redirected to `/kits` with no
console errors.

Still unverified, and still needing a real Anthropic key and a browser pointed at an actual
Blob store: a genuinely large manual upload (the 10–40 MB real-world case, and specifically
whether client-direct upload behaves the way `@vercel/blob/client`'s docs describe against this
project's own store); the inline PDF viewer across desktop browsers (a plain
`<iframe src={blobUrl}>` — no library, so it rides on each browser's own PDF handling); a real
`/api/kits/extract` call end to end, which needs a key and a real scanned manual to be worth
anything; and blob cleanup actually removing objects (the row-side logic is verified above, the
`del()` calls against a real store are not). The UI was driven with a headless browser against
no database, confirming every `<Suspense>` boundary this phase added fails into its own
`BenchError` card with no unhandled crash on `/kits` and `/kits/[id]`, phone and desktop — but
populated-state layout (real cards, a real manuals list, real paint buckets) still hasn't been
seen rendered with real rows.

**Round 4 — preview polish.** A fourth pass of screenshot feedback, all cosmetic:

- **Edit wasn't a button.** `EditKitTrigger` is shared between a card's compact action row
  (borderless icon, fine among other icons there) and the detail page's header (bordered, right
  next to `DeleteKitButton`'s `.deleteButton`) — one component, two contexts that want different
  weight. Gave it a `variant` prop (`"icon"` default, `"button"` for the detail header) rather
  than splitting it in two: the dialog it opens and the data it needs are identical either way,
  only the trigger's own chrome differs. The button variant reuses `.deleteButton`'s box
  wholesale (border, height, padding — its resting state was already the right look for Edit)
  and layers on a small `.editButtonHover` modifier so hovering Edit reads as accent, not the
  alert red that would wrongly suggest something destructive.
- **"Tap again to remove" never reset.** `DeleteKitButton`'s `armed` state had no path back to
  `false` except a failed delete — click Remove, look away, and it stayed armed forever, one
  stray click on the (now-relabelled) button away from actually deleting. Added a
  `mousedown` listener on `document`, live only while armed, that disarms on any click outside
  the button itself — the same "walk away and it forgets" behavior a real confirm dialog gives
  for free.
- **Three small dropzone fixes**, all in `ManualsList`'s "Choose a PDF" panel: the label pills
  (Instructions/Decal guide/…) are `<button>`s reusing `.filterPill`, a class written for
  `<Link>` anchors — anchors get a pointer cursor for free, buttons don't, so hovering them
  showed the default arrow; added `cursor: pointer` to `.filterPill` itself, which fixes every
  caller, not just this one. Removed the "Uploads straight to storage — real manuals run
  10–40 MB…" hint line entirely, per feedback that it wasn't earning its place. Added a small
  `margin-top` between the pill row and "Choose a file" (`.dropzoneUpload`) — `.dropzone`'s own
  `gap: 8px` is uniform across every child, which read as too tight once a whole pill row sat
  between the heading and the button rather than just the icon and heading.

Verified the same way as round 3: a local Postgres seeded with one stash kit, the driver
temporarily pointed at it and reverted before commit, driven with a headless browser. Confirmed
directly rather than by inspection: the Edit button's computed border/height now match Remove's;
clicking Remove arms it ("Tap again to remove"), and a click elsewhere resets it to "Remove"
(grabbed the element handle before the aria-label changed, since role-based re-queries break once
the click flips it); the label pill's computed `cursor` is `pointer`; the removed hint text has
zero matches on the page; and there's a real visible gap between the pill row and "Choose a
file" in a full-page screenshot. Pushed the shared `Inventory`/`InventoryForm` CSS 0.4 kB over its
budget in the process — see docs/PERFORMANCE.md §11 for why that moved to 10.5 kB instead of
being trimmed further.

**Round 5 — the manual viewer and the real bug behind it.** The user hit the ~20 MB extraction
ceiling with an actual manual (29.5 MB, well inside the 45 MB upload limit) and asked why storing
and extracting had two different size ceilings at all. They didn't: the ~20 MB number was never a
real product decision, it was `/api/kits/extract` inlining the PDF as base64 in the Messages API
request body, which has a 32 MB ceiling of its own — base64 inflates a file by ~33%, so a raw PDF
had to stay under ~20 MB to fit. A manual between 20 and 45 MB uploaded and stored fine and then
could never be extracted, silently, forever. The real fix wasn't a bigger number, it was removing
the reason for a second number: the route now uploads the fetched PDF to the Anthropic Files API
(`client.files.upload`, no beta header — out of beta as of this SDK) and references it by
`file_id` in the document block instead of inlining base64. The Files API's own ceiling is
500 MB, so `MAX_EXTRACTION_PDF_BYTES` is gone entirely — extraction now shares
`MAX_MANUAL_UPLOAD_BYTES` (45 MB, moved to `domain/kit-manual.ts` as the one ceiling a manual
answers to) with the upload route. If it's stored, it can be extracted, full stop. The uploaded
Files-API copy is deleted again in a `finally` once the run finishes (success or failure) — it
exists only to make one request's document reference resolvable, not as a second permanent copy
of the manual, and a delete failure is logged and swallowed rather than turning a real result into
a generic one.

Two smaller fixes rode along, both from a screenshot of the manuals list: the inline `<iframe>`
"View" toggle (desktop-only, `.deskOnly`) was removed outright rather than fixed — it duplicated
what "Open" already does (the browser's own PDF viewer, in a new tab) for the cost of a second
render path and a `viewing` state nobody asked to keep. And "Open"/"Extract paint list" were
hovering green, because both reuse `.boughtButton` for its pill shape and inherited its hover too
— a color this file's own top comment reserves for "mark bought" semantics (`--ok`, "in range /
owned"), which neither Open nor a not-yet-run extraction is. Added `.manualActionButton`, layered
on top of `.boughtButton` for the shape, that overrides just the hover to the plain accent used
everywhere else a secondary action isn't destructive or already done — same family as
`.editButtonHover` from round 4. Left `.boughtButtonDone` (the "Extracted — re-run" state) alone:
that one actually is the "done" state, same as a purchased kit, so green is correct there.

Verified what could be verified locally: typecheck/lint/build/perf/catalogue all clean, and a
local-Postgres-plus-headless-browser pass confirming the View/Hide buttons and the iframe are
gone from the DOM, that Open and the not-yet-extracted Extract button compute an accent hover
while the done state still computes the ok/green one, and that a manual seeded at 50 MB (over the
now-shared cap) fails immediately with the storage-limit message while one seeded at the real
29.5 MB size clears that check and proceeds to actually attempt the fetch — it then fails on a
fake Blob URL, which is the test fixture's limit, not the code's. The Files API call itself —
`client.files.upload`, the `file_id` document reference, and the cleanup delete — could not be
exercised end to end here: that needs a real `ANTHROPIC_API_KEY` and a real Blob-hosted PDF,
neither of which exist in this sandbox (`safeUrl`'s SSRF check correctly refuses a local test
server, same as it would in production). The API shapes used are not guessed — confirmed against
the installed SDK's own source (`node_modules/@anthropic-ai/sdk/src/resources/files.ts` and
`to-file.ts`) and the current (non-beta) Files API docs, fetched fresh rather than recalled.

**Round 6 — one more missing hover.** `.ghostButton` (every dialog's "Cancel", and the status
stepper's "Move back to Stash/Building") had no `:hover` rule at all — same shape of bug as round
4's `.filterPill` cursor miss, just a different property. Its resting state is already subtle (a
thin `--line-strong` border on muted text), so with nothing changing on hover it read as inert
rather than clickable. Added `.ghostButton:hover` with the same neutral treatment
`.iconButton:hover` already uses elsewhere (`--card-sunken` background, `--ink` text/border) —
not an accent/ok/alert colour, since this button never signals a particular outcome. Fixed at the
shared class rather than a one-off override, so it's every "Cancel" in the app plus this button,
not just the one in the screenshot. Left `.primaryButton` alone — it has no hover either, but
that wasn't reported, and a solid-fill button reads as clickable at rest in a way a bordered one
doesn't, so it's not obviously the same bug.

**Round 7 — the Paints panel.** Five fixes from a screenshot of a kit with a real, messy
extraction result:

- **No margin under the "Paints" title.** `.paintBucket + .paintBucket` gave every bucket
  *after* the first a top border and padding, but the first bucket had nothing above it at all —
  the title sat flush against "Owned". Moved the `margin-top: 14px` onto the base `.paintBucket`
  rule (every bucket gets it, first included) and left `+ .paintBucket` to layer just the
  separator (border + padding) on top, so the gap between buckets is unchanged and the gap under
  the title is now real.
- **Owned and Missing looked like two different UIs** — Owned a row of chips, Missing a list of
  full-width rows with a separate icon-button per line. Rebuilt Missing as the same chip
  (`.ownedChip`/`.missingChip` now share one box-model rule, differing only in colour — `--ok` vs
  `--alert`, the same meaning their bucket dots already carry) and dropped the visible paint name
  entirely in favour of a `title` tooltip, matching what Owned already did. The chip is now the
  whole "find somewhere selling this" link itself (an `<a>`, `cursor: pointer`, a hover state that
  swaps to solid `--alert`) rather than a separate `ExternalLinkIcon` button bolted onto a text
  row — one clickable shape instead of a row of parts.
- **Owned order was plain `localeCompare`,** which sorts "X-2" after "X-19" — visibly wrong next
  to the Paints screen's own ordering (line, then the code's number, then the string —
  `SHELF_ORDER` in `db/repositories/inventory.ts`). Added `comparePaintCodes` to
  `domain/paint-code.ts`, a plain-JS comparator matching that SQL `case`/`regexp_replace` logic by
  hand (documented as such — different enough mechanisms, SQL vs. in-memory array, that sharing
  one implementation would mean wrapping one to satisfy the other for three lines of logic), and
  used it for both Owned and Missing — the request only named Owned, but leaving Missing on the
  old lexicographic sort would have reintroduced the exact "these two lists don't match"
  complaint the chip-style fix above just resolved.
- **The extractor didn't recognize custom-mix formulas.** A manual's own mix table can define a
  named blend as a formula rather than a single paint — "H A = C30(1) + C335(1)" — and the
  extraction prompt had no instruction for that shape, so the whole formula line came back as one
  opaque `rawLabel`, landing in Unresolved as a string nobody can look up (it isn't a paint; it's
  a recipe). Added a paragraph to `SYSTEM_PROMPT` (`/api/kits/extract/route.ts`) naming the
  pattern and asking for one requirement entry per paint on the right-hand side of the "=",
  dropping the ratio numbers and the mix's own name — with an explicit carve-out for a part
  elsewhere simply painted "Paint A" (referencing the mix by name, formula not restated at that
  point): that stays its own single entry, since expanding a bare reference the model can't see
  the formula for risks inventing one.

Verified what's verifiable without a real Anthropic call: `comparePaintCodes` against the exact
code list from the screenshot (`X-1, X-2, X-10, X-11, X-12, X-14, X-18, X-19, X-21, X-26, X-27,
XF-1, XF-2, XF-7, XF-60, XF-84` — the numeric order, not the lexicographic one), and the panel
itself against a local Postgres seeded with fifteen owned codes, one missing (`X-1`, owned-list
codes minus one), and nine unresolved rows — confirming live: the Owned/Missing chips render
identically in shape, Missing shows only the code with the name on `title`, the Missing chip is a
real link with a hover state, and there's now visible air under "Paints" before "Owned". The
formula-recognition prompt change is not verifiable locally the same way — it only proves itself
against a real manual and a real `ANTHROPIC_API_KEY`, neither available in this sandbox — so
that one is asking for that live check.

**Phase 5 — cross-brand equivalence, built.** Prompted by round 7's own C335 row: a real Mr.
Color code from the user's kit that had nowhere to resolve to. §2.2 had already scoped this
phase and named its source; this is the account of actually building it.

*Getting the data in.* Neither `cybermodeler.com` nor a mirror of it (`web.archive.org`
included) was reachable from this sandbox — same limitation §2.2 already flagged when the
phase was first planned. The user supplied the chart as a PDF export of the live page instead.
`pdftotext -bbox-layout` (poppler-utils, not preinstalled — added for this) gives every word's
real (x, y) position rather than whitespace-approximated columns, which mattered here: the page
has a sidebar (site nav, a NOTICE block) running down the left margin that a plain `-layout`
text dump interleaves with the table itself mid-line — invisible in a quick look at the text,
and exactly the kind of thing that silently corrupts a paint code. Column boundaries came from
the real header row's x-positions; rows were grouped by y-proximity, with one genuine edge case
(a two-line colour name, "Metallic Blue" / "Aotake" stacked) needing a wider merge-gap
tolerance than the default line spacing to catch. The parsed table (129 colours, up to 10
brands each) is committed as `scripts/data/cybermodeler-tamiya-cross-reference.json` — the
transcription, kept separate from `scripts/build-equivalents.ts`'s transform logic — and
`build-equivalents.ts` turns it into `seed/equivalents.json`, the same "generate once, commit,
never re-scrape at runtime" pattern `build-catalogue.ts` already established for the paint
catalogue itself.

*What the schema needed.* Nothing — `paint_brand` and `paint_equivalent` have existed since
migration 0000 and sat completely unused. This phase is pure seed data plus application code:
`seed/paint-brands.json` (ten brands, the chart's nine plus Mr. Paint, which the chart itself
carries and the original brand list hadn't — §2.2), `seed/equivalents.json` (1,229 rows after
dedup — see below), a `resolveForeignCode` lookup in `src/catalogue/equivalents.ts` (compiled
into the build, same reasoning as `catalogue/paints.ts`: a lookup extraction needs synchronously
shouldn't cost a database round trip), and one new fallback branch in
`kit-paint-extraction.ts`'s `resolveCode` — try the Tamiya catalogue first, then, only for the
model's own `codeGuess`, try the equivalents lookup. `verify-catalogue.ts` gained a matching
check: every equivalent's Tamiya code must resolve to a real catalogue entry and its brand to a
real `paint_brand`, the same class of CI gate the catalogue itself already had.

*Two real bugs surfaced building this, both fixed, neither specific to cross-brand data:*
- `normalizePaintCode` never stripped leading zeros — "AS01" normalized to "AS-01", which
  doesn't match the catalogue's "AS-1". Never surfaced before because Tamiya's own manuals don't
  print leading zeros; Cybermodeler's chart does, for the first nine AS/X codes. Fixed in the
  shared normalizer, so it's fixed for extraction and search too, not just this phase.
- A meaningful chunk of the source chart (129 of 130 parsed rows, one dropped for having no
  Tamiya code at all) turned out to be genuinely duplicated — the page organizes into several
  sub-tables (one grouped around the AS line, one around XF, …) and a shade with both a spray
  and a bottle code appears in more than one, full row repeated. Deduped by (brand, foreign
  code, Tamiya code) in `build-equivalents.ts`, dropping 345 of 1,574 generated rows; the one
  substantive side effect was two sub-tables disagreeing on a name ("Olive Green" vs. "Bronze
  Green" for XF-67, which this app's own catalogue calls "NATO Green") — cosmetic only
  (`foreign_name` is descriptive, not a join key), documented rather than silently resolved
  either way.

*The one real design call: what to return when a foreign code maps to more than one Tamiya
paint.* A shade often has both a bottle code and a spray-can code — Mr. Color C335 is both
Tamiya AS-11 (spray) and XF-83 (bottle) — but `resolveCode` needs a single `paintCode`, not a
list. `resolveForeignCode` prefers the bottle/lacquer form (X, XF, LP) over a spray can (TS,
AS): that's the format the Thinner Bench's ratio calculator is actually built around, and the
more useful "buy this" answer when the owner has neither. The real gap this leaves: if someone
owns *only* the spray-can equivalent, this still reports the paint as missing, because bucketing
(`kit-paints.ts`) checks ownership of one resolved code, not every equivalent Tamiya code for
that foreign code. Fixing that properly means `ExtractedPaintRequirement.paintCode` becoming a
list checked against the shelf as a set, which is a real change to the bucketing shape, not a
seed-data tweak — left as a known limitation rather than a shallow patch.

*What's still open:* the second source the user offered
(`mech9.com`'s Tamiya spray-paint conversion chart, also unreachable from here) isn't
incorporated — Phase 5 ships on the Cybermodeler data alone. §2.2's own documented fallback
(`source = 'claude-research'` for a code the chart has no row for) isn't built either — a code
this chart doesn't cover, like the user's own H23/C79 and C328 rows, still lands in Unresolved,
same as before this phase; there's a real, scoped fast-follow here (a Claude web-search call, on
"Extract paint list", for exactly the requirements that come back with `paintCode: null`) but it
wasn't built speculatively. And a manual already extracted before this phase shipped keeps
whatever it resolved to at the time — cross-brand resolution runs at extraction time, not
retroactively, so an existing kit's Unresolved bucket only picks up the improvement once
"Extract paint list" (or "Extracted — re-run") is clicked again.

Verified without a real database: `resolveForeignCode` against known cases (`C335`/`H335`,
case- and whitespace-insensitive, both resolving to `XF-83` — bottle preferred over the `AS-11`
spray candidate; `H23`/`C79`/`C328`, the user's own uncovered codes, correctly returning
`null`). Verified with one: seeded a local Postgres with the real `db:seed` script (temporarily
pointed at node-postgres, reverted after — same as every other round's methodology) including
the new `paint_brand`/`paint_equivalent` tables, then ran the actual resolution path
(`normalizeExtractedPaints`) against wire data shaped like the user's real manual rows and drove
it through the UI: `C335 ミディアムシーグレー Medium Seagray` resolved to `XF-83` and rendered
in Owned (the shelf owned XF-83 but not AS-11, confirming the bottle-preference rule actually
takes effect, not just returns *a* candidate); `H23`/`C79` and `C328` correctly stayed in
Unresolved rather than being silently mismatched to something wrong.

**Round 8 — a real extraction regression from round 7's own formula fix.** The user re-ran
extraction (to pick up Phase 5) on a kit that had already extracted well, and watched a mostly
Owned/Missing paint list collapse to "Own 1 of 1 · +20 unresolved" — alarming, and reported as
"all my previous paints extracted are gone." Not data loss from `db:seed` (nothing in
`scripts/seed.mts` touches `kit`, `kit_manual`, or `kit_paint_requirement` — checked, not
assumed, before saying so): re-running extraction legitimately deletes and reinserts that
manual's paint list (`replaceManualPaintRequirements`), and this run's Claude call came back
with a genuinely different, worse result than the one before it.

The user sent the actual manual page: a GSI Creos (H/C code) ↔ Tamiya equivalence table, 19
rows, the kind many Tamiya manuals print so a builder without Tamiya's own paints knows what to
buy instead. Every row already states its Tamiya equivalent directly — 17 of 19 as a plain code
(X-2, XF-84, …), 2 as an explicit mix ("XF-7 + X-56 ×5"), and only 2 with no Tamiya equivalent
at all (dashed). The extraction that ran before round 7 read that Tamiya column correctly and
resolved nearly everything; this run instead reported the *foreign* H/C code as `codeGuess` for
most rows — findable through neither the direct Tamiya catalogue nor, for most of these
specific H-numbers, Phase 5's cross-brand chart, so the bulk of a genuinely mostly-resolved kit
came back Unresolved.

Root cause, by elimination rather than guesswork: round 5 (the Files API migration) was already
live for whichever earlier run the user calls "good," so that wasn't it — round 7's own
`SYSTEM_PROMPT` addition (`/api/kits/extract/route.ts`), teaching the extractor to recognize
"Paint A = X-1(1) + X-2(1)"-shaped mix formulas, is the only thing that changed between the two
runs. It never told the model to prefer a foreign code over a Tamiya one — but it also never
told it *not* to, and a table headed "H□ / C■" with the model's attention freshly primed to
watch for H/C-letter-prefixed "codes" worth reporting is a plausible way for that attention to
land on the wrong column. Diagnosed by asking the user directly rather than guessing at a fix
blind (having just gotten the file-size diagnosis wrong once already this project, guessing
twice in a row on a real-data question wasn't worth the risk) and having them send the actual
page — confirmed the exact mechanism (2 of 19 rows are real formulas, matching what they
reported) rather than a plausible-sounding theory.

Fix: rewrote `SYSTEM_PROMPT` to say explicitly what round 7's version left implicit — a manual
that gives *both* a foreign code and a Tamiya equivalent in the same row means `codeGuess` is
the Tamiya one, always; the foreign code is the fallback only for a row whose Tamiya column is
genuinely blank or dashed. The formula instruction now explicitly covers a formula appearing
*as* a row's Tamiya-equivalent value (the Wood Brown / Burnt Iron case), not just a formula as
its own standalone line, and every "kit's own brand" phrasing was written as "Tamiya" by name —
this app's catalogue is always Tamiya's regardless of which company boxed the kit, so a generic
"own brand" phrase would have been vaguer than the thing it was replacing.

Not verifiable locally the way most of this project's fixes are — there is no way to run the
real extraction call without a real `ANTHROPIC_API_KEY` and the real manual, both outside this
sandbox. Verified instead by re-reading the new prompt against every one of the 19 rows the user
sent, by hand: 17 resolve directly from the stated Tamiya code, 2 correctly trigger the
formula-split path, and the 2 truly dash-equivalent rows correctly still fall through to a
foreign-code `codeGuess` (which Phase 5's chart may or may not additionally resolve, same as
before) — matching the user's own description of the original good run ("only missing the ones
where there wasn't a clear Tamiya label"). This still needs a real re-run to confirm outright.

**Round 9 — a design-system inconsistency I introduced myself, plus a mobile layout fix.** Two
unrelated reports, fixed together:

- **Every "default" bordered/icon button had grown its own hover colour.** Across three
  separate rounds, `.ghostButton` (Cancel, "Move back to …") and `.iconButton` (both copies,
  `Inventory.module.css` and `Wishlist.module.css`) ended up hovering to `--card-sunken`/`--ink`
  (a neutral tan/ink tint), while `.editButtonHover` and `.manualActionButton` — built later,
  explicitly *as* "the same neutral treatment `.iconButton:hover` uses" — actually used
  `--accent`/`--accent-tint` (blue) instead. Neither round noticed the two didn't match, because
  each only looked at the one button it was fixing, not the family. Screenshotted directly:
  "Move back to Stash" hovering tan next to "Mark built"'s blue read as arbitrary. Unified all
  four call sites to the accent/accent-tint pair (`.editButtonHover` also gained the `background`
  it had been missing, hovering to a text/border colour change alone) — one hover rule for every
  bordered or icon-only "default" button in the app now, not a shade picked per caller, with
  cross-references between the CSS comments so the next one to touch any of these sees the whole
  family instead of just its own selector.
- **The kit detail page's mobile header didn't budget for a long title.** `PhoneHeader`'s row
  puts the title and `trailing` (Edit/Remove) side by side, `justify-content: space-between` —
  fine for every other screen's short, fixed title ("Paints", "Wishlist"), wrong for a kit's own
  name, which is user-entered and can run long enough to wrap three lines while squeezed against
  the action buttons, stranding them halfway down the wrapped text. Added a `stackTrailing` prop
  (default off, so every other `PhoneHeader` caller is unaffected) that switches the row to
  `flex-direction: column` — title gets the full row width, `trailing` drops to its own line
  below. `KitDetailSection` is the only caller that passes it.

Also fixed in passing, from an unrelated report: a `type="date"` input's "/" separators aren't
covered by the browser's own dimming of an empty month/day/year segment — Chromium visibly grays
each field's placeholder digits but leaves `::-webkit-datetime-edit-text` (the separator) at the
input's regular ink colour, so an untouched field read as light "mm/dd/yyyy" digits around
noticeably darker slashes. Recoloured just that pseudo-element to `--muted`, in
`InventoryForm.module.css`'s shared `.input` class — every date field in the app, not one dialog.

Verified live: a local Postgres seeded with a kit whose real title is long enough to reproduce
the wrap (the user's own screenshot's kit, "Lancia Delta S4 Martini Monte Carlo Rally 1986"),
driven with a headless browser at a real phone viewport (390×844) — confirmed the title's
bounding box now spans the row's full width and the Edit button's box sits strictly below the
title's, not beside it. Computed styles for all three previously-mismatched hover states
("Move back to Stash", the detail header's Edit, a plain trash icon button) came back byte-identical
on `color`/`background`/`border-color` after hovering each. The date-input fix was checked
visually — a fresh "Purchase & Dates" dialog's `mm`/`dd`/`yyyy` fields render as one consistent
muted tone, slashes included.

**Phase 6 (Dashboard)** was inserted into the plan rather than appended: it ships before kit
research and the build log, so it takes the number that matches the build order, and those two
shifted to 7 and 8. Safe to renumber because no shipped code cited either — every `Phase N` in
a source comment points at 0–5. The Build Log lost its nav slot to this screen at the owner's
request; `/log`'s `ComingSoon` stub and `LogIcon` are deleted rather than left unreachable, and
Phase 8 re-adds both when it happens.

Two calls the one-line spec didn't settle. **"Ready to build" is strict about a kit with no
extracted paint list**: such a kit is *unknown*, not ready, so `isReadyToBuild` requires both
"nothing missing" and "something was actually checked" — listing an un-extracted kit there
would make the single claim that module exists to make untrue. And the **shop run excludes
`built` kits** while `getStashReadiness` includes them: a finished kit's missing paints are a
historical fact, not shopping. Only `stash` and `building` describe paint you still need.

The CSS budget question `PERFORMANCE.md` §10 has been deferring since Phase 3 came up again and
was answered the same way — raise, don't split — but the number moved by only 0.2 kB for a whole
new screen. The first draft of `Dashboard.module.css` restated the card and row rules it needed
and cost more than the finished phase does; rewriting it to import the wishlist's
`.itemList`/`.itemRow`/`.itemBody`/`.itemTitle`/`.paintDot` and the `.moduleTitle` tier left
only genuinely new surface. The rule worth keeping: check whether a card or row already exists
before writing one.

**The Thinner Bench's desktop gaps**, reported after the Dashboard shipped, turned out to be the
same class of bug as the Dashboard's own and worth writing down because neither was visible in
review. Its grid was `"hero search" / "hero specs" / "hero notes"` — the hero spanning three
auto rows. A spanning item taller than the rows it spans does not overflow: **CSS grid
distributes the surplus equally across every row it spans**, so a `row-gap: 16px` rendered at
roughly 140px, twice, and `align-items: start` could not help because the items were already at
the top of rows that were themselves too tall. Measured in a browser, not estimated. The fix is
one grid area (`"hero side"`) holding a flex stack, so the stack's own gap is the only thing
between those cards and the surplus lands once, below them.

Two things rode along. Search moved out of the grid to full width above it — it is the first
thing you touch on that screen and it was sitting in a right-hand column, where the Stash and
the Wishlist both put theirs across the top. And `SpecGrid` stays 2×2 on desktop instead of
widening to 1×4: those tiles hold six characters, and at full width each was ~500px of air.

That freed room for the first UI Phase 5's chart has ever had: an **"Also sold as"** card under
the bench notes, listing what this Tamiya code is called by the other brands
(`getEquivalentsFor`, added to `src/catalogue/equivalents.ts` alongside the foreign → Tamiya
lookup that was already there — one module, one seed file, both directions). It is a pure
Server Component over the compiled catalogue: no query, no client JS. It renders **nothing**
when the chart has no rows, which is normal rather than a failure — coverage is good on the
bottle lines and thin on TS/AS, so a decanted spray usually shows no card at all. TS-8, the
paint that prompted the report, is one of those.

### The Phase 6 sweep

A read of the whole tree at the owner's request, before the app settles as the base the build
log and later features get built on. Four things came out of it.

**An empty Anthropic balance had no error of its own.** Both paid routes ended in the same
three-branch chain — key, rate limit, everything else — and "everything else" is where running
out of credit landed, reported in the same words as a transient blip and logged nowhere at all.
The API distinguishes these precisely and now so does `src/lib/anthropic-errors.ts`: 401 the key
itself, **402 `billing_error` an empty balance or a payment problem**, 403 model/workspace
access, 400 what a *self-imposed* spend limit returns, 429 either a real rate limit or the usage
tier's monthly spend cap — told apart by whether a `retry-after` came with it, because the cap
sends none and does not clear on its own. 402 is the one that needed saying out loud: the
TypeScript SDK gives it no error class the way it does 401/403/429, so it lands on the base
`APIError` and is only visible on `.status`. Every failure now also writes one line naming the
status, the error type and the request ID, which is what an Anthropic support ticket wants and
what neither route produced before.

**Dead code, deleted.** `/api/paints/search` and the `searchCatalogue` it wrapped had had no
caller since type-ahead moved into the browser in Phase 3 — and `src/catalogue/paints.ts` was
still building a full search index at import time to serve it, on every cold start of a server
that only ever wanted `getCataloguePaint`. The `ComingSoon` component and stylesheet went with
`/log`'s stub and were never removed; three icons (`AlertIcon`, `EyeIcon`, `DownloadIcon`) were
drafted for the manuals UI, which settled on `FileIcon`/`ExternalLinkIcon` instead; two exported
catalogue-size constants had no readers.

**Three input paths were trusting their caller.** The kit detail page's dates went in through
`readText`, which caps a string's length and has no opinion about its content — from the screen
always a browser date value, but a Server Action is a public endpoint and anything else reaches
Neon as `invalid input syntax for type date`, i.e. an unhandled rejection rather than one of this
app's own sentences (`readIsoDate` now validates by round trip, since "2026-02-31" passes every
shape test you would write). Two call sites recognised our own Blob store by
`url.includes(".blob.vercel-storage.com")`, which `https://example.com/?ref=.blob.vercel-storage.com`
satisfies; `isStoredBlobUrl` checks the parsed hostname, the way `deleteBoxArt` already did. And
a manual's `blobUrl` arrives from the client by design — the client is what ran the upload — but
is now required to be in that store before it is written to a row `/api/kits/extract` will later
fetch and send to Claude. Alongside those, `updateInventoryItem` returns whether a row was there,
so editing a shelf entry someone else's tab already deleted stops reporting success.

Three things were found and deliberately **not** changed:

- **`paint_brand` and `paint_equivalent` are seeded and never read.** Every equivalence lookup in
  the app — the Unresolved bucket, the "Also sold as" card — goes through
  `src/catalogue/equivalents.ts` and the committed JSON behind it (§3.1). By the rig's own
  reasoning (§2.3) that makes the two tables dead weight today. They are kept because
  `paint_equivalent.source` already anticipates `claude-research` rows, and research-derived
  equivalents *are* runtime data a compiled file cannot hold — Phase 7 either uses them or they
  should go with it. The runbook step that claimed Phase 5 needed the seed to work was wrong and
  is corrected in §9.5.
- **`/api/login` has no rate limiting**, and is the one route outside the session check. A
  passphrase behind an unthrottled endpoint is guessable given enough time; fixing it properly
  needs somewhere to keep a counter, which is a decision (Vercel KV, a table, the platform's own
  firewall) rather than an edit.
- **`/wishlist` initial JS is 149.8 kB against a 150.0 kB budget** — 0.2 kB. That is the number
  the next phase hits first, and `PERFORMANCE.md` §10's raise-or-split question will be about
  JavaScript rather than CSS when it does.

### Phase 7 — what the spec didn't settle

**Tips got a column of their own** (`kit_research.tips`, migration 0005 — the schema was
otherwise already complete, which is why §5.1 could be built without touching it). §5.1 named
only fit issues, and folding advice into them would have been wrong: "the bonnet sits proud
unless the firewall is sanded" is a defect in the kit, "let the clear coat cure 48h before
polishing" is technique, and a list that mixes them can't be read for either. Same row shape,
so one component and one CSS rule render both.

**§5.4 is enforced in `normalizeResearch`, not in the components.** A claim whose `sourceUrl`
doesn't parse as an http(s) URL is *dropped* — not shown unsourced, not shown with a
placeholder. Putting that in the domain layer rather than in the panel means the next screen
to render these rows inherits the rule instead of having to remember it. `consensusLine`
works the same way: it returns `null` when there is no difficulty or nothing was cited, so
the "Intermediate · consensus from 4 sources" line is structurally incapable of degrading
into a bare "Intermediate". Sources are counted by **distinct host** — three threads on one
forum is one source agreeing with itself, and counting it as three is the exact false
confidence §5.4 exists to prevent.

**The build video is a link, not an embed.** §5.1 promised a build video and the earlier
sketch of this phase wanted a click-to-load facade. A facade still needs YouTube's thumbnail,
which means hotlinking it — §8 says the app doesn't do that — and a real player is more
JavaScript than the entire app ships. On a phone at the bench the link opens the YouTube app,
which is where you wanted to watch it. The free YouTube *search* link stays visible either
way, as the fallback for a kit research found no video for.

**No `fallbacks` parameter**, though the SDK offers server-side refusal fallbacks on Opus 5.
A refusal on "what do builders say about this Tamiya kit" is not a failure mode this app has;
`stop_reason: "refusal"` is handled explicitly instead, the same as in `kits/extract`.
Revisit if one ever actually turns up.

Verified against a real Postgres and a real browser, since none of the below is covered by
any automated check. The pipeline's own two calls were **not** run — they cost real money on
the owner's key — so the routes were exercised to the point where the API key is read: a
valid kit reaches it, a wishlist or missing kit is refused, a malformed body is a 400, an
unknown job id is refused, and an unauthenticated request is redirected by the proxy like
every other route. What was driven end to end: the panel at 1280px and 390px against seeded
research; the empty state on a kit with none; Verify, which flips, persists a reload and
writes the row — with no client JavaScript, since it is a plain form action; and the delete
ordering, run as raw SQL against the real foreign keys, because `kit_research.job_id`
references `research_job(id)` NOT NULL and getting that order wrong is exactly the trap the
note above `deleteKit` has been warning about since Phase 4a.

One bug came out of that, and only from measuring: the source link — the load-bearing element
of the whole feature — was an **11px line of text and therefore a 13px tap target** on a
phone, less than a third of the 44px the app's own `.iconButton` comment says it designs for.
Fixed with the padding/negative-margin pair that comment describes: ~37px to hit, no extra
scrolling through six claims. It looked completely fine in the screenshot.

The whole panel cost **+0.1 kB** of the CSS budget by reusing `.card`, `.paintBucket`,
`.bucketHead`, `.boughtButton` and the rest of the existing vocabulary — the Phase 6 rule
(check whether a card or row already exists before writing one) holding up a second time.

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
#      in the Phase 6 sweep (§7).
npm run db:seed

# 6. Run it.
npm run dev
```

Step 5 prints `Migrations applied.` It applies whatever the database is missing, so a database
already up to date is a no-op. One database backs development, preview and production here
(§9.2 connects a single Neon instance to the project), so this one run covers all three — and,
by the same token, it is the *shared* schema being changed, which is why every migration is
additive and none drops a column another deploy might still be reading.

**The migration ledger.** What exists, and what each one is needed by:

| Migration | Adds | Needed by |
|---|---|---|
| `0000_init` | the whole schema | Phase 0 |
| `0001_drop_inventory_location` | drops `inventory_item.location` | Phase 2 |
| `0002_drop_airbrush_and_shopping` | drops four tables, retypes `purchased_from` | Phase 2 |
| `0003_wishlist_and_stash` | `wishlist_item`; `kit.category`/`scalemates_url`/`image_url` | Phase 3 |
| `0004_kit_status_dates_and_manual_label` | `kit.started_at`/`completed_at`, `kit_manual.label` | Phase 4a |

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
