/** Stock ledger + append-only movement log helpers. */
import { eq, and, asc, sql } from "drizzle-orm";
import { stockLedger, stockMovementLog } from "../db/schema/shared/stock-ledger.js";

export interface MovementInput {
  movementType: "IN" | "OUT";
  qtyKgChange?: number;
  qtyPiecesChange?: number;
  referenceTxnType: string;
  referenceTxnId: string;
  performedBy: string;
  remarks?: string;
}

export async function recordMovement(db: any, m: MovementInput & { stockLedgerId: number; resultingQtyKg?: number | null; resultingQtyPieces?: number | null }) {
  await db.insert(stockMovementLog).values({
    stockLedgerId: m.stockLedgerId,
    movementType: m.movementType,
    qtyKgChange: m.qtyKgChange || 0,
    qtyPiecesChange: m.qtyPiecesChange || 0,
    resultingQtyKg: m.resultingQtyKg ?? null,
    resultingQtyPieces: m.resultingQtyPieces ?? null,
    referenceTxnType: m.referenceTxnType,
    referenceTxnId: m.referenceTxnId,
    performedBy: m.performedBy,
    remarks: m.remarks || null,
  });
}

/** First (oldest) active stock lot matching the criteria. */
export async function findLot(db: any, match: { vdvkCode: string; commodityCode: string; stockType: string; facilityCode?: string }) {
  const conds = [
    eq(stockLedger.vdvkCode, match.vdvkCode),
    eq(stockLedger.commodityCode, match.commodityCode),
    eq(stockLedger.stockType, match.stockType),
    eq(stockLedger.isActive, true),
  ];
  if (match.facilityCode) conds.push(eq(stockLedger.facilityCode, match.facilityCode));
  const [lot] = await db.select().from(stockLedger).where(and(...conds)).orderBy(asc(stockLedger.createdAt)).limit(1);
  return lot;
}

/** Create a new stock lot and log the IN movement. */
export async function addStock(db: any, values: Record<string, unknown>, m: MovementInput) {
  const [row] = await db.insert(stockLedger).values(values).returning({
    id: stockLedger.id, qtyKg: stockLedger.qtyKg, qtyPieces: stockLedger.qtyPieces,
  });
  await recordMovement(db, {
    stockLedgerId: row.id, movementType: m.movementType,
    qtyKgChange: Number(values.qtyKg) || 0, qtyPiecesChange: Number(values.qtyPieces) || 0,
    resultingQtyKg: row.qtyKg, resultingQtyPieces: row.qtyPieces,
    referenceTxnType: m.referenceTxnType, referenceTxnId: m.referenceTxnId,
    performedBy: m.performedBy, remarks: m.remarks,
  });
  return row;
}

/** Deduct qty from an existing lot (first-lot accounting) and log the OUT movement. */
export async function deductStock(db: any, lot: { id: number; qtyKg: number | null; qtyPieces: number | null }, qtyKg: number, qtyPieces: number, m: MovementInput) {
  await db.update(stockLedger)
    .set({
      qtyKg: sql`${stockLedger.qtyKg} - ${qtyKg}`,
      qtyPieces: sql`${stockLedger.qtyPieces} - ${qtyPieces}`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(stockLedger.id, lot.id));
  await recordMovement(db, {
    stockLedgerId: lot.id, movementType: m.movementType,
    qtyKgChange: qtyKg, qtyPiecesChange: qtyPieces,
    resultingQtyKg: (lot.qtyKg || 0) - qtyKg, resultingQtyPieces: (lot.qtyPieces || 0) - qtyPieces,
    referenceTxnType: m.referenceTxnType, referenceTxnId: m.referenceTxnId,
    performedBy: m.performedBy, remarks: m.remarks,
  });
}
