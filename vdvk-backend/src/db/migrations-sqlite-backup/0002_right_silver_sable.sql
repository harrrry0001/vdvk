/*
 SQLite does not support "Dropping foreign key" out of the box, so this
 migration rebuilds stock_ledger WITHOUT the facilities FK on facility_code.

 WHY: Form 1 (collection) approval records stock at the VDVK by storing a
 vdvk_code in facility_code — VDVK codes are not rows in `facilities`, so the
 FK made the flagship collection-approval flow fail with SQLITE_CONSTRAINT.

 Applied manually to the dev DB (see scripts/rebuild-stock-ledger.mjs).
 The other 4 FKs (vdvk_code, beneficiary_id, commodity_code, grade_code)
 are preserved.
*/
CREATE TABLE stock_ledger_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    vdvk_code TEXT NOT NULL REFERENCES vdvks(code),
    vdvk_name_snapshot TEXT NOT NULL,
    beneficiary_id TEXT REFERENCES beneficiaries(id),
    beneficiary_name_snapshot TEXT,
    commodity_code TEXT NOT NULL REFERENCES commodities(code),
    commodity_name_snapshot TEXT NOT NULL,
    grade_code TEXT REFERENCES grades(code),
    grade_name_snapshot TEXT,
    stock_type TEXT NOT NULL,
    facility_code TEXT NOT NULL,
    facility_name_snapshot TEXT NOT NULL,
    unit TEXT NOT NULL,
    qty_kg REAL NOT NULL DEFAULT 0,
    qty_pieces REAL NOT NULL DEFAULT 0,
    rate_per_kg REAL,
    rate_per_piece REAL,
    total_value REAL,
    source_txn_type TEXT NOT NULL,
    source_txn_id TEXT,
    parent_lot_id INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    consumed_qty_kg REAL NOT NULL DEFAULT 0,
    consumed_qty_pieces REAL NOT NULL DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
);

INSERT INTO stock_ledger_new SELECT * FROM stock_ledger;

DROP TABLE stock_ledger;

ALTER TABLE stock_ledger_new RENAME TO stock_ledger;

CREATE INDEX idx_stock_vdvk ON stock_ledger (vdvk_code);
CREATE INDEX idx_stock_commodity ON stock_ledger (commodity_code);
CREATE INDEX idx_stock_facility ON stock_ledger (facility_code);
CREATE INDEX idx_stock_active ON stock_ledger (is_active);
CREATE INDEX idx_stock_type ON stock_ledger (stock_type);
CREATE INDEX idx_stock_source ON stock_ledger (source_txn_type, source_txn_id);

/*
 Rate revision fix: uq_rate_active was UNIQUE(commodity_code, grade_code,
 effective_from), which broke same-day revisions (closed row + new row share
 effective_from). Replaced with a partial unique index over ACTIVE rates only.
 Applied manually to the dev DB (DROP INDEX + CREATE INDEX, no rebuild).
*/
DROP INDEX uq_rate_active;

CREATE UNIQUE INDEX uq_rate_active ON commodity_rates (commodity_code, grade_code)
  WHERE effective_to IS NULL;
