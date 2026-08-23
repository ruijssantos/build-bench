# Bench & Build — Architecture & Build Plan

A companion app for 1:24 scale model car building, centred on a Tamiya 74540 HG Trigger
airbrush workflow and pre-build kit research.

**Status:** proposal, awaiting review. No implementation code written yet.
**Planning pass:** Opus. **Implementation:** Sonnet, phase by phase.

---

## 1. Decisions taken

| Question | Decision | Consequence |
|---|---|---|
| Where you use it | Public URL, phone + desktop | Needs hosting, a login, and a PWA shell |
| Kit research (feature 2) | Claude API with server-side web search | Real research, ~€0.20–0.45 per new kit, cached forever |
| Paint inventory source of truth | App database, one-time import from the Google Sheet | Sheet becomes an archive; per-bottle state lives in the app |
| Stack | Next.js (App Router) + React + SQLite | One repo, one process, one data file |

### 1.1 The hosting constraint, resolved

Next.js + SQLite has one sharp edge worth settling before any code: **Vercel cannot host
this.** Serverless functions get an ephemeral filesystem — the SQLite file is wiped on every
deploy and is not shared between concurrent invocations. The two honest options are Vercel +
a remote SQLite service (Turso), or a normal long-lived container with a disk.

**Recommendation: Fly.io, one small machine, one persistent volume, local SQLite.**

- `better-sqlite3` runs synchronously in-process. No network hop per query, no connection
  pool, no driver adapter layer. For a single-user app this is by a wide margin the simplest
  thing that works.
- Persistent volumes are ~$0.15/GB/month. A 3 GB volume (database + manual PDFs + build
  photos) is about $0.45/month; the machine itself runs roughly $2–4/month, and can scale to
  zero between uses.
- Litestream streams the SQLite WAL to object storage continuously, so the backup story is
  "point-in-time restore" rather than "hope".
- If you ever want to move to Turso later, keeping all data access behind a repository layer
  (§4.3) makes it a contained change rather than a rewrite.

**Auth: one user, one passphrase.** A signed, long-lived HTTP-only session cookie set by a
single `/login` route. No accounts table, no OAuth, no email flow. The threat model is "a
crawler finds the URL", not "an adversary targets my paint stash". Set a long cookie
lifetime so the phone never logs you out at the bench with wet hands.

**Phone: PWA, not a native app.** A web app manifest plus an installable icon gets you a
home-screen launcher and full-screen chrome. No app store, no second codebase. Worth
designing two screens specifically for one-handed phone use: the Thinner Bench readout and
the shopping list (see §6).

---

## 2. What the MVP proved, and what it hid

The attached `tamiyathinnerbench.html` is a genuinely good reference and the visual language
carries over wholesale. Three things it establishes that the real app should keep:

1. **The ratio model is right.** Family-based rules (gloss / flat / metallic / clear /
   lacquer / decanted spray / enamel / primer), with a starting ratio plus a workable
   window, not a single number.
2. **The rig is a first-class input.** Every number is stated for a 0.3 mm needle, a 7 cc
   fixed cup, and retarder-type thinner. That framing is the whole value.
3. **The cup-fill maths matters.** Drops → millilitres → percentage of a 7 cc cup, with an
   over-capacity warning, is the part that actually prevents a mistake at the bench.

Two things it hides that the architecture must fix:

- **The paint library is incomplete and it fails silently.** Your inventory contains
  **XF-83 Medium Sea Gray** and **XF-84 Dark Iron**, neither of which exists in the MVP's
  `LIB` array. The MVP does not error — `familyFromPrefix()` infers "XF → flat" and renders a
  grey swatch with a quiet "not in the library" note. That is the correct fallback behaviour,
  but it means the paint catalogue needs to be real seed data, verified against the full
  Tamiya range, not a hand-maintained literal in a script tag.
- **Everything is per-session.** Nothing you do survives a refresh, which is exactly the gap
  features 4, 5 and 6 exist to close.

### 2.1 Your inventory as imported

Parsed from the Google Sheet — 33 paints across four groups. This becomes the Phase 2 seed.

