import { v4 as uuid } from "uuid";
import { db } from "../db/index.js";
import { rejectedRecords } from "../db/schema/shared/audit-notification.js";

/** Record a rejected record so admin can review and the creator can resubmit. Never throws. */
export async function recordRejection(opts: {
  formType: string;
  transactionId: string;
  data: unknown;
  rejectedBy: string;
  remarks?: string;
}): Promise<void> {
  try {
    await db.insert(rejectedRecords).values({
      originalTransactionId: opts.transactionId,
      formType: opts.formType,
      rejectedData: opts.data,
      rejectedBy: opts.rejectedBy,
      rejectionRemarks: opts.remarks || null,
      rejectedAt: new Date().toISOString(),
    });
  } catch {
    // Recording a rejection must never break the approval flow
  }
}
