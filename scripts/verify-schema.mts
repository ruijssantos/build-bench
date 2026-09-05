import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { neon } from "@neondatabase/serverless";

import { loadLocalEnv } from "./load-env.mts";

/**
 * Answers "did `db:migrate` actually do what it said?" against a real
 * database — the question `npm run db:migrate` itself cannot answer, because
 * it prints "Migrations applied." whether it ran eight migrations or zero.
 *
 * There are two independent ways the answer can be "no", and this checks both:
 *
 * 1. **A stranded migration.** drizzle's migrator picks work by a single
 *    comparison: `max(created_at) in the database < the journal's "when"`,
 *    with that maximum read *once* before the loop (see the source in
 *    node_modules/drizzle-orm/neon-http/migrator.cjs). It does not track which
 *    migrations ran individually. So a journal entry whose `when` is *older*
 *    than something already recorded is skipped silently — and stays skipped
 *    on every future run, because the maximum only ever climbs. `db:migrate`
 *    reports success the whole time. 0007 shipped with exactly this defect;
 *    this check is what would have caught it.
 *
 * 2. **Drift.** Everything is recorded, but the live tables don't match what
 *    the migrations should have produced — a migration half-applied against
 *    Neon's non-transactional HTTP driver (the hazard scripts/migrate.mts is
 *    written around), or a column changed by hand.
 *
 * Drift is measured against `drizzle/meta/<latest>_snapshot.json` rather than
 * a list written out here. The snapshot is generated from schema.ts by
 * `db:generate`, so it is already the authoritative statement of the intended
 * end state, and this check keeps working as the schema grows instead of
 * rotting into a list nobody updates.
 *
 * Read-only: it issues nothing but SELECTs. Safe to run against production,
 * which is the point — that is the database whose state is in doubt.
 */

loadLocalEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(databaseUrl);

// ---------------------------------------------------------------------------
// What the migrations say should exist
// ---------------------------------------------------------------------------

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

interface Journal {
  entries: JournalEntry[];
}

interface SnapshotColumn {
  name: string;
  type: string;
}

interface SnapshotTable {
  name: string;
  columns: Record<string, SnapshotColumn>;
  indexes?: Record<string, { name: string }>;
}

interface Snapshot {
  tables: Record<string, SnapshotTable>;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

const journal = loadJson<Journal>("drizzle/meta/_journal.json");
const latest = journal.entries.at(-1);
if (!latest) {
  console.error("drizzle/meta/_journal.json has no entries.");
  process.exit(1);
}

/**
 * Snapshots are named for the migration that produced them, but not every
 * migration has one: a data-only migration written by hand (0005) never went
 * through `db:generate`, so the newest snapshot on disk may sit a number or
 * two behind the newest journal entry. Walk back until one is found.
 */
function latestSnapshot(): { tag: string; snapshot: Snapshot } {
  for (let i = journal.entries.length - 1; i >= 0; i--) {
    const tag = journal.entries[i]!.tag;
    const number = tag.slice(0, 4);
    try {
      return { tag, snapshot: loadJson<Snapshot>(`drizzle/meta/${number}_snapshot.json`) };
    } catch {
      continue;
    }
  }
  console.error("No snapshot found in drizzle/meta.");
  process.exit(1);
}

const { tag: snapshotTag, snapshot } = latestSnapshot();

/**
 * `serial` is a column *declaration*, not a stored type — Postgres reports the
 * underlying integer. Nothing else in this schema needs translating; a type
 * this doesn't know is compared verbatim, which is the safe direction (a false
 * mismatch is loud, a missed one is silent).
 */
const STORED_TYPE: Record<string, string> = {
  serial: "integer",
  bigserial: "bigint",
  smallserial: "smallint",
};

function storedType(declared: string): string {
  return STORED_TYPE[declared] ?? declared;
}

// ---------------------------------------------------------------------------
// What the database actually has
// ---------------------------------------------------------------------------

const problems: string[] = [];
const notes: string[] = [];

// --- 1. The bookkeeping table -----------------------------------------------

interface MigrationRow {
  hash: string;
  created_at: string;
}

const recorded = (await sql`
  select hash, created_at
  from drizzle.__drizzle_migrations
  order by created_at asc
`) as MigrationRow[];

/**
 * The migrator identifies nothing by name — it stores a sha256 of the .sql
 * file and the journal's `when`. Match on the hash first, since that survives
 * a journal edit; fall back to `when`, which survives a file edit (which
 * scripts/migrate.mts explicitly permits, for replay-safety fixes). A row
 * matching neither means the file changed *and* its timestamp moved.
 */
const byHash = new Map<string, string>();
const byWhen = new Map<number, string>();
for (const entry of journal.entries) {
  const contents = readFileSync(`drizzle/${entry.tag}.sql`, "utf-8");
  byHash.set(createHash("sha256").update(contents).digest("hex"), entry.tag);
  byWhen.set(entry.when, entry.tag);
}

const appliedTags = new Set<string>();
let highestRecorded = -1;

console.log(`Recorded in drizzle.__drizzle_migrations (${recorded.length} rows):`);
for (const row of recorded) {
  const millis = Number(row.created_at);
  highestRecorded = Math.max(highestRecorded, millis);
  const tag = byHash.get(row.hash) ?? byWhen.get(millis);
  if (tag) appliedTags.add(tag);
  console.log(
    `  ${(tag ?? "UNRECOGNISED").padEnd(38)} ${millis}  ${new Date(millis).toISOString()}`,
  );
}
console.log();

// --- 2. Stranded migrations --------------------------------------------------

for (const entry of journal.entries) {
  if (appliedTags.has(entry.tag)) continue;
  if (entry.when > highestRecorded) {
    notes.push(`${entry.tag} has not run yet — it will on the next \`npm run db:migrate\`.`);
  } else {
    problems.push(
      `${entry.tag} is STRANDED: its journal "when" (${entry.when}) is older than the ` +
        `newest recorded migration (${highestRecorded}), so the migrator skips it and ` +
        `always will. Raise its "when" above ${highestRecorded} in ` +
        `drizzle/meta/_journal.json and re-run db:migrate.`,
    );
  }
}

// --- 3. Drift against the snapshot -------------------------------------------

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
}

