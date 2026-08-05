## Commodity Rate Master (System-Wide Master Data)

**Purpose**

The Commodity Rate Master stores the price per unit for every Commodity + Grade combination. It serves as the single source of truth for rates across all forms (Collection, Stock Transfer, Processing, Sales). All financial calculations in the system derive from the rate stored in each transaction row, which is pre-filled from this master at the time of transaction creation.

**Access**

* **Maintained By:** Master Data Administrator (MDA) / Admin  
* **View Access:** All users (read-only in forms)

---

### Rate Master Register

| Field | Type | Description |
| ----- | ----- | ----- |
| Commodity | Text | MFP Commodity Name (e.g., Turmeric, Honey, Tamarind) |
| Grade | Text | Grade A / B / C / Default (Ungraded) |
| Unit | Enum | Kg / Pieces / Both |
| Rate (₹/Kg) | Currency | Price per Kilogram. Null if the commodity is not traded by weight. |
| Rate (₹/Piece) | Currency | Price per Piece. Null if the commodity is not traded by unit. |
| Effective From | Date | The date from which this rate is applicable (inclusive). |
| Effective To | Date (nullable) | The last date this rate is applicable (inclusive). Null = currently active. |

**Note:** `Rate (₹/Kg)` and `Rate (₹/Piece)` are not mutually exclusive. For commodities with Unit = Both, both rates may be populated.

---

### Example Data

| Commodity | Grade | Unit | Rate ₹/Kg | Rate ₹/Pc | Effective From | Effective To |
| ----- | ----- | ----- | ----: | ----: | ----- | ----- |
| Turmeric | A | Kg | 120 | — | 01/04/2025 | 31/03/2026 |
| Turmeric | A | Kg | 130 | — | 01/04/2026 | 31/03/2027 |
| Turmeric | B | Kg | 105 | — | 01/04/2025 | 31/03/2026 |
| Turmeric | B | Kg | 115 | — | 01/04/2026 | null |
| Honey | A | Pieces | — | 350 | 01/04/2025 | null |
| Tamarind | A | Kg | 55 | — | 01/04/2025 | null |
| Mahua Flowers | A | Both | 60 | 40 | 01/04/2025 | 31/03/2026 |
| Mahua Flowers | A | Both | 65 | 45 | 01/04/2026 | null |
| Bamboo Baskets | Default | Pieces | — | 180 | 01/04/2025 | null |

---

### Rate Revision Workflow

1. **Admin initiates revision** via MDA Dashboard → Rate Master → Edit Rate.  
2. **System closes the current rate** by setting `Effective To = today - 1 day`.  
3. **System inserts a new row** with the revised rate, `Effective From = today`, `Effective To = null`.  
4. **Audit Trail** records: `action = RATE_REVISED`, `old_values` = previous rate row, `new_values` = new rate row.  
5. **Bulk revision** is supported: Admin can select multiple commodities and apply a percentage or fixed increase.

**Rate Master screens do not require DPM approval.** Rate changes are an administrative function. Financial audit integrity is maintained because every transaction stores its own rate snapshot.

---

### Pre-fill and Locking Logic

When a user creates a new transaction in any form, the system auto-fills the rate fields as follows:

1. Look up the **Commodity Rate Master** for the matching `Commodity + Grade` combination.  
2. Find the row where `Effective From <= Transaction Date <= Effective To` (or Effective To is null for active rates).  
3. If exactly one match is found → pre-fill **only the rate columns applicable to the transaction row's unit type**:  
   * If the row unit is **Kg**: pre-fill `Rate (₹/Kg)`.  
   * If the row unit is **Pieces**: pre-fill `Rate (₹/Piece)`.  
   * If the row unit is **Both** (commodity Default Unit = Both and user enters both): pre-fill both rates.  
   * If the rate value for the applicable unit is null in the master → leave that rate field blank (user must enter manually).  
4. If no match is found → leave the rate field blank (user must enter manually).  
5. If multiple matches are found (data integrity error) → log to Audit Trail and leave blank.  

**Draft locking:** Once a user saves a Draft, the pre-filled rate is **snapshotted into the transaction row**. If the Rate Master is revised later, existing drafts retain their original rate. The draft does not re-fetch the rate on re-open.

**Manual override:** Users may override the pre-filled rate in any transaction row. The override does not update the Rate Master.

---

### Validation Rules

* `Effective From` must be a valid date.  
* `Effective To` must be `>= Effective From` (or null).  
* Rate field(s) must be > 0 based on the commodity's Unit:  
  * If Unit = **Kg**: `Rate (₹/Kg)` must be > 0, `Rate (₹/Piece)` must be null.  
  * If Unit = **Pieces**: `Rate (₹/Piece)` must be > 0, `Rate (₹/Kg)` must be null.  
  * If Unit = **Both**: both `Rate (₹/Kg)` and `Rate (₹/Piece)` must be > 0.  
* No overlapping effective date ranges are allowed for the same `Commodity + Grade + Unit` combination.  
* Closing an existing rate (setting Effective To) requires a replacement rate with `Effective From = Effective To + 1 day`. The system shall enforce this to prevent gaps.

---

### Registers Updated

1. **Commodity Rate Master** *(Primary Register)*  
2. **Audit Trail Register**

---

## Commodity Master (System-Wide Master Data)

**Purpose**

Defines all MFP commodities handled by the system, including their default measurement unit and active status. The Commodity Master is referenced by every form that involves commodities (Collection, Stock Transfer, Processing, Sales, Machinery Utilisation).

**Access:** Maintained by MDA/Admin

### Commodity Master Register

| Field | Type | Description |
| ----- | ----- | ----- |
| Commodity Code | Auto Generated | Unique immutable code (e.g., CMD-001). Used as FK in all transaction tables. |
| Commodity Name | Text | Display name (e.g., Turmeric, Honey, Tamarind). |
| Default Unit | Enum | Kg / Pieces / Both. The default measurement unit at the time the commodity was defined. |
| Unit Effective From | Date | Date from which the Default Unit applies. |
| Unit Effective To | Date (nullable) | Date after which a new unit revision applies. Null = currently active. |
| Status | Enum | Active / Inactive. Inactive commodities cannot be selected in new transactions. |

**Unit Revision:** If a commodity's default unit changes (e.g., Honey from Pieces to Kg), the Admin archives the old row (Effective To = today − 1) and inserts a new row (Effective From = today). Historical transactions retain their original unit because each transaction row snapshots its own Unit, Rate, and Commodity Name.

### Example Data

| Code | Commodity | Default Unit | Unit Eff. From | Unit Eff. To | Status |
| ----- | ----- | ----- | ----- | ----- | ----- |
| CMD-001 | Turmeric | Kg | 01/04/2025 | null | Active |
| CMD-002 | Honey | Pieces | 01/04/2025 | 31/03/2026 | Active |
| CMD-002 | Honey | Kg | 01/04/2026 | null | Active |
| CMD-003 | Tamarind | Kg | 01/04/2025 | null | Active |
| CMD-004 | Mahua Flowers | Both | 01/04/2025 | null | Active |
| CMD-005 | Bamboo Baskets | Pieces | 01/04/2025 | null | Active |

---

## Grade Master (System-Wide Master Data)

**Purpose**

Defines the quality grades available for each commodity. Grades are used across Forms 1–4 for rate determination and quality tracking.

**Access:** Maintained by MDA/Admin

### Grade Master Register

| Field | Type | Description |
| ----- | ----- | ----- |
| Grade Code | Auto Generated | Unique code (e.g., GRD-001). |
| Commodity Code | FK | Links grade to a specific commodity. |
| Grade Name | Text | A / B / C / Default (Ungraded). |
| Effective From | Date | Date this grade becomes available. |
| Effective To | Date (nullable) | Date this grade is retired. Null = active. |

**Behaviour:** When a user selects a Commodity in a transaction, the Grade dropdown filters to only grades active on the transaction date. Historical grades remain valid for existing records.

### Example Data

| Code | Commodity | Grade | Eff. From | Eff. To |
| ----- | ----- | ----- | ----- | ----- |
| GRD-001 | Turmeric | A | 01/04/2025 | null |
| GRD-002 | Turmeric | B | 01/04/2025 | null |
| GRD-003 | Honey | A | 01/04/2025 | null |
| GRD-004 | Tamarind | A | 01/04/2025 | null |
| GRD-005 | Mahua Flowers | A | 01/04/2025 | null |
| GRD-006 | Bamboo Baskets | Default | 01/04/2025 | null |

---

## Scheme Master (System-Wide Master Data)

**Purpose**

Defines all government schemes under which VDVKs operate. Each VDVK belongs to one scheme. Scheme information flows into financial reports, dashboards, and scheme-wise fund utilisation tracking.

**Access:** Maintained by MDA/Admin

### Scheme Master Register

| Field | Type | Description |
| ----- | ----- | ----- |
| Scheme Code | Auto Generated | Unique code (e.g., SCH-001). |
| Scheme Name | Text | Display name (e.g., PMJVM, PM JANMAN). |
| Effective From | Date | Date the scheme became active under this name. |
| Effective To | Date (nullable) | Date the scheme was renamed/retired. Null = currently active. |

**Name Revision:** If PM JANMAN is renamed to PM JANMAN 2.0, the old row is closed and a new row inserted with the new name. All transactions reference the Scheme Code (immutable), so the display name updates for new views while historical records show the name that was active at transaction time.

### Example Data

| Code | Name | Eff. From | Eff. To |
| ----- | ----- | ----- | ----- |
| SCH-001 | PMJVM | 01/04/2025 | null |
| SCH-002 | PM JANMAN | 01/04/2025 | null |

---

## Expenditure Head Master (System-Wide Master Data)

**Purpose**

Maintains the list of all operational expenditure heads used in Form 10 (Weekly Fund Utilisation). This master replaces the hardcoded dropdown, allowing Admin to add, rename, or deactivate heads without code changes.

**Access:** Maintained by MDA/Admin

### Expenditure Head Master Register

| Field | Type | Description |
| ----- | ----- | ----- |
| Head Code | Auto Generated | Unique code (e.g., EXP-001). |
| Head Name | Text | Display name (e.g., Logistics & Transportation). |
| Effective From | Date | Date this head became available. |
| Effective To | Date (nullable) | Date this head was retired. Null = active. |
| Excluded From Processing | Boolean | True for heads that overlap with dedicated modules (Processing Cost, Training Expenses, Machinery Procurement). These are never shown in Form 10. |

**Behaviour:** The Form 10 dropdown filters to `Effective From <= today <= Effective To (or null)` AND `Excluded From Processing = False`. Historical entries with retired heads remain valid.

### Example Data

| Code | Head Name | Eff. From | Eff. To | Excluded |
| ----- | ----- | ----- | ----- | :---: |
| EXP-001 | Logistics & Transportation | 01/04/2025 | null | No |
| EXP-002 | Packaging Material | 01/04/2025 | null | No |
| EXP-003 | Electricity Charges | 01/04/2025 | null | No |
| EXP-004 | Processing Cost | 01/04/2025 | null | **Yes** |
| EXP-005 | Training Expenses | 01/04/2025 | null | **Yes** |
| EXP-006 | Machinery Procurement | 01/04/2025 | null | **Yes** |
| EXP-007 | Office Expenses | 01/04/2025 | null | No |
| EXP-008 | Miscellaneous | 01/04/2025 | null | No |

---

## Customer Master (System-Wide Master Data)

**Purpose**

Maintains the list of all customers (buyers) for MFP sales transactions (Form 4). The Customer Master allows APM to select existing customers or add new ones on-the-fly during sales entry.

**Access:** Maintained by APM / Admin (on-the-fly creation during Form 4)

### Customer Master Register

| Field | Type | Description |
| ----- | ----- | ----- |
| Customer Code | Auto Generated | Unique immutable code (e.g., CUST-001). Used as FK in Sales transactions. |
| Customer Name | Text | Legal/Business name of the buyer. |
| Mobile | Text | Contact number for billing and coordination. |
| Address | Text | Business address (optional). |
| GST No. | Text (nullable) | GST registration number for invoice generation. |
| Effective From | Date | Date this customer was added. |
| Effective To | Date (nullable) | Date this customer was retired. Null = active. |

### Example Data

| Code | Name | Mobile | Address | GST | Eff. From | Eff. To |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| CUST-001 | ABC Traders | 9876543210 | Kakinada | 37ABCDE1234F1Z5 | 01/04/2025 | null |
| CUST-002 | Girijan Coop | 9876543211 | Rampachodavaram | — | 01/04/2025 | null |
| CUST-003 | Local Buyer – Ravi | 9876543212 | Paderu | — | 01/06/2025 | null |

**Behaviour:** On-the-fly creation sets `Customer Code = Auto Generate`, `Effective From = today`. The customer is immediately available for selection in the current sales transaction.

---

## Supplier / Vendor Master (System-Wide Master Data)

**Purpose**

Maintains the list of all suppliers and vendors from whom machinery, equipment, packaging materials, and other goods are procured. Referenced by Form 7 (Machinery Onboarding) and Form 11 (Facility Registration).

**Access:** Maintained by MDA/Admin. New suppliers can also be added on-the-fly during Form 7 machinery entry.

### Supplier Master Register

| Field | Type | Description |
| ----- | ----- | ----- |
| Supplier Code | Auto Generated | Unique immutable code (e.g., SUP-001). Used as FK in procurement records. |
| Supplier Name | Text | Legal/Business name of the supplier. |
| Contact Person | Text | Name of the supplier's point of contact. |
| Mobile Number | Text | Contact number. |
| Email | Text (nullable) | Email address. |
| Address | Text (nullable) | Business address. |
| GST No. | Text (nullable) | GST registration number. |
| Effective From | Date | Date this supplier was added. |
| Effective To | Date (nullable) | Date this supplier was retired. Null = active. |

### Example Data

| Code | Name | Contact | Mobile | Email | Eff. From | Eff. To |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| SUP-001 | ABC Engineering | Ravi Kumar | 9876543210 | abc@gmail.com | 01/04/2025 | null |
| SUP-002 | Solar Tech Pvt. Ltd. | Mahesh | 9988776655 | solar@gmail.com | 01/04/2025 | null |
| SUP-003 | Precision Scale Co. | Suresh | 9123456789 | support@psc.com | 01/04/2025 | null |

**Behaviour:** On-the-fly creation during Form 7 sets `Supplier Code = Auto Generate`, `Effective From = today`. The supplier is immediately available for selection in the current machinery entry. Supplier Name is snapshotted in each machinery transaction row.

---

## Geographic Hierarchy Master (System-Wide Master Data)

**Purpose**

Defines the geographic hierarchy used across all forms: State → District → Mandal → Village. This master drives all location-based dropdowns with cascading filters (selecting a District auto-filters the Mandal list, etc.).

**Access:** Maintained by MDA/Admin. These are pre-seeded with approved government administrative data.

### State Master

| Field | Type | Description |
| ----- | ----- | ----- |
| State Code | Text | ISO/Government state code (e.g., AP). |
| State Name | Text | Display name (e.g., Andhra Pradesh). |
| Status | Enum | Active / Inactive. |

### District Master