- **Gloss (18):** X-2, X-3, X-6, X-7, X-8, X-9, X-10, X-11, X-12, X-13, X-14, X-18, X-19,
  X-21, X-22, X-24, X-26, X-27
  *Note: the sheet files X-21 Flat Base under Gloss, and X-19/X-22/X-24/X-26/X-27 are smoke
  and clears. The importer classifies by catalogue family, not by sheet column, so these land
  as `additive` and `clear` — which is what the ratio rules need.*
- **Flat (11):** XF-1, XF-2, XF-7, XF-16, XF-24, XF-53, XF-56, XF-60, XF-64, XF-83, XF-84
- **Sprays (2):** TS-7 Racing White, TS-8 Italian Red
- **Primers (2):** Liquid Surface Primer Grey, Liquid Surface Primer White

The sheet's merged-cell layout carries a name and a code and nothing else. It cannot express
how full a bottle is, whether a TS can has been decanted into a jar, or when you last bought
one — which is why the app database takes over as source of truth.

---

## 3. Data model

SQLite via **Drizzle ORM** (TypeScript-native schema, real migrations, no codegen step).
Types flow from the schema into the app with no hand-written duplicates.

### 3.1 Reference data — seeded, read-mostly

```
paint
  code            TEXT PK        -- "XF-64", canonical, normalised
  line            TEXT           -- X | XF | LP | TS | AS | PS | PRIMER
  name            TEXT           -- "Red Brown"
  hex             TEXT           -- swatch
  family          TEXT FK        -- ratio family (see ratio_rule)
  finish          TEXT           -- gloss | flat | semi | metallic | clear
  size_ml         INTEGER        -- 10 / 23 / 100
  discontinued    INTEGER        -- 0/1
  verified_at     TEXT

ratio_rule                       -- the MVP's R{} table, promoted to data
  family          TEXT PK        -- gloss | flat | semi | metallic | clear |
                                 -- lacquer | sprayDecant | polycarb | enamel |
                                 -- primer | additive
  thinner_type    TEXT           -- acrylic_retarder | lacquer_retarder | enamel_x20
  paint_parts     REAL
  thinner_parts   REAL
  window_lo       REAL
  window_hi       REAL
  psi_text        TEXT
  coats_text      TEXT
  distance_text   TEXT
  notes           TEXT           -- JSON array, the "On the bench · 1:24" bullets

ratio_override                   -- your rig, your corrections
  id              INTEGER PK
  paint_code      TEXT NULL FK   -- override one paint...
  family          TEXT NULL      -- ...or a whole family
  paint_parts     REAL
  thinner_parts   REAL
  psi_text        TEXT
  reason          TEXT           -- "XF-2 needs more thinner than the flat rule"
  created_at      TEXT

paint_equivalent                 -- cross-brand lookup, feature 3
  id              INTEGER PK
  brand           TEXT           -- mr_hobby | mr_color | aqueous | vallejo | ak | zero
  foreign_code    TEXT           -- "H12"
  foreign_name    TEXT
  tamiya_code     TEXT FK paint  -- the Tamiya equivalent — the direction you need
  match_quality   TEXT           -- exact | close | approximate
  source          TEXT           -- URL or "manufacturer chart" or "claude-research"
  notes           TEXT

vendor                           -- your actual shops
  id, name, country, url, notes, sort
```

`vendor` is seeded with Scalemates (research), Spot Model, KitMania (PT), Hobby Sector (PT),
Super Hobby (PT), El Taller del Modelista (ES).

### 3.2 Your data — read/write

