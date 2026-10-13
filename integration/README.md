# VDVK field-data integration package

Turns the six field-data zips in `D:\1A Gopal\New folder` into database-ready
member records for the VDVK MIS (`vdvk` repo), **without touching any existing
repo code** — everything lives in this folder and merges in via
`backend/CHANGES.md`.

```
integration/
├── tools/                       # offline converters (Node, no DB needed)
│   ├── extract.mjs              # unzip the 6 archives → data/raw/
│   ├── convert-members.mjs      # ★ core: Excel → members CSVs + reports
│   ├── check-identity.mjs       # dedupe-rule diagnostic on the loader input
│   ├── evidence.mjs / census.mjs  # analysis helpers (villages, headers, labels)
│   └── diagnose.mjs, probe-*.mjs   # post-run spot checks
├── data/
│   ├── raw/                     # extracted workbooks (90 .xls/.xlsx)
│   ├── members-full.csv         # ★ 29,793 members, 29 cols (load this)
│   ├── members-import.csv       # 13-col form6 contract (for the UI import)
│   ├── members-unmatched.csv    # 1,067 quarantined rows (no trusted VDVK)
│   ├── new-vdvk-proposals.csv   # 6 entities missing from the VDVK master
│   ├── coverage-vs-report.csv   # per-VDVK: loaded vs Member-Wise report
│   ├── vdvk-reconciliation.csv  # every source VDVK spelling → matched code
│   ├── vdvk-master-list.csv     # seed codes + loaded counts
│   ├── import-report.md         # ★ full conversion report (start here)
│   ├── vdvk-aliases.json        # ★ editable mapping table (re-run to apply)
│   └── evidence.txt, proposed-census.csv
└── backend/                     # DB side — merges into vdvk-backend
    ├── CHANGES.md               # ★ merge instructions for the repo
    ├── beneficiaries-extension.sql  # +15 nullable columns on beneficiaries (PG)
    ├── apply-extension.cjs      # applies the SQL (DATABASE_URL + ca.pem)
    ├── import-members.cjs       # ★ offline batch loader, PostgreSQL (idempotent)
    ├── import-beneficiaries.route.ts  # hardened POST route (drop-in)
    ├── turso-client.cjs         # shared libSQL client (turso.json / env)
    ├── turso.json               # Turso url + auth token (local only, not for repo)
    ├── full-reset-seed.libsql.cjs  # ★ canonical seed.cjs port for Turso (fresh reset)
    ├── apply-extension-libsql.cjs  # +15 columns + canonical indexes (SQLite DDL)
    ├── import-members.libsql.cjs   # ★ ★ THE LOADER THAT RAN — libSQL member load
    ├── verify-load.mjs          # post-load verification vs the report
    ├── wipe-members.cjs         # remove loaded members for a clean re-load
    └── probe-turso.mjs          # read-only DB inventory
```

---

## 1. What the field data is

| Workbook family | Content |
|---|---|
| **Per-VDVK files** (`…/Pedabayalu/…`, `…/Paderu/…`, one folder per mandal) | Full 47-column member sheets per VDVK: name, age, gender, mobile, Aadhaar, address, village, `Name of Proposed VDVK`, … |
| **District-wide files** (`ANANTHAGIRT MANDAL…`, `ARAKU VALLEY…`, `BANGARUMETTA VDVK FINAL.xls`, …) | The same members re-listed per mandal — overlapping copies of the per-VDVK data |
| **`VDVKs Member Wise Data Report.xlsx`** | Official report: expected member count (≈300) per VDVK — used as the coverage baseline |
| `VDVK - Faciltiy Master / MACHINERY / MFP / New Machinery` | Facility/machinery masters (not members — not converted here) |

Quirks handled by the converter: headerless continuation sheets (template
header from the NGO workbook), header rows that are *not* row 1, style-inflated
sheets (real-extent parsing), duplicate workbook copies across zips,
`~$`/report/Shg-Gatherer exclusions, and 800 822 blank-name rows.

---

## 2. Pipeline

