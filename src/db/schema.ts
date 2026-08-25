import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Schema — docs/PLAN.md §3.
 *
 * Nullability convention: a column is `.notNull()` only where the plan's
 * pseudo-schema either omits "NULL" on a foreign key, or the column is
 * structurally required (a primary key, or a foreign key that anchors the
 * row's identity — e.g. every kit_manual belongs to a kit). Descriptive
 * fields (notes, names, free text) are left nullable even where the plan
 * didn't mark them, since no insert logic exists yet to justify a stricter
 * constraint — tightening a column later is cheap, loosening a NOT NULL
 * that's already blocking real inserts is not.
 */

// ---------------------------------------------------------------------------
// 3.1 Reference data — seeded, read-mostly
// ---------------------------------------------------------------------------

export const ratioRule = pgTable("ratio_rule", {
  family: text("family").primaryKey(), // gloss | flat | semi | metallic | clear | lacquer |
  // sprayDecant | polycarb | enamel | primer | additive
  thinnerType: text("thinner_type"), // acrylic_retarder | lacquer_retarder | enamel_x20
  paintParts: real("paint_parts"),
  thinnerParts: real("thinner_parts"),
  windowLo: real("window_lo"),
  windowHi: real("window_hi"),
  psiText: text("psi_text"),
  coatsText: text("coats_text"),
  distanceText: text("distance_text"),
  notes: jsonb("notes").$type<string[]>(), // the "On the bench · 1:24" bullets
});

export const paint = pgTable("paint", {
  code: text("code").primaryKey(), // "XF-64", canonical, normalised
  line: text("line"), // X | XF | LP | TS | AS | PS | PRIMER
  name: text("name"),
  hex: text("hex"),
  family: text("family").references(() => ratioRule.family),
  finish: text("finish"), // gloss | flat | semi | metallic | clear
  sizeMl: integer("size_ml"),
  discontinued: boolean("discontinued").default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
});

export const ratioOverride = pgTable("ratio_override", {
  id: serial("id").primaryKey(),
  paintCode: text("paint_code").references(() => paint.code), // override one paint...
  family: text("family").references(() => ratioRule.family), // ...or a whole family
  paintParts: real("paint_parts"),
  thinnerParts: real("thinner_parts"),
  psiText: text("psi_text"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const paintBrand = pgTable("paint_brand", {
  // gunze_mr_hobby | revell | vallejo | ammo | testors | lifecolor | xtracolour |
  // hataka | mission — display ordering, §2.2
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  sort: integer("sort").notNull(),
});

export const paintEquivalent = pgTable(
  "paint_equivalent",
  {
    id: serial("id").primaryKey(),
    brand: text("brand")
      .notNull()
      .references(() => paintBrand.key),
    foreignCode: text("foreign_code").notNull(), // "H12"
    foreignName: text("foreign_name"),
    tamiyaCode: text("tamiya_code")
      .notNull()
      .references(() => paint.code), // the direction you need
    matchQuality: text("match_quality"), // exact | close | approximate
    source: text("source"), // cybermodeler | manufacturer | claude-research
    notes: text("notes"),
  },
  (table) => [
    index("paint_equivalent_brand_foreign_code_idx").on(table.brand, table.foreignCode),
    index("paint_equivalent_tamiya_code_idx").on(table.tamiyaCode),
  ],
);

export const vendor = pgTable("vendor", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country"),
  url: text("url"),
  notes: text("notes"),
  sort: integer("sort"),
});

// ---------------------------------------------------------------------------
// 3.2 Your data — read/write
// ---------------------------------------------------------------------------

export const inventoryItem = pgTable("inventory_item", {
  id: serial("id").primaryKey(),
  paintCode: text("paint_code")
    .notNull()
    .references(() => paint.code),
  form: text("form"), // bottle | spray_can | decanted_jar
  decantedFrom: text("decanted_from").references(() => paint.code), // TS-8 can → decanted jar
  state: text("state"), // open | low (null reads as "in stock")
  quantity: integer("quantity"),
  purchasedFrom: integer("purchased_from").references(() => vendor.id),
  purchasedAt: date("purchased_at"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const kit = pgTable("kit", {
  id: serial("id").primaryKey(),
  brand: text("brand"),
  kitNumber: text("kit_number"),
  name: text("name"),
  scale: text("scale"),
  status: text("status"), // wishlist | owned | in_progress | built | shelved
  purchasedFrom: integer("purchased_from").references(() => vendor.id),
  purchasedPrice: numeric("purchased_price"),
  currency: text("currency"),
  purchasedAt: date("purchased_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const kitManual = pgTable("kit_manual", {
  // YOU upload these — §4.3, never auto-downloaded
  id: serial("id").primaryKey(),
  kitId: integer("kit_id")
    .notNull()
    .references(() => kit.id),
  blobUrl: text("blob_url").notNull(), // Vercel Blob
  filename: text("filename"),
  sizeBytes: integer("size_bytes"),
  pageCount: integer("page_count"),
  paintsExtractedAt: timestamp("paints_extracted_at", { withTimezone: true }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow(),
});

export const researchJob = pgTable("research_job", {
  // drives the staged pipeline — §5.1
  id: uuid("id").primaryKey().defaultRandom(),
  kitId: integer("kit_id").references(() => kit.id), // nullable: research before buying
  query: text("query"),
  stage: text("stage"), // resolve | investigate | extract | done | failed
  stageStatus: jsonb("stage_status").$type<
    Record<string, { ok: boolean; error?: string; durationMs?: number; tokens?: number }>
  >(),
  partial: jsonb("partial").$type<Record<string, unknown>>(), // accumulated result between stages
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const kitResearch = pgTable("kit_research", {
  // the finished, cached result
  id: serial("id").primaryKey(),
  kitId: integer("kit_id").references(() => kit.id),
  jobId: uuid("job_id")
    .notNull()
    .references(() => researchJob.id),
  resolvedBrand: text("resolved_brand"),
  resolvedNumber: text("resolved_number"),
  resolvedName: text("resolved_name"),
  manualUrl: text("manual_url"), // a LINK it found; the app does not download it
  difficulty: text("difficulty"), // beginner | intermediate | advanced
  difficultyNote: text("difficulty_note"),
  fitIssues: jsonb("fit_issues").$type<
    Array<{ issue: string; severity: string; sourceUrl: string; confidence: number }>
  >(),
  buildVideoUrl: text("build_video_url"),
  sources: jsonb("sources").$type<string[]>(),
  modelUsed: text("model_used"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  verifiedByMe: boolean("verified_by_me").default(false), // §5.4
  researchedAt: timestamp("researched_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const kitPaintRequirement = pgTable("kit_paint_requirement", {
  // the manual's paint callouts
  id: serial("id").primaryKey(),
  kitId: integer("kit_id")
    .notNull()
    .references(() => kit.id),
  manualId: integer("manual_id").references(() => kitManual.id),
  rawLabel: text("raw_label"), // exactly as printed: "X-11 CHROME SILVER"
  paintCode: text("paint_code").references(() => paint.code), // resolved; null if unresolvable
  partHint: text("part_hint"),
  source: text("source"), // manual_pdf | research | manual_entry
  confidence: real("confidence"),
});

export const shoppingListItem = pgTable("shopping_list_item", {
  // feature 3 output, persisted so you can tick it off
  id: serial("id").primaryKey(),
  paintCode: text("paint_code")
    .notNull()
    .references(() => paint.code),
  kitId: integer("kit_id").references(() => kit.id),
  reason: text("reason"),
  substituteFor: text("substitute_for"), // set when this is a cross-brand equivalent
  status: text("status"), // needed | ordered | bought | skipped
  vendorId: integer("vendor_id").references(() => vendor.id), // a note, not a price
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
});

export const buildLogEntry = pgTable("build_log_entry", {
  id: serial("id").primaryKey(),
  kitId: integer("kit_id")
    .notNull()
    .references(() => kit.id),
  stage: text("stage"), // research | prep | primer | body_colour | clear | polish |
  // interior | engine | chassis | decals | final
  title: text("title"),
  bodyMd: text("body_md"),
  occurredOn: date("occurred_on"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const buildPhoto = pgTable("build_photo", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id")
    .notNull()
    .references(() => buildLogEntry.id),
  blobUrl: text("blob_url").notNull(),
  caption: text("caption"),
  sort: integer("sort"),
});

export const airbrush = pgTable("airbrush", {
  // one row today: the 74540 — §2.3. Modelled for more; nothing assumes single-rig.
  id: serial("id").primaryKey(),
  model: text("model"), // "Tamiya 74540 HG Trigger"
  nozzleMm: real("nozzle_mm"), // 0.3
  cupCc: real("cup_cc"), // 7
  isActive: boolean("is_active").default(true),
  acquiredAt: date("acquired_at"),
});

export const maintenanceLog = pgTable("maintenance_log", {
  id: serial("id").primaryKey(),
  airbrushId: integer("airbrush_id")
    .notNull()
    .references(() => airbrush.id),
  type: text("type"), // session_flush | deep_clean | needle_replace | oring_replace |
  // lube | repair
  performedOn: date("performed_on"),
  notes: text("notes"),
  partsUsed: text("parts_used"),
});

export const spraySession = pgTable("spray_session", {
  // the loop that makes feature 1 learn — §3.3
  id: serial("id").primaryKey(),
  kitId: integer("kit_id").references(() => kit.id),
  paintCode: text("paint_code")
    .notNull()
    .references(() => paint.code),
  ratioPaint: real("ratio_paint"),
  ratioThinner: real("ratio_thinner"),
  thinnerType: text("thinner_type"),
  psi: real("psi"),
  coats: integer("coats"),
  ambientTemp: real("ambient_temp"),
  humidity: real("humidity"),
  outcome: integer("outcome"), // 1–5
  notes: text("notes"), // "orange peel, needed more thinner"
  sprayedAt: timestamp("sprayed_at", { withTimezone: true }).defaultNow(),
});
