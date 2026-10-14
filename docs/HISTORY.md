# Build history

How The Build Bench got to where `docs/PLAN.md` describes it: what each phase
shipped, what the spec didn't settle and who decided, what broke and why. This
was `PLAN.md` §7 ("Status detail") until it outgrew the plan it was part of.
Half of that file was this account, and everything reading the plan for how
the app *is* had to read past how it got there.

`PLAN.md` §7 keeps the rules this history established and the items it left
open. A reference to "§7" in a code comment points to one of those, or, for a
story, to the matching section here.

## Phases 1–6, and the review rounds between them


Phase 1's catalogue script caught the XF-83/XF-84 gap the original prototype missed,
confirming both codes and names by search; their hex values are still unverified estimates,
flagged as such in `scripts/build-catalogue.ts`'s own comments — fix by eye against a real
bottle whenever convenient, no phase attached. Phase 2 shipped with two deviations from the
original one-line spec, both made during review: `inventory_item.location` was dropped
entirely (a real migration, not just UI), and `state` was trimmed to two values
(`open`/`low`, unset reads as "In Stock"). `open` was later dropped too, at the owner's
request: it read as redundant with the unset default, so `state` is now just `low`
(a real migration again, moving every existing `open` row to unset).

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

`kit_manual.label` is nullable free text. It was once picked on upload (Instructions, Decal
guide, Painting guide, Other) and shown as a chip on each manual; both were removed at the
owner's request — "Upload manual" now opens the file picker directly. The column is left in
place, unread and unwritten, holding whatever older rows were given.
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
giving owned 2 / missing 1 / unresolved 2, i.e. "Own 2 of 3 · 1 missing · +2 unresolved".

The UI then got the same treatment, which is what all of the above was found by: a local
Postgres seeded with the real 395-paint catalogue, a ten-bottle shelf and five kits spread
across all three statuses, with the driver temporarily pointed at it (reverted before commit —
`src/db/client.ts` is untouched). That confirmed, on phone and desktop, the display ordering,
the three chip colours, the filter pills and their counts, the readiness lines against a kit
deliberately built for the awkward case ("Own 3 of 5 · 2 missing · +2 unresolved", with TS-8
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

*What's still open:* ~~the second source the user offered (`mech9.com`'s conversion chart, also
unreachable from here) isn't incorporated — Phase 5 ships on the Cybermodeler data alone.~~
**Since incorporated**, by the same PDF-export route (§2.2, and the account later in this
section). §2.2's own documented fallback
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

## The Phase 6 sweep

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

## Phase 7 — what the spec didn't settle

**Tips got a column of their own** (`kit_research.tips`, migration 0006 — the schema was
otherwise already complete, which is why §5.1 could be built without touching it). §5.1 named
only fit issues, and folding advice into them would have been wrong: "the bonnet sits proud
unless the firewall is sanded" is a defect in the kit, "let the clear coat cure 48h before
polishing" is technique, and a list that mixes them can't be read for either. Same row shape,
so one component and one CSS rule render both.

**§5.4 is enforced in `normalizeResearch`, not in the components.** A claim whose `sourceUrl`
doesn't parse as an http(s) URL is *dropped* — not shown unsourced, not shown with a
placeholder. Putting that in the domain layer rather than in the panel means the next screen
to render these rows inherits the rule instead of having to remember it. `difficultyRating`
works the same way: it returns `null` when there is no difficulty or nothing was cited, so
a rating with nothing behind it is structurally incapable of degrading
into a bare "Intermediate". Sources are counted by **distinct host** — three threads on one
forum is one source agreeing with itself, and counting it as three is the exact false
confidence §5.4 exists to prevent.

**Both of §5.1's link-outs were cut on sight, and both deserved it.** The phase shipped a
build video and an "instructions online" link, per §5.1's original list. The owner removed
each within a minute of seeing it, for the same reason in both cases: **the page already gets
there.** `IdentityPanel` has carried Scalemates and a YouTube search since Phase 4a, and the
Manuals panel holds the real, uploaded instructions — so a video button or an instructions
button lower down the same screen is a second route to something one scroll up already does.
(The video was a link rather than an embed for its own reasons: a click-to-load facade still
needs YouTube's thumbnail hotlinked, which §8 rules out, and a real player is more JavaScript
than the whole app ships. Moot now.)