```powershell
# 1. convert (90 files → CSVs + reports)          [tools/]
node --max-old-space-size=4096 convert-members.mjs

# 2. review the outputs                            [data/]
#    import-report.md, coverage-vs-report.csv, members-unmatched.csv,
#    new-vdvk-proposals.csv, vdvk-reconciliation.csv

# 3. tune mappings: edit data/vdvk-aliases.json → re-run step 1

# 4. database side                                 [backend/]
node apply-extension.cjs                          # +15 columns (idempotent)
node --max-old-space-size=4096 import-members.cjs --dry-run --create-missing-vdvk
node --max-old-space-size=4096 import-members.cjs --create-missing-vdvk            # → Draft
#   …or with --status=Approved, see backend/CHANGES.md for all flags
```

The loader reads `DATABASE_URL` (+ `ca.pem`) from the environment or from
`vdvk-backend/.env`, runs **one transaction**, and is **idempotent** — re-runs
skip members already present (Aadhaar authoritative, else
`(vdvk, name, gender)` key), so it is safe to iterate.

### Turso (libSQL) variant — **this is what ran, 2026-10-12**

```powershell
# database side on Turso (backend/, creds in turso.json)
node full-reset-seed.libsql.cjs            # fresh reset + canonical masters (demo members skipped)
node apply-extension-libsql.cjs            # +15 columns + canonical indexes (idempotent)
node --max-old-space-size=4096 import-members.libsql.cjs --dry-run --create-missing-vdvk   # plan + validation, no writes
node --max-old-space-size=4096 import-members.libsql.cjs --create-missing-vdvk            # → 30,085 members, Draft
node verify-load.mjs                       # post-load verification vs the Member Wise report
```

Differences from the Postgres path: `db.transaction("write")` for the seed,
auto-commit chunked statements for the member load (Turso aborts interactive
transactions held open across tens of thousands of inserts), `pragma_table_info`
introspection, booleans bound as 0/1. A partial load resumes safely — re-run
the same command and identity dedupe skips what is already committed
(`wipe-members.cjs` starts over from zero members).

---

## 3. Latest conversion result

| Metric | Value |
|---|---|
| Files / raw rows | 90 / 307 057 (193 sheets) |
| **Unique members matched** | **29 793** |
| Quarantined (no trusted VDVK) | 1 067 |
| VDVKs receiving data | **95 / 106** |
| Dedupe removed | 263 621 duplicate Aadhaar, 3 648 duplicate name-keys, 8 712 duplicate quarantine rows, 216 superseded |
| Source VDVK spellings reconciled | 365 → 335 matched / 1 ambiguous / 31 unmatched |
| Report gaps | **1**: VDK-087 GUTTULAPUTTU (0/300, see findings) |
| New-VDVK proposals | 6 (2 sanctioned by the report → loader creates them with `--create-missing-vdvk`) |

Per-VDVK coverage vs the official report is in `coverage-vs-report.csv` —
after tuning, **every loaded VDVK is within ±90 of its sanctioned count**
except the single GUTTULAPUTTU gap.

### How matching works (`convert-members.mjs`)

1. **Scoped aliases** (`file:`/`sheet:`/`village:` keys in `vdvk-aliases.json`)
   — e.g. *every* row in the NGO/VELUGU workbooks → VDK-101/VDK-103.
2. **Plain aliases** — exact source spelling → seed code (evidence-checked).
3. **Matcher tiers** — normalised alias → exact variant → token-set → prefix →
   contains → single-token → fuzzy (edit distance 1–2), always inside the
   mandal context pool first.
4. **Fallbacks** — blank proposed value → sheet name, then file name
   (never a district-wide workbook).
5. Anything present-but-unmatched → **quarantine**, never a guess.

Blank-proposed + district copies + weak identities are handled by
*Aadhaar-or-name-key* dedupe; a later matched row supersedes an earlier
quarantined one.

---

## 4. Findings worth knowing

- **The report annotates alternate names in parentheses** — this resolved the
  last two "mysterious" gaps:
  - report row *“DUMBRIGUDA FPO VDVK **(KANDRUM)**”* = seed **VDK-030** →
    source label `FPO DUMBRIGUDA` aliased to VDK-030 (now 326/300);
  - report row *“PADERU FPO VDVK **(GUTTULAPUTTU)**”* = seed **VDK-092**.