| Field | Type | Description |
| ----- | ----- | ----- |
| District Code | Auto Generated | Unique code. |
| State Code | FK | Links district to a state. |
| District Name | Text | Display name (e.g., Alluri Sitarama Raju). |
| Status | Enum | Active / Inactive. |

### Mandal Master

| Field | Type | Description |
| ----- | ----- | ----- |
| Mandal Code | Auto Generated | Unique code. |
| District Code | FK | Links mandal to a district. |
| Mandal Name | Text | Display name (e.g., Rampachodavaram). |
| Status | Enum | Active / Inactive. |

### Village Master

| Field | Type | Description |
| ----- | ----- | ----- |
| Village Code | Auto Generated | Unique code. |
| Mandal Code | FK | Links village to a mandal. |
| Village Name | Text | Display name. |
| PIN Code | Text (nullable) | Postal code (auto-fetched where available). |
| Status | Enum | Active / Inactive. |

**Behaviour:** All forms use these cascading lookups (State → District → Mandal → Village). Inactive locations are hidden from dropdowns but remain valid in historical records. The PIN Code in the Village Master supports auto-fill in Forms 5 and 6. Village selection is optional; users may also type a village name manually.

---

## Referential Integrity & Snapshotting (All Forms)

Every transaction table in this document references master data through **immutable Code-based foreign keys**. Display names (VDVK Name, Beneficiary Name, Commodity Name, etc.) are **snapshotted at creation time** and stored alongside the FK in the transaction row. This ensures:

1. **Master data can change without breaking history** — renaming a VDVK or commodity does not retroactively alter approved transactions.  
2. **Reports remain accurate** — financial summaries always reflect the names and rates that were active when the transaction was created.  
3. **Drafts are stable** — a draft saved with old master data keeps its original display values even if the master is updated before submission.

The following fields are snapshotted in every transaction row:

| Snapshot Field | Source Master | Example |
| ----- | ----- | ----- |
| `vdvk_code` (FK) + `vdvk_name_snapshot` | VDVK Master | VDK-042 → "Rampachodavaram VDVK" |
| `commodity_code` (FK) + `commodity_name_snapshot` | Commodity Master | CMD-001 → "Turmeric" |
| `grade_code` (FK) + `grade_name_snapshot` | Grade Master | GRD-001 → "A" |
| `scheme_code` (FK) + `scheme_name_snapshot` | Scheme Master | SCH-001 → "PMJVM" |
| `unit_snapshot` | Commodity Master (unit at tx time) | "Kg" |
| `rate_snapshot` | Commodity Rate Master (rate at tx date) | ₹120 |
| `supervisor_code` (FK) + `supervisor_name_snapshot` | Facility → Supervisor mapping | USER-042 → "Ravi Kumar" |
| `customer_code` (FK) + `customer_name_snapshot` | Customer Master (Form 4) | CUST-001 → "ABC Traders" |
| `created_by_role_snapshot` | User Master (at tx time) | "CC" |
| `created_by_mandal_snapshot` | User Master (at tx time) | "Rampachodavaram" |

**Implementation rule:** Every INSERT into a transaction table must snapshot all referenced display values from the master tables as they exist at the current timestamp. The FK itself never changes; the snapshot is for display and reporting only.

---

**System-Wide Access Note:** Project Officer (PO) has **view-only access** to all forms. DPM has **view access** to all forms and **approval access** only for forms assigned to DPM (Forms 4, 5, 6, 7, 10, 11). PO & DPM can view any form's data across the district; APM view is restricted to assigned Mandal(s).

---

## Historical Data & Inventory Initialization

**Purpose**

When the system goes live, existing VDVKs already hold physical stock (raw materials, processed goods) and machinery from prior procurement. This section defines how historical data is seeded so that available stock and asset balances are accurate from Day 1.

### Stock Initialization

1. **Admin imports historical stock** via an MDA tool: "Data Migration → Stock Initialization".  
2. Each row specifies: VDVK Code, Commodity Code, Grade Code, Location (Hub/Collection Centre/etc.), Stock Qty (Kg), Stock Qty (Pieces), Stock Rate (₹/Kg), Stock Rate (₹/Pc), Stock Type (Raw/Processed), and As-On Date.  
3. The system inserts the stock as an **approved opening balance** (no approval workflow — flagged as `source = MIGRATION`).  
4. These opening balances serve as the initial `Available Stock` for Forms 2, 3, and 4.  
5. **Subsequent transactions** (Collection, Stock Transfer, Processing, Sales) increment/decrement stock from these opening balances.  

### Machinery Initialization

1. **Admin imports existing machinery** via "Data Migration → Machinery Initialization".  
2. Fields match Form 7 schema with the addition of `source = MIGRATION` and `existing_asset_id` (to preserve legacy tracking numbers).  
3. All imported machinery starts with `Status = Active` at their current location.  

### Historical Transaction Data

* If historical transactions (past collection, sales, etc.) need to be loaded, they are imported as **approved records** with `source = MIGRATION`.  
* Migrated transactions **do not** go through the normal approval workflow and **do not** trigger stock deductions again (stock was already initialized separately).  

### Migration Audit

All migration imports are logged in the Audit Trail with `action = MIGRATED` and `performer_role = SYSTEM`.

---

**Input Form – 1: MFP Collection Register (Daily Collection Entry)**

**Access:** Community Coordinator (CC)  
**Approval:** Assistant Project Manager (APM)

**Workflow:**

* CC fills the form and submits it to APM.  
* **Draft** entries are saved locally and can be edited later.  
* **Submitted** entries become **Pending Approval** until reviewed by APM.  
* **Approved** entries are saved in the database and reflected in Inventory, Stock, Processing, Reports, and Dashboards.  
* **Rejected** entries are **retained in a dedicated Rejected Records table** (separate from operational registers). CC can view the Approval Status and APM Remarks. The CC may modify the rejected entry based on the APM's remarks and submit it again as a fresh entry. The original rejection record is preserved in the Audit Trail and the Rejected Records table.


**Form Fields**


| Sl. No. | Field Name | Input Type | System Functionality / Mapping |
| ----- | ----- | ----- | ----- |
| 1 | VDVK Code | Searchable Dropdown | Search and select VDVK by **VDVK Code** or **VDVK Name**. System displays VDVK Name + Mandal for confirmation. FK → VDVK Master. Snapshot: VDVK Name at transaction date. |
| 2 | Date of MFP Submission | Date Picker | Format DD/MM/YYYY. Defaults to current date. |
| 3 | Place of Submission | Dropdown | VDVK Facility / Multipurpose Centre / Haat Bazaar / Hub. |
| 4 | Transaction Type | Dropdown | Cash / Bank Transfer / Credit / Advance / Other. Determines the payment method for this collection entry. |
| 5 | Overall Remarks | Text Box | Optional remarks for the complete collection transaction. |

**Beneficiary-wise MFP Collection Details**

| Beneficiary ID | Beneficiary Name | MFP Commodity | Grade | Collection Unit *(Kg/Pieces/Both)* | Qty Collected (Kg) | Qty Collected (Pieces) | Rate (₹/Kg) | Rate (₹/Piece) | Total Cost (₹) | Remarks |
| ----- | ----- | ----- | ----- | ----- | ----: | ----: | ----: | ----: | ----: | ----- |
| BEN-001 | Ramu | CMD-003 Tamarind | GRD-004 A | Kg | 120 | — | ₹55 | — | ₹6,600 | Good quality |
| BEN-001 | Ramu | CMD-001 Turmeric | GRD-002 B | Kg | 40 | — | ₹120 | — | ₹4,800 | Slight moisture |
| BEN-002 | Lakshmi | CMD-002 Honey | GRD-003 A | Pieces | — | 25 | — | ₹350 | ₹8,750 | Packed bottles |
| BEN-003 | Somulu | CMD-005 Bamboo Baskets | GRD-006 Default | Pieces | — | 50 | — | ₹180 | ₹9,000 | Good finish |
| BEN-004 | Bheemanna | CMD-003 Tamarind | GRD-004 A | Both | 100 | 20 | ₹55 | ₹120 | Auto Calculated | Mixed collection |
| \+ Add Benificary |  |  |  |  |  |  |   |
| \+ Add Commodity |  |  |  |  |  |  |  |

**Functional Note**

The system shall support collection entry in **Kilograms (Kg)**, **Number of Pieces**, or **Both**, depending on the commodity.

**Step 1 – Collection Unit Detection (Per-Row, Automatic)**

The measurement type is **auto-detected per commodity row** from the Commodity Master's `Default Unit` field. No form-level selection is required — each row independently enables the relevant quantity and rate fields.

| Commodity Default Unit | System Behaviour for that Row |
| ----- | ----- |
| **Kg** | Enable **Qty Collected (Kg)** and **Rate (₹/Kg)** only. **Qty Collected (Pieces)** and **Rate (₹/Piece)** remain disabled. |
| **Pieces** | Enable **Qty Collected (Pieces)** and **Rate (₹/Piece)** only. **Qty Collected (Kg)** and **Rate (₹/Kg)** remain disabled. |
| **Both** | All four fields are enabled. The user **may enter Kg, Pieces, or both** for that row. If only one unit type is filled, the other rate column is hidden. If both unit types are filled, **Total Cost** is calculated as **(Kg Qty × Kg Rate) + (Pieces Qty × Piece Rate)**. |

Fields not applicable to the commodity's unit shall remain disabled and shall not accept any input in that row.

**Grade Note:** Grade is marked optional but each rate is tied to a **Commodity + Grade** combination. If Grade is left blank, the system shall apply the **Default/Ungraded** rate from the Commodity Rate Master for that commodity. If no default rate exists, the user must select a grade or enter a custom rate manually.

**Rate Lookup:** When a Commodity and Grade are selected, the system fetches the rate effective on the **Transaction Date** from the Commodity Rate Master. See the **Commodity Rate Master** section at the start of this document for the rate versioning logic.

**System Generated Commodity Summary**

| Commodity | Grade | No. of Beneficiaries | Total Qty (Kg) | Total Qty (Pieces) | Avg./Applied Rate | Total Amount (₹) |
| :---- | :---- | ----- | ----: | ----: | ----- | ----- |
| CMD-003 Tamarind | GRD-004 A | 2 | 220 | 20 | As Entered | 14,500 |
| CMD-001 Turmeric | GRD-002 B | 1 | 40 | — | As Entered | 4,800 |
| CMD-002 Honey | GRD-003 A | 1 | — | 25 | As Entered | 8,750 |
| CMD-005 Bamboo Baskets | GRD-006 Default | 1 | — | 50 | As Entered | 9,000 |

**Grand Totals**

| Particular | Value |
| ----- | ----: |
| Total Beneficiaries | 4 |
| Total Commodity Entries | 5 |
| Grand Total Quantity (Kg) | **260 Kg** |
| Grand Total Quantity (Pieces) | **95 Pieces** |
| Grand Total Amount | **₹37,050** |

---

**Buttons**

* ➕ **Add Beneficiary** — Appends a new beneficiary row to the table. The user can then add commodities under that beneficiary.  
* ➕ **Add Commodity** (for the currently active beneficiary) — Appends a new commodity+grade row under the selected beneficiary. Multiple commodities per beneficiary are supported.  
* 🗑 **Delete Commodity Row** — Removes a specific commodity+grade row from a beneficiary.  
* 💾 **Save Draft**  
* 📤 **Submit for Approval**

**Interactive Behaviour:**  
* The table is a **hierarchical grid**: Beneficiaries are top-level rows, and each beneficiary can have multiple commodity+grade sub-rows.  
* When "+ Add Beneficiary" is clicked, a new beneficiary row is appended at the bottom with no commodities yet. The user then clicks "+ Add Commodity" to add rows under that beneficiary.  
* Each commodity+grade row independently auto-detects its measurement unit (Kg/Pieces/Both) from the Commodity Master.  
* Total Cost is calculated per commodity+grade row. A subtotal per beneficiary and a grand total for the transaction are displayed.

**Developer Logic**

* One **Transaction** → Multiple **Beneficiaries**.  
* One **Beneficiary** → Multiple **Commodities**.  
* One **Commodity** → Multiple **Grades** (each grade entered as a separate row).  
* Each **Commodity \+ Grade** combination has its own **Rate (₹/Kg)** or **Rate (₹/Piece)**.  
* **Total Cost** is calculated row-wise:  
  * If Unit = **Kg**: Qty (Kg) × Rate (₹/Kg)  
  * If Unit = **Pieces**: Qty (Pieces) × Rate (₹/Piece)  
  * If Unit = **Both**: (Qty Kg × Rate ₹/Kg) + (Qty Pieces × Rate ₹/Piece)  
* The system automatically generates:  
  * Commodity-wise summary (with Kg and Pieces columns).  
  * Grade-wise summary.  
  * Grand Total Quantity (Kg).  
  * Grand Total Quantity (Pieces).  
  * Grand Total Amount.  
* Only **Approved** transactions are inserted into the operational database.

**Developer Notes**

1. One **Transaction** → Multiple **Beneficiaries**.  
2. One **Beneficiary** → Multiple **Commodities**.  
3. One **Commodity** → Multiple **Grades** (each grade entered as a separate row).  
4. Each **Commodity \+ Grade** combination has its own **Rate (₹/Kg)** or **Rate (₹/Piece)**, defined in the Commodity Rate Master (see the Commodity Rate Master section at the start of this document for rate versioning and effective-date logic).  
5. **Total Cost** is calculated row-wise — see formula in Developer Logic above.  
6. The system automatically generates:  
   * Commodity-wise summary (Kg + Pieces columns).  
   * Grade-wise summary.  
   * Grand Total Quantity (Kg).  
   * Grand Total Quantity (Pieces).  
   * Grand Total Amount.  
7. Only **Approved** transactions are inserted into the operational database.  
8. Rejected transactions are retained in a separate **Rejected Records** table (not in operational registers). The CC may **modify and resubmit** the rejected entry. Original rejection data is preserved in the Audit Trail. Rejected data shall not appear in:  
   * Inventory Register  
   * Stock Register  
   * Processing Register  
   * Sales Register  
   * Financial Reports  
   * Dashboards  
9. Store audit details:  
   * Transaction ID  
   * Created By (CC) — snapshots `created_by_role_snapshot = "CC"` and `created_by_mandal_snapshot`  
   * Created Date & Time  
   * Approved By (APM)  
   * Approval Date & Time  
   * Approval Status  
   * Approval Remarks  
10. **Referential Integrity:** All Commodity, Grade, and Beneficiary lookups use immutable Codes as FK. Display names are snapshotted at creation time (see Referential Integrity & Snapshotting section).

**Input Form – 2: Stock Transfer Register (MFP Movement Register)**

**Purpose**

To record the movement of MFP stock from one storage location to another (e.g., Collection Centre → Hub, Hub → Haat Bazaar, Haat Bazaar → Processing Centre, etc.) while maintaining complete stock traceability.

**Access**

* **Filled By:** Centre Supervisor / Hub Supervisor / Haat Bazaar Supervisor (Origin Location In-charge)  
* **Approval:** Assistant Project Manager (APM)

**Workflow**