The fields went with the buttons rather than lingering behind them. Stage B is told not to
look for either, stage C to ignore them if the write-up mentions them, and `buildVideoUrl` /
`manualUrl` are out of the Zod schema, the normaliser and the repository — collecting a field
nothing renders is exactly the dead weight the Phase 6 sweep spent a commit removing, and
paying Opus to search for it is worse than merely storing it. `kit_research.build_video_url`
and `manual_url` stay as unused columns: both predate this phase (`0000_init`), both are
nullable, and dropping them would be a migration bought for nothing.

**The Verify tick went the same way, and taught the more interesting lesson.** §5.4 asked for
one — "verified rows visually outrank unverified" — and this phase implemented it faithfully:
a form action, no client JavaScript, flips `verified_by_me`, persists, turns the button green.
All of which worked, and none of which *meant* anything, because the panel holds exactly one
research row per kit and a single row cannot outrank anything. The rule had been written for a
shape the feature didn't end up having. Nobody noticed until it was on screen and the owner
asked what it was for.

Worth recording as a class of mistake rather than a one-off: **a spec line can be implemented
correctly and still be dead**, and the check that catches it is not "does this work" but "what
changes for the person looking at it". The idea underneath is fine one level down — a tick per
*claim*, sorting verified issues and tips above the rest — and §5.4 now says so. That is a
deliberate feature to build if it is ever wanted, not a line to re-implement.

What's left is the part only research can produce — claims about the kit, each with a source.
That is a better-shaped feature than the one specified: every link-out on the panel was a
thing the app could already reach, every control on it did nothing, and cutting all of them
leaves nothing on the panel that isn't a sourced claim.

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
research; the empty state on a kit with none; the Verify tick, which flipped, persisted a
reload and wrote the row with no client JavaScript (and has since been removed, above — it
worked exactly as specified and that turned out not to be the question); and the delete
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

## Phase 7's first real runs failed, and why

Two kits, both well documented, both ~3 minutes and ~€0.30, both ending in *"Research found
nothing it could cite for this kit."* Three faults stacked, and only the third was mine
alone — the first two are the kind of API default that does exactly what it says and still
surprises you.

**1. Dynamic filtering was on by default.** `web_search_20260209` and later default
`allowed_callers` to `["code_execution_20260120"]`: the search runs *inside* code execution,
which filters results before they reach the model. Sensible, cheaper — and it moves the
`web_search_tool_result` blocks *inside* the code execution result, where this route's
top-level scan never looked, and it changes what the model is citing from "these search
results" to "this code output". The `web_search_result_location` citations this whole feature
is built on stopped appearing. Fixed by asking for what the feature actually needs:
`allowed_callers: ["direct"]` on both web tools, paying more input tokens on a once-per-kit
call to get citations back.

**2. The prompt was pulling the other way.** It told the model to "name the URL you got it
from, **inline**, right next to the claim" — an instruction fully satisfied by typing a URL
into prose, with no citation object anywhere. The code then looked only for citation objects.
Two mechanisms for one job, and the prompt was steering away from the one being read.

**3. Zero citations was a hard, terminal failure — and that was the real bug.** The gate
reasoned that §5.4 needs a source per claim, so a citation-less write-up was worthless. But
the URLs *were* there, in the prose, exactly as instructed; the run was fine and the gate
threw it away, along with the write-up itself, which wasn't even saved on the failure path.
§5.4 never needed enforcing there: `normalizeResearch` already drops any claim whose
`sourceUrl` doesn't parse, so a genuinely unsourceable run still shows nothing — after a
cheap stage C rather than in place of one.

Source collection is now a structural walk for `url` keys at any depth, plus text-block
citations, plus a regex over the prose, and it is an **aid handed to stage C, never a gate**.
Failures keep their prose so a retry resumes at stage C. Verified against fixtures built from
the documented block shapes — top-level results, results nested in a code execution block, a
fetch result, an error object (which must not crash the walk), a citation, and inline URLs
wrapped in parentheses or trailing a full stop: all seven URLs recovered, no crash.

The lesson worth keeping is about defaults, not citations: **a server tool's defaults are part
of its response shape.** This code was written against the documented shape and then run
against a different one, because a default chose a different execution path. When a feature
depends on a specific field appearing, pin the setting that produces it rather than accepting
whatever is cheapest by default.

## And then it cost $1.60 a kit

