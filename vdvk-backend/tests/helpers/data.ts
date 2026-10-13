import { db } from "../../src/db/index.js";
import { beneficiaries } from "../../src/db/schema/index.js";
import { and, eq, ne } from "drizzle-orm";

export interface RealMember {
  id: string;
  name: string;
  vdvkCode: string;
}

const cache = new Map<string, Promise<RealMember>>();

/**
 * Look up a real field-data member of the given VDVK (loaded via
 * integration/backend/import-members.libsql.cjs). Specs use this instead of
 * hardcoded IDs so the suite runs against a freshly imported database
 * without any seeded fixture rows.
 */
export function memberOf(vdvkCode: string): Promise<RealMember> {
  let p = cache.get(vdvkCode);
  if (!p) {
    p = (async () => {
      const [row] = await db
        .select({ id: beneficiaries.id, name: beneficiaries.name })
        .from(beneficiaries)
        .where(and(eq(beneficiaries.vdvkCode, vdvkCode), ne(beneficiaries.status, "Rejected")))
        .limit(1);
      if (!row) {
        throw new Error(`No member loaded for ${vdvkCode} — run the field-data import first (see integration/README.md)`);
      }
      return { id: row.id, name: row.name, vdvkCode };
    })();
    cache.set(vdvkCode, p);
  }
  return p;
}