**Origin Location Supervisor submits Stock Transfer → Request Status: Pending Verification → APM verifies physical movement and confirms with destination → Database Updated**

**Important Logic — Two Tracks: Physical vs. Database**

* **Physical Track (real world):** Once the supervisor submits the transfer, physical stock may be moved from origin to destination based on the transfer request. The system cannot track physical movement — it only updates the database after APM approval.  
* **Database Track (system):**  
  * **Only after APM Approval** (after confirming with the destination supervisor) shall:  
    * Stock be deducted from the source location in the database.  
    * Stock be added to the destination location in the database.  
    * All stock registers be updated.  
* If rejected, **no database stock movement** is recorded. Physical stock that has already moved must be reconciled offline. APM remarks are displayed to the creator for resubmission.

**Stock Transfer Details**

| Sl. No. | Field Name | Input Type | System Functionality / Mapping |
| ----- | ----- | ----- | ----- |
| 1 | Stock Transfer Date | Date Picker | Format DD/MM/YYYY. Defaults to current date. |
| 2 | VDVK Details | Dynamic Table | Allows multiple VDVKs in one stock transfer transaction. Each row selects VDVK Code (immutable FK, VDVK Name snapshotted). System fetches available stock for each selected VDVK. |
| 3 | Sent From | Dropdown | Select Origin Location (Collection Centre / Hub / Haat Bazaar / Processing Centre etc.). Displays only mapped locations. |
| 4 | Sent To | Dropdown | Select Destination Location. Displays only mapped locations. |
| 5 | Sent By | Dropdown | Displays supervisor/in-charge mapped to the selected origin location. Includes **Other** option with text box if not available in Master. |
| 6 | Vehicle Details (Optional) | Text Box | Vehicle Number / Transport Details. |
| 7 | Driver Name & Mobile (Optional) | Text Box | For transportation tracking. |
| 8 | Overall Remarks | Text Box | Optional remarks for complete transfer. |
| 9 | Submit Stock Transfer | Button | Creates Stock Transfer Request. Request Status becomes **Pending Verification**. Physical stock movement happens offline. Database is updated only after APM approval. |
| 10 | Approval Status | System Generated | Pending Verification / Approved / Rejected. |
| 11 | APM Remarks | Text Box | Mandatory for Approval/Reject observations. Visible to creator. |

**Dynamic Table (VDVK-wise Stock Transfer Details)**

| VDVK Code | Beneficiary ID | Commodity Code | Grade Code | Goods Type | Stock Unit *(Kg/Pieces/Both)* | Available (Kg) | Transfer Qty (Kg) | Available (Pieces) | Transfer Qty (Pieces) | Rate (₹/Kg) | Rate (₹/Piece) | Total Value (₹) |
| ----- | ----- | ----- | ----- | ----- | ----- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| VDK-001 Rampachodavaram | BEN-001 Ramu | CMD-001 Turmeric | GRD-001 A | Raw | Kg | 40 | 30 | — | — | ₹120 | — | ₹3,600 |
|  | BEN-001 Ramu | CMD-001 Turmeric | GRD-002 B | Processed | Kg | 15 | 10 | — | — | ₹105 | — | ₹1,050 |
|  | BEN-001 Ramu | CMD-003 Tamarind | GRD-004 A | Raw | Kg | 20 | 20 | — | — | ₹55 | — | ₹1,100 |
| VDK-001 Rampachodavaram | BEN-003 Somulu | CMD-001 Turmeric | GRD-001 A | Processed | Kg | 10 | 10 | — | — | ₹120 | — | ₹1,200 |
|  | BEN-003 Somulu | CMD-004 Mahua Flowers | GRD-005 A | Raw | Both | 25 | 20 | 10 | 8 | ₹60 | ₹40 | ₹1,520 |
| VDK-001 Rampachodavaram | BEN-002 Lakshmi | CMD-002 Honey | GRD-003 A | Processed | Pieces | — | — | 15 | 15 | — | ₹350 | ₹5,250 |

**System Generated Summary**

| Commodity | Grade | Total Transfer Qty (Kg) | Total Transfer Qty (Pieces) | Total Value (₹) |
| ----- | ----- | ----: | ----: | ----: |
| CMD-001 Turmeric | GRD-001 A | 40 | — | 4,800 |
| CMD-001 Turmeric | GRD-002 B | 10 | — | 1,050 |
| CMD-003 Tamarind | GRD-004 A | 20 | — | 1,100 |
| CMD-004 Mahua Flowers | GRD-005 A | 20 | 8 | 1,520 |
| CMD-002 Honey | GRD-003 A | — | 15 | 5,250 |

**Grand Totals**

| Particular | Auto Calculated |
| ----- | ----: |
| Total VDVKs | 1 |
| Total Beneficiaries | 3 |
| Total Commodity Entries | 6 |
| Total Transfer Quantity (Kg) | **90 Kg** |
| Total Transfer Quantity (Pieces) | **23 Pieces** |
| **Grand Total Transfer Value (₹)** | **₹13,720** |

**Approval Workflow**

**Step 1**

Origin Supervisor submits Stock Transfer.

Request Status = **Pending Verification**

APM verifies physical movement by confirming with the destination supervisor.

**If Approved**

* Deduct stock from Source Location in the database.  
* Add stock to Destination Location in the database.  
* Update all stock registers.  
* Transaction Status becomes **Completed**.

**If Rejected**

* No stock movement in the database.  
* Source stock in the database remains unchanged.  
* Destination stock in the database remains unchanged.  
* Physical stock already moved must be reconciled offline.  
* Creator sees rejection remarks and may modify and resubmit the transfer request as a fresh entry. The original rejection is preserved in the Audit Trail.

**Registers Updated After APM Approval**

The following registers shall be updated automatically:

1. **Stock Transfer Register (Movement Register)** *(Primary Register for this form)*  
2. **Collection Centre Stock Register** *(if source/destination is Collection Centre)*  
3. **Hub Stock Register**  
4. **Haat Bazaar Stock Register**  
5. **Processing Centre Stock Register** *(if applicable)*  
6. **Commodity-wise Stock Ledger**  
7. **VDVK-wise Stock Ledger**  
8. **Inventory Register**  
9. **Audit Trail Register**

**Developer Logic**

* Select **VDVK**.   
* System shows **only beneficiaries having available stock** under that VDVK.   
* Select Beneficiary.   
* System automatically shows only the **available commodities, grades, quantities, and rates** for that beneficiary.   
* The **Rate** displayed for each row is the **original rate from the source transaction** (the rate at which the commodity was collected or processed). This preserves cost traceability through the supply chain. If a single commodity has stock from multiple source transactions with different rates, the system displays the **weighted average rate** and allows the user to select specific lots if granular tracking is required.  
* User enters only the **Transfer Quantity** (which cannot exceed available stock).   
* **Total Value (₹)** is auto-calculated per row: (Transfer Qty Kg × Rate ₹/Kg) + (Transfer Qty Pieces × Rate ₹/Piece). Only applicable unit(s) are summed.  
* The commodity summary and grand totals aggregate all row values.  
* One transaction can contain:   
  * Multiple VDVKs   
  * Multiple Beneficiaries   
  * Multiple Commodities   
  * Multiple Grades 

This creates an end-to-end chain:

**Beneficiary Collection (Input Form–1)** → **Stock Transfer (Input Form–2)** → **Processing Register** → **Finished Goods Register** → **Sales Register**

* Stock Transfer Submitted  
  * Pending Verification  
  * Approved  
  * Rejected  
* Every approved transfer shall generate a unique **Stock Transfer ID (ST-XXXXXX)** and update all linked stock registers automatically. This ensures complete traceability of stock movement from source to destination.

Note: When stock is transfer let says Place A 151 kg of Turmeric is getting transfer to place B now Stock of Place A is decreased and Place B is increased.

**Input Form – 3: Processing Register**

**Purpose**

To record the processing of raw MFP into finished products while maintaining complete traceability of **VDVK → Beneficiary → Commodity → Grade**, along with inventory movement, yield, packetization, and value addition.

**Access**

* **Created By:** Hub Supervisor / Multipurpose Centre (Collection Centre) Supervisor / Haat Bazaar Supervisor/ VDVK Facility Supervisor  
* **Approved By:** Assistant Project Manager (APM)

**Workflow**

**Supervisor → Submit Processing Entry → APM Verification → Approve/Reject**

* Only **Approved** transactions update the operational database.  
* On approval, raw stock is deducted and processed stock is added to the Finished Goods Inventory.  
* Rejected transactions do not update any inventory or register. The creator can view the rejection status and APM remarks, and may modify and resubmit the processing entry as a fresh request.

**Processing Register**

| Sl. No. | Field Name | Input Type | System Functionality / Mapping |
| ----- | ----- | ----- | ----- |
| 1 | Processing Location | Dropdown | Displays VDVK’s Facility, Multipurpose Centres, Hubs and Haat Bazaars mapped to the logged-in supervisor. System fetches available raw stock for the selected location. |
| 2 | Processing Date | Date Picker | Format DD/MM/YYYY. Defaults to current date. |
| 3 | Processing Details | **Dynamic Table** | Allows processing of stock from **multiple VDVKs** (by VDVK Code FK), **multiple beneficiaries**, **multiple commodities** (by Commodity Code FK), and **multiple grades** (by Grade Code FK) in a single transaction. Display names are snapshotted at creation time. |
| 4 | Commodity-wise Processing Summary | Auto Generated | Displays commodity-wise raw quantity processed, finished quantity produced, yield loss and value. |
| 5 | Total Raw Material Value (₹) | Auto Calculated | Sum of raw material values of all entries. |
| 6 | Total Finished Goods Value (₹) | Auto Calculated | Sum of finished goods values of all entries. |
| 7 | Total Value Addition (₹) | Auto Calculated | Total Finished Goods Value − Total Raw Material Value. |
| 8 | Total Yield Loss (Kg) | Auto Calculated | Sum of yield loss of all entries. |
| 9 | Overall Remarks | Text Box | Optional remarks for the complete processing batch. |
| 10 | Submit for Approval | Button | Status becomes **Pending Approval**. |
| 11 | Approval Status | System Generated | Pending Approval / Approved / Rejected. |
| 12 | APM Remarks | Text Box | Mandatory if rejected. |

Dynamic Table

| VDVK Code | Beneficiary ID | Commodity Code | Grade Code | Unit (Kg/Pieces/Both) | Available Stock (Kg) | Qty Taken for Processing (Kg) | Rate ₹/Kg | Available Stock (Pcs) | Qty Taken for Processing (Pcs) | Rate ₹/Pc | Raw Mat. Value (₹) *(Auto)* | Finished (Kg) | Finished (Pcs) | Final Cost ₹/Kg | Final Cost ₹/Pc | Finished Value (₹) *(Auto)* | Processing Cost (₹) *(Auto)* | Yield Loss (Kg) *(Auto)* | Yield Loss (Pcs) *(Auto)* | Packet/Packaging Details | Remarks |
| ----- | ----- | ----- | ----- | ----- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----- | ----- | ----- | ----- |
| VDK-001 Rampachodavaram | BEN-001 Ramu | CMD-001 Turmeric | GRD-001 A | Kg | 300 | 150 | 150 | — | — | — | 22,500 | 145 | — | 180 | — | 26,100 | 3,600 | 5 Kg | — | 10 × 10 Kg \+ 9 × 5 Kg |  |
|  | BEN-001 Ramu | CMD-003 Tamarind | GRD-004 A | Kg | 120 | 100 | 55 | — | — | — | 5,500 | 95 | — | 70 | — | 6,650 | 1,150 | 5 Kg | — | 19 × 5 Kg |  |
| VDK-002 Maredumilli | BEN-003 Somulu | CMD-002 Honey | GRD-003 A | Pieces | — | — | — | 80 | 80 | 320 | 25,600 | — | 78 | — | 380 | 29,640 | 4,040 | — | 2 Pcs | 78 × 1 Kg Bottle |  |
|  | BEN-003 Somulu | CMD-002 Honey | GRD-007 B | Pieces | — | — | — | 30 | 30 | 290 | 8,700 | — | 29 | — | 340 | 9,860 | 1,160 | — | 1 Pc | 29 × 1 Kg Bottle |  |
| VDK-003 Chintoor | BEN-004 Lakshmi | CMD-004 Mahua Flowers | GRD-005 A | Both | 150 | 100 | 60 | 20 | 10 | 20 | 6,200 | 96 | 10 | 75 | 20 | 7,400 | 1,200 | 4 Kg | 0 Pcs | 48 × 2 Kg \+ 10 Bags |  |

**Auto Generated Commodity Summary**

| Commodity | Grade | Raw Qty (Kg) | Raw Qty (Pcs) | Finished (Kg) | Finished (Pcs) | Yield Loss | Raw Mat. Value (₹) | Finished Value (₹) | Value Addition (₹) |
| ----- | ----- | ----: | ----: | ----: | ----: | ----- | ----: | ----: | ----: |
| CMD-001 Turmeric | GRD-001 A | 150 | — | 145 | — | 5 Kg | 22,500 | 26,100 | 3,600 |
| CMD-003 Tamarind | GRD-004 A | 100 | — | 95 | — | 5 Kg | 5,500 | 6,650 | 1,150 |
| CMD-002 Honey | GRD-003 A | — | 80 | — | 78 | 2 Pcs | 25,600 | 29,640 | 4,040 |
| CMD-002 Honey | GRD-007 B | — | 30 | — | 29 | 1 Pc | 8,700 | 9,860 | 1,160 |
| CMD-004 Mahua Flowers | GRD-005 A | 100 | 10 | 96 | 10 | 4 Kg | 6,200 | 7,400 | 1,200 |

---

**Functional Note**

The system shall support processing entries in **Kilograms (Kg)**, **Number of Pieces**, or **Both**, depending on the commodity and processing method.

**Step 1 – Select Processing Unit (Mandatory)**

The user must first choose one of the following options:

* ☐ Quantity in Kilograms (Kg)   
* ☐ Quantity in Pieces   
* ☐ Both (Kg & Pieces) 

**Step 2 – Enable Relevant Fields**

| User Selection | System Behaviour |
| ----- | ----- |
| **Kg** | Enable **Available Stock (Kg)**, **Qty Taken for Processing (Kg)**, **Rate ₹/Kg**, **Finished (Kg)**, **Final Cost ₹/Kg** and **Yield Loss (Kg)**. **Pieces** columns remain disabled. |
| **Pieces** | Enable **Available Stock (Pcs)**, **Qty Taken for Processing (Pcs)**, **Rate ₹/Pc**, **Finished (Pcs)**, **Final Cost ₹/Pc** and **Yield Loss (Pcs)**. **Kg** columns remain disabled. |
| **Both** | Enable both **Kg** and **Pieces** sets for all quantity, rate, and cost columns. Raw Material Value = (Qty Taken Kg × Rate ₹/Kg) + (Qty Taken Pcs × Rate ₹/Pc). Finished Goods Value = (Finished Kg × Final Cost ₹/Kg) + (Finished Pcs × Final Cost ₹/Pc). |

Fields that are not selected shall remain disabled and shall not accept any input.

---

**System Validations**