```
inventory_item                   -- feature 4, paint half
  id              INTEGER PK
  paint_code      TEXT FK paint
  form            TEXT           -- bottle | spray_can | decanted_jar
  decanted_from   TEXT NULL FK   -- TS-8 can → decanted jar, keeps the lineage
  state           TEXT           -- sealed | open | low | empty
  quantity        INTEGER
  location        TEXT           -- "bench drawer", "shelf box 2"
  purchased_from  INTEGER NULL FK vendor
  purchased_at    TEXT
  notes           TEXT
  updated_at      TEXT

kit                              -- feature 4, stash half
  id              INTEGER PK
  brand           TEXT           -- "Tamiya"
  kit_number      TEXT           -- "24345"
  name            TEXT
  scale           TEXT           -- "1:24"
  status          TEXT           -- wishlist | owned | in_progress | built | shelved
  purchased_from  INTEGER NULL FK vendor
  purchased_price REAL
  currency        TEXT
  purchased_at    TEXT
  notes           TEXT
  created_at      TEXT

kit_research                     -- feature 2 cache, one row per kit per refresh
  id              INTEGER PK
  kit_id          INTEGER NULL FK  -- nullable: research before buying
  query           TEXT             -- what you typed
  resolved_brand  TEXT
  resolved_number TEXT
  resolved_name   TEXT
  manual_url      TEXT
  manual_file     TEXT NULL        -- local path once downloaded
  difficulty      TEXT             -- beginner | intermediate | advanced
  difficulty_note TEXT
  fit_issues      TEXT             -- JSON: [{issue, severity, source_url, confidence}]
  build_video_url TEXT
  sources         TEXT             -- JSON: every URL consulted
  model_used      TEXT
  input_tokens    INTEGER
  output_tokens   INTEGER
  researched_at   TEXT
  expires_at      TEXT

kit_paint_requirement            -- the manual's paint callouts
  id              INTEGER PK
  kit_id          INTEGER FK
  raw_label       TEXT           -- exactly as printed: "X-11 CHROME SILVER"
  paint_code      TEXT NULL FK   -- resolved, null if unresolvable
  part_hint       TEXT           -- "body", "engine block", "seats"
  source          TEXT           -- manual_pdf | research | manual_entry
  confidence      REAL
  created_at      TEXT

shopping_list_item               -- feature 3 output, persisted so you can tick it off
  id              INTEGER PK
  paint_code      TEXT FK paint
  kit_id          INTEGER NULL FK
  reason          TEXT           -- "needed for 24345, not in inventory"
  substitute_for  TEXT NULL      -- set when this is a cross-brand equivalent
  status          TEXT           -- needed | ordered | bought | skipped
  vendor_id       INTEGER NULL FK
  added_at        TEXT

build_log_entry                  -- feature 5
  id              INTEGER PK
  kit_id          INTEGER FK
  stage           TEXT           -- research | prep | primer | body_colour | clear |
                                 -- polish | interior | engine | chassis | decals | final
  title           TEXT
  body_md         TEXT
  occurred_on     TEXT
  created_at      TEXT

build_photo
  id              INTEGER PK
  entry_id        INTEGER FK
  file_path       TEXT           -- on the Fly volume
  caption         TEXT
  sort            INTEGER

airbrush                         -- feature 6; one row today, but modelled properly
  id              INTEGER PK
  model           TEXT           -- "Tamiya 74540 HG Trigger"
  nozzle_mm       REAL           -- 0.3
  cup_cc          REAL           -- 7
  acquired_at     TEXT

maintenance_log                  -- feature 6
  id              INTEGER PK
  airbrush_id     INTEGER FK
  type            TEXT           -- session_flush | deep_clean | needle_replace |
                                 -- oring_replace | lube | repair
  performed_on    TEXT
  notes           TEXT
  parts_used      TEXT
  created_at      TEXT

spray_session                    -- the loop that makes feature 1 learn
  id              INTEGER PK
  kit_id          INTEGER NULL FK
  paint_code      TEXT FK
  ratio_paint     REAL
  ratio_thinner   REAL
  thinner_type    TEXT
  psi             REAL
  coats           INTEGER
  ambient_temp    REAL
  humidity        REAL
  outcome         INTEGER        -- 1–5
  notes           TEXT           -- "orange peel, needed more thinner"
  sprayed_at      TEXT
```

### 3.3 Why `spray_session` earns its place

It is the only table that closes a loop. Log what you actually mixed and how it came out, and
the Thinner Bench can show "last three times you sprayed XF-64 you went wetter than the rule"
next to the starting ratio — and offer to promote that into a `ratio_override`. It also feeds
`maintenance_log` (sessions since last deep clean) and `build_log_entry` (what you sprayed on
which kit, dated). Without it, features 1, 5 and 6 stay three disconnected screens.

It is deliberately last in the build order — but modelling it now means the others don't need
reshaping later.

---

## 4. Application structure

### 4.1 Folders

