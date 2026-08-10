import { db } from "../index";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";

// ─── GEO HIERARCHY ───────────────────────────────────────────────────────
import { states, districts, mandals, villages } from "../schema/master/geo-hierarchy";

// ─── MASTER DATA ─────────────────────────────────────────────────────────
import { commodities, grades, commodityRates } from "../schema/master/commodity-grade-rate";
import { schemes, expenditureHeads, customers, suppliers } from "../schema/master/scheme-exphead-customer-supplier";
import { vdvks, vdvkCommodities, beneficiaries } from "../schema/master/vdvk-beneficiary";
import { facilities, facilitySupervisors, facilityVdvkMapping } from "../schema/master/facility";
import { machinery } from "../schema/master/machinery";
import { users, userRoles } from "../schema/master/user";

async function seed() {
  console.log("🌱 Seeding VDVK MIS database...\n");

  // ─── STATES ──────────────────────────────────────────────────────────
  await db.insert(states).values([
    { code: "AP", name: "Andhra Pradesh", status: "Active" },
  ]).onConflictDoNothing();
  console.log("✓ States");

  // ─── DISTRICTS ───────────────────────────────────────────────────────
  await db.insert(districts).values([
    { code: "DIST-ASR", stateCode: "AP", name: "Alluri Sitarama Raju", status: "Active" },
  ]).onConflictDoNothing();
  console.log("✓ Districts");

  // ─── MANDALS ─────────────────────────────────────────────────────────
  await db.insert(mandals).values([
    { code: "MND-001", districtCode: "DIST-ASR", name: "Rampachodavaram", status: "Active" },
    { code: "MND-002", districtCode: "DIST-ASR", name: "Maredumilli", status: "Active" },
    { code: "MND-003", districtCode: "DIST-ASR", name: "Chintoor", status: "Active" },
    { code: "MND-004", districtCode: "DIST-ASR", name: "Araku", status: "Active" },
    { code: "MND-005", districtCode: "DIST-ASR", name: "Dumbriguda", status: "Active" },
    { code: "MND-006", districtCode: "DIST-ASR", name: "Paderu", status: "Active" },
    { code: "MND-007", districtCode: "DIST-ASR", name: "Ananthagiri", status: "Active" },
    { code: "MND-008", districtCode: "DIST-ASR", name: "G.K. Veedhi", status: "Active" },
    { code: "MND-009", districtCode: "DIST-ASR", name: "Pedabayalu", status: "Active" },
    { code: "MND-010", districtCode: "DIST-ASR", name: "Munchingput", status: "Active" },
    { code: "MND-011", districtCode: "DIST-ASR", name: "Hukumpeta", status: "Active" },
  ]).onConflictDoNothing();
  console.log("✓ Mandals (11)");

  // ─── SCHEMES ─────────────────────────────────────────────────────────
  await db.insert(schemes).values([
    { code: "SCH-001", name: "PMJVM", effectiveFrom: "2025-04-01", status: "Active" },
    { code: "SCH-002", name: "PM JANMAN", effectiveFrom: "2025-04-01", status: "Active" },
  ]).onConflictDoNothing();
  console.log("✓ Schemes");

  // ─── COMMODITIES ─────────────────────────────────────────────────────
  await db.insert(commodities).values([
    { code: "CMD-001", name: "Turmeric", defaultUnit: "Kg", unitEffectiveFrom: "2025-04-01", status: "Active" },
    { code: "CMD-002", name: "Honey", defaultUnit: "Pieces", unitEffectiveFrom: "2025-04-01", status: "Active" },
    { code: "CMD-003", name: "Tamarind", defaultUnit: "Kg", unitEffectiveFrom: "2025-04-01", status: "Active" },
    { code: "CMD-004", name: "Mahua Flowers", defaultUnit: "Both", unitEffectiveFrom: "2025-04-01", status: "Active" },
    { code: "CMD-005", name: "Bamboo Baskets", defaultUnit: "Pieces", unitEffectiveFrom: "2025-04-01", status: "Active" },
    { code: "CMD-006", name: "Turmeric Powder", defaultUnit: "Kg", unitEffectiveFrom: "2025-04-01", status: "Active" },
  ]).onConflictDoNothing();
  console.log("✓ Commodities");

  // ─── GRADES ──────────────────────────────────────────────────────────
  await db.insert(grades).values([
    { code: "GRD-001", commodityCode: "CMD-001", gradeName: "A", effectiveFrom: "2025-04-01" },
    { code: "GRD-002", commodityCode: "CMD-001", gradeName: "B", effectiveFrom: "2025-04-01" },
    { code: "GRD-003", commodityCode: "CMD-002", gradeName: "A", effectiveFrom: "2025-04-01" },
    { code: "GRD-004", commodityCode: "CMD-003", gradeName: "A", effectiveFrom: "2025-04-01" },
    { code: "GRD-005", commodityCode: "CMD-004", gradeName: "A", effectiveFrom: "2025-04-01" },
    { code: "GRD-006", commodityCode: "CMD-005", gradeName: "Default", effectiveFrom: "2025-04-01" },
    { code: "GRD-007", commodityCode: "CMD-002", gradeName: "B", effectiveFrom: "2025-04-01" },
  ]).onConflictDoNothing();
  console.log("✓ Grades");

  // ─── COMMODITY RATES ─────────────────────────────────────────────────
  await db.insert(commodityRates).values([
    { commodityCode: "CMD-001", gradeCode: "GRD-001", unit: "Kg", ratePerKg: 120, effectiveFrom: "2025-04-01" },
    { commodityCode: "CMD-001", gradeCode: "GRD-002", unit: "Kg", ratePerKg: 105, effectiveFrom: "2025-04-01" },
    { commodityCode: "CMD-002", gradeCode: "GRD-003", unit: "Pieces", ratePerPiece: 350, effectiveFrom: "2025-04-01" },
    { commodityCode: "CMD-003", gradeCode: "GRD-004", unit: "Kg", ratePerKg: 55, effectiveFrom: "2025-04-01" },
    { commodityCode: "CMD-004", gradeCode: "GRD-005", unit: "Both", ratePerKg: 60, ratePerPiece: 40, effectiveFrom: "2025-04-01" },
    { commodityCode: "CMD-005", gradeCode: "GRD-006", unit: "Pieces", ratePerPiece: 180, effectiveFrom: "2025-04-01" },
  ]).onConflictDoNothing();
  console.log("✓ Commodity Rates");

  // ─── EXPENDITURE HEADS ───────────────────────────────────────────────
  await db.insert(expenditureHeads).values([
    { code: "EXP-001", name: "Logistics & Transportation", effectiveFrom: "2025-04-01" },
    { code: "EXP-002", name: "Packaging Material", effectiveFrom: "2025-04-01" },
    { code: "EXP-003", name: "Electricity Charges", effectiveFrom: "2025-04-01" },
    { code: "EXP-004", name: "Processing Cost", effectiveFrom: "2025-04-01", excludedFromProcessing: true },
    { code: "EXP-005", name: "Training Expenses", effectiveFrom: "2025-04-01", excludedFromProcessing: true },
    { code: "EXP-006", name: "Machinery Procurement", effectiveFrom: "2025-04-01", excludedFromProcessing: true },
    { code: "EXP-007", name: "Office Expenses", effectiveFrom: "2025-04-01" },
    { code: "EXP-008", name: "Miscellaneous", effectiveFrom: "2025-04-01" },
  ]).onConflictDoNothing();
  console.log("✓ Expenditure Heads");

  // ─── CUSTOMERS ───────────────────────────────────────────────────────
  await db.insert(customers).values([
    { code: "CUST-001", name: "ABC Traders", mobile: "9876543210", address: "Kakinada", gstNo: "37ABCDE1234F1Z5", effectiveFrom: "2025-04-01" },
    { code: "CUST-002", name: "Girijan Coop", mobile: "9876543211", address: "Rampachodavaram", effectiveFrom: "2025-04-01" },
    { code: "CUST-003", name: "Local Buyer – Ravi", mobile: "9876543212", address: "Paderu", effectiveFrom: "2025-06-01" },
  ]).onConflictDoNothing();
  console.log("✓ Customers");

  // ─── SUPPLIERS ───────────────────────────────────────────────────────
  await db.insert(suppliers).values([
    { code: "SUP-001", name: "ABC Engineering", contactPerson: "Ravi Kumar", mobile: "9876543210", email: "abc@gmail.com", effectiveFrom: "2025-04-01" },
    { code: "SUP-002", name: "Solar Tech Pvt. Ltd.", contactPerson: "Mahesh", mobile: "9988776655", email: "solar@gmail.com", effectiveFrom: "2025-04-01" },
    { code: "SUP-003", name: "Precision Scale Co.", contactPerson: "Suresh", mobile: "9123456789", email: "support@psc.com", effectiveFrom: "2025-04-01" },
  ]).onConflictDoNothing();
  console.log("✓ Suppliers");

  // ─── VDVKs ───────────────────────────────────────────────────────────
  await db.insert(vdvks).values([
    { code: "VDK-001", schemeCode: "SCH-001", name: "Rampachodavaram VDVK", state: "Andhra Pradesh", district: "Alluri Sitarama Raju", mandal: "MND-001", sanctionDate: "2025-04-01", beneficiaryCount: 50, amountSanctioned: 500000, amountReleased: 300000, status: "Approved", approvedBy: "USER-DPM", approvedAt: "2025-04-01T10:00:00.000Z", createdBy: "USER-MDA" },
    { code: "VDK-002", schemeCode: "SCH-002", name: "Maredumilli VDVK", state: "Andhra Pradesh", district: "Alluri Sitarama Raju", mandal: "MND-002", sanctionDate: "2025-04-01", beneficiaryCount: 35, amountSanctioned: 400000, amountReleased: 250000, status: "Approved", approvedBy: "USER-DPM", approvedAt: "2025-04-01T10:00:00.000Z", createdBy: "USER-MDA" },
    { code: "VDK-003", schemeCode: "SCH-001", name: "Chintoor VDVK", state: "Andhra Pradesh", district: "Alluri Sitarama Raju", mandal: "MND-003", sanctionDate: "2025-04-01", beneficiaryCount: 42, amountSanctioned: 450000, amountReleased: 280000, status: "Approved", approvedBy: "USER-DPM", approvedAt: "2025-04-01T10:00:00.000Z", createdBy: "USER-MDA" },
  ]).onConflictDoNothing();
  console.log("✓ VDVKs");

  // ─── BENEFICIARIES ───────────────────────────────────────────────────
  await db.insert(beneficiaries).values([
    { id: "BEN-001", vdvkCode: "VDK-001", name: "Ramu", age: 38, gender: "Male", mandal: "MND-004", status: "Approved", registrationMode: "Bulk", createdBy: "USER-MDA" },
    { id: "BEN-002", vdvkCode: "VDK-001", name: "Lakshmi", age: 41, gender: "Female", mandal: "MND-004", status: "Approved", registrationMode: "Bulk", createdBy: "USER-MDA" },
    { id: "BEN-003", vdvkCode: "VDK-002", name: "Somulu", age: 35, gender: "Male", mandal: "MND-005", status: "Approved", registrationMode: "Bulk", createdBy: "USER-MDA" },
    { id: "BEN-004", vdvkCode: "VDK-003", name: "Bheemanna", age: 42, gender: "Male", mandal: "MND-003", status: "Approved", registrationMode: "Individual", createdBy: "USER-MDA" },
  ]).onConflictDoNothing();
  console.log("✓ Beneficiaries");

  // ─── FACILITIES ──────────────────────────────────────────────────────
  await db.insert(facilities).values([
    { code: "FAC-HUB-001", type: "Hub", name: "Rampachodavaram Hub", mandal: "MND-001", status: "Approved", createdBy: "USER-MDA" },
    { code: "FAC-HUB-002", type: "Hub", name: "Maredumilli Hub", mandal: "MND-002", status: "Approved", createdBy: "USER-MDA" },
    { code: "FAC-MPC-001", type: "Multipurpose Centre", name: "Maredumilli Collection Centre", mandal: "MND-002", status: "Approved", createdBy: "USER-MDA" },
  ]).onConflictDoNothing();
  console.log("✓ Facilities");

  // ─── USERS ───────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Vdvk@2025", 10);
  await db.insert(users).values([
    { id: "USER-PO", name: "Project Officer", username: "po", passwordHash, designation: "Project Officer", mandal: "MND-001" },
    { id: "USER-DPM", name: "Divisional Project Manager", username: "dpm", passwordHash, designation: "DPM", mandal: "MND-001" },
    { id: "USER-APM", name: "Assistant Project Manager", username: "apm", passwordHash, designation: "APM", mandal: "MND-001" },
    { id: "USER-CC", name: "Community Coordinator", username: "cc", passwordHash, designation: "CC", mandal: "MND-001", vdvkCode: "VDK-001" },
    { id: "USER-HUB-SUP", name: "Hub Supervisor", username: "hubsup", passwordHash, designation: "Hub Supervisor", mandal: "MND-001", facilityCode: "FAC-HUB-001" },
    { id: "USER-MDA", name: "Admin", username: "mda", passwordHash, designation: "MDA" },
  ]).onConflictDoNothing();
  console.log("✓ Users (password: Vdvk@2025)");

  // ─── USER ROLES ──────────────────────────────────────────────────────
  // No unique constraint on user_roles — skip when already seeded.
  const existingRoles = await db.select({ id: userRoles.id }).from(userRoles).limit(1);
  if (existingRoles.length === 0) {
    await db.insert(userRoles).values([
      { userId: "USER-PO", role: "PO", isPrimary: true, assignedFrom: "2025-04-01" },
      { userId: "USER-DPM", role: "DPM", isPrimary: true, assignedFrom: "2025-04-01" },
      { userId: "USER-APM", role: "APM", isPrimary: true, assignedFrom: "2025-04-01" },
      { userId: "USER-CC", role: "CC", isPrimary: true, assignedFrom: "2025-04-01" },
      { userId: "USER-HUB-SUP", role: "Hub Supervisor", isPrimary: true, assignedFrom: "2025-04-01" },
      { userId: "USER-MDA", role: "MDA", isPrimary: true, assignedFrom: "2025-04-01" },
    ]);
  }
  console.log("✓ User Roles");

  console.log("\n✅ Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
