# CHANGES.md — patches for `vdvk-backend` (merge when integrating)

Everything here is **additive or a targeted fix** — no behavior is removed.
Apply in order; steps 1–2 are required for the loader/route, 3+ are hardening.

Files touched in the repo:

| # | File | Change |
|---|------|--------|
| 1 | `src/db/schema/master/vdvk-beneficiary.ts` | +15 nullable columns on `beneficiaries` |
| 2 | `src/routes/import/beneficiaries.ts` | **new** hardened bulk import route |
| 3 | `src/app.ts` | mount line for the new route |
| 4 | `src/routes/forms/form5-6.ts` | per-row error handling, dedupe, count recompute, defaults, list totals |
| 5 | DB | run `../beneficiaries-extension.sql` (via `node ../apply-extension.cjs`) |

---

## 1. Schema extension — `src/db/schema/master/vdvk-beneficiary.ts`

Add inside `pgTable("beneficiaries", { … })` (after `updatedAt`, before the index block):

```ts
  // ── field-data integration (nullable; see integration/README.md) ──
  referenceId:   varchar("reference_id",   { length: 191 }),
  dateOfBirth:   varchar("date_of_birth",  { length: 16 }),
  shgName:       varchar("shg_name",       { length: 191 }),
  tribe:         varchar("tribe",          { length: 64 }),
  education:     varchar("education",      { length: 64 }),
  occupation:    varchar("occupation",     { length: 64 }),
  bankName:      varchar("bank_name",      { length: 191 }),
  ifsc:          varchar("ifsc",           { length: 16 }),
  accountNumber: varchar("account_number", { length: 32 }),
  financialYear: varchar("financial_year", { length: 16 }),
  gramPanchayat: varchar("gram_panchayat", { length: 191 }),
  importFlags:   text("import_flags"),
  sourceFile:    varchar("source_file",    { length: 500 }),
  sourceSheet:   varchar("source_sheet",   { length: 191 }),
  proposedVdvk:  varchar("proposed_vdvk",  { length: 191 }),
```

Then either:

```bash
npx drizzle-kit generate     # creates the migration, apply with drizzle-kit migrate
# or straight to the live DB:
node integration/backend/apply-extension.cjs     # runs beneficiaries-extension.sql
```

(Both paths are idempotent — `ADD COLUMN IF NOT EXISTS`.)

---

## 2. New route — `src/routes/import/beneficiaries.ts`

Copy `integration/backend/import-beneficiaries.route.ts` into the repo as
`src/routes/import/beneficiaries.ts` (content is ready to drop in; exports
`beneficiaryImportRoutes`).

It provides `POST /api/import/beneficiaries` (MDA, multipart `file` field,
same CSV contract as form6 import = `members-import.csv`/`members-full.csv`
headers) with:

- one transaction for members + commodity maps + counts + audit log
- per-row try/catch → `failed[]` instead of aborting the upload
- Aadhaar **and** `(vdvk, name, gender)` dedupe (DB + within-file)
- `vdvkcode` existence check, mandal fallback from the VDVK, state/district defaults
- caps: 60 000 rows / 25 MB
- `beneficiary_count` **recomputed** after import
- `migration_log` entry

---

## 3. Mount — `src/app.ts`

```ts
import { beneficiaryImportRoutes } from "./routes/import/beneficiaries";   // near line 18
…
app.route("/api/import", importRoutes);
app.route("/api/import/beneficiaries", beneficiaryImportRoutes);           // after line 74
```

---

## 4. Hardening — `src/routes/forms/form5-6.ts`

### 4a. Count rule: recompute instead of `+N` (fixes double count)

The current code increments `beneficiary_count` at **import** (`+count`, line ~218),
**bulk** (`+rows.length`, ~250) and **approve** (`+1`, ~286) — a member imported as
Draft and later approved is counted twice, a rejected member is never removed, and
`POST /` never counts at all. Add one helper and use it everywhere:

```ts
// shared authoritative rule: registered members = everything except Rejected
async function recomputeBeneficiaryCount(tx: any, code: string) {
  await tx.update(vdvks).set({
    beneficiaryCount: sql`(SELECT count(*) FROM beneficiaries
                            WHERE vdvk_code = ${code} AND status <> 'Rejected')`,
  }).where(eq(vdvks.code, code));
}
```