The run that finally worked read **39 sources** and billed $1.60 — against §5.3's estimate of
€0.20–0.45. The owner's instinct was to cut the output ("I probably wouldn't need so much
info, or links to the sources"), and the output was the wrong end: all seven fit issues,
twelve tips and every source link together are a few hundred output tokens, perhaps a tenth of
the bill. **The money went into the reading, not the writing** — roughly 280K input tokens.

Three causes, and the first two came from the fix directly above:

1. **`max_content_tokens` was unset on web fetch.** Every fetched page entered context whole;
   a long forum thread is ~25K tokens and a PDF can reach 125K. Capped at 6K.
2. **Dynamic filtering had been pinned off on *both* web tools** to rescue citations — right
   for web search, where `web_search_result_location` lives, and pointless for web fetch,
   whose source URL is the URL it was handed, sitting in the result block that
   `collectUrlsFromBlock` already reads at any depth. Fetch is back on the filtering default;
   search stays direct. The asymmetry is the whole insight, and it was available at the time
   the pin was written.
3. **The loop compounds and nothing was cached.** Every search and fetch result is resent on
   each later iteration of the same turn at full price. Top-level `cache_control` reprices the
   accumulated prefix at ~0.1× (Sonnet 5's minimum cacheable prefix is 1024 tokens, which the
   system prompt plus tool definitions clears — worth checking, since a shorter prefix caches
   silently not at all).