* VDVK Name and Commodity are mandatory.   
* Beneficiary Name is optional.   
* Grade is optional.   
* Processing Unit selection is mandatory.   
* Quantity Taken for Processing cannot exceed Available Stock for the respective unit.   
* Finished Goods Quantity cannot exceed the quantity taken for processing unless specifically configured for the commodity.   
* Rate must be greater than zero.   
* Packet/Packaging Details are mandatory for processed goods.   
* All monetary values shall be automatically calculated. 

---

**Automatic Calculations**

System behaviour depends on the selected Processing Unit:

**If Unit = Kg:**  
Raw Material Value = Qty Taken for Processing (Kg) × Rate ₹/Kg  
Finished Goods Value = Finished Qty (Kg) × Final Cost ₹/Kg  
Yield Loss (Kg) = Qty Taken for Processing (Kg) − Finished Qty (Kg)  
Processing Cost = Finished Goods Value − Raw Material Value  
Per-Unit Processing Cost = Final Cost ₹/Kg − Rate ₹/Kg

**If Unit = Pieces:**  
Raw Material Value = Qty Taken for Processing (Pcs) × Rate ₹/Pc  
Finished Goods Value = Finished Qty (Pcs) × Final Cost ₹/Pc  
Yield Loss (Pcs) = Qty Taken for Processing (Pcs) − Finished Qty (Pcs)  
Processing Cost = Finished Goods Value − Raw Material Value  
Per-Unit Processing Cost = Final Cost ₹/Pc − Rate ₹/Pc

**If Unit = Both:**  
Raw Material Value = (Qty Taken Kg × Rate ₹/Kg) + (Qty Taken Pcs × Rate ₹/Pc)  
Finished Goods Value = (Finished Kg × Final Cost ₹/Kg) + (Finished Pcs × Final Cost ₹/Pc)  
Yield Loss (Kg) = Qty Taken for Processing (Kg) − Finished Qty (Kg)  
Yield Loss (Pcs) = Qty Taken for Processing (Pcs) − Finished Qty (Pcs)  
Processing Cost = Finished Goods Value − Raw Material Value

**Value Addition (all units):**  
Value Addition = Finished Goods Value − Raw Material Value

The system shall automatically update all calculated values whenever the user modifies quantity or rate.

---

**Packet / Packaging Details**

The system shall support **multiple packaging variants** for the same processed commodity.

**Example:**

| Pack Size | Units Produced |
| ----- | ----- |
| 100 g | 250 |
| 250 g | 180 |
| 500 g | 120 |
| 1 Kg | 75 |

**\+ Add Packaging Variant** shall allow users to add unlimited packaging sizes for a processed commodity.

This design keeps the Processing Register consistent with the Collection Register and Stock Transfer Register by supporting **Kg, Pieces, or Both** while allowing flexible packaging and automatic calculations.

**Grand Totals**

| Particular | Auto Calculated |
| ----- | ----: |
| Total VDVKs | 3 |
| Total Beneficiaries | 3 |
| Total Commodity Entries | 5 |
| Total Raw Material Processed (Kg) | **350 Kg** |
| Total Raw Material Processed (Pieces) | **120 Pcs** |
| Total Finished Goods Produced (Kg) | **336 Kg** |
| Total Finished Goods Produced (Pieces) | **117 Pcs** |
| Total Yield Loss (Kg) | **14 Kg** |
| Total Yield Loss (Pieces) | **3 Pcs** |
| **Total Raw Material Value** | **₹68,500** |
| **Total Finished Goods Value** | **₹79,650** |
| **Total Value Addition** | **₹11,150** |

**Packet Details (Popup / Child Table)**

The packet details table shall display columns relevant to the processing unit:

| Packet Size (Kg / Pcs) | Number of Packets | Total Quantity (Kg) | Total Quantity (Pieces) |
| ----- | ----: | ----: | ----: |

* When Unit = **Kg**: "Total Quantity (Pieces)" column is hidden. Sum of Total Quantity (Kg) must match Finished Goods (Kg).  
* When Unit = **Pieces**: "Total Quantity (Kg)" column is hidden. Sum of Total Quantity (Pieces) must match Finished Goods (Pieces).  
* When Unit = **Both**: Both columns are visible. The Kg sum must match Finished (Kg) and the Pieces sum must match Finished (Pieces).

**Example for Turmeric (Kg unit):**

| Packet Size | Number of Packets | Total Quantity (Kg) |
| ----- | ----: | ----: |
| 10 Kg | 10 | 100 Kg |
| 5 Kg | 9 | 45 Kg |

**Example for Honey (Pieces unit):**

| Packet Size | Number of Packets | Total Quantity (Pieces) |
| ----- | ----: | ----: |
| 1 Kg Bottle | 78 | 78 Pcs |

**Example for Mahua Flowers (Both unit):**

| Packet Size | Number of Packets | Total Quantity (Kg) | Total Quantity (Pieces) |
| ----- | ----: | ----: | ----: |
| 2 Kg | 48 | 96 Kg | — |
| Bag | 10 | — | 10 Bags |

**Validation:** The sum of all packet quantities must exactly match the **Finished Goods Quantity** for each unit type.

**Developer Logic**

* One Processing Transaction → Multiple VDVKs.  
* One VDVK → Multiple Beneficiaries.  
* One Beneficiary → Multiple Commodities.  
* One Commodity → Multiple Grades.  
* The system shall display only approved **available raw stock** at the selected processing location.  
* Qty Taken for Processing cannot exceed Available Stock at the selected location.
* **Raw Material Value** \= (Kg Processed × Rate ₹/Kg) + (Pieces Processed × Rate ₹/Piece). Only applicable unit(s) are calculated.  
* **Finished Goods Value** \= (Finished Kg × Final Cost ₹/Kg) + (Finished Pieces × Final Cost ₹/Piece). Fields irrelevant to the selected unit remain disabled.  
* **Processing Cost** \= Finished Goods Value − Raw Material Value (applies to all unit types).  
* **Per-Unit Processing Cost** (Kg-only or Pieces-only) \= Final Cost per unit − Raw Material Rate per unit. Not applicable when unit is Both.  
* **Yield Loss** \= Raw Qty Processed − Finished Goods Qty (calculated separately for Kg and Pieces).  
* **Value Addition** \= Finished Goods Value − Raw Material Value.  
* Packet quantities must equal the Finished Goods Quantity.

**On APM Approval, automatically update:**

1. Processing Register  
2. Raw Material Stock Register (Deduct Raw Quantity)  
3. Finished Goods Inventory Register (Add Finished Goods)  
4. Commodity-wise Stock Ledger  
5. VDVK-wise Stock Ledger  
6. Beneficiary-wise Stock Ledger  
7. Inventory Register  
8. Audit Trail Register

Only **Approved** processing transactions shall update stock and inventory; rejected transactions shall not modify any register. 

This maintains complete traceability from **collection → stock transfer → processing → finished goods inventory**.

**Input Form – 4: Sales Entry Register**

**Purpose**

To record the sale of **Raw Materials** and **Processed Products** while maintaining complete traceability of **Customer → VDVK → Beneficiary → Commodity/Product → Grade**, along with inventory updates, revenue, and billing details.

**Access**

* **Created By:** Assistant Project Manager (APM)  
* **Verified & Approved By:** Divisional Project Manager (DPM)

**Workflow**

**APM → Submit Sales Entry → DPM Verification → Approve/Reject**

* Only **Approved** sales transactions shall update the operational database.  
* On approval, stock shall be deducted from inventory and sales records shall be updated.  
* If rejected, no inventory or sales registers shall be updated.  
* Rejected transactions shall remain visible only to the creator (APM) with DPM remarks for correction and fresh submission.

**Sales Entry Register**

| Sl. No. | Field Name | Input Type | System Functionality / Mapping |
| ----- | ----- | ----- | ----- |
| 1 | Sale Location (Multipurpose Centre / Hub / Haat Bazaar/ VDVK Facility) | Dropdown | Displays locations mapped to the logged-in APM. System fetches available stock for the selected location. |
| 2 | Sale Date | Date Picker | Format DD/MM/YYYY. Defaults to current date. |
| 3 | Sales Details | **Dynamic Table** | Allows **multiple Customers** (by Customer Code FK), **multiple VDVKs** (by VDVK Code FK), **multiple Beneficiaries**, **multiple Commodities/Products** (by Commodity Code FK), and **multiple Grades** (by Grade Code FK) in a single sales transaction. Display names are snapshotted at creation time. |
| 4 | Commodity-wise Sales Summary | Auto Generated | Displays commodity-wise quantity sold and total sales value. |
| 5 | Grand Total Quantity Sold | Auto Calculated | Sum of all quantities sold. |
| 6 | Grand Total Sales Value (₹) | Auto Calculated | Sum of all sales values. |
| 7 | Overall Remarks | Text Box | Optional remarks for the complete sales transaction. |
| 8 | Submit for Approval | Button | Sends transaction to DPM. Status becomes **Pending Verification**. |
| 9 | Approval Status | System Generated | Pending Verification / Approved / Rejected. |
| 10 | DPM Remarks | Text Box | Mandatory if rejected. Visible to APM for correction and resubmission. |

**Dynamic Sales Details Table**

| Customer Code | Mobile No. | Invoice/Bill No. | VDVK Code | Beneficiary ID | Product Type | Commodity Code | Grade Code | Sales Unit (Kg/Pieces/Both) | Available (Kg) | Available (Pcs) | Packet Details / Bulk Qty | Sold (Kg) | Sold (Pcs) | Price ₹/Kg | Price ₹/Pc | Total Sales (₹) *(Auto)* | Closing (Kg) | Closing (Pcs) | Remarks |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----: | ----: | ----- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----- |
| CUST-001 ABC Traders | 9876543210 | INV-001 | VDK-001 Rampachodavaram | BEN-001 Ramu | Processed | CMD-006 Turmeric Powder | GRD-001 A | Kg | 145 | — | 10 × 10 Kg | 100 | — | 220 | — | 22,000 | 45 | — |  |
|  |  |  | VDK-001 Rampachodavaram | BEN-001 Ramu | Raw Material | CMD-003 Tamarind | GRD-004 A | Kg | 20 | — | Bulk | 15 | — | 90 | — | 1,350 | 5 | — |  |
| CUST-002 XYZ Retail | 9123456789 | INV-002 | VDK-002 Maredumilli | BEN-003 Somulu | Processed | CMD-002 Honey | GRD-003 A | Pieces | — | 78 | 50 × 1 Kg Bottles | — | 50 | — | 450 | 22,500 | — | 28 |  |
|  |  |  | VDK-002 Maredumilli | BEN-003 Somulu | Processed | CMD-002 Honey | GRD-007 B | Pieces | — | 29 | 20 × 1 Kg Bottles | — | 20 | — | 420 | 8,400 | — | 9 |  |
| CUST-003 Local Buyer | 9988776655 | INV-003 | VDK-003 Chintoor | BEN-004 Lakshmi | Processed | CMD-004 Mahua Flowers | GRD-005 A | Both | 96 | 10 | 20 × 2 Kg \+ 10 Bags | 40 | 5 | 50 | 30 | 2,150 | 56 | 5 |  |

**\+ Add Product**

**\+ Add Customer**

**Functional Note**

The system shall support sales entry in **Kilograms (Kg)**, **Number of Pieces**, or **Both**, depending on the commodity, product, or packaging type.

**Step 1 – Select Sales Unit (Mandatory)**

Before entering stock or sales quantity, the user must select one of the following:

* ☐ Quantity in Kilograms (Kg)  
* ☐ Quantity in Pieces  
* ☐ Both (Kg & Pieces)

---

**Step 2 – Enable Relevant Fields**

| User Selection | System Behaviour |
| ----- | ----- |
| **Kg** | Enable **Available (Kg)**, **Sold (Kg)**, **Price ₹/Kg**, **Closing (Kg)**. Pieces & ₹/Pc fields disabled. |
| **Pieces** | Enable **Available (Pcs)**, **Sold (Pcs)**, **Price ₹/Pc**, **Closing (Pcs)**. Kg & ₹/Kg fields disabled. |
| **Both** | Enable all fields: **Available (Kg)**, **Sold (Kg)**, **Price ₹/Kg**, **Closing (Kg)**, **Available (Pcs)**, **Sold (Pcs)**, **Price ₹/Pc**, **Closing (Pcs)**. Total Sales = (Kg × ₹/Kg) + (Pcs × ₹/Pc). |

Fields not selected shall remain disabled and shall not accept any input.

---

**Field-wise Guidelines**

| Field | Description / Validation |
| ----- | ----- |
| **Customer Name** | Mandatory. Select an existing customer or add a new customer. |
| **Mobile No.** | Optional. Validate 10-digit mobile number. |
| **Invoice/Bill No.** | Mandatory. Auto-generated with manual override (if authorized). |
| **VDVK Code** | Mandatory. Select from the VDVK Master by Code or Name. VDVK Name is snapshotted. |
| **Beneficiary Name** | Optional. Applicable where beneficiary-wise sales are maintained. |
| **Product Type** | Mandatory. Select **Raw Material** or **Processed Product**. |
| **Commodity/Product** | Mandatory. Select from the Product/Commodity Master. |
| **Grade** | Optional. Applicable if grading exists. |
| **Sales Unit** | Mandatory. Select Kg, Pieces, or Both before entering quantities. |
| **Available Stock** | Auto-fetched from inventory based on the selected unit. |
| **Packet Details/Bulk Quantity** | For processed products, enter packet details. For raw materials, select **Bulk** or provide loose quantity. |
| **Quantity Sold** | Mandatory. Cannot exceed Available Stock. |
| **Selling Price** | Rate per Kg or per Piece depending on the selected unit. |
| **Total Sales Value** | Auto-calculated. |
| **Closing Stock** | Auto-calculated after deducting sold quantity. |
| **Remarks** | Optional. |

**Automatic Calculations**

**Total Sales Value**

If Sales Unit = **Kg**: Value \= Qty Sold (Kg) × Selling Price (₹/Kg)

If Sales Unit = **Pieces**: Value \= Qty Sold (Pieces) × Selling Price (₹/Piece)

If Sales Unit = **Both**: Value \= (Kg Qty × ₹/Kg) + (Pieces Qty × ₹/Piece)

**Closing Stock**

If **Kg**: Closing (Kg) \= Available (Kg) − Sold (Kg)

If **Pieces**: Closing (Pcs) \= Available (Pcs) − Sold (Pcs)

If **Both**: Both closing stock columns updated independently.

The system shall automatically recalculate all values whenever the quantity or selling price is modified.

**System Validations**

* Customer Name is mandatory.  
* Invoice Number shall be unique.  
* Product Type is mandatory.  
* Commodity/Product is mandatory.  
* Sales Unit selection is mandatory.  
* Quantity Sold (Kg and/or Pieces) cannot exceed Available Stock for the respective unit.  
* Selling Price must be greater than zero.  
* Closing Stock (Kg and/or Pieces) shall be updated automatically.  
* Packet Details shall be mandatory for processed products.  
* Bulk Quantity shall be permitted for raw materials.

**Dynamic Features**

**\+ Add Product**

Allows multiple products or commodities to be added under the same customer invoice.

**\+ Add Customer**