- **VDK-087 GUTTULAPUTTU (0/300)** — no workbook anywhere labels a VDVK
  “Guttulaputtu”. 128 members *from Guttulaputtu village* sit inside the
  VDK-092 PADERU FPO group, and the report lists that group twice under the two
  names above. The source data likely contains **one** Guttulaputtu-area group,
  not two. Left unloaded and flagged — confirm with the district office before
  deciding (split VDK-092, or accept 0).
- **Sanctioned-but-missing masters**: report rows `KUMBIDISINGI VDVK` (MND-006)
  and `KOYYURU FPO VDVK` (MND-008) have member data but no seed VDVK →
  `new-vdvk-proposals.csv` (`inReport=yes`) and created by the loader flag.
- **Source-only entities** (data but no report row — create only if the office
  confirms): `Gudemkothaveedhi` (MND-005), `kothapalem`+`KOTTAPALEM`
  (probably one VDVK, MND-003), `kotnapallivdvk` (MND-007).
- **Double-counting root causes fixed**: district copies of the same people
  (deduped by Aadhaar, else name-key within a VDVK) — e.g. DEVAPURAM 612→380,
  KOTTURU 598→300, BADIMELA 507→309, PEDAKODAPALLI 636→333.
- **Quarantine is by design**: `members-unmatched.csv` holds every row whose
  proposed VDVK could not be matched with confidence (1 067 — junk labels like
  `yes`, `coffeebeans`, plus the 6 unconfirmed entities). Add an alias and
  re-run to absorb any of them.

---

## 5. Integrating into the repo

Follow **`backend/CHANGES.md`** in order:

1. Add the 15 nullable columns (Drizzle block + `beneficiaries-extension.sql`).
2. Drop in `import-beneficiaries.route.ts` as `src/routes/import/beneficiaries.ts`
   and mount it in `src/app.ts`.
3. Patch `form5-6.ts`: per-row try/catch, duplicate skip, state/district/mandal
   defaults, transaction + audit log, and **recompute** (not `+N`)
   `beneficiary_count` at all four sites — fixing the draft-then-approve double
   count.
4. Optional: `GET /` returns totals so the UI can paginate 29 793 members.

For a UI-driven load instead of the offline loader, export
`members-import.csv` (13-column form6 contract) through the existing
`POST /forms/form6/import`, or the new hardened route.

---

## 6. Open items

- [ ] Confirm GUTTULAPUTTU/VDK-087 handling (see findings).
- [ ] District office to confirm the 4 source-only entities before creation.
- [x] ~~Run the extension + loader against the live DB~~ — **done on Turso,
      see §7**. The PostgreSQL variants remain ready for a Railway/Aiven target.
- [ ] Optional frontend change for `GET /` totals (CHANGES.md §4c).
- [ ] Decide whether the 30,085 members should stay `Draft` (approve via the
      UI or re-run the loader with `--status=Approved` after `wipe-members.cjs`).

---

## 7. Execution record — Turso (libSQL), 2026-10-12