Then the deliberate cuts: searches 6 → 3, fetches 4 → 2, claim caps 12 → 5 issues and 6 tips
(the run hit the 12 exactly, so it was already truncating), and the prompt now says the limits
are a brief rather than a quota to fill. **Sonnet 5 at `medium` effort** replaced Opus 5 at
`high`, at the owner's choice — the recommendation was to try everything above it first, since
model choice is the one lever that lowers the ceiling; the measured curve for research-shaped
work is nearly flat (`medium` matching the default's accuracy at 70–85% of cost), which is
what made it a reasonable call rather than a purely thrifty one.

Two things to carry forward. **The cheap fix and the expensive fix can be the same edit** — the
`allowed_callers` pin bought citations and cost 4× the bill, and nobody separated the two
halves until the invoice arrived. And when someone reports a cost problem, **check which end
of the pipe the tokens are actually in** before agreeing with the proposed cut: this one would
have removed the source links, kept the 39-source read, and saved almost nothing.

## Extraction reads five pages, and the dead schema is gone

Two changes that came out of asking the same cost question of the other two paid routes.

**Kit lookup was left alone, deliberately.** It is $0.02–0.05 a search on a handful of searches
a week, and its one obvious lever doesn't fire: the stable prefix is ~550 tokens of system
prompt plus a small tool definition, under Sonnet 5's 1024-token minimum, so a `cache_control`
marker there would cache nothing at all — silently, with no error. Padding a prompt to reach a
cache minimum means paying for the padding forever. Nothing to do here is the honest finding.

**Extraction now reads the first five pages.** The owner supplied the domain rule and it is a
good one: these manuals print the paint chart in the front matter, and the assembly steps that
follow re-use codes that chart already named rather than introducing new ones. Every page costs
image tokens *and* text tokens, so the pages after the chart were the bill. The API has no
page-range parameter — the caller has to hand it a shorter document — so `src/lib/pdf-pages.ts`
trims with `pdf-lib` before upload.

It is a default with a way out, not a cap, because the rule is about the common case and a few
boxings print their chart at the back. Extraction reports `foundPaintChart`; a `false` puts a
"read the whole manual" link on the row. A hard cap would have failed the other way — a short
paint list, no error, and the discovery happening at the bench, which is the same failure as a
wrong code.

**And the dead schema went** — the running catalogue this file kept accumulating, finally
cashed in (0007). `paint_brand` and `paint_equivalent`: seeded since 0000_init, never read,
kept through the Phase 6 sweep on the argument that Phase 7 might write `claude-research` rows
into them. Phase 7 shipped and doesn't, so the argument expired. `part_hint`: extracted on
every run, stored, rendered nowhere — the owner's call to drop it, and the useful part is that
it was also the *only* thing the assembly pages uniquely provided, which is what made the
five-page window cost nothing real. Then `confidence`, `decanted_from`, and seven `kit_research`
columns nothing had ever written.

The pattern worth naming: **every one of these was noticed and then kept**, each time for a
plausible future. Three sessions of "kept because Phase N might want it" is how a schema
acquires ten columns that describe nothing. The rule that would have prevented all of it is the
one `deleteKit` already states for its own children — add the column in the commit that starts
writing it.

**Then 0007 shipped stranded, and `Migrations applied.` said otherwise.** Its journal `when`
landed *behind* 0006's, because 0006's had been set by hand to clear main's 0005 after the
numbering collision and 0007 was left with whatever `db:generate` stamped. drizzle gates on a
single `max(created_at) < when` comparison, so on any database that had already recorded 0005
— which is every database main had been deployed to — 0007 was skipped, permanently, and the
run reported success. §9.5 has the mechanism and the fix.

Two things went wrong, and only one was the bug. The bug was a timestamp. The reason it could
have gone to production undetected is that **the migration step had no observable outcome**:
one hardcoded success line, printed before anything was checked, for a step whose entire job is
to change state. Every other risky path in this app was made to report what actually happened —
§7's own rule that every failure returns a reason — and the one that rewrites the shared schema
was exempt. `npm run db:verify` (`scripts/verify-schema.mts`) closes that: it names stranded
migrations, and it diffs the live tables against the generated snapshot, so a half-applied
migration against Neon's non-transactional driver shows up as drift rather than as silence.
Verified by rebuilding both starting states on a local Postgres — one that had seen 0005 and
one that hadn't — reproducing the skip, then confirming the corrected journal repairs the first
and replays harmlessly on the second.

**And the fix was pushed to a branch that had already merged.** #44's state was read at the
start of the turn, when it was open, and still believed half an hour later — by which time the
owner had merged it and moved on. The same mistake had been made on #40 and called out then, so
the correction that was actually needed wasn't "check the PR" (it *was* checked) but "a PR's
state is only true at the moment you read it". Both that and the journal-ordering invariant now
live in `AGENTS.md`, which is loaded into every session automatically — unlike this file, which
has to be gone looking for. That is the general shape: a lesson written only into the narrative
is a lesson that has to be remembered, and this one had already proved it wouldn't be.

**The cross-brand chart had never once been looked up successfully.** The first real extraction
— a Fujimi Ferrari 330 P4, whose paint table calls out Gunze Aqueous throughout — returned all
ten callouts correctly and resolved none of them. Two separate faults in `resolveForeignCode`,
either of which alone was enough:

1. **Zero padding.** Cybermodeler stores Gunze's codes padded to three digits, `H004`; the
   bottle, the box and every manual print `H4`. `foreignKey` normalised case and whitespace and
   stopped there, so the lookup missed every Gunze code there has ever been.
2. **Line preference.** With the padding fixed, eight of ten resolved — to `LP`, the lacquer
   line, because "first row that isn't a spray can" took whatever order Cybermodeler happened
   to list. The shelf (§2.1) is 29 of 33 bottles in `X`/`XF` and holds **all eight** of the
   acrylics those codes also map to. So the screen would have gone from "10 unresolved" to
   "8 missing" — every one of them already in the rack.

The second is the more instructive failure, because it is the one that looks like success. A
missing answer announces itself; a confident wrong one gets acted on, and the action here is
driving to a shop. Phase 5 shipped this chart, §9.5 documents it, and it was never exercised
against a real Japanese manual — the `verify-catalogue` gate checked that every row's Tamiya
code and brand were real, which is a statement about the chart's internal consistency and says
nothing about whether anything can be found in it. That gate now also resolves a handful of
codes *as printed* and asserts which Tamiya paint comes back, and was confirmed to fail when
each fault is put back.

`H38` (Steel Red) and `H86` (Red Madder) still resolve to nothing: the Cybermodeler chart has
no row for either, in any range, and the manual prints no Mr. Color number beside them to try
instead. That is the honest gap the Unresolved bucket exists for, and the right outcome — as is
dropping the table's eleventh row, `H A = H8 + H9 (1:1)`, which is a mixing instruction rather
than a paint to own.

**Then the chart got a second source, and the interesting part was not the coverage.** mech9's
Gunze-indexed tables (§2.2) took the chart from 713 lookup keys to 802 and Gunze's H range from
77 codes to 132, which is the boring half. `H38` now resolves to `X-10` Gun Metal — right, once
you know 赤鉄色 is a dark *metallic* rather than a red. `H86` Monza Red still resolves to
nothing, and now for a much better reason: mech9 has a row for it listing Vallejo, Humbrol and
AK equivalents and no Tamiya at all. "No Tamiya paint matches this" is a finding; "our chart is
thin" was an absence.

Two things had to be got right to avoid making the data worse:

- **A Tamiya-shaped code is not necessarily Tamiya.** Xtracolour numbers its paints
  X001..X354 — the same shape as Tamiya's X-1..X-35. The parser only accepts a code when the
  word "Tamiya" sits where that cell's brand line belongs.
- **A second opinion must earn an override.** Merged naively, mech9 changed 15 existing answers
  for no reason at all: same product tier, same single-source confidence, tie broken by
  `seed/equivalents.json` being sorted by Tamiya code, so `X-15` beat `XF-4` *alphabetically*.
  Two fixes. `X` and `XF` now share a preference tier, because they are one product in two
  finishes and ranking them silently answers a question about finish; and ties fall to the
  incumbent source. A new chart now wins only by corroboration or by offering a better tier.
  After that the sweep across all 713 previously-resolvable codes reads: 691 unchanged, 22
  changed, and every one of the 22 a spray can replaced by a bottle.

The general lesson is the same one the migration bug taught, in a different costume: the danger
is never the missing answer, it is the plausible one. Both faults here would have produced a
screen that looked entirely fine.

**And then the re-run that was supposed to show all this off resolved nothing at all.** Not the
chart — the chart was right, and given the H code it still answered nine of the ten. The single
point of failure was upstream of it: `resolveCode` only ever asked the chart about `codeGuess`,
the model's separate opinion about which token in the label is the code. That run returned clean
labels and no `codeGuess` at all (the Mr. Color numbers vanished from the labels too, so its
whole output shape had shifted), and ten callouts came back unresolved with the answers sitting
right there.

Two things are worth keeping from it. The first is that **this was a known risk, written off**:
it was spotted while building the padding fix, judged speculative, and left — the same "kept
because a future phase might want it" reflex as the dead schema, pointed the other way. A single
field that the whole feature depends on and that an LLM may or may not populate is not a
speculative risk; it is the load-bearing one.

The second is where the fix goes. Not into the wire schema — making `codeGuess` required would
throw away a whole paid call over a missing field, which is exactly what §7 already learned not
to do. The label is the reliable half of what extraction returns, so the code is now recovered
from it as well, anchored at the head of the string where every manual prints it, and with
Tamiya-shaped prefixes rejected rather than looked up (a label leading `X-99` is a Tamiya
callout this catalogue lacks; answering it with Xtracolour's unrelated `X099` would fabricate a
match). `verify-catalogue` now runs real labels through `normalizeExtractedPaints` with
`codeGuess` omitted — checks 1-4 test the data, this one tests the path that reads it, which is
the gap that let a data-perfect chart return nothing.

**Colour distance closes the last gap, and is deliberately a weaker kind of answer.** mech9's
colour-chart pages turned out to hold the swatches as *vector fills* rather than images —
`pdfimages` finds 32 images on a page of ~200 swatches and every one is page furniture — so the
colour can be read straight from the content stream instead of rendering and sampling a pixel.
That is the number the page was authored with, not an approximation of it, and it lands 183/183
and 233/233 with nothing missed, because the swatch *is* the table cell's background and the
code is drawn on top of it: a label belongs to the fill containing it, with no nearest-neighbour
guessing anywhere.

With 416 hexes in hand, `H86` finally has an answer — `TS-86` Pure Red at **ΔE 1.9**, which for
a Ferrari body colour is worth walking into a shop with. Two details make it trustworthy rather
than merely impressive:

- **The formula is checked, not assumed.** CIEDE2000 has several places where a wrong
  implementation still returns plausible numbers — the hue average wrapping past 360°, the
  arctangent quadrant, the near-neutral cases where chroma collapses. `verify-catalogue` pins it
  against ten of Sharma, Wu & Dalal's published pairs to 1e-4. "The output looked reasonable" is
  precisely the evidence this file keeps recording as insufficient.
- **It corroborates the charts where both have an opinion.** `H38` → `X-10` Gun Metal, `H1` →
  `X-2` White, `H4` → `X-8` Lemon Yellow: colour distance independently reaches the answers the
  published tables already gave. That agreement is the reason to believe it on `H86`, where they
  are silent.

What it is *not* is a chart row. A published equivalence means somebody compared two paints and
called them a match; this is the distance between two depictions of them on a screen, and it
knows nothing about finish, flake or transparency — a clear orange and an opaque one can sit two
ΔE apart and behave nothing alike. So suggestions stay inside the Unresolved bucket, are styled
so they cannot be mistaken for an Owned or Missing chip, carry their ΔE and the candidate's
finish, and stop at ΔE 12, past which the nearest paint is merely the least distant one and
saying nothing is better.

**A top-three list was the wrong shape, and the owner's own question found it.** Asked whether
the app would have suggested TS-8 Italian Red — the spray a modeller would actually reach for on
a Ferrari, and one already on this shelf — the honest answer was: it ranked it, at ΔE 4.5, in
eighth place, three rows below the cut. Ranks 2-4 were a single Bright Red repeated in LP, TS
and PS form, and 5-6 a single Pure Red in two. Half the list was one colour said three ways.

Two fixes, both using what was already to hand. Candidates are **grouped by swatch**, so one
shade occupies one row and names its other lines in a tooltip. And the group is led by a paint
**you own**, when it holds one, flagged in the row — `bucketPaintRequirements` is handed the
shelf already, so this cost nothing but noticing. Italian Red now lands fourth of four and says
"on the shelf".

Ownership deliberately decides only *which member of a group is named*, never how the groups are
ordered. Distance ranks them. Promoting a worse colour match because it happens to be in the
rack would be telling the owner what they want to hear, which is the same failure as a
confidently wrong equivalence wearing a different hat.

**And the bucket got a way out.** Extraction reads small print off scanned diagrams; sometimes a
callout is a misread table cell, or something that isn't a paint at all, and without a way to
silence it the only escape is to stop reading the panel — which costs the Unresolved count the
meaning it exists to carry. So each row carries a **Dismiss** link, and the count follows it, on
the card as well as the detail page (two different queries, one number, so both learned the
`dismissed_at is null` filter).

The reset comes free rather than being built. `dismissed_at` is a column on
`kit_paint_requirement`, and re-running extraction *replaces* that manual's rows
(`replaceManualPaintRequirements`) — so a re-run cannot inherit a dismissal and nothing has to
remember to clear one. It is the same button the owner would already reach for on suspecting the
extraction had gone wrong, which is exactly when they'd want their dismissals back.

Two details caught by measuring rather than looking. Only genuinely unresolved rows can be
dismissed — the `paint_code is null` guard is in the UPDATE, not just the UI, so a stray call
can't hide a paint that resolved. And the link's tap target came out at 43 x 13px, the *same*
too-small target the research source links had; the same `padding: 12px 6px` / negative-margin
fix takes it to 55 x 37 without moving the row. A lesson recorded once in this file was not
enough to stop it recurring the moment a new control appeared.

Worth recording what remains true after both fixes: ΔE still puts Pure Red above Italian Red,
and by its own measure it is right — TS-86 really is closer to how the chart depicts H86. The
community's answer encodes something else entirely, that the car is a Ferrari and Ferraris are
painted Italian Red. Colour distance cannot know that, and no amount of tuning will teach it.
It narrows a dead end to four candidates; it does not pick.

## A kit is a kit — the detail page opens for wishlist kits

`/kits/[id]` used to 404 on a wishlist kit, and the research routes refused one ("you research
a kit to build it, not to want it"). That was backwards for how the app is used: the manual,
the paint check and the research are what you'd want *before* spending money on a kit. The
data never needed changing — one `kit` table, §3.3 — so this was entirely UI gates. No
migration.

- The detail page renders every status. The breadcrumb follows the status (Wishlist or
  Stash), so it moved inside the Suspense boundary; `KitDetailSkeleton` renders a placeholder
  `.crumb` of the same shape so nothing shifts when the kit resolves.
- The status ladder is four steps (Wishlist → Stash → Building → Built) only while the kit is
  on the wishlist, with **Move to stash** as its one action — the Wishlist card's own
  `markKitBought`. Once bought it's the old three steps; buying is still one-directional.
- "Purchase & dates" is hidden on a wishlist kit. Remove redirects to the list the kit was on.
- The full kit dialog (Edit / Add Manually) carries every field a kit has, Purchase & dates
  included, so there is one place to edit all of it; the four fields come from the shared
  `PurchaseFields` and save in the same UPDATE as the identity fields. They show only for a
  stash-side kit, on the same rule as the panel. The panel's own small dialog stays for
  editing just those.
- Status and dates move together both ways. The status buttons stamp Started/Completed
  (`updateKitStatus`, as before); now editing those dates by hand moves the status to match
  (`statusAfterDateEdit`), in the same UPDATE: a start date set on a stashed kit makes it
  Building, a completion date makes it Built, and clearing one steps it back. Only a date
  that changed in the edit moves anything, so a kit with no start date that reached Building
  before stamping existed isn't sent back to the shelf by an unrelated save. Adding a kit by
  hand with dates already filled in saves it straight into the matching status.
- `getStashReadiness` became `getKitReadiness` and covers every status. The Wishlist grid now
  asks for it, and its cards link to the detail page and show "Own 3 of 5 · 2 missing" /
  "Ready to build". The shop run stays scoped to `stash`/`building` — a kit you haven't
  bought doesn't put paint on the run.
- Research is still only ever started by its button. It's the paid path (§5.3), and wishlists
  hold more speculative kits than stashes do.

One measured cost worth recording: the first version called `promoteKitToStash` from the
detail page's new button, which reshuffled Turbopack's shared chunks and put `/wishlist`'s
initial JS **3 bytes** under its 150.0 kB budget (+117 B gzip over `main`), even though no
wishlist-page code had grown. Calling `markKitBought` instead — the same write, already in
that bundle — brought it to 149.5 kB, below where it started. `markKitBought` also now
invalidates `kitTag(id)`, which it never needed before because no page showed a single
wishlist kit.

## Equivalents — an LP or TS you don't own, covered by the X/XF you do

Some kits call out Tamiya's LP lacquers or TS sprays. Tamiya's own LP Color Compatibility Chart
(2024.4) lists, per LP colour, its Acrylic, Enamel, TS and AS matches. Transcribed by hand into
`seed/tamiya-lp-chart.json`: the 51 rows with an X/XF entry, plus that row's TS where it has
one (31 do). That gives LP → X/XF directly, and TS → X/XF by reading across a row — X-18 and
TS-29 on LP-5's row are the same colour. A TS the chart doesn't list (TS-36, fluorescent red,
has no LP) gets no match; that's a gap in the source, not a claim. AS and enamel are left out —
the owner's rule is "I have it in X or XF". No migration.

- The paint list still stores the code the manual printed. Whether it's covered is decided on
  read against the shelf, so buying or using up the X/XF bottle moves it between **Missing**
  and a new **Equivalents** bucket by itself. An LP/TS you own outright stays in Owned.
- Equivalents are not missing: they're off the "to buy" count and the shop run, and a kit
  whose only gaps are equivalents is Ready to build. On the kit cards they simply count as
  owned ("Own 14 of 17") — the detail page's Equivalents section is where they're itemised.
  (A first cut added "(2 via X/XF)" to the card line; the owner found it noise.) A card with
  nothing missing reads just "Ready to build", without the count.
- The chip reads `● LP-8 → ● X-8` — both swatches, solid outline in Owned's green — and opens
  the acrylic on the Thinner bench: that's the bottle being thinned.
- Card counts and the detail page are computed in different places (SQL aggregate vs.
  `bucketPaintRequirements`), so both read the same pairs: SQL through a `case` join in
  `db/repositories/acrylic-twin-shelf.ts`. `catalogue:verify` checks every pair is a real
  LP/TS and a real X/XF, and that the bucketing puts each case where it belongs.

## Missing is one click from Owned

A Missing chip used to link to a web search for the paint. What the owner actually needed
was the step after the shop: getting the paint onto the shelf without re-typing it in the
Paints screen one code at a time. So the Missing chip on the kit Paints panel, and the Missing
tag on the Dashboard's shop run, are now a **Bought** button (`MarkBought` →
`markPaintBought`). At rest they look as before; hover or focus turns them green and reads
"Bought". The two labels share one grid cell, so the chip keeps its width and the row doesn't
reflow under the pointer.

- One shelf row, quantity 1, in the form the code implies (`defaultFormFor`: spray can for
  TS/AS/PS, bottle otherwise — the Add dialog's pre-selection now uses the same function).
  Anything more particular is still Add/Edit on the Paints screen.
- Idempotent: a second click (or a second tab) finds the row already there and adds nothing.
- The shop run's **Low** tag gets the same treatment (`MarkBought restock` →
  `markLowRestocked`): the paint is already on the shelf, so "Bought" clears the running-low
  mark on every row for that code — the run lists low paints distinct by code — and leaves
  quantity alone.
- The re-render does the rest — Owned, the shop run, the Stash counts and the Paints screen
  all read the shelf, so nothing else needs telling.