Allows another customer and invoice to be entered in the same sales transaction.

**Auto-Generated Commodity-wise Sales Summary**

| Commodity / Product | Grade | Sales Unit | Sold (Kg) | Sold (Pieces) | Total Sales Value (₹) |
| ----- | ----- | ----- | ----: | ----: | ----: |
| CMD-006 Turmeric Powder | GRD-001 A | Kg | 100 | — | ₹22,000 |
| CMD-003 Tamarind | GRD-004 A | Kg | 15 | — | ₹1,350 |
| CMD-002 Honey | GRD-003 A | Pieces | — | 50 | ₹22,500 |
| CMD-002 Honey | GRD-007 B | Pieces | — | 20 | ₹8,400 |
| CMD-004 Mahua Flowers | GRD-005 A | Both | 40 | 5 | ₹2,150 |

**Grand Totals (Auto-Calculated)**

| Particular | Value |
| ----- | ----: |
| Total Customers | 3 |
| Total VDVKs | 3 |
| Total Beneficiaries | 3 |
| Total Product Entries | 5 |
| Total Quantity Sold (Kg) | **155 Kg** |
| Total Quantity Sold (Pieces) | **75 Pieces** |
| Grand Total Sales Value | **₹56,400** |

**Packet / Packaging Details**

Applicable only for **Processed Products**.

The system shall support **multiple packaging variants** for the same product.

| Packet Size | Number of Packets | Total Quantity |
| ----- | ----: | ----: |
| 100 gm | 150 | 15 Kg |
| 250 gm | 120 | 30 Kg |
| 500 gm | 90 | 45 Kg |
| 1 Kg | 50 | 50 Kg |
| 5 Kg | 9 | 45 Kg |
| 10 Kg | 10 | 100 Kg |

**\+ Add Packet Size** – Users can add unlimited packaging variants.

**Business Rules**

* For **Raw Material**, the system shall allow **Bulk Quantity** entry instead of packet details.  
* For **Processed Products**, the system shall support **packet-wise inventory and sales** with multiple packaging variants.  
* Every sales transaction shall automatically update:  
  * Available Stock Register  
  * Inventory Register  
  * Commodity-wise Sales Register  
  * Customer-wise Sales Register  
  * Beneficiary Revenue Register  
  * VDVK Revenue Dashboard  
  * Financial Reports  
  * Daily, Monthly, and Annual Sales Dashboards

This ensures a single sales entry updates all inventory, financial, and dashboard records automatically while supporting commodities sold by **Kg, Pieces, or both**.

**Developer Logic**

* One Sales Transaction → Multiple Customers.  
* One Customer → Multiple Products.  
* One Product → Multiple VDVKs.  
* One VDVK → Multiple Beneficiaries.  
* One Beneficiary → Multiple Commodities/Products.  
* One Commodity/Product → Multiple Grades.  
* Support sale of both **Raw Materials** and **Processed Products**.  
* For **Processed Products**, support packet-wise or bulk sales.  
* For **Raw Materials**, support bulk quantity sales.  
* Quantity Sold shall not exceed Available Stock (checked per unit type — Kg and Pieces independently).  
* Total Sales Value \= (Kg Sold × ₹/Kg) + (Pieces Sold × ₹/Piece). Only applicable unit(s) are summed.  
* Closing Stock \= Available Stock − Quantity Sold (calculated separately for Kg and Pieces).  
* Customer Master (with immutable Customer Code FK) shall support selection of existing customers and addition of new customers. Customer Name is snapshotted in each sales transaction row. Customer contact details (mobile, address) are editable in the Customer Master without affecting historical sales records.

**On DPM Approval, the system shall automatically update:**

1. Sales Register *(Primary Register)*  
2. Raw Material Stock Register *(if raw material is sold)*  
3. Processed Goods Inventory Register *(if processed goods are sold)*  
4. Commodity-wise Sales Register  
5. VDVK-wise Sales Register  
6. Beneficiary-wise Sales Register  
7. Customer Sales Register  
8. Revenue Register  
9. Inventory Register  
10. Audit Trail Register

**Rejection Logic**

* Rejected transactions shall **not** update any inventory, sales, or financial register.  
* DPM Remarks shall be mandatory for rejection.  
* The APM shall modify the rejected transaction based on the remarks and submit it again as a **fresh sales entry** for approval. This ensures that only approved transactions affect inventory and financial records while maintaining a complete audit trail.

**Input Form – 5: New VDVK Registration (Master Creation)**

**Purpose**

To create a new Van Dhan Vikas Kendra (VDVK) in the system. Once approved, the VDVK shall become available across all operational modules, including MFP Collection, Stock Transfer, Processing, Sales, Beneficiary Management, Reports, and Dashboards.

---

**Access**

* **Created By:** **Admin**  
* **Approved By:** **Divisional Project Manager (DPM)**

---

**Important Workflow**

A VDVK Registration shall not be treated as complete until all beneficiary details are added.

The registration process shall follow two stages, but only one approval.

---

**Stage 1 – Draft Creation**

* Admin enters the VDVK Master details.  
* On clicking **Save Draft**, the VDVK is saved with **Draft Status**.  
* It shall **NOT** be sent to the DPM for approval.  
* The **Submit for Approval** button shall remain disabled.

---

**Stage 2 – Beneficiary Addition**

After saving the draft, the system shall automatically activate the **"Add Beneficiaries"** task on the **Admin Dashboard**.

The Admin shall add beneficiaries through **Input Form – 6** using either:

* Individual Beneficiary Entry  
* Bulk Beneficiary Entry

The system shall automatically update the **Number of Beneficiaries** based on the beneficiary records added.

Once beneficiary addition is completed, the **Submit for Approval** button shall become active.

The Admin shall then submit the complete VDVK Registration (Master \+ Beneficiaries) to the DPM.

---

**Stage 3 – DPM Approval**

The DPM shall review the entire VDVK in one approval cycle.

**If Approved**

* VDVK Master is created.  
* Beneficiary Mapping becomes active.  
* VDVK becomes available throughout the system.

**If Rejected**

The Admin shall make a fresh entry after discussion with the DPM.

This workflow avoids multiple approval cycles and ensures that only complete VDVK records are approved.

---

**VDVK Registration Form**

| Sl. No. | Field Name | Input Type | System Functionality / Mapping |
| ----- | ----- | ----- | ----- |
| 1 | Scheme Code | Dropdown \+ Add New | Displays predefined schemes (PMJVM, PM JANMAN, etc.) from Scheme Master. The "+ Add New" option is available **only to MDA/Admin** — it opens an inline form to create a new scheme with Name and Effective From date. The new scheme is saved to the Scheme Master with `Status = Active` and is immediately available for selection. No separate approval is required for scheme creation. Scheme Name is snapshotted. |
| 2 | VDVK Unique Code | Auto Generated | System automatically generates a unique VDVK Code (immutable FK used by all transaction tables). |
| 3 | VDVK Name | Text Box | Enter official VDVK Name. Duplicate validation shall be applied. Name is snapshotted in all transaction rows at the time of each transaction. Renaming a VDVK does not retroactively change historical records. |
| 4 | MFP Commodities | Multi-Select Dropdown | Select one or more MFP commodities handled by the VDVK. \+ Add Commodity option available. |
| 5 | State | Dropdown | Select from State Master. |
| 6 | District | Dropdown | Auto-filtered based on State selection. |
| 7 | Block / Mandal | Dropdown | Auto-filtered based on District selection. |
| 8 | Village (Optional) | Dropdown / Text Box | Select from Village Master or enter manually. |
| 9 | PIN Code | Auto Fetch / Numeric | Auto-fetch based on Village with manual override option. |
| 10 | Sanction Date | Date Picker | Format DD/MM/YYYY. |
| 11 | Number of Beneficiaries | Auto Generated | Initially displays **0**. Automatically updated after beneficiaries are added through Input Form – 6\. Manual editing is not allowed. |
| 12 | Amount Sanctioned (₹) | Currency | Enter sanctioned amount. Automatically updates Total Sanctioned Amount in the Master Dashboard after approval. |
| 13 | Amount Released by SIA Till Date (₹) | Currency | Enter released amount. Automatically updates financial dashboards after approval. |
| 14 | Bank Details (Optional) | Text Box | Bank Name, Account Number and IFSC (if applicable). |
| 15 | VDVK Status | System Generated | Draft / Pending Approval / Approved / Rejected. |
| 16 | Remarks | Text Box | Optional remarks. |
| 17 | Save Draft | Button | Saves the VDVK as Draft. Does not send for approval. |
| 18 | Submit for Approval | Button | Enabled only after beneficiary details are added. Sends complete VDVK to DPM. |
| 19 | DPM Remarks | Text Box | Mandatory if rejected. Visible to Admin. |

---

**Beneficiary Management**

---

**Automatic System Updates (After DPM Approval)**

The system shall automatically:

* Create the VDVK Master.  
* Activate the VDVK throughout the application.  
* Make the VDVK available in:  
  * MFP Collection Register  
  * Stock Transfer Register  
  * Processing Register  
  * Sales Register  
  * Beneficiary Management  
  * Reports  
  * Dashboards

The system shall also update:

* Total Number of VDVKs  
* Scheme-wise VDVK Count  
* District-wise VDVK Count  
* Block-wise VDVK Count  
* Commodity-wise VDVK Mapping  
* Total Sanctioned Amount  
* Total Released Amount  
* Financial Dashboard  
* Geographic Dashboard

---

**Approval Workflow**

Admin Creates VDVK  
        │  
        ▼  
   Save as Draft  
        │  
        ▼  
System Generates  
"Add Beneficiary" Task  
        │  
        ▼  
Add Beneficiaries  
(Input Form – 6\)  
        │  
        ▼  
Beneficiary Count Updated  
Automatically  
        │  
        ▼  
Submit Complete VDVK  
for Approval  
        │  
        ▼  
DPM Verification  
      │  
 ┌────┴────┐  
 │         │  
Approved  Rejected  
 │         │  
VDVK      Draft Returned  
Activated with Remarks  
---

**Developer Logic**

* One VDVK belongs to one Scheme.  
* One VDVK can handle multiple MFP Commodities.  
* One VDVK can have multiple Beneficiaries.  
* Beneficiaries shall be added only through **Input Form – 6**.  
* Beneficiary Count shall always be system-generated.  
* Duplicate VDVK Codes shall not be allowed.  
* Duplicate VDVK Names within the same Scheme and Block shall not be allowed.  
* A newly created VDVK shall always have **Draft** status.  
* **Submit for Approval** shall remain disabled until:  
  * All mandatory VDVK details are completed.  
  * Beneficiary addition is acknowledged (the Admin must either add at least one beneficiary or explicitly confirm "No beneficiaries to add at this time" via a checkbox). This ensures a new VDVK with zero beneficiaries can proceed to approval when legitimate (e.g., newly formed VDVK awaiting beneficiary identification).
* The DPM shall receive only one approval request after the VDVK registration is fully completed.  
* Every approval, rejection, modification, and resubmission shall be recorded in the **Audit Trail**.

---

**Registers Updated After DPM Approval**

1. VDVK Master Register (Primary Register)  
2. Beneficiary Master Register (Mapped Beneficiaries)  
3. Scheme-wise VDVK Register  
4. District-wise VDVK Register  
5. Block-wise VDVK Register  
6. Commodity Mapping Register  
7. Financial Master Register  
8. Master Dashboard  
9. Audit Trail Register

---

**This workflow ensures that a VDVK is created only once, approved only once, and becomes operational only after complete beneficiary mapping, maintaining data integrity and avoiding duplicate approval cycles.**

**Input Form – 6: Beneficiary Registration (Master Creation)**

**Purpose**

To register beneficiaries under a VDVK. This form shall be used in **two different scenarios**:

1. **During New VDVK Registration (Draft Stage)** – Bulk addition of beneficiaries before VDVK approval.  
2. **After VDVK Approval** – Individual addition of new beneficiaries to an existing VDVK.

Both modes shall create/update records in the **Beneficiary Master**.

**Access**

* **Created By:** Admin  
* **Approved By:**  
  * **During New VDVK Registration:** No separate approval. Beneficiaries are approved along with the VDVK by the DPM.  
  * **For Individual Beneficiary Addition (Existing VDVK):** Divisional Project Manager (DPM).

**Mode 1 – During New VDVK Registration (Bulk Beneficiary Upload)**

**Purpose**

Used only when a new VDVK is in **Draft** status.

After the VDVK Master is saved as Draft, the system shall automatically generate the task:

**Add Beneficiaries**

The Admin can:

* Add beneficiaries manually.  
* Upload beneficiaries through Excel.

No approval shall be initiated until beneficiary addition is completed.

**Excel Upload Format**

| Name | Age | Gender | Mandal | Mobile No. (Optional) |
| ----- | ----: | ----- | ----- | ----- |
| Ramu | 38 | M | Araku | 9876543210 |
| Lakshmi | 41 | F | Araku |  |
| Somulu | 35 | M | Dumbriguda | 9988776655 |

**Mandatory Fields**

* Name  
* Age  
* Gender  
* Mandal

**Optional Fields**

* Mobile Number

After upload, the system shall:

* Generate a **Unique Beneficiary ID** for each record.  
* Map all beneficiaries to the Draft VDVK.  
* Display the uploaded beneficiaries in an editable grid with **Draft** status.

The Admin may later update optional information (Aadhaar, Address, Category, Commodities, etc.) before submitting the complete VDVK for approval.

**Editable Beneficiary Grid (Draft VDVK)**

| Beneficiary ID | Name | Age | Gender | Mandal | Mobile | Status |
| ----- | ----- | ----: | ----- | ----- | ----- | ----- |
| Auto | Ramu | 38 | M | Araku | 9876543210 | Draft |
| Auto | Lakshmi | 41 | F | Araku |  | Draft |
| Auto | Somulu | 35 | M | Dumbriguda | 9988776655 | Draft |

Buttons:

* ➕ Add Beneficiary  
* 📥 Upload Excel  
* ✏ Edit  
* 🗑 Delete

**Mode 2 – Individual Beneficiary Registration (Existing VDVK)**

**Purpose**

Used to add a new beneficiary after the VDVK has already been approved. The Admin fills the full registration form and submits to DPM for approval.

Workflow:

**Admin → Submit Beneficiary → DPM Approval → Beneficiary Added to Master**

---

**Beneficiary Registration Form**