const liveColumns = (await sql`
  select table_name, column_name, data_type
  from information_schema.columns
  where table_schema = 'public'
`) as ColumnRow[];

const live = new Map<string, Map<string, string>>();
for (const row of liveColumns) {
  let table = live.get(row.table_name);
  if (!table) {
    table = new Map();
    live.set(row.table_name, table);
  }
  table.set(row.column_name, row.data_type);
}

const expectedTables = new Set<string>();

for (const table of Object.values(snapshot.tables)) {
  expectedTables.add(table.name);
  const actual = live.get(table.name);
  if (!actual) {
    problems.push(`table "${table.name}" is missing.`);
    continue;
  }

  for (const column of Object.values(table.columns)) {
    const actualType = actual.get(column.name);
    if (actualType === undefined) {
      problems.push(`${table.name}.${column.name} is missing.`);
      continue;
    }
    const expectedType = storedType(column.type);
    if (actualType !== expectedType) {
      problems.push(
        `${table.name}.${column.name} is ${actualType}, the schema says ${expectedType}.`,
      );
    }
  }

  for (const name of actual.keys()) {
    if (!(name in table.columns)) {
      problems.push(`${table.name}.${name} exists in the database but not in the schema.`);
    }
  }
}

for (const name of live.keys()) {
  if (!expectedTables.has(name)) {
    problems.push(`table "${name}" exists in the database but not in the schema.`);
  }
}

// --- 4. Indexes ---------------------------------------------------------------

/**
 * Only the named indexes the schema declares. Primary keys and unique
 * constraints bring their own indexes along, and those are the constraint's
 * business, not something the snapshot lists.
 */
const liveIndexes = new Set(
  ((await sql`
    select indexname from pg_indexes where schemaname = 'public'
  `) as Array<{ indexname: string }>).map((row) => row.indexname),
);

for (const table of Object.values(snapshot.tables)) {
  for (const index of Object.values(table.indexes ?? {})) {
    if (!liveIndexes.has(index.name)) {
      problems.push(`index "${index.name}" on ${table.name} is missing.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`Compared against drizzle/meta/${snapshotTag.slice(0, 4)}_snapshot.json.`);
console.log();

for (const note of notes) console.log(`note: ${note}`);
if (notes.length > 0) console.log();

if (problems.length === 0) {
  console.log("Schema matches. Every migration in the journal is recorded and applied.");
  process.exit(0);
}

console.error(`${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
for (const problem of problems) console.error(`  - ${problem}`);
process.exit(1);