```
scale-model-bench/
├── docs/
│   ├── PLAN.md                   ← this file
│   └── decisions/                ← short ADRs as things change
├── drizzle/                      ← generated migrations
├── data/                         ← volume mount in production
│   ├── bench.db
│   ├── manuals/                  ← downloaded kit manual PDFs
│   └── photos/                   ← build log photos
├── seed/
│   ├── paints.tamiya.json        ← full catalogue, verified
│   ├── ratio-rules.json          ← ported from the MVP's R{}
│   ├── equivalents.json          ← Mr Hobby / Aqueous → Tamiya
│   ├── vendors.json
│   └── inventory.initial.json    ← the Google Sheet, imported once
├── src/
│   ├── app/
│   │   ├── (bench)/
│   │   │   ├── thinner/          ← feature 1
│   │   │   ├── inventory/        ← feature 4a
│   │   │   ├── shopping/         ← feature 3
│   │   │   ├── kits/
│   │   │   │   ├── page.tsx      ← feature 4b, the stash
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── research/ ← feature 2
│   │   │   │       └── log/      ← feature 5
│   │   │   └── airbrush/         ← feature 6
│   │   ├── api/
│   │   │   ├── research/route.ts ← the only slow route; streams
│   │   │   └── ...
│   │   ├── login/
│   │   └── layout.tsx
│   ├── db/
│   │   ├── schema.ts             ← Drizzle table definitions
│   │   ├── client.ts             ← better-sqlite3 singleton
│   │   └── repositories/         ← all queries live here, nothing else touches db
│   ├── domain/
│   │   ├── ratio.ts              ← pure: family + overrides → ratio, window, cup fill
│   │   ├── paint-code.ts         ← normalise "xf64" / "XF 64" → "XF-64"
│   │   ├── equivalence.ts        ← cross-brand → Tamiya
│   │   └── shopping.ts           ← requirements − inventory → buy list
│   ├── research/                 ← feature 2, isolated (see §5)
│   │   ├── resolve.ts
│   │   ├── investigate.ts
│   │   ├── extract.ts
│   │   ├── manual-parse.ts
│   │   └── schema.ts             ← Zod, shared by extract + API route
│   ├── components/
│   └── styles/
│       └── tokens.css            ← the MVP's palette and type, lifted verbatim
├── scripts/
│   ├── import-sheet.ts
│   └── verify-catalogue.ts
└── tests/
```

### 4.2 Design system

The MVP's visual language transfers directly and should be extracted before any component is
written, so nothing gets re-invented per screen:

- **Palette:** `--ink #14161a`, `--panel #1c1f24`, `--line #2e333a`, `--paper #e8e4da`,
  `--dim #8d8a82`, `--red #c8202a`, `--thin #5d9dc4`, `--amber #d9a441`
- **Type:** Archivo Narrow 700 for display, IBM Plex Mono for everything else
- **Idioms worth keeping:** the hairline-bordered panel grid, uppercase letterspaced eyebrow
  labels, the red em-dash bullet list, the amber/red flag callout, the segmented cup bar

This is a dark, high-contrast, workshop-instrument aesthetic. It happens to be exactly right
for a phone screen under a bench lamp. Keep it; do not introduce a second visual idea.

### 4.3 Data access rule

Every query goes through `src/db/repositories/*`. Route handlers and components never import
the Drizzle client directly. This is what makes a future move to Turso — or to Postgres, if
this ever stops being a single-user app — a contained change.

---

## 5. Feature 2: how kit research actually works

This is the piece the MVP could not do, and the piece most likely to disappoint if built
naively. Three findings from checking the ground first:

1. **Scalemates is bot-hostile.** It is the best kit database on the web and it does not want
   scrapers. Direct HTML scraping will work until it abruptly doesn't. *(Note: it is also
   blocked outright by this planning sandbox's egress policy — that is a sandbox restriction,
   not a production one, but it does mean the pipeline cannot be smoke-tested from inside a
   Claude Code session. It must be tested against the deployed Fly machine.)*
2. **"Difficulty and fit-issue notes from reviews and forums" is a synthesis job.** No API
   returns it. It lives in prose scattered across build threads, review blogs and video
   descriptions. This is exactly what an LLM with web search is for, and exactly what a
   scraper cannot do.
3. **You do not need the YouTube Data API.** Its free tier allows ~100 searches/day and would
   add an API key, a quota budget and a failure mode. Claude's server-side web search finds
   the build video as part of the same call. Skip it; revisit only if you want structured
   video metadata (duration, channel, view count) later.