| Sl. No. | Field Name | Input Type | System Functionality / Mapping |
| ----- | ----- | ----- | ----- |
| 1 | Beneficiary Name | Text Box | Enter beneficiary name. |
| 2 | Beneficiary Unique ID | Auto Generated | System automatically generates a unique Beneficiary ID. |
| 3 | Age | Numeric | Enter age in years. |
| 4 | Gender | Dropdown | Male / Female / Other. |
| 5 | Mobile Number | Numeric | Optional. Duplicate validation may be applied if provided. |
| 6 | Aadhaar / UID | Numeric | Optional. Validation for 12 digits if entered. |
| 7 | Address | Text Area | Manual entry. |
| 8 | State | Dropdown | Select from State Master. |
| 9 | District | Dropdown | Filtered based on State. |
| 10 | Mandal | Dropdown | **Mandatory.** Select from Mandal Master. |
| 11 | Village | Dropdown / Text Box | Optional. Select from master or enter manually. |
| 12 | PIN Code | Auto Fetch / Manual | Auto-fetch with manual override option. |
| 13 | MFP Commodities | Multi-Select Dropdown | Select one or more commodities handled by the beneficiary. |
| 14 | VDVK Code | Searchable Dropdown | Search existing VDVKs by Code or Name. Selection automatically maps the beneficiary to the selected VDVK and Scheme. VDVK Name snapshotted. |
| 15 | Scheme | Auto Display | Auto-fetched from the selected VDVK. |
| 16 | Category | Dropdown | SC / ST / OBC / General / Minority / Others. |
| 17 | Remarks | Text Box | Optional remarks. |
| 18 | Submit for Approval | Button | Sends request to DPM. |
| 19 | Approval Status | System Generated | Pending Approval / Approved / Rejected. |
| 20 | DPM Remarks | Text Box | Mandatory if rejected. |

**Workflow**

**Scenario 1 – New VDVK**

Create Draft VDVK  
        │  
        ▼  
Add Beneficiaries  
(Manual / Excel)  
        │  
        ▼  
Edit Optional Details  
        │  
        ▼  
Submit Complete VDVK  
        │  
        ▼  
Single DPM Approval

**Scenario 2 – Existing VDVK**

Admin Adds Beneficiary  
        │  
        ▼  
Submit to DPM  
        │  
        ▼  
Approve / Reject

**Developer Logic**

**Bulk Upload**

* Upload Excel.  
* Validate mandatory columns:  
  * Name  
  * Age  
  * Gender  
  * Mandal  
* Generate Beneficiary IDs automatically.  
* Save as Draft.  
* Allow editing before final VDVK submission.

**Individual Registration**

* Create one beneficiary.  
* Generate Beneficiary ID.  
* Map to selected VDVK.  
* Auto-fetch Scheme.  
* Route to DPM for approval.

**Common Logic**

* One VDVK → Multiple Beneficiaries.  
* One Beneficiary → Multiple MFP Commodities.  
* One Beneficiary belongs to only one active VDVK at a time (unless future business rules permit transfers).  
* Duplicate Aadhaar (if entered) shall not be allowed.  
* Duplicate Beneficiary IDs shall not be allowed.  
* Beneficiary Count in the VDVK Master shall update automatically after approval.

**Registers Updated**

**When added during New VDVK**

(After DPM approves the VDVK)

1. Beneficiary Master Register  
2. VDVK Beneficiary Mapping Register  
3. Beneficiary Dashboard  
4. Audit Trail Register

**When added individually**

(After DPM approval)

1. Beneficiary Master Register  
2. VDVK Beneficiary Mapping Register  
3. VDVK Master (Beneficiary Count Updated)  
4. Beneficiary Dashboard  
5. Audit Trail Register

**Additional Recommendation (Very Useful)**

Include an **"Incomplete Beneficiary Details"** task on the APM Dashboard.

If beneficiaries are uploaded with only the mandatory fields (Name, Age, Gender, Mandal), the system should automatically list them under this task. The Admin can progressively update optional details such as Mobile Number, Aadhaar, Address, Village, PIN Code, and Commodities whenever the information becomes available. This ensures quick onboarding during VDVK creation while maintaining a complete beneficiary profile over time. This feature is especially valuable in field operations where complete beneficiary information is often not available at the time of registration.

**Input Form – 7: Machinery / Asset Onboarding Register**

**Purpose**

To register newly procured machinery/assets under a **VDVK, Hub, Collection Centre, Haat Bazaar, Processing Centre or any other operational location**. Once approved, the machinery/assets shall become part of the **Asset Register** and be available for inventory, reporting, monitoring, maintenance, and audit purposes.

---

**Access**

* **Created By:** Admin  
* **Verified & Approved By:** Divisional Project Manager (DPM)

---

**Workflow**

**Admin → Submit Machinery/Asset Entry → DPM Verification → Approve / Reject**

* Only **Approved** machinery/assets shall be added to the operational database.  
* Rejected entries shall not update any register.  
* DPM Remarks shall be mandatory if rejected.  
* The Admin may modify the rejected entry and submit it again as a fresh request.

---

**Machinery / Asset Onboarding Form**

| Sl. No. | Field Name | Input Type | System Functionality / Mapping |
| ----- | ----- | ----- | ----- |
| 1 | Machinery / Asset Details | **Dynamic Table** | Allows multiple machinery/assets to be added in one transaction. Each row represents one unique machinery/asset or a group of identical machinery. |
| 2 | Overall Remarks | Text Box | Optional remarks for the complete transaction. |
| 3 | Submit for Approval | Button | Sends the transaction to DPM. Status becomes **Pending Verification**. |
| 4 | Approval Status | System Generated | Pending Verification / Approved / Rejected. |
| 5 | DPM Remarks | Text Box | Mandatory if rejected. Visible to APM for modification and resubmission. |

**Dynamic Machinery / Asset Details Table**

| Purchase Date | VDVK Facility / Hub / Centre / Multipurpose Centre | Mandal *(Auto)* | Installation Location | Machinery / Asset Name | Commodity Mapping | Quantity\* | Unit Cost (₹/Machine) | Total Purchase Cost (₹) *(Auto)* | Supplier / Vendor Name | Contact Person | Mobile No. | Email (Optional) | Warranty / Guarantee Available | Warranty Type | Warranty Period | Warranty Start Date | Warranty Expiry Date *(Auto)* | Funding Source | Reason / Purpose | Remarks |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----: | ----: | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| 15/06/2026 | Rampachodavaram | Rampachodavaram | Hub | Pulverizer Machine | Turmeric | 1 | 90,000 | 90,000 | ABC Engineering | Ravi Kumar | 9876543210 | [abc@gmail.com](mailto:abc@gmail.com) | Yes | Warranty | 24 Months | 15/06/2026 | 14/06/2028 | PMJVM | Turmeric Processing |  |
| 15/06/2026 | Rampachodavaram | Rampachodavaram | Hub | Pulverizer Machine | Tamarind | 1 | 1,10,000 | 1,10,000 | ABC Engineering | Ravi Kumar | 9876543210 | [abc@gmail.com](mailto:abc@gmail.com) | Yes | Warranty | 24 Months | 15/06/2026 | 14/06/2028 | PMJVM | Tamarind Processing |  |
| 18/06/2026 | Maredumilli | Maredumilli | Collection Centre | Solar Dryer | Honey | 1 | 2,40,000 | 2,40,000 | Solar Tech Pvt. Ltd. | Mahesh | 9988776655 | [solar@gmail.com](mailto:solar@gmail.com) | Yes | Warranty | 36 Months | 18/06/2026 | 17/06/2029 | MoTA | Honey Drying |  |
| 05/07/2026 | Chintoor | Chintoor | Haat Bazaar | Weighing Machine | All Commodities | 3\* | 15,000 | 45,000 | Precision Scale Co. | Suresh | 9123456789 | [support@psc.com](mailto:support@psc.com) | Yes | Warranty | 12 Months | 05/07/2026 | 04/07/2027 | PM JANMAN | Procurement Operations |  |
| **\+ Add Machinery** |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| **\+ Add VDVK** |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

**Field Logic**

| Field | System Functionality |
| ----- | ----- |
| Purchase Date | Individual purchase date for each machinery. Different dates can be entered for different rows. |
| **VDVK Facility / Hub / Centre / Multipurpose Centre** | Searchable dropdown from approved **VDVK Facility / Hub / Centre / Multipurpose Centre**. Multiple can be included in one transaction. |
| Mandal | Automatically fetched based on selected VDVK. |
| Installation Location | Dropdown: Collection Centre / Hub / Haat Bazaar / Processing Centre / Office / Other (Specify). |
| Machinery / Asset Name | Dropdown from Machinery Master with **Add New Machinery** option. |
| Commodity Mapping | Multi-select dropdown. One machinery can be mapped to one or more commodities. |
| Quantity | **Use only when all machinery are identical** (same model, same purchase date, same supplier, same warranty, same commodity mapping and same unit cost). Otherwise, create separate rows. |
| Unit Cost | Cost of one machinery. |
| Total Purchase Cost | Auto calculated as Quantity × Unit Cost. |
| Supplier / Vendor Name | Select from Supplier Master or add new supplier. |
| Contact Person | Name of supplier representative. |
| Mobile Number | Supplier contact number. |
| Email | Optional supplier email. |
| Warranty / Guarantee Available | Yes / No. |
| Warranty Type | Warranty / Guarantee / AMC. |
| Warranty Period | Example: 12 Months, 24 Months, 36 Months. |
| Warranty Start Date | Defaults to Purchase Date (editable if required). |
| Warranty Expiry Date | Auto calculated based on Warranty Start Date \+ Warranty Period. |
| Funding Source | Dropdown: PMJVM / PM JANMAN / MoTA / State Government / CSR / Other (Specify). |
| Reason / Purpose | Mandatory field describing why the machinery was procured. |

---

**Auto Generated Summary**

| Particular | Auto Calculated |
| ----- | ----: |
| Total VDVKs Covered | 3 |
| Total Machinery Entries | 4 |
| Total Machinery Quantity | 6 |
| Grand Total Purchase Cost | ₹4,85,000 |

**Approval Workflow**

Admin Creates Machinery Entry  
          │  
          ▼  
Submit for Approval  
          │  
          ▼  
DPM Verification  
     ┌──────────────┐  
     │              │  
 Approved      Rejected  
     │              │  
Added to      Returned to Admin  
Asset Register with DPM Remarks

**Developer Logic**

**Entry Logic**

* One Transaction → Multiple VDVKs.  
* One VDVK → Multiple Machinery Entries.  
* One Machinery → Multiple Commodity Mappings.  
* Different machinery may have different:  
  * Purchase Dates  
  * Suppliers  
  * Costs  
  * Funding Sources  
  * Warranty Details  
  * Installation Locations

**Quantity Validation**

The **Quantity** field shall be used **only if**:

* Machinery Name is identical.  
* Purchase Date is identical.  
* Supplier is identical.  
* Unit Cost is identical.  
* Warranty Details are identical.  
* Commodity Mapping is identical.  
* Installation Location is identical.

If **any** of the above differs, the system shall require a **new row**.

**Automatic Calculations**

* **Total Purchase Cost \= Quantity × Unit Cost**  
* **Warranty Expiry Date \= Warranty Start Date \+ Warranty Period**  
* **Grand Total Purchase Cost \= Sum of all machinery purchase costs**

**Auto Generated Asset Details (After Approval)**

For every approved machinery, the system shall generate:

* Asset ID  
* Asset Status \= Active  
* Asset Creation Date  
* Created By  
* Approval Date

**Registers Updated After DPM Approval**

1. **Machinery / Asset Register** *(Primary Register)*  
2. **VDVK Asset Register**  
3. **Hub Asset Register**  
4. **Collection Centre Asset Register**  
5. **Haat Bazaar Asset Register**  
6. **Commodity-wise Machinery Mapping Register**  
7. **Supplier Register**  
8. **Funding Source Register**  
9. **Fixed Asset Register**  
10. **Asset Dashboard**  
11. **Audit Trail Register**

**Important Note**

* Each row should preferably represent **one unique machinery/asset**.  
* Use the **Quantity** field only when multiple machinery are **completely identical** in terms of purchase date, supplier, unit cost, warranty, commodity mapping, and installation location.  
* If any attribute differs (for example, one Pulverizer is for Turmeric costing ₹90,000 and another is for Tamarind costing ₹1,10,000), they **must be entered as separate rows**. This ensures accurate asset tracking, warranty management, financial reporting, and audit compliance.

**Input Form – 8: Machinery Utilisation Register**

**Purpose**

To capture the **daily utilisation and performance of machinery/assets** installed at Collection Centres, Hubs and Haat Bazaars. This register is used to evaluate machinery efficiency, utilisation, productivity and compare the recorded output with the **Processing Register** for verification.

**Access**

* **Created By:** Hub Supervisor / Multipurpose Centre Supervisor / Haat Bazaar Supervisor / VDVK Facility Supervisor  
* **Approved By:** Assistant Project Manager (APM)

**Workflow**

**Supervisor → Submit Daily Machinery Utilisation → APM Approval/Verification**

* APM shall verify the utilisation details by comparing them with the **Processing Register** for the same date.  
* If discrepancies are found, APM may reject the entry with remarks.  
* Only approved entries shall be considered for utilisation and efficiency reports.

**Machinery Utilisation Register**

| Sl. No. | Field Name | Input Type | System Functionality / Mapping |
| ----- | ----- | ----- | ----- |
| 1 | Processing Date | Date Picker | Format DD/MM/YYYY. |
| 2 | Utilisation Details | Dynamic Table | Allows multiple locations, multiple machinery and multiple commodities in one daily entry. |
| 3 | Overall Remarks | Text Box | Optional remarks. |
| 4 | Submit for Verification | Button | Sends entry to APM. |
| 5 | Verification Status | System Generated | Pending / Verified / Rejected. |
| 6 | APM Remarks | Text Box | Mandatory if rejected. |

**Functional Note (Form 8)**

The system shall support utilisation entries in **Kilograms (Kg)**, **Number of Pieces**, or **Both**, depending on the commodity handled by the machinery. Consistent with Forms 1–4, the unit type is **auto-detected per row** from the Commodity Master's `Default Unit`. Per-row field enable/disable behaviour follows the same pattern:

| Commodity Default Unit | System Behaviour for that Row |
| ----- | ----- |
| **Kg** | Enable **Raw Qty (Kg)**, **Final Output (Kg)**, **Yield Loss (Kg)**. Pieces columns remain disabled. |
| **Pieces** | Enable **Raw Qty (Pcs)**, **Final Output (Pcs)**, **Yield Loss (Pcs)**. Kg columns remain disabled. |
| **Both** | Enable all four quantity/output columns. User may enter either or both unit types for that row. |

Fields not applicable to the commodity's unit shall remain disabled and shall not accept any input.

**Dynamic Utilisation Details Table**

| Location Type | Centre / Hub / Haat Bazaar | VDVK Name | Mandal *(Auto)* | Machinery Used | Commodity | Raw Qty (Kg) | Raw Qty (Pcs) | Packet Details | Final Output (Kg) | Final Output (Pcs) | Yield Loss (Kg) *(Auto)* | Yield Loss (Pcs) *(Auto)* | Utilisation Hours | Remarks |
| ----- | ----- | ----- | ----- | ----- | ----- | ----: | ----: | ----- | ----: | ----: | ----: | ----: | :---: | ----- |
| Hub | Rampachodavaram Hub | Rampachodavaram | Rampachodavaram | Pulverizer | Turmeric | 120 | — | 11 × 10 Kg | 110 | — | 10 | — | 6 Hours |  |
| Hub | Rampachodavaram Hub | Rampachodavaram | Rampachodavaram | Pulverizer | Tamarind | 80 | — | 16 × 5 Kg | 80 | — | 0 | — | 3 Hours |  |
| Collection Centre | Maredumilli Centre | Maredumilli | Maredumilli | Solar Dryer | Honey | 100 | — | Bulk | 95 | — | 5 | — | 5 Hours |  |
| Collection Centre | Maredumilli Centre | Maredumilli | Maredumilli | Bottle Filler | Honey | — | 80 | 78 × 1 Kg Bottle | — | 78 | — | 2 | 4 Hours |  |
| **\+ Add Commodity** |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| **\+ Add Location** |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

