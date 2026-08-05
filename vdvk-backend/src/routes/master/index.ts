import { Hono } from "hono";
import { db } from "../../db/index";
import { states, districts, mandals, villages } from "../../db/schema/master/geo-hierarchy";
import { commodities, grades, commodityRates } from "../../db/schema/master/commodity-grade-rate";
import { schemes, expenditureHeads, customers, suppliers } from "../../db/schema/master/scheme-exphead-customer-supplier";
import { vdvks, vdvkCommodities } from "../../db/schema/master/vdvk-beneficiary";
import { eq, and, sql } from "drizzle-orm";
import { requireRole, HonoEnv} from "../../middleware/auth";

export const masterRoutes = new Hono<HonoEnv>();

// ─── GEO HIERARCHY ───────────────────────────────────────────────────────
masterRoutes.get("/geo/states", async (c) => {
  const rows = await db.select().from(states).where(eq(states.status, "Active"));
  return c.json(rows);
});

masterRoutes.get("/geo/districts/:stateCode", async (c) => {
  const { stateCode } = c.req.param();
  const rows = await db.select().from(districts)
    .where(and(eq(districts.stateCode, stateCode), eq(districts.status, "Active")));
  return c.json(rows);
});

masterRoutes.get("/geo/mandals/:districtCode", async (c) => {
  const { districtCode } = c.req.param();
  const rows = await db.select().from(mandals)
    .where(and(eq(mandals.districtCode, districtCode), eq(mandals.status, "Active")));
  return c.json(rows);
});

masterRoutes.get("/geo/villages/:mandalCode", async (c) => {
  const { mandalCode } = c.req.param();
  const rows = await db.select().from(villages)
    .where(and(eq(villages.mandalCode, mandalCode), eq(villages.status, "Active")));
  return c.json(rows);
});

// ─── COMMODITIES ─────────────────────────────────────────────────────────
masterRoutes.get("/commodities", async (c) => {
  const rows = await db.select().from(commodities).where(eq(commodities.status, "Active"));
  return c.json(rows);
});

masterRoutes.get("/commodities/active-on/:date", async (c) => {
  const { date } = c.req.param();
  const rows = await db.select().from(commodities)
    .where(and(
      sql`${commodities.unitEffectiveFrom} <= ${date}`,
      sql`(${commodities.unitEffectiveTo} IS NULL OR ${commodities.unitEffectiveTo} >= ${date})`,
      eq(commodities.status, "Active"),
    ));
  return c.json(rows);
});

// ─── GRADES ──────────────────────────────────────────────────────────────
masterRoutes.get("/grades", async (c) => {
  const commodityCode = c.req.query("commodityCode");
  const conditions = commodityCode ? [eq(grades.commodityCode, commodityCode)] : [];
  const rows = await db.select().from(grades).where(and(...conditions));
  return c.json(rows);
});

// ─── RATES ───────────────────────────────────────────────────────────────
masterRoutes.get("/rates", async (c) => {
  const { commodityCode, gradeCode, date } = c.req.query();
  const conditions = [];

  if (commodityCode) conditions.push(eq(commodityRates.commodityCode, commodityCode));
  if (gradeCode) conditions.push(eq(commodityRates.gradeCode, gradeCode));
  if (date) {
    conditions.push(
      sql`${commodityRates.effectiveFrom} <= ${date}`,
      sql`(${commodityRates.effectiveTo} IS NULL OR ${commodityRates.effectiveTo} >= ${date})`
    );
  }

  const rows = await db.select().from(commodityRates).where(and(...conditions));
  return c.json(rows);
});

// ─── SCHEMES ─────────────────────────────────────────────────────────────
masterRoutes.get("/schemes", async (c) => {
  const rows = await db.select().from(schemes).where(eq(schemes.status, "Active"));
  return c.json(rows);
});

// ─── EXPENDITURE HEADS ───────────────────────────────────────────────────
masterRoutes.get("/expenditure-heads", async (c) => {
  const rows = await db.select().from(expenditureHeads)
    .where(and(
      eq(expenditureHeads.status, "Active"),
      eq(expenditureHeads.excludedFromProcessing, false),
    ));
  return c.json(rows);
});

// ─── CUSTOMERS ───────────────────────────────────────────────────────────
masterRoutes.get("/customers", async (c) => {
  const rows = await db.select().from(customers).where(eq(customers.status, "Active"));
  return c.json(rows);
});

// ─── SUPPLIERS ───────────────────────────────────────────────────────────
masterRoutes.get("/suppliers", async (c) => {
  const rows = await db.select().from(suppliers).where(eq(suppliers.status, "Active"));
  return c.json(rows);
});

// ─── VDVK MASTER ─────────────────────────────────────────────────────────
masterRoutes.get("/vdvks", async (c) => {
  const rows = await db.select().from(vdvks).where(eq(vdvks.status, "Approved"));
  return c.json(rows);
});

masterRoutes.get("/vdvks/:code", async (c) => {
  const { code } = c.req.param();
  const [vdvk] = await db.select().from(vdvks).where(eq(vdvks.code, code)).limit(1);
  if (!vdvk) return c.json({ error: "VDVK not found" }, 404);

  const commodities = await db.select().from(vdvkCommodities)
    .where(eq(vdvkCommodities.vdvkCode, code));

  return c.json({ ...vdvk, commodities });
});