### 5.1 Pipeline

Four stages, each independently cacheable and independently testable.

```
  "24345" or "Tamiya Nissan GT-R"
        │
   [1] resolve      Claude + web_search, low effort
        │           → { brand, kit_number, name, scale, year, scalemates_url }
        │           Cheap, fast, disambiguates before spending on research.
        ▼
   [2] investigate  Claude Opus 5 + web_search_20260209 + web_fetch_20260209
        │           Free-form research with citations. Prompted to find:
        │             · the instruction manual PDF
        │             · difficulty consensus + specific fit issues, with sources
        │             · the manual's paint callout list
        │             · one good full-build video
        │           max_uses ~8. Streams (long turn).
        ▼
   [3] extract      Claude + messages.parse() with a Zod schema
        │           Converts stage 2's prose into strict typed JSON.
        │           Cheap: no web tools, just the transcript.
        ▼
   [4] manual-parse (optional, when a PDF was found)
                    PDF as a base64 document block → structured paint list.
                    Far more reliable than forum prose for feature 3's input.
```

**Why two passes instead of one.** Structured outputs (`output_config.format`) are
incompatible with citations, and citations are the thing that makes research output
trustworthy — you need the source URL next to every "the bonnet doesn't sit flush" claim.
Splitting research (cited, free-form) from extraction (typed, cheap) gets both. Stage 3 costs
a fraction of stage 2, so the split is close to free.

### 5.2 API shapes to use

Verified against current API documentation, not recalled:

- Model: `claude-opus-5`
- Thinking: `{ type: "adaptive" }` — no `budget_tokens`, which is rejected with a 400 on
  Opus 5
- Effort: `output_config: { effort: "medium" }` for resolve, `"high"` for investigate
- Web tools: `web_search_20260209` and `web_fetch_20260209` (the dynamic-filtering variants).
  Do **not** additionally declare `code_execution` — these run it internally.
- Streaming with `.finalMessage()` for stage 2; research turns are long
- **Handle `stop_reason: "pause_turn"`** — a long server-tool turn can pause, and an
  unhandled pause returns a silently truncated answer with no error
- Server-tool errors return HTTP 200 with an error object in the result block, not an
  exception. On web search, a success `content` is an array and an error `content` is an
  object — branch on that before indexing.
- Stage 3: `client.messages.parse()` with `zodOutputFormat(KitResearchSchema)`;
  `parsed_output` is null on failure, so guard it

### 5.3 Domain steering

Bias search toward what you actually use: `scalemates.com`, `spotmodel.com`, `tamiya.com`,
plus modelling forums and YouTube. Prefer `allowed_domains` as a soft preference in the
prompt rather than a hard filter — a hard allowlist will miss the one forum thread that
happens to describe the fit problem.

### 5.4 Cost, honestly

Roughly **€0.20–0.45 per newly researched kit** (Opus 5 at $5/$25 per MTok; web search
results dominate input tokens). Cached in `kit_research` with a long expiry — kit facts do
not change — and only re-run on an explicit **Refresh** button. Across a lifetime stash of
50 kits that is under €25 total. Every call records its own token counts in the row, so the
number stops being a guess after the first week.

### 5.5 Trust

Research output is synthesised from forum posts by a language model. Treat it accordingly:

- Every fit issue stores `source_url` and `confidence`, and the UI renders the source as a
  link next to the claim. No unsourced assertion appears as fact.
- Difficulty is shown as "consensus from N sources", never as a bare rating.
- A **Verify** action marks a research row as human-checked, and verified rows visually
  outrank unverified ones.

You are going to cut plastic based on this. It should always be one tap to see where a claim
came from.

---

## 6. Build phases

Sequenced so that each phase ships something usable on its own.

### Phase 0 — Foundations
Repo scaffold, Next.js App Router, Drizzle schema and first migration, `better-sqlite3`
client, design tokens extracted from the MVP, PWA manifest, passphrase auth, Fly.io deploy
with a mounted volume, Litestream backup.
**Ships:** a deployed empty app you can log into from your phone.