The `vdvk-gurveer.aws-ap-south-1.turso.io` database (the app's original DB)
was **fresh-reset to the canonical seed and loaded with the field data**:

| Step | Result |
|---|---|
| `full-reset-seed.libsql.cjs` | 52 tables wiped → canonical masters: 1 state, 1 district, 11 mandals, 188 villages, 2 schemes, 20 commodities/8 grades/9 rates, 17 exp-heads, 10 customers, 3 suppliers, **106 VDVKs + 175 commodity maps**, 56 facilities (+293 maps), 215 machinery, 89 users (+92 roles, password `Vdvk@2025`), 14 config keys, 3 templates. The 456 synthetic seed beneficiaries were **skipped on purpose** — the real field data replaces them. |
| `apply-extension-libsql.cjs` | +15 nullable provenance columns; canonical indexes already present; beneficiary_count repaired |
| `import-members.libsql.cjs --create-missing-vdvk` | read 30,298 → **inserted 30,085 members** (213 in-file duplicate Aadhaar collapsed), 44,522 beneficiary↔commodity rows, `VDK-107 KOYYURU FPO VDVK` (274) + `VDK-108 KUMBIDISINGI VDVK` (231) created, counts recomputed for 97 VDVKs, migration_log #2 written |
| `verify-load.mjs` | 97/108 VDVKs populated; 0 duplicate Aadhaar (29,427 distinct/29,427); beneficiary_count rule ✓ all 108; provenance complete (source file/sheet on 30,085 rows, SHG 29,311, bank 29,011, account 29,199, IFSC 28,913, FY 29,403, flags 11,012); only VDK-087 (−300, the documented report gap) and VDK-103 (converter couldn't tie its report row) exceed ±90 vs the report |

**Bugs found & fixed along the way** (details in `backend/CHANGES.md`):

1. **Repo `seed.cjs` bug** — `for (const [c, cmds] of real.vdvks)` destructures
   the *scheme code* as `cmds` and inserts every character of `"SCH-001"` as a
   commodity mapping (106×7 = 742 junk rows on every canonical seed). Fixed in
   the libSQL port (cmds = element `[8]`); patch noted for the repo.
2. **Loader column list** — synthetic columns (`created_by`, `status`,
   timestamps…) never entered the INSERT column list → NOT NULL violations
   would have aborted the first insert. Fixed in both loaders.
3. **Loader CSV→column mapping** — `dbToCsv` was built in the wrong direction
   for the extension columns; only same-name columns (tribe/education/
   occupation/ifsc) worked by coincidence. Fixed; verified by full provenance
   fill after a clean re-load.
4. **Identity rule** — the loader name-skipped rows carrying a *distinct*
   Aadhaar, contradicting the documented “Aadhaar authoritative, multi-entry
   lists allow same name + different Aadhaar” rule (would have dropped 1,721
   real members). Fixed: the `(vdvk,name,gender)` key only applies to rows
   without an Aadhaar. `tools/check-identity.mjs` documents the counts.

**Turso operational notes**: interactive transactions are aborted when the
stream idles (~minutes of continuous inserts) — keep write phases short or
auto-commit; `db.transaction()` modes are `"write"|"read"|"deferred"`; bound
args stay under ~10k per statement; `PRAGMA foreign_keys=off` was a no-op
(harmless) — the canonical seed order is FK-safe anyway.

## 8. Backend switch to Turso — execution record, 2026-10-13

The backend (`vdvk-backend/`) now uses **Turso/libSQL as its only database**
(Railway Postgres is gone — the `ECONNREFUSED ::1:15432` login 500s came from
the old pg tunnel). The Drizzle schema was ported from `pg-core` to
`sqlite-core` (`varchar→text`, `serial→integer autoIncrement`,
`jsonb→text(mode:"json")`, `boolean→integer(mode:"boolean")`), and the 15
field-data extension columns are declared in `src/db/schema/master/vdvk-beneficiary.ts`
so `drizzle-kit push` owns them.

| Step | Result |
|---|---|
| Schema port + `drizzle-kit generate` | `src/db/migrations/0000_dapper_nextwave.sql` — 52 tables, 104 indexes |
| Fresh schema push | `npx tsx scripts/reset-schema.ts --yes` dropped 53 legacy tables → `npm run db:push` recreated 52 tables + 104 indexes; a second push reports **no changes** (idempotent). A pre-wipe backup exists at `backup-turso-2026-10-12.ndjson` (74,890 rows, 36.3 MB). |
| Reseed + extension | `npm run db:seed` (now the canonical libSQL seed) → same masters as §7; `apply-extension-libsql.cjs` → 0 columns/indexes needed |
| Member reload | `import-members.libsql.cjs` → identical to the §7 load: 30,085 members, 44,522 mappings, VDK-107 (274) / VDK-108 (231); `verify-load.mjs` integrity ✓ (0 duplicate Aadhaar, count rule ✓ all 108, provenance complete). The per-VDVK db-vs-converter deltas sum to the 213 in-file duplicate Aadhaar the loader collapses — expected, not data loss. |
| Runtime verification | `POST /api/auth/login` → 200 with tokens; full `npm test` suite green (93/93) against Turso |

**Test-suite fix (no fake data)**: `tests/specs/{forms,tables,extras}.test.ts`
used to hardcode `beneficiaryId: "BEN-001"` — a demo seed member that the
canonical libSQL seed deliberately skips. With real field data loaded there is
no `BEN-001`, so Form 1/2/3 creates failed with `FOREIGN KEY constraint
failed`. The specs now resolve a real member at runtime via
`tests/helpers/data.ts` (`memberOf("VDVK-001")`); the temporary `BEN-001`
fixture row and its test-residue transactions were removed from Turso.
