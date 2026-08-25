# The Build Bench — Architecture

A companion app for 1:24 scale model car building, centred on a Tamiya 74540 HG Trigger
airbrush workflow and pre-build kit research.

**Status:** Phases 0–2 shipped (foundations, Thinner Bench, paint inventory). Phase 3
(wishlist) is next. This file is the standing architecture and technical approach — how the
app is hosted, how data and screens are structured, and the rules any new phase builds
against. It is not a decision log; for that, `git log docs/PLAN.md`.

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
│   │   │   ├── thinner/            ← page.tsx + actions.ts
│   │   │   ├── inventory/          ← the paint shelf, page.tsx + actions.ts
│   │   │   ├── wishlist/           ← Phase 3
│   │   │   ├── kits/               ← the stash, Phase 4
│   │   │   └── log/                ← Phase 7
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
        │   Claude, effort medium, web_search max_uses 2
        │   → { brand, kit_number, name, scale, category,
        │       scalemates_url, image_url, year }
        │   Returns candidates; the user picks. Hand entry always available.
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

Each phase ships one screen that is useful on its own. The ordering rule: **want it, own it,
build it** — the wishlist comes before the stash because that's the order a kit passes
through in real life, and because resolving a kit (§5.1 stage A) is the machinery the stash
then inherits for free.

### Phase 0 — Foundations ✅
Next.js scaffold, Neon + Blob via Vercel, Drizzle schema and first migration, cookie auth,
`tokens.css`, PWA manifest, CI.

### Phase 1 — Thinner Bench ✅
The full Tamiya catalogue with generation and CI verification. Paint lookup, family ratio
rules, cup-fill visualiser, `ratio_override` editing, the 74540 dry-tip panel.

### Phase 2 — Paint inventory ✅
The paint shelf: CRUD over form/state (`open`/`low`), sortable table, one-tap running low,
"do I own this?" on the Thinner Bench card.

### Phase 3 — Wishlist
Two sections on one screen. **Kits:** search by kit number or free text via §5.1 stage A,
pick from candidates, save with brand, scale, category and box art (fetched once into Blob)
plus a `scalemates_url` through to the full reference. Hand entry always available for
anything the search can't place. **Other items:** free-text `wishlist_item` rows for tools
and supplies. Both tick over to bought. Needs `ANTHROPIC_API_KEY` — this is the phase that
first uses it.

### Phase 4 — Stash
The kits you own: `status` of `stash`, `building` or `built`, promoted from the wishlist with
one tap or added directly. Manual PDF upload to Blob and a desktop viewer (§4.3), **Extract
paint list** → `kit_paint_requirement`, and the per-kit paint list checked against the shelf
— what this kit calls for, what you already have, what's missing.

### Phase 5 — Cross-brand equivalence
Cybermodeler import (§2.2), `paint_equivalent`, foreign → Tamiya lookup. Sits here rather
than earlier because this is what makes Phase 4's paint list work for Japanese kits, whose
manuals call out Mr. Color throughout. Standalone lookup screen too.

### Phase 6 — Kit research
§5.1 stages B and C against a stash kit: difficulty, fit issues with sources, build video,
manual link. Optional enhancement — nothing depends on it.

### Phase 7 — Build log
Per-kit dated journal by stage, photos to Blob, research and manual attached to the kit. To
be detailed when we get there.

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
3. Storage tab → add a Blob store → connect it to the project.
4. Environment Variables → add two secrets by hand:
   - `AUTH_SECRET` — 32 random bytes: `openssl rand -base64 32`.
   - `APP_PASSPHRASE` — whatever you want to type in to sign in.

`DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` come from steps 2–3 automatically — you never type
them. `ANTHROPIC_API_KEY` is a fifth variable, needed from Phase 3 onwards: that's when kit
search starts resolving queries through Claude (§5.1 stage A).

### 9.3 What I do

Schema and migrations live in `src/db/schema.ts` / `drizzle-kit`, wired to Neon's HTTP driver
(`drizzle-orm/neon-http` — no connection pool to configure; it's stateless HTTP per query).
`npm run db:migrate` applies pending migrations; `npm run db:seed` (`scripts/seed.mts`) loads
the committed catalogue and ratio rules into `paint` and `ratio_rule` and the initial paint
shelf into `inventory_item`, using credentials pulled locally via `vercel env pull`. The rig
is not seeded — it's compiled in (§2.3). Full script reference: `README.md`.

### 9.4 What I never need from you

I never need your connection string, a database password, or an API key typed into chat.
Every secret lives in Vercel's Environment Variables; I only ever reach it through
`vercel env pull` when running a script against the real database. If one ever ends up
pasted here anyway, rotate it.