**Auto Generated Daily Summary**

| Particular | Auto Calculated |
| ----- | ----: |
| Total Locations | 3 |
| Total Machinery Used | 3 |
| Total Commodities Processed | 4 |
| Total Raw Material Processed (Kg) | 300 Kg |
| Total Raw Material Processed (Pieces) | 80 Pcs |
| Total Finished Output (Kg) | 285 Kg |
| Total Finished Output (Pieces) | 78 Pcs |
| Total Yield Loss (Kg) | 15 Kg |
| Total Yield Loss (Pieces) | 2 Pcs |
| Total Machinery Running Hours | 18 Hours |

**Developer Logic**

* One Daily Entry → Multiple Locations.  
* One Location → Multiple Machinery.  
* One Machinery → Multiple Commodities.  
* Yield Loss (Kg) \= Raw Qty (Kg) − Final Output (Kg).  
* Yield Loss (Pcs) \= Raw Qty (Pcs) − Final Output (Pcs).  
* At least one unit (Kg or Pieces) must have data.  
* Packet quantities should match Final Output Quantity.  
* APM shall compare:  
  * Raw Quantity (Kg / Pcs)  
  * Final Output (Kg / Pcs)  
  * Commodity  
  * Date  
  * Location  
    against the **Processing Register**.  
* If values differ by more than a configurable tolerance (default 5%), the entry shall be **flagged for APM review** with the discrepancy highlighted. The APM decides whether to reject with remarks or approve after offline verification. The Admin may adjust the tolerance per commodity in the Master Settings.

**Registers Updated After Verification**

1. Machinery Utilisation Register *(Primary Register)*  
2. Machinery Performance Register  
3. Daily Utilisation Register  
4. Machinery Efficiency Dashboard  
5. Audit Trail Register

**Rejection Logic**

* If the APM rejects the entry, no registers shall be updated.  
* The supervisor may modify the rejected entry based on the APM's remarks and submit it again as a fresh request.  
* The original rejection record and APM remarks shall be preserved in the Audit Trail.  
* Rejected entries shall not appear in utilisation reports, efficiency dashboards, or performance metrics.

**Input Form – 9: Training Programme Register**

**Purpose**

To record details of training programmes conducted for VDVKs for **information, expenditure mapping, monitoring, and reporting purposes**. This module is intended to maintain a centralized record of training activities and the expenditure incurred for each participating VDVK.

**Note:** Training programmes are already approved through the departmental offline process. Therefore, this module is **only for recording completed training programmes** and **does not require any online approval workflow**.

**Access**

* **Created By:** Divisional Project Manager (DPM)  
* **Approval:** **Not Required**

**Workflow**

**DPM → Enter Training Details → Save → Automatically Updates Training Registers & Dashboard**

* The training record shall be saved directly into the database.  
* The system shall immediately update all related registers and dashboards.  
* The DPM may edit the record later if required.  
* All modifications shall be captured in the Audit Trail.

**Training Programme Register**

| Sl. No. | Field Name | Input Type | System Functionality / Mapping |
| ----- | ----- | ----- | ----- |
| 1 | Training Date | Date Picker | Format DD/MM/YYYY. |
| 2 | Training Title | Text Box | Enter the title/name of the training programme. |
| 3 | Training Topic | Dropdown | Processing / Packaging / Value Addition / Marketing / Financial Literacy / Machinery Operation / Safety / Quality Control / Entrepreneurship / Others. |
| 4 | Training Type | Dropdown | Classroom / Field Demonstration / Exposure Visit / Workshop / Online / Awareness Programme / Others. |
| 5 | Training Venue | Text Box | Enter the location where the training was conducted. |
| 6 | Resource Person / Trainer | Text Box | Name of trainer or resource person. |
| 7 | Training Details | **Dynamic Table** | Allows multiple VDVKs to be included in one training programme. |
| 8 | Total Participants | Auto Calculated | Sum of participants from all VDVKs. |
| 9 | Total Training Expenditure (₹) | Auto Calculated | Sum of VDVK-wise training expenses. |
| 10 | Supporting Documents (Optional) | File Upload | Upload attendance sheet, photographs, agenda, or training report. |
| 11 | Overall Remarks | Text Box | Optional remarks. |
| 12 | Save Training Record | Button | **New record mode:** Saves the new training record directly into the database. Hidden when editing an existing record. |
| 13 | Edit Training Record | Button | **Existing record mode:** Saves modifications to an existing training record. Captured in Audit Trail. Hidden when creating a new record. |

**Dynamic Training Details Table**

| VDVK Name | Scheme *(Auto)* | Mandal *(Auto)* | Commodity Covered | No. of Participants | Training Expense (₹) | Remarks |
| ----- | ----- | ----: | ----- | ----- | ----: | ----- |
| Rampachodavaram | PMJVM | Rampachodavaram | Turmeric | 30 | 15,000 |  |
| Maredumilli | PM JANMAN | Maredumilli | Honey | 25 | 12,000 |  |
| Chintoor | PMJVM | Chintoor | Tamarind | 20 | 10,000 |  |
| **\+ Add VDVK** |  |  |  |  |  |  |

**Auto Generated Summary**

| Particular | Auto Calculated |
| ----- | ----: |
| Total VDVKs Covered | 3 |
| Total Participants | 75 |
| Total Training Expenditure | ₹37,000 |

**Developer Logic**

* One Training Programme → Multiple VDVKs.  
* One VDVK → One participant count and expenditure entry per training programme.  
* Scheme shall be auto-fetched from the selected VDVK.  
* Mandal shall be auto-fetched from the selected VDVK.  
* Commodity Covered may be selected for each VDVK if the training is commodity-specific.  
* **Total Participants** \= Sum of all participant counts.  
* **Total Training Expenditure** \= Sum of all VDVK-wise expenses.  
* Supporting documents shall be stored against the training record.  
* The DPM may edit the record after saving. All modifications shall be recorded in the Audit Trail.

**Registers Updated Immediately After Saving**

1. **Training Programme Register** *(Primary Register)*  
2. **Training Expenditure Register**  
3. **VDVK-wise Training Register**  
4. **Scheme-wise Training Register**  
5. **Mandal-wise Training Register**  
6. **Training Calendar**  
7. **Training Dashboard**  
8. **Audit Trail Register**

**Important Note**

* This module is **only for recording completed training programmes**.  
* **No online approval or verification workflow shall be implemented**, as administrative approval is completed offline before the training is conducted.  
* The data captured through this module shall be used for **information, expenditure tracking, monitoring, reporting, and dashboard analytics**. Any subsequent edits shall be logged in the **Audit Trail** to maintain transparency and accountability.

**Input Form – 10: Weekly Fund Utilisation Register**

**Purpose**

To record **weekly operational expenditure** incurred under various approved expenditure heads (excluding Processing, Training, and Machinery Procurement, which are captured through separate modules). This register shall be used for fund utilisation monitoring, financial reporting, and scheme-wise expenditure tracking.

**Access**

* **Created By:** Assistant Project Manager (APM)  
* **Verified & Approved By:** Divisional Project Manager (DPM)

**Workflow**

**APM → Submit Weekly Fund Utilisation → DPM Verification → Approve / Reject**

* Only **Approved** entries shall update the Financial Registers and Dashboard.  
* Rejected entries shall not be posted to the database.  
* DPM remarks shall be mandatory if the entry is rejected.  
* The APM may modify the rejected entry by incorporating the DPM's observations and submit it again as a fresh request.

**Weekly Fund Utilisation Register**

| Sl. No. | Field Name | Input Type | System Functionality / Mapping |
| ----- | ----- | ----- | ----- |
| 1 | Week From | Date Picker | Start date of the reporting week. |
| 2 | Week To | Date Picker | End date of the reporting week. |
| 3 | Expenditure Details | **Dynamic Table** | Allows multiple expenditure entries in one weekly submission. |
| 4 | Supporting Documents | File Upload | Upload bills, vouchers, invoices, receipts, or other supporting documents (multiple uploads allowed). |
| 5 | Overall Remarks | Text Box | Optional remarks for the weekly submission. |
| 6 | Submit for Approval | Button | Sends the weekly expenditure statement to DPM. |
| 7 | Approval Status | System Generated | Pending Verification / Approved / Rejected. |
| 8 | DPM Remarks | Text Box | Mandatory if rejected. |

**Dynamic Expenditure Details Table**

| Expenditure Date | Expenditure Head | Related to VDVK? | VDVK Name(s) | Related to Operational Location? | Location Type | Hub / Collection Centre / Haat Bazaar | Amount (₹) | Purpose / Justification | Remarks |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| 02/07/2026 | Logistics & Transportation | Yes | Rampachodavaram, Chintoor | Yes | Hub | Rampachodavaram Hub | 8,000 | Transportation of raw turmeric from VDVKs to Hub |  |
| 03/07/2026 | Office Expenses | No | — | Yes | Collection Centre | Maredumilli Collection Centre | 2,500 | Stationery and office consumables |  |
| 04/07/2026 | Electricity Charges | Yes | Rampachodavaram | Yes | Hub | Rampachodavaram Hub | 3,800 | Electricity charges for processing operations |  |
| 05/07/2026 | Miscellaneous | Yes | Maredumilli | No | — | — | 1,200 | Local transport for beneficiary meeting |  |
| **\+ Add Expenditure** |  |  |  |  |  |  |  |  |  |

**Expenditure Heads**

The system shall provide a dropdown from the **Expenditure Head Master** (see System-Wide Master Data section). Only heads with `Excluded From Processing = No` and active on the current date shall be displayed.

**Default active heads (pre-seeded):**

* Logistics & Transportation  
* Packaging Material  
* Electricity Charges  
* Water Charges  
* Office Expenses  
* Communication Expenses  
* Vehicle Running & Fuel  
* Repair & Maintenance  
* Printing & Stationery  
* Internet / Telephone Charges  
* Cleaning & Housekeeping  
* Awareness Activities  
* Bank Charges  
* Miscellaneous  
* Other (Specify)

**The following heads are maintained in the Expenditure Head Master with `Excluded From Processing = Yes` and shall NOT appear in this dropdown:**

* ❌ Processing Cost  
* ❌ Machinery Procurement  
* ❌ Training Expenses

**Adding/renaming/deprecating heads:** Admin uses the MDA Dashboard → Expenditure Head Management page. Changes take effect from the specified Effective From date. Historical entries tagged with retired heads remain valid.

**Auto Generated Summary**

| Particular | Auto Calculated |
| ----- | ----: |
| Total Expenditure Entries | 4 |
| Total VDVKs Covered | 3 |
| Total Operational Locations | 2 |
| Grand Total Weekly Expenditure | ₹15,500 |

**Developer Logic**

**Entry Logic**

* One Weekly Submission → Multiple Expenditure Entries.  
* One Expenditure Entry → Multiple VDVKs (if applicable).  
* One Expenditure Entry → Multiple Operational Locations (Hub, Collection Centre, Haat Bazaar), if applicable.

**Mapping Logic**

* **Related to VDVK?**  
  * Yes → Select one or more VDVKs.  
  * No → VDVK selection disabled.  
* **Related to Operational Location?**  
  * Yes → Select one or more:  
    * Hub(s)  
    * Collection Centre(s)  
    * Haat Bazaar(s)  
  * No → Location fields disabled.

**Financial Logic**

* Each expenditure shall be tagged with:  
  * Date  
  * Expenditure Head  
  * Scheme (auto-derived from the selected VDVK(s). If multiple VDVKs from different schemes are selected, the scheme is auto-derived per VDVK and the expenditure is split proportionally across schemes. If the expenditure is **not related to any VDVK**, the Scheme field is left as `Not Applicable` and the expenditure is reported under a separate "General / Non-VDVK" category in scheme-wise reports.)  
  * VDVK(s)  
  * Operational Location(s)  
  * Amount  
  * Purpose / Justification  
* Supporting documents shall be stored with the expenditure record.

**Approval Workflow**

APM Creates Weekly Fund Utilisation  
               │  
               ▼  
      Submit for Approval  
               │  
               ▼  
      DPM Verification  
         ┌──────────────┐  
         │              │  
     Approved      Rejected  
         │              │  
Updated Financial   Returned to APM  
Registers & Dashboard with Remarks

**Registers Updated After DPM Approval**

1. **Weekly Fund Utilisation Register** *(Primary Register)*  
2. **Financial Expenditure Register**  
3. **VDVK-wise Expenditure Register**  
4. **Hub-wise Expenditure Register**  
5. **Collection Centre Expenditure Register**  
6. **Haat Bazaar Expenditure Register**  
7. **Scheme-wise Expenditure Register**  
8. **Financial Dashboard**  
9. **Audit Trail Register**

**Important Note**

* This register shall capture **only operational and administrative expenditures not covered by other dedicated modules**.  
* **Processing Costs**, **Training Expenses**, and **Machinery Procurement** shall continue to be recorded only through their respective modules.  
* All approved expenditures shall contribute to **scheme-wise**, **VDVK-wise**, and **location-wise** fund utilisation reports, enabling comprehensive financial monitoring and audit readiness.

**Input Form – 11: Facility Master Register (Hub / Multipurpose Centre / Haat Bazaar Onboarding)**

**Purpose**

To onboard new operational facilities (Hub, Collection Centre, or Haat Bazaar) into the system. This module shall maintain the master database of all facilities along with their location, infrastructure, commodities handled, machinery available, supervisors, and financial details. Once approved, the facility shall automatically become available for selection in all relevant modules.

---

**Access**

* **Created By:** Admin  
* **Verified & Approved By:** Divisional Project Manager (DPM)

---

**Workflow**

**Admin → Submit New Facility Details → DPM Verification → Approve / Reject**

* Only approved facilities shall be added to the Master Database.  
* Rejected entries shall not be added.  
* DPM remarks shall be mandatory if rejected.  
* Admin may modify and resubmit as a fresh request.

---

**Facility Master Register**

| Sl. No. | Field Name | Input Type | System Functionality / Mapping |
| ----- | ----- | ----- | ----- |
| 1 | Facility Type | Dropdown | Hub / Multipurpose Centre (Collection Centre) / Haat Bazaar |
| 2 | Facility Name | Text Box | Enter the official name of the facility. |
| 3 | Facility Code | Auto Generated | Unique system-generated code. |
| 4 | Scheme | Dropdown | PMJVM / PM JANMAN / Other (Specify). |
| 5 | State | Dropdown | List of States. |
| 6 | District | Dropdown | List of Districts. |
| 7 | Mandal | Dropdown | List of Mandals. |
| 8 | Village / Location | Dropdown \+ Other | Select from master list or enter manually. |
| 9 | Address | Text Area | Complete postal address. |
| 10 | PIN Code | Dropdown / Manual | Select or enter manually. |
| 11 | Date of Establishment | Date Picker | Date the facility became operational. |
| 12 | Status | Dropdown | Operational / Under Construction / Temporarily Closed / Inactive. |
| 13 | Commodities Handled | Multi-Select Dropdown | Select one or more commodities. |
| 14 | Related VDVKs | Multi-Select Search | Select one or more VDVKs served by this facility. |
| 15 | Supervisor / In-charge | Searchable Dropdown | Select from User Master or add new supervisor. Assignment is time-bounded — see Facility → Supervisor Assignment History below. |
| 16 | Contact Number | Numeric | Supervisor contact number. |
| 17 | Email ID | Email | Optional. |

