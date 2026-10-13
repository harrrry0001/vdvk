-- ═══════════════════════════════════════════════════════════════════════════
-- beneficiaries: field-data extension
-- Adds provenance + full member-detail columns produced by the VDVK field-data
-- integration (integration/tools/convert-members.mjs). 100% additive — safe on
-- a live database, no existing column is touched.
--
-- Apply with:
--   psql "$DATABASE_URL" -f beneficiaries-extension.sql
-- or via node (uses the same ca.pem as the backend):
--   node apply-extension.cjs
-- then sync the Drizzle schema (see CHANGES.md) and run:
--   npx drizzle-kit generate   (or drizzle-kit push)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE beneficiaries
  ADD COLUMN IF NOT EXISTS reference_id   varchar(191),   -- source REFRENCE ID (batch id in field sheets)
  ADD COLUMN IF NOT EXISTS date_of_birth  varchar(16),    -- ISO yyyy-mm-dd when present
  ADD COLUMN IF NOT EXISTS shg_name       varchar(191),
  ADD COLUMN IF NOT EXISTS tribe          varchar(64),
  ADD COLUMN IF NOT EXISTS education      varchar(64),
  ADD COLUMN IF NOT EXISTS occupation     varchar(64),
  ADD COLUMN IF NOT EXISTS bank_name      varchar(191),
  ADD COLUMN IF NOT EXISTS ifsc           varchar(16),
  ADD COLUMN IF NOT EXISTS account_number varchar(32),
  ADD COLUMN IF NOT EXISTS financial_year varchar(16),     -- e.g. 2024-25
  ADD COLUMN IF NOT EXISTS gram_panchayat varchar(191),
  ADD COLUMN IF NOT EXISTS import_flags   text,            -- converter flags (ctx-mismatch, header-template, ...)
  ADD COLUMN IF NOT EXISTS source_file    varchar(500),    -- provenance: originating workbook
  ADD COLUMN IF NOT EXISTS source_sheet   varchar(191),    -- provenance: originating sheet
  ADD COLUMN IF NOT EXISTS proposed_vdvk  varchar(191);    -- provenance: raw "Name of Proposed VDVK" value

COMMENT ON COLUMN beneficiaries.reference_id   IS 'Batch reference id from the field data workbook';
COMMENT ON COLUMN beneficiaries.source_file    IS 'Originating field-data workbook (integration import)';
COMMENT ON COLUMN beneficiaries.source_sheet   IS 'Originating sheet of the field-data workbook';
COMMENT ON COLUMN beneficiaries.proposed_vdvk  IS 'Raw proposed-VDVK label the row was mapped from';
COMMENT ON COLUMN beneficiaries.import_flags   IS 'Semicolon-separated conversion flags';

-- beneficiary_count repair (authoritative rule shared by loader + route):
--   count of members that are not Rejected.
UPDATE vdvks v
   SET beneficiary_count = (SELECT count(*) FROM beneficiaries b
                             WHERE b.vdvk_code = v.code AND b.status <> 'Rejected');