Replace the four sites:

| Site | Current | Now |
|------|---------|-----|
| `POST /import` loop (line ~218) | `set({ beneficiaryCount: sql\`\`… + ${count}\`\` })` per code | `await recomputeBeneficiaryCount(db, vdvkCode)` per touched code |
| `POST /bulk` (line ~249) | `+ rows.length` | `await recomputeBeneficiaryCount(db, body.vdvkCode)` |
| `PATCH /:id/approve` (line ~284) | `+ 1` when approved, nothing on reject | **both** branches: `await recomputeBeneficiaryCount(db, r.vdvkCode)` |
| `POST /` (line ~152) | *(missing entirely)* | after insert: `await recomputeBeneficiaryCount(db, body.vdvkCode)` |

### 4b. `POST /import` — per-row safety + dedupe (line ~166)

Wrap the row-loop body in `try/catch` so one bad row lands in `failed[]`
instead of throwing a 500 mid-upload, and skip duplicates before insert:

```ts
// after `const headers = …`, before the loop:
const existingAad = new Set(
  (await db.select({ aadhaar: beneficiaries.aadhaar }).from(beneficiaries)
     .where(inArray(beneficiaries.aadhaar, rows.slice(1).map(r => r[5] || "").filter(a => /^\d{12}$/.test(a)))))
    .map(r => r.aadhaar));
const seenKeys = new Set<string>();
let skippedDuplicates = 0;

// inside the loop, after validation:
const aad = rec.aadhaar && /^\d{12}$/.test(rec.aadhaar) ? rec.aadhaar : null;
const key = `P:${rec.vdvkcode}|${rec.name.toUpperCase().replace(/[^A-Z0-9]/g, "")}|${rec.gender || ""}`;
if ((aad && existingAad.has(aad)) || seenKeys.has(key)) { skippedDuplicates++; continue; }
if (aad) existingAad.add(aad);
seenKeys.add(key);

// per-row try/catch:
try { …existing insertRow push… } catch (e) { failed.push({ row: i + 1, errors: [String(e)] }); }
```

Also fix inside the same handler:

```ts
// NOT NULL columns that could abort the batch:
state:    rec.state    || "Andhra Pradesh",
district: rec.district || "Alluri Sitarama Raju",
mandal:   rec.mandal   || vdvkOf(rec.vdvkcode)?.mandal,   // was: rec.mandal || null → 500
```

(validate `vdvkcode` against a pre-fetched `SELECT code, mandal FROM vdvks`
before the loop; unknown codes → `failed[]`.)

Wrap `db.insert(beneficiaries)` + commodity insert + count updates in
`await db.transaction(async (tx) => { … })` and log it:

```ts
await db.insert(migrationLog).values({
  entity: "beneficiaries", recordCount: insertRows.length, migratedBy: user.userId,
  sourceFile: file.name, remarks: `form6 /import; skippedDuplicates=${skippedDuplicates}`,
});
```

### 4c. `GET /` — clamped limit + totals (line ~315)

The UI gets a bare array, so it cannot render "showing 50 of 29 500". Return
totals and clamp the limit (a `limit=1000000` bypasses pagination today):

```ts
const limit = Math.min(Math.max(Number(limitQ) || 50, 1), 200);
const page = Math.max(Number(pageQ) || 1, 1);
const rows = await db.select().from(beneficiaries).where(and(...conds))
  .orderBy(desc(beneficiaries.createdAt))
  .limit(limit).offset((page - 1) * limit);
const [{ total }] = await db.select({ total: sql<number>`count(*)` })
  .from(beneficiaries).where(and(...conds));
return c.json({ rows, total, page, limit });
```

⚠ Frontend impact: response shape changes from array → `{ rows, total, page, limit }`.
If the frontend must stay untouched, keep the array and add
`c.header("X-Total-Count", String(total))` instead.

---

## 5. Do NOT touch

- `src/db/seed/seed.ts` / `full-reset-seed.cjs` (legacy Turso numbering — wrong MND codes).
- Canonical seed = `src/db/seed/seed.cjs` + `data/real-data.cjs`.
- District in DB is **`Alluri Sitarama Raju`** — never write variants.