---

**Infrastructure & Machinery Details**

| Sl. No. | Field Name | Input Type | System Functionality / Mapping |
| ----- | ----- | ----- | ----- |
| 18 | Machinery Available | Radio Button | Yes / No |
| 19 | Machinery Details | Dynamic Table | Enabled only when "Yes" is selected. |
| 20 | Storage Capacity (Kg) | Numeric | Total storage capacity of the facility. |
| 21 | Processing Capacity (Kg/Day) | Numeric | Daily processing capacity (if applicable). |
| 22 | Electricity Available | Yes / No |  |
| 23 | Water Facility | Yes / No |  |
| 24 | Internet Connectivity | Yes / No |  |
| 25 | Other Infrastructure | Text Area | Additional facilities available. |

---

**Dynamic Machinery Table**

**Important — Relationship with Form 7:** Form 7 (Machinery Onboarding) is the **authoritative source** for machinery registration. The machinery table in Form 11 **references existing machinery** from the Asset Register (Form 7). When the Admin selects a machinery name, the system searches the Asset Register for matching machinery already installed at the facility. If found, details are pre-filled from Form 7. If the machinery is new (not yet registered), selecting "+ Add Machinery" creates a pending entry in Form 7's workflow and links it to this facility.

| Purchase Date | Machinery Name | Commodity Used For | Quantity | Unit Cost (₹) | Total Cost (₹) | Warranty Till | Status |
| ----- | ----- | ----- | ----- | ----: | ----: | ----- | ----- |
| 10/05/2026 | Pulverizer | Turmeric | 2 | 45,000 | 90,000 | 09/05/2028 | Working |
| 15/06/2026 | Solar Dryer | Tamarind | 1 | 1,20,000 | 1,20,000 | 14/06/2029 | Working |
| **\+ Add Machinery** |  |  |  |  |  |  |  |

**Total Cost** \= Quantity × Unit Cost.

---

**Financial Details**

| Sl. No. | Field Name | Input Type | System Functionality / Mapping |
| ----- | ----- | ----- | ----- |
| 26 | Total Fund Sanctioned (₹) | Currency | Total sanctioned amount for establishment/development of the facility. |
| 27 | Total Fund Released (₹) | Currency | Amount released till date. |
| 28 | Total Fund Utilised (₹) | Currency | Amount utilised till date. |
| 29 | Balance Fund Available (₹) | Auto Calculated | Fund Released − Fund Utilised. |
| 30 | Funding Source | Multi-Select | PMJVM / PM JANMAN / TRIFED / State Govt. / CSR / NGO / Other. |

**Supporting Documents**

| Sl. No. | Field Name | Input Type | System Functionality |
| ----- | ----- | ----- | ----- |
| 31 | Approval Order | File Upload | Upload administrative approval. |
| 32 | Geo-tagged Photograph | File Upload | Optional. |
| 33 | Building Photograph | File Upload | Optional. |
| 34 | Machinery Bills | File Upload | Optional. |
| 35 | Remarks | Text Area | Additional information. |

**Developer Logic**

**Facility Mapping**

* One Facility can serve multiple VDVKs.  
* One VDVK can be linked to multiple facilities.  
* Multiple commodities can be mapped to one facility.  
* One facility can have multiple machinery items.

**Financial Logic**

* **Balance Fund Available \= Total Fund Released − Total Fund Utilised.**  
* Financial figures should be editable as additional funds are released or utilised.

**Machinery Logic**

* Machinery entries are enabled only if **Machinery Available \= Yes**.  
* Each machinery can have a different purchase date, quantity, commodity mapping, warranty period, and cost.

**User Mapping**

* Supervisor shall be selected from the User Master wherever possible.  
* Changing the supervisor through the User Management module shall automatically update this facility.

---

### Facility → Supervisor Assignment History

Each facility may have multiple supervisors over time. The system shall maintain a history of all supervisor assignments with effective date ranges.

**Assignment Record:**

| Field | Type | Description |
| ----- | ----- | ----- |
| Assignment ID | Auto Generated | Unique record ID. |
| Facility Code | FK | The facility being assigned. |
| Supervisor User ID | FK | The supervisor assigned. |
| Supervisor Name Snapshot | Text | Supervisor's name at the time of assignment. |
| Assigned From | Date | Date this supervisor took charge. |
| Assigned To | Date (nullable) | Date this supervisor was relieved. Null = currently active. |
| Remarks | Text (nullable) | Reason for change (transfer, resignation, etc.). |

**Behaviour:**

1. When a new facility is created, the selected supervisor is assigned with `Assigned From = Date of Establishment`, `Assigned To = null`.  
2. When the Admin changes the supervisor (via Form 11 edit or User Management), the system closes the current assignment (`Assigned To = today − 1`) and creates a new one (`Assigned From = today`).  
3. Historical transactions (Forms 2, 3, 8) created by a supervisor remain linked to that supervisor via `created_by` (User ID FK). The supervisor's name at transaction time is snapshotted in the transaction row.  
4. The **Contact Repository** (Dashboard 7) uses the currently active assignment to display the correct supervisor for each facility.  
5. The **Facility → Supervisor Assignment History** is viewable from the Facility Detail page and the User Transfer History.

**Registers Updated:**

1. Facility → Supervisor Assignment Register  
2. Audit Trail Register

---

**Registers Updated After DPM Approval**

1. **Facility Master Register** *(Primary Register)*  
2. **Hub Master Register**  
3. **Collection Centre Master Register**  
4. **Haat Bazaar Master Register**  
5. **Facility–VDVK Mapping Register**  
6. **Facility Machinery Register**  
7. **Facility Financial Register**  
8. **Infrastructure Register**  
9. **Audit Trail Register**

---

**Important Note**

Once a facility is approved, it shall automatically become available throughout the application, including:

* MFP Collection  
* Stock Transfer  
* Processing  
* Sales  
* Machinery Utilisation  
* Weekly Fund Utilisation  
* Dashboard Filters  
* Search Bar  
* Reports  
* Analytics

This ensures that any newly established Hub, Collection Centre, or Haat Bazaar is immediately integrated into all operational modules without requiring further system configuration.

**Input Form – 12: Field Visit Register (Geo-Tagged Visit Monitoring)**

**Purpose**

To record all official field visits conducted by the **Assistant Project Manager (APM)** for monitoring VDVKs, Collection Centres, Hubs, Haat Bazaars, machinery, beneficiary activities, training, inspections, and other field activities. The form shall capture geo-tagged photographic evidence to ensure transparency, accountability, and field activity monitoring.

---

**Access**

* **Created By:** Assistant Project Manager (APM)   
* **View Access:** Project Officer (PO), Divisional Project Manager (DPM), Concerned APM   
* **Approval:** Not Required (Information & Monitoring Purpose Only) 

---

**Field Visit Register**

| Sl. No. | Field Name | Input Type | System Functionality / Mapping |
| ----- | ----- | ----- | ----- |
| 1 | Visit Date | Date Picker | Date of field visit. |
| 2 | Visit Start Time | Time Picker | Time when visit commenced. Stored in **IST (UTC+5:30)**. |
| 3 | Visit End Time | Time Picker | Time when visit concluded. Stored in **IST (UTC+5:30)**. |
| 4 | Mandal | Auto Display / Dropdown | Displays assigned Mandal(s) of the logged-in APM. |
| 5 | Visit Location Type | Dropdown | VDVK / Hub / Collection Centre / Haat Bazaar / Beneficiary / Other. |
| 6 | Location Name | Searchable Dropdown | Displays locations based on selected Visit Location Type. |
| 7 | Related VDVK(s) | Multi-Select Dropdown | Select one or more VDVKs covered during the visit. |
| 8 | Purpose of Visit | Dropdown | Monitoring / Inspection / Beneficiary Meeting / Stock Verification / Machinery Inspection / Training / Issue Resolution / New Facility Inspection / Other. |
| 9 | Visit Description | Text Area | Brief description of activities performed during the visit. |
| 10 | Key Observations | Text Area | Major findings, issues identified, or recommendations. |
| 11 | Geo-Tagged Photographs | Image Upload (Multiple) | Upload one or more geo-tagged photographs. System shall capture Latitude, Longitude, Date & Time automatically from image metadata (where available). |
| 12 | Current GPS Location | Auto Capture | Automatically capture latitude and longitude (subject to device permission). |
| 13 | Number of Photos Uploaded | Auto Generated | Automatically count uploaded photographs. |
| 14 | Supporting Documents (Optional) | File Upload | Upload inspection reports or supporting documents, if required. |
| 15 | Remarks | Text Area | Additional remarks. |
| 16 | Submit | Button | Saves the field visit entry into the Field Visit Register. |

---

**System Behaviour**

Upon submission, the system shall automatically:

* Save the visit in the **Field Visit Register**.   
* Record the APM name and timestamp.   
* Store GPS coordinates.   
* Store geo-tagged photographs.   
* Link the visit to the selected VDVKs and locations.   
* Make the visit immediately visible to the PO and DPM dashboards.   
* Update visit statistics on the dashboard. 

No approval workflow is required.

**Developer Logic**

* Only logged-in APMs can create field visit entries.   
* An APM shall only be able to select locations within their assigned Mandal(s).   
* Multiple VDVKs may be tagged in a single visit.   
* Multiple photographs may be uploaded.   
* GPS coordinates and capture time shall be stored for each visit.   
* Geo-tagged photographs should preferably validate image EXIF GPS data; if unavailable, use the device GPS location during submission.   
* Visit records shall remain editable only until **midnight IST (23:59:59 UTC+5:30)** on the same calendar day as the visit. Thereafter, any correction shall require administrative modification through the Master Data Administrator with proper remarks.
* Every edit shall be recorded in the Audit Trail. 

**Registers Updated**

1. Field Visit Register   
2. APM Activity Register   
3. Audit Trail Register 

---

## Authentication & Authorization

### Login

* Users log in using a **username + password** combination.  
* Passwords are stored as **bcrypt hashes** (never in plain text).  
* A successful login returns a **JWT access token** (15-minute expiry) and a **refresh token** (7-day expiry).  
* All API requests include the access token in an `Authorization: Bearer <token>` header.  
* When the access token expires, the client silently refreshes using the refresh token.  
* **Password policy:** Minimum 8 characters, at least one uppercase, one lowercase, one digit.  
* **Account lockout:** 5 consecutive failed login attempts lock the account for 30 minutes.  
* **Session management:** A user can have a maximum of 3 concurrent sessions. New login beyond this invalidates the oldest session.  

### Role-Based Access Control (RBAC)

Each user is assigned one or more roles. Access to forms, dashboards, and approval actions is determined by role as defined throughout this document. The system enforces RBAC at both the **API** and **UI** layers:

* **API layer:** Every endpoint validates the user's role from the JWT before processing.  
* **UI layer:** Navigation items, buttons, and action menus are conditionally rendered based on the user's current role.  

### Approval Hierarchy

The approval chain is: **CC/Supervisor → APM → DPM**. PO has view-only access across all forms. No user can approve their own submissions.

---

## Notification System Schema

### In-App Notifications

| Field | Type | Description |
| ----- | ----- | ----- |
| `notification_id` | UUID | Unique identifier. |
| `recipient_user_id` | FK → User Master | The user receiving the notification. |
| `type` | Enum | `APPROVAL_REQUIRED` / `APPROVED` / `REJECTED` / `ESCALATED` / `PENDING_ATTENTION` / `SYSTEM`. |
| `title` | Text | Human-readable title (e.g., "Request MFPC-000001 requires your approval"). |
| `body` | Text | Detailed message. |
| `related_transaction_id` | String (nullable) | The transaction this notification relates to. |
| `is_read` | Boolean | Default `false`. |
| `created_at` | Timestamp | When the notification was generated. |
| `read_at` | Timestamp (nullable) | When the user marked it as read. |

**Behaviour:** Notifications are displayed as a bell-icon dropdown in the dashboard header. Unread count is shown as a badge. Clicking a notification navigates to the related transaction and marks it as read.

### Email Alerts

Email alerts are sent for **escalated** and **pending attention** notifications only (not for routine approvals/rejections). The system uses a configurable SMTP server. Email templates are stored in the database and can be customized by Admin.

| Configuration | Value |
| ----- | ----- |
| SMTP Host | Configurable |
| SMTP Port | Configurable (default 587) |
| Sender Address | Configurable (e.g., noreply@vdvk-mis.gov.in) |
| Email Footer | Standard government disclaimer |

**Email triggers:**
* Request pending 7+ days → Send email to DPM & PO (or PO only if pending with DPM).  
* Request pending 5 days → Send pending-attention email to approver.  

### Notification Log

Every notification sent (in-app + email) is recorded in an append-only log for audit purposes.

---

## Audit Trail Schema (Common to All Forms)

Every approval, rejection, modification, resubmission, administrative correction, and **rate revision** across all input forms and master data must be recorded in the central Audit Trail.

| Field | Type | Description |
| :--- | :--- | :--- |
| `audit_id` | Auto-generated (UUID) | Unique identifier for each audit record. |
| `transaction_id` | String | The ID of the original transaction being audited (e.g., MFPC-000001, ST-000001). |
| `form_type` | Enum | Which input form the transaction belongs to (Form 1 / Form 2 / ... / Form 12). |
| `action` | Enum | `CREATED` / `SUBMITTED` / `APPROVED` / `REJECTED` / `MODIFIED` / `RESUBMITTED` / `CORRECTED` / `DELETED` / `RATE_REVISED`. |
| `performed_by` | User ID | Who performed the action. |
| `performer_role` | Enum | Role of the performer at the time of action (CC / APM / DPM / Admin / MDA). This value is snapshotted from the User Master — if the user changes role later, the audit record retains the original role. |
| `performed_at` | Timestamp | Date and time of the action. |
| `old_values` | JSON (nullable) | Snapshot of the record before the change (null for CREATED). |
| `new_values` | JSON (nullable) | Snapshot of the record after the change (null for DELETED). |
| `remarks` | Text (nullable) | Approval/rejection remarks or reason for correction. |
| `escalated` | Boolean | Whether this action was triggered by an escalation. |
| `escalated_to` | User ID (nullable) | PO or DPM notified if escalated. |

**Behaviour:**
* Every state change in any form shall insert one row into this table.
* `old_values` and `new_values` shall store complete row snapshots as JSON, including all dynamic-table child rows.
* The Audit Trail is read-only via the UI; no user can edit or delete audit records.
* The Audit Trail Register (Report 16 in Books of Accounts, Register 16 in Operational Registers) queries this table. 