### Phase 1 — Thinner Bench *(feature 1)*
Port the MVP: paint lookup with type-ahead, family ratio rules from `ratio_rule`, the cup
fill visualiser and drop calculator, pressure / distance / coats, per-family bench notes, the
lacquer-vs-acrylic thinner warning, and the 74540 dry-tip guidance panel. Seed the **full**
Tamiya catalogue including XF-83 and XF-84. Add `ratio_override` editing so your corrections
persist.
**Ships:** the MVP, but correct, persistent, and on your phone.

### Phase 2 — Paint inventory *(feature 4a)*
Import the Google Sheet via `scripts/import-sheet.ts`. CRUD on `inventory_item` with
decanted-vs-stock, bottle state, and location. "Do I own this?" surfaced directly on the
Thinner Bench result card.
**Ships:** the standing-in-a-shop question answered.
*Sequencing note: this comes before feature 3 because the shopping list is meaningless
without it.*

### Phase 3 — Paint shopping *(feature 3)*
Requirements → inventory → buy list. Cross-brand equivalence (Mr Hobby / Mr Color / Aqueous →
Tamiya) with match quality shown. Shopping list persists with ordered/bought status and a
preferred vendor per line.

**Input in this phase is manual paste-or-type of a kit's paint list.** Feature 2 automates
that input in Phase 4 — but building the shopping engine against manual input first means it
is fully working and tested before the research pipeline exists, and it respects your
"start with 1 and 3" instruction without pretending the dependency isn't there.
**Ships:** a real buy list you can take to KitMania.

### Phase 4 — Kit research *(feature 2)*
The four-stage pipeline in §5. Manual PDF discovery and download, difficulty and fit-issue
synthesis with sources, build video, and paint-list extraction that feeds Phase 3 directly.
**Ships:** the thing the MVP couldn't do. Phase 3's manual input becomes a fallback.

### Phase 5 — Stash & build log *(features 4b + 5)*
Kit CRUD with wishlist / owned / in-progress / built. Per-kit dated journal by stage, with
photo upload to the volume. Research results attach to the kit record.
**Ships:** the project management half of the app.

### Phase 6 — Airbrush maintenance & the feedback loop *(feature 6)*
`maintenance_log` against the 74540. `spray_session` logging from the Thinner Bench in one
tap. Sessions-since-last-deep-clean surfaced as a nudge. "Your last three XF-64 mixes" shown
next to the starting ratio, promotable into a `ratio_override`.
**Ships:** the app stops being a reference and starts being a record.

---

## 7. Open questions

Not blocking — Phase 0 and 1 can start regardless — but worth your answer before the phase
that needs it.

1. **Phase 3 — which brands matter for equivalence?** You named Mr Hobby / Aqueous. Worth
   adding Mr Color (lacquer, different line to Aqueous), Zero Paints or AK Real Colors? The
   seed table is cheap to extend but the mappings need sourcing per brand.
2. **Phase 4 — hard domain allowlist or soft preference?** My recommendation is soft (§5.3),
   but if you would rather never see a result from a source you don't trust, say so.
3. **Phase 5 — photos on the volume, or object storage?** Volume is simpler and included in
   the plan. If you expect hundreds of build photos, S3-compatible storage is the better home
   and changes `build_photo.file_path` to a key.
4. **Currency and vendor pricing.** You buy from PT, ES and international shops. Should
   `shopping_list_item` track expected price per vendor, or is the vendor field just a note?
   Price tracking means either manual entry or per-shop scraping, which is its own project.
5. **Does the 74540 stay the only airbrush?** The schema supports more. The Thinner Bench
   copy is currently written *to* that specific rig — if a second airbrush is likely, the
   ratio rules need a rig dimension and that is much cheaper to add in Phase 1 than Phase 6.

---

## 8. What I am explicitly not proposing

- **No native mobile app.** A PWA covers it. Two codebases for a personal tool is a bad trade.
- **No two-way Google Sheets sync.** One-time import, then the app owns the data.
- **No direct scraping of Scalemates or the shops.** Fragile, unwelcome, and unnecessary given
  the research pipeline. Vendor links are stored as links.
- **No YouTube Data API** in Phase 4 (§5, finding 3).
- **No multi-user support, roles, or sharing.** One person, one passphrase. Adding it later is
  a schema migration, not an architecture change — the repository layer (§4.3) is what keeps
  that true.
