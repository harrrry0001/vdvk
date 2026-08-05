**Dashboard – 1: Home Page / District Overview Dashboard**

The Home Page shall provide a **real-time overview of all Van Dhan Vikas Kendras (VDVKs)** operating in ITDA,PADERU, **Alluri Sitarama Raju District**. It shall serve as the primary monitoring dashboard for Project Officer (PO), Addl. Project Director (APD) and District Project Managers (DPM-VDVK) by displaying district-level performance indicators, commodity statistics, financial performance, and operational summaries.

**Access**

| User | Access Level |
| ----- | ----- |
| Project Officer (PO) | Complete District Data |
| Addl.Project Director (APD) | Complete District Data |
| Divisional Project Manager (DPM-VDVK) | Complete District Data |
| Assistant Project Manager (APM) | Only Assigned Mandal(s) |

**Note:** This page describes the **PO, APD, and DPM** Home Dashboard. APMs have a **separate limited version** (see "APM Dashboard" section) restricted to their assigned Mandal(s) — the APM District Overview is a subset of the KPIs shown here.

**Notification Mechanism for Escalations**

When a request crosses the escalation threshold (7+ working days), the system shall automatically:
* Send an **in-app notification** (bell icon / alert badge on the dashboard header) per the Escalation Notification Logic (APM-pending → DPM & PO, DPM-pending → PO only).
* Send an **email alert** to the concerned recipients based on the same logic.
* Mark the request with a red **🔴 Escalated** badge in all dashboard views and the request monitoring table.
* Log the notification event in the Audit Trail with the performer = "System", action = "ESCALATED", and escalated_to = DPM/PO user ID.

No SMS or WhatsApp integration is required at this stage. The in-app notification and email alert are sufficient for the current scope.

**Page Layout**

The dashboard shall contain the following sections:

1. Search & Smart Navigation   
2. District Summary Overview   
3. Commodity Performance Section   
4. Mandal Performance Section   
5. Hub & Haat Bazaar Performance Widget 

**1\. Search & Smart Navigation**

**Location:** Top Right Corner

**Feature**

A global search bar shall allow users to quickly search and navigate to operational entities.

**Search Options**

* Mandal   
* VDVK   
* Commodity   
* Hub   
* Multipurpose Centre (Collection Centre)   
* Haat Bazaar 

**A. Mandal Search**

When a Mandal is searched, the system shall display a Mandal Summary Card containing:

* Mandal Name   
* Total VDVKs   
* Total Beneficiaries   
* Total MFP Collection   
* Total Processing Quantity   
* Total Sales Quantity   
* Total Revenue 

Users shall be able to change the reporting period:

* Today   
* This Week   
* This Month *(Default)*   
* Quarter   
* Year   
* Custom Date Range   
* Till Date 

**B. Commodity Search**

Searching a commodity (e.g., Turmeric, Honey, Tamarind) shall display:

* Commodity Name   
* Total MFP Collection   
* Total Quantity Processed   
* Current Unprocessed Stock   
* Final Goods Sold   
* Total Revenue Generated 

The same time filters shall be available.

**C. Hub Search**

Searching a Hub shall display:

* Hub Name   
* Total Raw Stock   
* Total Processed Stock   
* Processing Quantity   
* Sales Quantity   
* Revenue Generated 

**D. Haat Bazaar Search**

Searching a Haat Bazaar shall display:

* Haat Bazaar Name   
* Available Stock   
* Sales Quantity   
* Revenue   
* Commodities Handled 

**2\. District Summary Overview**

**Position:** Top Section

This section shall display key performance indicators (KPIs) for the entire district.

**District Summary Cards**

| KPI | Data Source |
| ----- | ----- |
| Total VDVKs | VDVK Master (Input Forms 5 & 6\) |
| Scheme-wise VDVKs | VDVK Master |
| Total Beneficiaries | Beneficiary Master (Input Form 6\) |
| Total MFP Collection | Master Data \+ Input Form 1 |
| Total Processing Quantity | Master Data \+ Input Form 3 |
| Total Sales Quantity | Master Data \+ Input Form 4 |
| Total Revenue | Master Data \+ Input Form 4 |
| Total Hubs | Master Data |
| Total Collection Centres / Multipurpose Centres | Master Data |
| Total Haat Bazaars | Master Data |

**System Behaviour**

The figures shall update automatically whenever:

* MFP Collection is approved (Input Form–1)   
* Stock Transfer is approved (Input Form–2)   
* Processing is approved (Input Form–3)   
* Sales are approved (Input Form–4)   
* New VDVKs are approved (Input Form–5)   
* New Beneficiaries are approved (Input Form–6) 

The dashboard shall combine:

* Historical Master Data   
* Approved New Transactions 

to generate live statistics.

**3\. Commodity Performance Section**

**Position:** Middle Section

Displays commodity-wise performance.

**Default View**

Top 5 Commodities

A **View All Commodities** button shall display the complete ranking.

**Commodity Ranking Table**

| Rank | Commodity | MFP Collection (Kg/Pieces) | Processed (Kg/Pieces) | Unprocessed Stock (Kg/Pieces) | Sales (Kg/Pieces) | Revenue (₹) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |

Note: Kg column applies to weight-based commodities. Pieces column applies to commodities tracked by unit count.

**Unprocessed Stock Formula:**  
`Unprocessed Stock = MFP Collection (Approved Form 1) − Quantity Taken for Processing (Approved Form 3) − Direct Raw Material Sales (Approved Form 4, where Product Type = Raw Material)`  

The formula is calculated independently for Kg and Pieces. Stock transferred between locations (Form 2) does not change the total unprocessed stock at the district level — it only redistributes it across locations.

**Graph**

Default Graph:

**Commodity-wise MFP Collection Contribution (%)**

Example:

Turmeric → 38%

Honey → 22%

Tamarind → 18%

Others...

**Ranking Parameter**

The user shall be able to change the ranking basis.

Dropdown:

* Collection Quantity *(Default)*   
* Processing Quantity   
* Unprocessed Stock   
* Sales Quantity   
* Revenue 

Changing the parameter shall automatically update:

* Ranking   
* Table   
* Graph 

**Data Source**

Primary:

* Input Form–1   
* Input Form–2   
* Input Form–3   
* Input Form–4 

Supporting:

* Input Form–5   
* Input Form–6 

Historical:

* Master Database 

**4\. Mandal Performance Section**

**Position:** Bottom Left

Displays Mandal Performance Cards.

**Default View**

Top 5 Performing Mandals

Button:

**View All Mandals**

Displays all Mandals alphabetically.

**Each Mandal Card**

Displays:

* Mandal Name   
* Number of VDVKs   
* Total Beneficiaries   
* Total MFP Collection   
* Total Revenue   
* Number of Hubs   
* Number of Multipurpose Centres (Collection Centres)   
* Number of Haat Bazaars 

**Data Source**

| Data | Source |
| ----- | ----- |
| VDVKs | Master \+ Input Form 5 |
| Beneficiaries | Master \+ Input Form 6 |
| Collection | Master \+ Input Form 1 |
| Revenue | Master \+ Input Form 4 |
| Hubs | Master Data |
| Multipurpose Centres (Collection Centres) | Master Data |
| Haat Bazaars | Master Data |

**5\. Hub & Haat Bazaar Performance Widget**

**Position:** Right Side of Dashboard

Displays consolidated operational performance of all Hubs and Haat Bazaars.

**Performance Widget**

Displays:

* Total MFP Collection   
* Total Processing Quantity   
* Current Raw Stock   
* Current Processed Stock   
* Sales Quantity   
* Revenue 

**Time Filter**

* Weekly *(Default)*   
* Monthly   
* Quarterly   
* Half-Yearly   
* Yearly   
* Custom Date Range 

**Data Source**

Primary:

* Input Form–1   
* Input Form–2   
* Input Form–3   
* Input Form–4 

Supporting:

* Master Database 

Figures shall update automatically after approval of the relevant operational entries.

**Developer Logic**

**Dashboard Refresh**

The dashboard shall automatically refresh whenever approved data is received from:

* Input Form–1 (MFP Collection)   
* Input Form–2 (Stock Transfer)   
* Input Form–3 (Processing)   
* Input Form–4 (Sales)   
* Input Form–5 (VDVK Master)   
* Input Form–6 (Beneficiary Master) 

Historical data shall be retrieved from the Master Database and merged with approved operational data.

**Filters**

The dashboard shall support:

* Today   
* This Week   
* This Month *(Default)*   
* Quarterly   
* Half-Yearly   
* Yearly   
* Till Date   
* Custom Date Range 

**Search**

The global search bar shall support searching by:

* Mandal   
* VDVK   
* Commodity   
* Hub   
* Multipurpose Centre (Collection Centre)   
* Haat Bazaar 

**Performance Ranking**

Users shall be able to dynamically rank commodities and mandals based on:

* MFP Collection   
* Processing Quantity   
* Current Stock   
* Sales Quantity   
* Revenue 

The ranking table and associated graphs shall update instantly when the selected ranking parameter changes.

**Dashboard Data Sources Summary**

| Dashboard Component | Data Source |
| ----- | ----- |
| District Summary | Master Database \+ Input Forms 1, 3, 4, 5, 6 |
| VDVK & Beneficiary Statistics | Input Forms 5 & 6 |
| Commodity Performance | Input Forms 1–4 |
| Mandal Performance | Master Database \+ Input Forms 1, 4, 5, 6 |
| Hub & Haat Bazaar Widget | Input Forms 1–4 \+ Master Database |
| Revenue | Input Form 4 |
| Processing | Input Form 3 |
| Collection | Input Form 1 |
| Stock Information | Input Forms 2 & 3 |

**Dashboard – 2: VDVK Performance Dashboard**

**Purpose**

The **VDVK Performance Dashboard** provides a quick comparison of the performance of all VDVKs in the District (PO/APD/DPM) or assigned Mandal (APM). It helps identify the top-performing VDVKs based on different operational parameters.

---

**Access**

| User | Access Level |
| ----- | ----- |
| Project Officer (PO) | All VDVKs in the District |
| Addl. Project Director | All VDVKs in the District |
| Divisional Project Manager (DPM) | All VDVKs in the District |
| Assistant Project Manager (APM) | Only Assigned Mandal(s) |

---

**Page Layout**

**1\. Performance Filters (Top Section)**

The following filters shall be available:

* **Time Period**  
  * Today  
  * This Week  
  * **Current Month (Default)**  
  * Quarterly  
  * Half-Yearly  
  * Yearly  
  * Till Date  
  * Custom Date Range  
* **Ranking Based On**  
  * **MFP Collection (Default)**  
  * Processing Quantity  
  * Raw Goods Sold  
  * Processed Goods Sold  
  * Total Sales Quantity  
  * Revenue  
  * Current Raw Stock  
  * Current Processed Stock  
* **Commodity Filter**  
  * All Commodities (Default)  
  * Turmeric  
  * Tamarind  
  * Honey  
  * Amla  
  * Hill Broom  
  * Soap Nut  
  * Other Commodities

Whenever any filter is changed, the table and graph shall automatically refresh.

---

**2\. Top Performing VDVKs**

By default, the dashboard shall display the **Top 10 VDVKs** ranked based on **MFP Collection** for the selected time period.

**Performance Table**

| Rank | VDVK Name | Mandal | Collection (Kg) | Processing (Kg) | Total Sales (Kg) | Revenue (₹) |
| :---: | :---: | :---: | ----: | ----: | ----: | ----: |

If the user changes the ranking parameter (e.g., Revenue or Processing), the ranking and values shall automatically update.

---

**3\. Performance Graph**

A graph shall display the **Top 10 VDVKs** based on the selected ranking parameter.

The graph shall automatically change whenever:

* Time Filter changes  
* Ranking Parameter changes  
* Commodity Filter changes

**5\. Download Complete Report**

At the bottom of the page, provide the following options:

* **View Complete VDVK List**  
* **Download Excel Report**  
* **Download PDF Report**

The downloaded report shall include **all VDVKs** based on the selected filters, not just the Top 10\.

**Developer Logic**

**Default Settings**

* Time Filter → **Current Month**  
* Ranking → **MFP Collection**  
* Commodity → **All Commodities**  
* Display → **Top 10 VDVKs**

**Data Source**

* **Input Form 1** – MFP Collection  
* **Input Form 3** – Processing  
* **Input Form 4** – Sales & Revenue  
* **Input Forms 5 & 6** – VDVK & Beneficiary Details  
* **Master Database** – Historical Data

**System Behaviour**

* Rankings shall update automatically based on the selected parameter.  
* Commodity filter shall show rankings only for the selected commodity.  
* Time filter shall recalculate all figures for the selected period.  
* Reports shall be generated based on the currently applied filters.  
* PO/DPM shall view all VDVKs in the District, while APM shall view only VDVKs under their assigned Mandal(s).

**Dashboard – 3: Hub / Haat Bazaar / Multipurpose Centre Performance Dashboard**

**Purpose**

The dashboard provides a comparative performance analysis of all Hubs, Multipurpose Centres (Collection Centres), and Haat Bazaars. It enables users to monitor operational performance based on MFP Collection, Processing, Raw Goods Sales, Processed Goods Sales, Revenue, Machinery, and VDVK coverage.

---

**Access**

| User | Access Level |
| ----- | ----- |
| Project Officer (PO)/APD | All Facilities in District |
| Divisional Project Manager (DPM) | All Facilities in District |
| Assistant Project Manager (APM) | Only Assigned Mandal Facilities |

---

**Page Layout**

**1\. Performance Filters**

**Facility Type**

* Hub (Default)
* Multipurpose Centre (Collection Centre)
* Haat Bazaar

**Time Filter**

* Today  
* This Week  
* **Current Month (Default)**  
* Quarterly  
* Half-Yearly  
* Yearly  
* Till Date  
* Custom Date Range

**Ranking Based On**

* **MFP Collection (Default)**  
* Processing Quantity  
* Raw Goods Sales  
* Processed Goods Sales  
* Total Sales  
* Revenue  
* Machinery Count  
* Number of VDVKs Served

Whenever any filter is changed, the table and graph shall automatically refresh.

**2\. Facility Performance**

**Hub Performance (Default)**

Since there are currently **11 Hubs**, the dashboard shall display **all Hubs**.

| Rank | Hub Name | Mandal | Machinery Count | MFP Collection (Kg) | Processing (Kg) | Raw Goods Sales (Kg) | Processed Goods Sales (Kg) | Revenue (₹) | VDVKs Served |
| :---: | :---: | :---: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |

---

**Multipurpose Centre / Haat Bazaar Performance**

By default, the dashboard shall display the **Top 10** Multipurpose Centres (Collection Centres) or Haat Bazaars.

| Rank | Facility Name | Mandal | Machinery Count | MFP Collection (Kg) | Processing (Kg) | Raw Goods Sales (Kg) | Processed Goods Sales (Kg) | Revenue (₹) | VDVKs Served |
| :---: | :---: | :---: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |

Changing the ranking parameter shall automatically update the ranking, table, and graph.

---

**3\. Performance Graph**

A graphical representation of facility performance shall be displayed.

The graph shall update automatically whenever:

* Facility Type changes  
* Ranking Parameter changes  
* Time Filter changes

---

**4\. View Complete List & Download Report**

At the bottom of the page, provide:

* **View Complete List**  
* **Download Excel Report**  
* **Download PDF Report**

**Behaviour**

* **Hub:** Displays/downloads all Hubs.  
* **Multipurpose Centre:** Displays/downloads all Multipurpose Centres (Collection Centres).  
* **Haat Bazaar:** Displays/downloads all Haat Bazaars.  
* **VDVK’s:** Displays/downloads all VDVK’s

All reports shall be generated based on the selected filters.

---

**Developer Logic**

**Default Settings**

* Facility Type → **Hub**  
* Time Filter → **Current Month**  
* Ranking → **MFP Collection**

**Data Source**

* Input Form 1 – MFP Collection  
* Input Form 2 – Stock Transfer  
* Input Form 3 – Processing  
* Input Form 4 – Sales (Raw & Processed Goods)  
* Input Form 7 – Machinery Master  
* Input Form 11 – Facility Master  
* Master Database – Historical Data

**System Behaviour**

* Hub dashboard shall display **all Hubs** (currently 11).  
* Multipurpose Centre (Collection Centre) and Haat Bazaar dashboards shall display the **Top 10** by default with a **View Complete List** option.  
* **Raw Goods Sales** and **Processed Goods Sales** shall be displayed as separate columns. **Total Sales** may be calculated as the sum of both when required.  
* Changing any filter shall automatically refresh the rankings, graph, and performance table.  
* PO/DPM shall view all district facilities, while APM shall view only facilities mapped to their assigned Mandal(s).

**Dashboard – 4: Assets / Machinery Monitoring Dashboard**

**Purpose**

The **Assets / Machinery Monitoring Dashboard** provides a centralized view of all machinery/assets available across Hubs, Multipurpose Centres (Collection Centres), and Haat Bazaars. It enables users to monitor the current location, operational status, purchase details, warranty, supplier information, and maintenance history of each machine.

---

**Access**

| User | Access Level |
| ----- | ----- |
| Project Officer (PO)/APD | All Machinery in District |
| Divisional Project Manager (DPM) | All Machinery in District |
| Assistant Project Manager (APM) | Machinery under Assigned Mandal(s) |

---

**Page Layout**

**1\. Filters**

The dashboard shall provide the following filters:

* **Facility Type** (Hub / Multipurpose Centre / Haat Bazaar/ VDVK Facility)  
* **Mandal**  
* **Commodity**  
* **Machinery Status**  
* **Warranty Status**  
* **Purchase Date**

Whenever any filter is changed, the table shall automatically refresh.

---

**2\. Machinery Monitoring Table**

The dashboard shall display all machinery with the following details:

| Machinery ID | Machinery Name | Current Facility | Facility Type | Mandal | Purchase Date | Purchase Cost (₹) | Supplier Name | Supplier Contact | Warranty Valid Till | Last Service Date | Current Status |
| :---: | :---: | :---: | :---: | :---: | :---: | ----: | :---: | :---: | :---: | :---: | :---: |

---

**Current Status**

Each machinery shall display one of the following statuses:

* Available  
* In Use  
* Idle  
* In Transit  
* Under Maintenance  
* Out of Service

---

**3\. View Machinery Details**

Clicking on a machinery shall display complete details:

* Machinery ID  
* Machinery Name  
* Commodity Handled  
* Current Facility  
* Facility Type  
* Mandal  
* Current Supervisor/In-charge  
* Purchase Date  
* Purchase Cost  
* Supplier Name  
* Supplier Contact Details  
* Funding Source  
* Warranty / Guarantee Period  
* Last Service Date  
* Next Service Due Date  
* Current Status  
* Transfer History  
* Utilisation History

---

**4\. Download Report**

Provide the following options:

* **View Complete Machinery List**  
* **Download Excel Report**  
* **Download PDF Report**

Reports shall be generated based on the selected filters.

---

**Developer Logic**

**Default View**

* Display all machinery within the user's jurisdiction.  
* Show the latest approved location and current status of each machinery.

**Data Source**

* Input Form 7 – Machinery Master Register  
* Input Form 8 – Machinery Utilisation Register  
* Input Form 11– Facility Master Register  
* Master Database – Historical Asset Data

**System Behaviour**

* Current facility shall automatically update after completion of an approved machinery transfer.  
* Warranty, supplier, and purchase details shall be fetched from the Machinery Master.  
* Last Service Date shall update whenever a maintenance/service record is entered.  
* PO/DPM shall view all machinery in the district, while APM shall view only machinery mapped to their assigned Mandal(s).

**Dashboard – 5: Fund Monitoring Dashboard**

**Purpose**

The **Fund Monitoring Dashboard** provides a comprehensive overview of the financial performance of all VDVKs in the district. It enables the Project Officer (PO) and Divisional Project Manager (DPM) to monitor sanctioned funds, fund utilization, expenditure under various heads, and revenue generated from VDVK activities.

---

**Access**

| User | Access Level |
| ----- | ----- |
| Project Officer (PO)/APD | Complete District Data |
| Divisional Project Manager (DPM) | Complete District Data |
| Assistant Project Manager (APM) | Not Available |

---

**Page Layout**

**1\. Financial Summary (Top Section)**

The dashboard shall display the following financial summary cards:

* Total Funds Sanctioned  
* Total Funds Released  
* Total Funds Utilised  
* Remaining Fund Balance  
* Total Revenue Generated  
* Net Financial Position *(Revenue vs. Expenditure)*

**Time Filter**

* Current Month (Default)  
* Quarterly  
* Half-Yearly  
* Yearly  
* Till Date  
* Custom Date Range

All financial figures shall automatically update based on the selected time period.

---

**2\. Expenditure Summary**

The dashboard shall display expenditure under different heads.

**Expenditure Table**

| Expenditure Head | Amount (₹) |
| ----- | ----- |
| Machinery Purchase |  |
| Processing Cost |  |
| Training Expenses |  |
| Logistics & Transportation |  |
| Infrastructure / Facility Expenses |  |
| Administrative Expenses |  |
| Other Expenses |  |
| **Total Expenditure** |  |

A pie chart or bar chart shall display the percentage contribution of each expenditure head.

---

**3\. Revenue Monitoring**

The dashboard shall display revenue generated from VDVK activities.

| Particular | Amount (₹) |
| ----- | ----- |
| Revenue from Raw Goods Sales |  |
| Revenue from Processed Goods Sales |  |
| **Total Revenue Generated** |  |

A graph shall display revenue trends based on the selected time period.

---

**4\. VDVK-wise Fund Status**

The dashboard shall display the financial status of each VDVK.

| VDVK Name | Scheme | Amount Sanctioned (₹) | Amount Released (₹) | Amount Utilised (₹) | Balance Fund (₹) | Revenue Generated (₹) |
| :---: | :---: | ----: | ----: | ----: | ----: | ----: |

Buttons:

* **View Complete List**  
* **Download Excel Report**  
* **Download PDF Report**

---

**Developer Logic**

**Default Settings**

* Time Filter → **Current Month**

**Data Source**

* **Input Form 4** – Sales Revenue  
* **Input Form 5** – VDVK Master (Sanctioned & Released Funds)  
* **Input Form 7** – Machinery Onboarding (Machinery Purchase Cost)  
* **Input Form 9** – Training Register (Training Expenses)
* **Input Form 10** – Weekly Fund Utilisation Register  
* **Master Database** – Historical Financial Data

**System Behaviour**

* The dashboard shall automatically update after approval of financial transactions.  
* Remaining Fund Balance shall be calculated as **Amount Released − Amount Utilised**.  
* Total Expenditure shall be the sum of all approved expenditure heads.  
* Total Revenue shall include **Raw Goods Sales \+ Processed Goods Sales**.  
* All reports and graphs shall update automatically when the selected time filter changes.  
* The dashboard shall be available **only to PO and DPM** for district-level financial monitoring and reporting.

**Dashboard – 6: Request Monitoring Dashboard**

**Purpose**

The **Request Monitoring Dashboard** enables the Project Officer (PO) and Divisional Project Manager (DPM) to monitor all requests submitted by subordinate users through various input forms. It provides a centralized view of pending, approved, rejected, and delayed requests to ensure timely verification and approvals.

---

**Access**

| User | Access Level |
| ----- | ----- |
| Project Officer (PO)/APD | View Only (All Requests) |
| Divisional Project Manager (DPM) | View All \+ Approve / Reject (Forms 4–7, 10–11 only). View-only for Forms 1–3, 8. |

**Approval Responsibility Matrix**

| Input Form | Submitted By | Approved By |
| :--- | :--- | :--- |
| Form 1 – MFP Collection | Community Coordinator (CC) | Assistant Project Manager (APM) |
| Form 2 – Stock Transfer | Hub / Haat / MPC Supervisor | Assistant Project Manager (APM) |
| Form 3 – Processing | Hub / Haat / MPC Supervisor | Assistant Project Manager (APM) |
| Form 4 – Sales | Assistant Project Manager (APM) | Divisional Project Manager (DPM) |
| Form 5 – VDVK Registration | Admin | Divisional Project Manager (DPM) |
| Form 6 – Beneficiary Registration | Admin | Divisional Project Manager (DPM) |
| Form 7 – Machinery Onboarding | Admin | Divisional Project Manager (DPM) |
| Form 8 – Machinery Utilisation | Hub / Haat / MPC Supervisor | Assistant Project Manager (APM) |
| Form 9 – Training Programme | DPM | Not Required |
| Form 10 – Weekly Fund Utilisation | Assistant Project Manager (APM) | Divisional Project Manager (DPM) |
| Form 11 – Facility Registration | Admin | Divisional Project Manager (DPM) |
| Form 12 – Field Visit | Assistant Project Manager (APM) | Not Required |

**System Behaviour:** DPM can approve/reject only forms assigned to DPM (Forms 4, 5, 6, 7, 10, 11). Forms pending with APM (Forms 1, 2, 3, 8) are displayed for monitoring but the DPM's Approve/Reject buttons shall remain disabled. PO is view-only for all forms.

---

**Page Layout**

**1\. Filters (Top Section)**

The dashboard shall provide the following filters:

* Request Type (All Input Forms)  
* Submitted By  
* Mandal  
* VDVK  
* Status  
* Date Range  
* Pending With (APM / DPM / None)

**Status Filter**

* Pending Approval  
* Approved  
* Rejected  
* Recent (0–2 Working Days)  
* Pending Attention (3–5 Working Days)  
* Delayed (6 Working Days)  
* Escalated (7+ Working Days)

---

**2\. Request Monitoring Table**

The dashboard shall display all requests received from different input forms.

| Request ID | Input Form | Submitted By | Mandal | Date Created | Current Status | Pending With | Approval Status | Remarks | Action |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |

---

**Request Status Indicators**

The system shall automatically categorize pending requests based on the number of working days since submission.

| Working Days | Status |
| ----- | ----- |
| 0–2 Working Days | 🟢 Recent Request |
| 3–5 Working Days | 🟡 Pending Attention |
| 6 Working Days | 🟠 Delayed |
| 7+ Working Days | 🔴 Escalated — Auto-notify based on Pending With |

**Escalation Notification Logic:**

| Pending With | Notify |
| :---: | :---: |
| APM | DPM & PO |
| DPM | PO only |
| None | No auto-notification |

These indicators shall help identify requests requiring immediate action.

**3\. Request Details**

Clicking on a request shall display the complete submitted form along with supporting documents and remarks.

**4\. Approval Actions**

**For DPM (Forms 4, 5, 6, 7, 10, 11 only)**

The following actions shall be available for forms assigned to DPM:

* **Approve**  
* **Reject**

**Remarks shall be mandatory for rejection** and optional for approval.

* **Approve:** The request shall be processed, relevant registers updated, and the submitter notified.  
* **Reject:** The request shall not update any register. The submitter shall receive the remarks and must submit a fresh corrected entry where applicable.

**For DPM (Forms 1, 2, 3, 8 — pending with APM)**

* View the request and all attached details.  
* Approve/Reject buttons shall be disabled.  
* The DPM may contact the concerned APM offline to follow up on pending approvals.

**For PO/APD**

* View all requests and their status.  
* No approval or rejection permissions for any form.

**Developer Logic**

**Requests Covered**

The dashboard shall monitor requests generated through:

* Input Form 1 – MFP Collection Register  
* Input Form 2 – Stock Transfer Register  
* Input Form 3 – Processing Register  
* Input Form 4 – Sales Register  
* Input Form 5 – New VDVK Registration  
* Input Form 6 – Beneficiary Registration  
* Input Form 7 – Machinery Onboarding  
* Input Form 8 – Machinery Utilisation Register  
* Input Form 10 – Weekly Fund Utilisation Register  
* Input Form 11 – Facility Master Register

**Default View**

* Show **Pending Requests** first.  
* Sort by **oldest pending request** to ensure timely disposal.

**System Behaviour**

* The status shall update automatically after approval or rejection.  
* Delayed requests shall be highlighted based on working-day calculations.  
* The **Pending With** column shall display **APM** for Forms 1, 2, 3, 8 and **DPM** for Forms 4, 5, 6, 7, 10, 11. Forms 9 and 12 show **None** (no approval required).  
* Approval and rejection history, along with remarks, shall be stored in the Audit Trail.  
* PO shall have **view-only** access for all forms.  
* DPM shall have **approval and rejection** privileges with mandatory remarks **only for forms assigned to DPM** (Forms 4, 5, 6, 7, 10, 11). For forms pending with APM (Forms 1, 2, 3, 8), DPM has view-only access.

**Dashboard – 7: Contact Repository**

**Purpose**

The **Contact Repository** serves as a centralized directory of all officials and stakeholders associated with the Van Dhan Programme. It enables users to quickly access contact details of the concerned person for day-to-day coordination and communication.

**Access**

| User | Access Level |
| ----- | ----- |
| **Project Officer (PO)/APD** | View all contacts in the District |
| **Divisional Project Manager (DPM)** | View all contacts in the District |
| **Assistant Project Manager (APM)** | View DPM contact and all contacts mapped to assigned Mandal(s). PO contact shall not be visible. |
| **Hub Supervisor** | View DPM contact and contacts of mapped APMs, Hub Supervisors, Multipurpose Centre Supervisors, Haat Bazaar Supervisors, VDVK Heads, Community Coordinators, and other mapped users. PO contact shall not be visible. |
| **Multipurpose Centre Supervisor** | View DPM contact and contacts of mapped field users. PO contact shall not be visible. |
| **Haat Bazaar Supervisor** | View DPM contact and contacts of mapped field users. PO contact shall not be visible. |
| **VDVK Head** | View DPM contact and contacts of mapped APMs, Community Coordinators, Hub Supervisors, Multipurpose Centre Supervisors, Haat Bazaar Supervisors, and other mapped users. PO contact shall not be visible. |

---

**Page Layout**

**1\. Filters**

The dashboard shall provide the following filters:

* Designation  
* Mandal  
* VDVK  
* Facility Type (Hub / Multipurpose Centre / Haat Bazaar)  
* Name

---

**2\. Contact Directory**

The directory shall display the following details:

| Name | Designation | Mobile Number | Mandal | VDVK / Facility | Email ID | Action |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |

The **Action** column shall provide:

* 📞 **Call**  
* 👤 **View Details**

---

**Available Designations**

* Project Officer (PO)& APD  
* Divisional Project Manager (DPM)  
* Assistant Project Manager (APM)  
* Hub Supervisor  
* Multipurpose Centre Supervisor  
* Haat Bazaar Supervisor  
* VDVK Head  
* Community Coordinator  
* Other Authorized Users

---

**Developer Logic**

**PO & DPM Access**

PO and DPM shall have access to the complete district contact directory, including:

* Project Officer/APD  
* Divisional Project Manager  
* Assistant Project Managers  
* Hub Supervisors  
* Multipurpose Centre Supervisors (Pucca Kendra)  
* Haat Bazaar Supervisors  
* VDVK Heads  
* Community Coordinators  
* Other Authorized Users

---

**APM Access**

APMs shall be able to view:

* DPM  
* APMs (if multiple are assigned)  
* Hub Supervisors  
* Multipurpose Centre Supervisors   
* Haat Bazaar Supervisors  
* VDVK Heads  
* Community Coordinators  
* Other mapped users within their assigned Mandal(s)

**PO contact shall not be visible.**

---

**Hub Supervisor /Multipurpose Centre Supervisor / Haat Bazaar Supervisor / VDVK Head Access**

These users shall be able to view:

* DPM  
* APM(s) of their assigned Mandal  
* Hub Supervisors  
* Multipurpose Centre Supervisors  
* Haat Bazaar Supervisors  
* VDVK Heads  
* Community Coordinators  
* Other mapped users within their jurisdiction

**PO contact shall not be visible.**

---

**Data Source**

* User Master Register  
* VDVK Master Register  
* Facility Master Register  
* User Assignment Register

---

**System Behaviour**

* Contact details shall be automatically updated whenever a user is added, modified, transferred, or reassigned through the **User Management Module**.  
* Role-based access control shall ensure that users can view only the contacts permitted for their role.  
* Selecting the **Call** button shall initiate a phone call on supported devices.  
* Selecting **View Details** shall display the complete profile of the selected user, including designation, assigned Mandal, VDVKs, facilities, email ID, and contact information.

**Note:** The **Project Officer's contact details shall be visible only to the Project Officer and Divisional Project Manager**. The **Divisional Project Manager's contact details shall be visible to all users** to facilitate operational communication and issue escalation. All other contacts shall be displayed based on the user's role and assigned jurisdiction.

**Page 8 – Training Management**

**Purpose**

This page enables the **Divisional Project Manager (DPM)** to create and maintain records of training programmes conducted for VDVKs. Since training is organized only after offline approval, this module is **for recording and monitoring purposes only** and does **not require any further approval workflow**.

**Form Creation**

**Input Form 9 – Training Register**

The DPM shall be able to create new training records.

The form shall capture:

* Training Date  
* Training Title / Subject  
* Training Type  
* Scheme  
* Mandal(s) (Multiple Selection)  
* VDVK(s) (Multiple Selection)  
* Training Venue  
* Resource Person / Trainer Name  
* Total Participants  
* Number of Participants from each VDVK  
* Total Training Expense  
* Expense per VDVK  
* Funding Source  
* Supporting Documents (Attendance Sheet, Photos, Training Report, etc.)  
* Remarks

**Buttons**

* Save as Draft  
* Submit  
* Reset

**Training Records**

Below the form, the system shall display previously created training records.

| Training Date | Training Title | Mandal | No. of VDVKs | Participants | Total Expense (₹) | Status |
| :---: | :---: | :---: | ----: | ----: | ----: | :---: |

The following actions shall be available:

* View Details  
* Edit (before final submission, if applicable)  
* Download Report  
* Print

**Developer Logic**

* Only the **DPM** shall have permission to create and manage **Input Form 9 – Training Register**.  
* No approval or verification workflow shall be applicable for this form.  
* Once submitted, the training details shall automatically update:  
  * Training Register  
  * Training Reports  
  * Fund Monitoring Dashboard (Training Expenses)  
  * Reports & Registers Module  
* Training expenses shall be reflected in the **Fund Monitoring Dashboard** under **Training Expenses**.  
* All submitted training records shall support **View, Excel Export, PDF Export, and Print** options.  
* The module shall support filtering by **Date, Mandal, VDVK, Scheme, and Training Type**.

**Dashboard Page – Field Visit Monitoring (PO, APD & DPM)**

**Purpose**

To monitor field visits conducted by APMs across the district and track field monitoring activities through geo-tagged evidence.

**Summary Cards**

* Total Visits (Selected Period)   
* Visits Today   
* Visits This Week   
* Visits This Month   
* Number of APMs Visited   
* Total Geo-Tagged Photographs Uploaded   
* Average Visits per APM 

**Filter Options**

* Date Range   
* Mandal   
* APM   
* VDVK   
* Visit Type   
* Location Type 

**Visit Monitoring Table**

| Visit Date | APM Name | Mandal | Location | Related VDVK(s) | Purpose | Photos | GPS Available | Status |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |

Clicking a record shall display:

* Complete visit details   
* Geo-tagged photographs   
* GPS location (Map View if integrated)   
* Visit description   
* Key observations   
* Supporting documents 

---

**Dashboard Analytics**

Display:

* Visits by Mandal   
* Visits by APM   
* Visits by Purpose   
* Monthly Visit Trend   
* Top APMs by Number of Visits   
* Locations with Maximum Visits 

---

**Advantages**

* Digital record of all APM field visits.   
* Geo-tagged photographic evidence enhances transparency.   
* Eliminates manual tour diaries.   
* Enables PO and DPM to monitor field activities in real time.   
* Supports performance evaluation of APMs.   
* Provides a searchable historical record of inspections and monitoring activities.   
* Ensures accountability through GPS location, timestamps, photographs, and audit logs. 

**10\. Module: Reports, Registers & Books of Accounts**

**Purpose**

The **Reports, Registers & Books of Accounts** module shall provide automatically generated operational, inventory, financial, and management reports based on **approved transactions** entered through the system. This module shall eliminate manual preparation of registers and ensure a single source of truth for monitoring, reporting, and auditing.

---

**Access**

| User | Access Level |
| ----- | ----- |
| Project Officer (PO)/ APD | Full Access (District Level) |
| Divisional Project Manager (DPM) | Full Access (District Level) |
| Assistant Project Manager (APM) | View & Download reports related to assigned Mandal(s) |
| Hub / Multipurpose Centre / Haat Bazaar Supervisor | View & Download reports related to assigned facility only |

---

**Page Layout**

The module shall contain three sections:

1. Reports  
2. Registers  
3. Books of Accounts

All reports, registers, and books shall support the following common filters:

* Date Range  
* Week  
* Month  
* Quarter  
* Half-Year  
* Year  
* Till Date  
* Scheme  
* Mandal  
* VDVK  
* Commodity  
* Hub   
* Multipurpose Centre (Collection Centre)   
* Haat Bazaar 

Buttons available on every page:

* **View Report**  
* **Download Excel**  
* **Download PDF**  
* **Print**

---

**A. Reports**

The following analytical reports shall be available:

| Sl. No. | Report Name | Data Source |
| ----- | ----- | ----- |
| 1 | District Performance Report | Dashboard Data |
| 2 | Mandal Performance Report | Dashboard Data |
| 3 | VDVK Performance Report | Input Forms 1–6 |
| 4 | Commodity-wise Performance Report | Input Forms 1–4 |
| 5 | Hub Performance Report | Input Forms 1–4 & Facility Master |
| 6 | Multipurpose Centre (Collection Centre) Performance Report | Input Forms 1–4 & Facility Master |
| 7 | Haat Bazaar Performance Report | Input Forms 1–4 & Facility Master |
| 8 | Weekly Operational Report | Input Forms 1–10 |
| 9 | Fund Utilisation Report | Input Forms 5, 7, 9 & 10 |
| 10 | Machinery Utilisation Report | Input Form 8 |
| 11 | Beneficiary Performance Report | Input Forms 1, 3 & 4 |
| 12 | Inventory Status Report | Input Forms 2, 3 & 4 |

---

**B. Operational Registers**

These registers shall be generated automatically from approved transactions.

| Sl. No. | Register | Auto Generated From |
| ----- | ----- | ----- |
| 1 | VDVK Master Register | Input Form 5 (Admin Input) |
| 2 | Beneficiary Register | Input Form 6 (Admin Input) |
| 3 | MFP Collection Register | Input Form 1 (CC) |
| 4 | Stock Transfer Register | Input Form 2 (Supervisor) |
| 5 | Processing Register | Input Form 3 (Supervisor) |
| 6 | Sales Register | Input Form 4 (APM) |
| 7 | Customer Master Register | Input Form 4 / Admin (buyer master) |
| 8 | Machinery / Asset Register | Input Form 7 (Admin Input) |
| 9 | Machinery Utilisation Register | Input Form 8 (Supervisor) |
| 10 | Training Register | Input Form 9 (DPM) |
| 11 | Weekly Fund Utilisation Register | Input Form 10 (APM) |
| 12 | User Register | Admin Input |
| 13 | Facility Master Register (Hub / Multipurpose Centre (Collection Centre) / Haat Bazaar / VDVK's) | Input Form 11 (Admin Input) |
| 14 | Machinery Transfer Register | Admin Input |
| 15 | Inventory Register (Raw & Finished Goods) | Input Forms 1–4 |
| 16 | Stock Movement Register | Input Form 2 |
| 17 | Approval & Audit Register | All Approved / Rejected Transactions |

---

**C. Books of Accounts**

The system shall automatically generate the following Books of Accounts:

| Sl. No. | Book of Account | Auto Generated From |
| ----- | ----- | ----- |
| 1 | Cash Book | Cash Purchases, Cash Sales & Cash Expenses |
| 2 | Credit Register | Credit Purchases & Credit Sales |
| 3 | Purchase Register | MFP Procurement, Machinery Purchases & Other Approved Purchases |
| 4 | Sales Register | Raw Goods Sales & Processed Goods Sales |
| 5 | Receipt Book / Receipt Register | Customer Receipts, Fund Releases & Other Receipts |
| 6 | Payment Register | Procurement, Logistics, Processing, Machinery, Training & Other Payments |
| 7 | Processing Cost Register | Input Form 3 |
| 8 | Logistics & Other Expense Register | Input Form 10 |
| 9 | Machinery Purchase Register | Input Form 7 |
| 10 | Training Expense Register | Input Form 9 |
| 11 | Fund Register | Input Forms 5 & 10 |
| 12 | Revenue Register | Input Form 4 |
| 13 | Profit & Loss Statement | Auto-generated from Revenue & Expenditure |
| 14 | Inventory Valuation Register | Input Forms 1–4 |
| 15 | Asset Register | Input Form 7 |
| 16 | Audit Trail Register | All System Activities |

---

**D. Weekly Operational & Financial Report**

This report shall provide a consolidated view of operational and financial activities.

| Sl. No. | Commodity | MFP Collection (Kg) | Raw Material Rate (₹/Kg) | Raw Material Value (₹) | Processed Quantity (Kg) | Packaging Details | Value Added Cost (₹/Kg) | Value of Processed Goods (₹) | Raw Goods Sold (Kg) | Processed Goods Sold (Kg) | Sales Revenue (₹) | Total Expenditure (₹) | Profit / Loss (₹) |
| :---: | :---: | ----: | ----: | ----: | ----: | :---: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |

**Packaging Details**

The system shall dynamically display multiple packet sizes, for example:

| Packet Size | Units Produced |
| ----- | ----: |
| 250 g | 120 |
| 500 g | 80 |
| 1 Kg | 45 |

The number of rows shall expand automatically based on the packaging details entered in the Processing Register.

---

**Developer Logic**

**Data Sources**

* Input Form 1 – MFP Collection  
* Input Form 2 – Stock Transfer  
* Input Form 3 – Processing  
* Input Form 4 – Sales  
* Input Form 5 – VDVK Master  
* Input Form 6 – Beneficiary Master  
* Input Form 7 – Machinery Utilisation  
* Input Form 8 – Training  
* Input Form 10 – Fund Utilisation  
* Input Form 11– Facility Master  
* Master Database – Historical Data

---

**System Behaviour**

* All reports, registers, and books shall be **auto-generated** from **approved transactions** only.  
* No manual editing shall be permitted in any generated report, register, or book of accounts.  
* Any correction shall be made by creating a new approved transaction or adjustment entry, ensuring a complete audit trail.  
* All calculations, inventory balances, fund balances, revenue, expenditure, and profit/loss shall update automatically after each approved transaction.  
* Users shall be able to filter data by **Date, Scheme, Mandal, VDVK, Commodity, Hub, Multipurpose Centre (Collection Centre), or Haat Bazaar**.  
* All reports and registers shall support **View, Excel Download, PDF Download, and Print** options.  
* The system shall maintain complete historical records and automatically generate reports for **Daily, Weekly, Monthly, Quarterly, Half-Yearly, Yearly, Till Date, and Custom Date Range**.

**Note:** This module acts as the centralized reporting and accounting repository for the entire VDVK MIS. Every approved transaction recorded through the input forms shall automatically update the relevant reports, operational registers, inventory records, and books of accounts, ensuring real-time monitoring, transparency, and audit readiness.

**APM Dashboard (Assistant Project Manager Interface)**

**Purpose**

The **Assistant Project Manager (APM) Dashboard** is designed to manage all activities related to the assigned Mandal(s). While the APM primarily creates and approves specific records, the interface also provides access to all input forms (for contingency or administrative requirements), performance dashboards, request tracking, reports, and contact management.

---

**Access Scope**

* Only assigned **Mandal(s)**  
* Only mapped **VDVKs**  
* Only mapped **Hubs, Multipurpose Centres (Collection Centres) & Haat Bazaars**  
* Cannot view other Mandals or District-wide data.

---

**Page 1 – Dashboard Overview**

Displays overall Mandal performance.

**Summary Cards**

* Total VDVKs  
* Scheme-wise VDVK Count  
* Total Beneficiaries  
* Total MFP Collection  
* Total Processing  
* Raw Goods Sales  
* Processed Goods Sales  
* Revenue

**Filters**

* Today  
* Week  
* Current Month (Default)  
* Quarter  
* Half-Year  
* Year  
* Till Date  
* Custom Date Range

**Commodity Ranking**

Displays Top 5 Commodities with:

* Collection  
* Processing  
* Raw Sales  
* Processed Sales  
* Revenue

**VDVK Summary**

Displays all VDVKs under the assigned Mandal with:

* Beneficiaries  
* Collection  
* Processing  
* Sales  
* Revenue

---

**Page 2 – VDVK Performance**

Displays comparative performance of VDVKs under the assigned Mandal.

Features:

* Top 10 Ranking  
* Commodity Filter  
* Time Filter  
* Ranking by:  
  * Collection  
  * Processing  
  * Raw Sales  
  * Processed Sales  
  * Revenue

Buttons:

* View Full List  
* Download Excel  
* Download PDF

**Page 3 – Hub /Multipurpose Centre / Haat Bazaar Performance**

Displays performance of facilities within the assigned Mandal.

Shows:

* MFP Collection  
* Processing  
* Raw Goods Sales  
* Processed Goods Sales  
* Revenue  
* Machinery Count  
* VDVKs Served

Filters:

* Facility Type  
* Commodity  
* Time Period

Buttons:

* View Full List  
* Download Excel  
* Download PDF

---

**Page 4 – Assets / Machinery Monitoring**

Displays machinery available within the assigned Mandal.

Shows:

* Machinery Name  
* Current Facility  
* Facility Type  
* Purchase Cost  
* Supplier  
* Warranty  
* Last Service Date  
* Status

Buttons:

* View Details  
* Download Report

**Page 5 – Form Creation**

The APM shall have access to below mentioned. However, the following forms shall be the primary responsibility of the APM.

**Primary Forms**

* **Input Form 4** – Sales Register  
* **Input Form 10** – Fund Utilisation  
* **Input Form 12** – Field Visits Logs

The Form Creation page shall display all forms as clickable cards with the current status of drafts and submissions.

**Page 6 – Request Tracking**

Displays all requests created by the APM and requests pending action from the APM. The APM is the approving authority for **Forms 1 (MFP Collection), 2 (Stock Transfer), 3 (Processing), and 8 (Machinery Utilisation)**. Requests for these forms submitted by CCs and Supervisors shall appear here for the APM's approval action.

**Information Displayed**

* Request ID  
* Input Form  
* Date Created  
* Current Status  
* Pending With  
* Remarks  
* Last Updated

**Status**

* Draft  
* Submitted  
* Pending Approval  
* Approved  
* Rejected  
* Modification Required

The APM shall be able to monitor every request until its final approval.

**Page 7 – Reports & Registers**

Displays reports limited to the assigned Mandal.

Available Reports:

* VDVK Report  
* Beneficiary Report  
* Commodity Report  
* Weekly Operational Report  
* Inventory Report  
* Machinery Report  
* Fund Utilisation Report  
* Processing Report  
* Sales Report

Buttons:

* View  
* Excel  
* PDF  
* Print

---

**Page 8 – Contact Repository**

Displays contacts relevant to the assigned Mandal.

Can view:

* DPM  
* Assigned APM(s)  
* Hub Supervisors  
* Multipurpose Centre Supervisors  
* Haat Bazaar Supervisors  
* VDVK Heads  
* Community Coordinators  
* Other mapped users

**PO contact shall not be visible.**

Action Buttons:

* Call  
* View Details

**Developer Notes**

* The APM interface shall be restricted to **assigned Mandal(s)** only.  
* All dashboard statistics shall update automatically after **approved transactions**.  
* Although the APM is the **primary creator** for **Input Forms 4 and 10**, access to other forms shall remain available for exceptional operational requirements, subject to role-based permissions  
* The **Request Tracking** page shall provide complete visibility of submitted, pending, approved, rejected, and draft requests.  
* All pages shall support role-based filtering, report downloads (Excel/PDF), and real-time data updates from approved transactions.

**Field User Interface (CC / Hub Supervisor / Multipurpose Centre Supervisor / Haat Bazaar Supervisor / VDVK Head)**

**Purpose**

The **Field User Interface** is designed for field-level data entry and request tracking. After logging in, the user shall select the role they wish to perform, and the system shall display only the relevant input forms and request tracking page for that role.

---

**Login Process**

**Step 1**

User logs into the system using assigned credentials.

**Step 2**

System displays **Role Selection**.

Available roles (based on user mapping):

* Community Coordinator (CC)  
* Hub Supervisor  
* Multipurpose Centre Supervisor  
* Haat Bazaar Supervisor  
* VDVK Facility Supervisor

After selecting a role, the corresponding interface shall be displayed.

---

**Community Coordinator (CC) Interface**

**Page 1 – Form Creation**

The Community Coordinator shall have access to:

* **Input Form 1 – MFP Collection Register**

This shall be the only data entry form available to the CC.

---

**Page 2 – Request Tracking**

Before displaying the request list, the system shall ask the user to select:

* **VDVK Name**  
* **Mandal**

The dashboard shall then display all requests created by the CC for the selected VDVK.

**Request Tracking Table**

| Request ID | Date Created | Input Form | Status | Pending With | Remarks |
| :---: | :---: | :---: | :---: | :---: | :---: |

**Status**

* Draft  
* Submitted  
* Pending Approval  
* Approved  
* Rejected  
* Modification Required

---

**Escalation Logic**

The system shall automatically classify pending requests:

* **0–2 Working Days** → Normal  
* **3–5 Working Days** → Pending Attention  
* **6 Working Days** → Delayed  
* **7 or More Working Days** → Escalated

When a request remains pending for more than **5 working days**, a **pending attention notification** shall be sent to the assigned approver.

When a request remains pending for **7 or more working days**, an **escalated notification** shall be sent based on the **Escalation Notification Logic** defined in the Request Status Indicators section above.

The request shall also be highlighted in the DPM/PO **Request Monitoring Dashboard**.

---

**Supervisor Interface**

*(Hub Supervisor / Multipurpose Centre Supervisor / Haat Bazaar Supervisor / VDVK Facility Supervisor)*

**Page 1 – Form Creation**

The supervisor shall have access to:

* **Input Form 2 – Stock Transfer Register**  
* **Input Form 3 – Processing Register**  
* **Input Form 8 – Machinery Utilisation Register**

Only the forms relevant to the selected supervisor role shall be enabled based on the mapped facility.

---

**Page 2 – Request Tracking**

Before displaying requests, the system shall ask the user to select:

* **Facility Type**  
  * Hub  
  * Multipurpose Centre (Collection Centre)  
  * Haat Bazaar  
  * VDVK Facility  
* **Facility Name**  
* **Mandal**

The dashboard shall then display all requests submitted for the selected facility.

**Request Tracking Table**

| Request ID | Date Created | Input Form | Status | Pending With | Remarks |
| :---: | :---: | :---: | :---: | :---: | :---: |

**Status**

* Draft  
* Submitted  
* Pending Approval  
* Approved  
* Rejected  
* Modification Required

**Escalation Logic**

Pending requests shall be automatically monitored.

| Pending Duration | Status |
| ----- | ----- |
| 0–2 Working Days | Normal |
| 3–5 Working Days | Pending Attention |
| 6 Working Days | Delayed |
| 7+ Working Days | 🔴 Escalated — Auto-notify based on Pending With |

**Escalation Notification Logic:**

| Pending With | Notify |
| :---: | :---: |
| APM | DPM & PO |
| DPM | PO only |
| None | No auto-notification |

If a request remains pending for more than **7 working days**, the system shall:

* Highlight the request as **Escalated**.
* Auto-notify per the **Escalation Notification Logic** table above.
* Display the request in the **Request Monitoring Dashboard** for priority action.

**Developer Logic**

**Role-Based Form Access**

| Role | Available Input Forms |
| :---: | :---: |
| **Community Coordinator (CC)** | **Input Form 1** |
| **Hub Supervisor** | **Input Forms 2, 3, 8** |
| **Multipurpose Centre Supervisor** | **Input Forms 2, 3, 8** |
| **Haat Bazaar Supervisor** | **Input Forms 2, 3, 8** |
| **VDVK Facility Supervisor** | **Input Forms 2, 3, 8** |
| **Haat Bazaar Supervisor** | **Input Forms 2, 3, 8** |

---

**Role Selection**

* A single user account may be mapped to one or more roles.  
* After login, the system shall display only the roles assigned to that user.  
* Based on the selected role, the corresponding interface and input forms shall be loaded.

---

**Request Tracking**

* Users shall only view requests created under their selected role and mapped VDVK/facility.  
* Draft, submitted, approved, rejected, and modification-required requests shall be displayed with remarks and timestamps.  
* Escalation notifications shall be triggered automatically for requests pending approval beyond **7 working days**.

**Note:** This design provides a **single login with multiple role selection**, minimizing credential management while ensuring strict role-based access control. Each role sees only its relevant forms and request history, while delayed approvals are automatically escalated to the DPM and PO for timely action.

**Master Data Administrator (MDA) Dashboard**

**Purpose**

The **Master Data Administrator (MDA)** shall be responsible for maintaining all master data of the VDVK Dashboard. This role is created to reduce the workload of APMs by centralizing the management of VDVKs, Beneficiaries, Machinery, Facilities, Users, and other master records.

The MDA shall **not** perform day-to-day operational activities such as MFP Collection, Stock Transfer, Processing, Sales, or Fund Utilisation. The role is limited to **master data management, administrative updates, data corrections, user administration, and asset management**.

---

**Access**

The MDA shall have access to:

* VDVK Management  
* Beneficiary Management  
* Machinery Management  
* Hub / Multipurpose Centre (Collection Centre) / Haat Bazaar Management  
* User Management  
* Machinery Transfer Management  
* Machinery Status Management  
* Commodity Rate Management (Rate Master with effective-date versioning — revise rates, view rate history)  
* **Commodity Management** (versioned unit-of-measure)  
* **Grade Management** (per-commodity grades with effective dates)  
* **Scheme Management** (versioned scheme names)  
* **Expenditure Head Management** (managed list, replace hardcoded dropdown)  
* **Customer Management** (buyer master for Form 4 – Sales)  
* Administrative Data Corrections  
* Master Reports & Registers

---

**Page 1 – Dashboard Overview**

The homepage shall provide a quick summary of all master data.

**Dashboard Cards**

* Total VDVKs  
* Total Beneficiaries  
* Total Hubs  
* Total Multipurpose Centres  
* Total Haat Bazaars  
* Total Machinery  
* Active Machinery  
* Machinery Under Maintenance  
* Machinery In Transit  
* Active Users  
* Inactive Users  
* Pending DPM Approvals  
* Recently Added Master Records

The figures shall update automatically whenever new master data is approved or modified.

---

**Page 2 – VDVK Management**

Used to create and maintain VDVKs.

Functions:

* Add New VDVK  
* Edit VDVK Details  
* View VDVK Details  
* Activate / Deactivate VDVK  
* Remove VDVK (if not linked with approved transactions)

This page uses **Input Form – 5**.

---

**Page 3 – Beneficiary Management**

Functions:

* Add Individual Beneficiary  
* Bulk Beneficiary Upload (Excel)  
* Edit Beneficiary Details  
* Change Beneficiary Mapping  
* Activate / Deactivate Beneficiary  
* Remove Beneficiary (if permitted)

This page uses **Input Form – 6**.

---

**Page 4 – Machinery Management**

This page combines **Machinery Registration**, **Machinery Status**, and **Machinery Transfer** into a single module.

**Functions**

* Add New Machinery  
* Edit Machinery Details  
* View Machinery Details  
* Change Machinery Status  
* Transfer Machinery  
* Remove Machinery (if permitted)

This page uses **Input Form – 7**.

---

**Machinery List**

| Machinery ID | Machinery Name | Commodity | Current Facility | Mandal | Status | Action |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |

**Available Actions**

* View  
* Edit  
* Change Status  
* Transfer  
* Remove

---

**Transfer Machinery**

The Admin selects **Transfer** from the Action menu.

**Transfer Details**

| Field | Input Type |
| ----- | ----- |
| Transfer Date | Date Picker |
| Current Facility | Auto Display |
| Destination Facility Type | Dropdown |
| Destination Facility | Searchable Dropdown |
| Reason for Transfer | Dropdown |
| Remarks | Text Box |
| Supporting Document (Optional) | File Upload |
| Initiate Transfer | Button |

---

**System Behaviour After Transfer Initiation**

The system shall automatically:

* Change Machinery Status to **🚚 In Transit**  
* Prevent machinery from being used in Processing or Machinery Utilisation.  
* Retain the current location until transfer completion.  
* Record the transfer in the Machinery Movement History.  
* Update the Audit Trail.

---

**Complete Transfer**

After receiving offline confirmation that the machinery has reached the destination, the Admin opens the transfer record.

Fields:

| Field | Input Type |
| ----- | ----- |
| Date Received | Date Picker |
| Machinery Condition | Good / Minor Damage / Major Damage / Not Working |
| Remarks | Text Area |
| Supporting Photos/Documents (Optional) | File Upload |
| Complete Transfer | Button |

---

**System Behaviour After Completion**

The system shall automatically:

* Update Current Facility.  
* Update Assigned Supervisor.  
* Change Status to **Active**.  
* Remove machinery from the In Transit list.  
* Make machinery available for utilisation.  
* Update all related dashboards and registers.

---

**Page 5 – Facility Management**

Manage:

* Hubs  
* Multipurpose Centres  
* Haat Bazaars

Functions:

* Add Facility  
* Edit Facility  
* View Facility  
* Activate / Deactivate Facility  
* Remove Facility (if permitted)

Uses **Input Form – 11**

---

**Page 6 – Commodity Rate Management**

Used to manage commodity pricing with effective-date versioning. Rate changes take effect from the specified date and do not retroactively modify approved transactions.

**Functions:**

* View all commodity rates (current and historical)  
* Revise a commodity rate (system archives the old rate with Effective To = today − 1, inserts new rate with Effective From = today)  
* Bulk rate revision (percentage or fixed increase across multiple commodities)  
* View rate revision history (Audit Trail)

**Rate Master Table:**

| Commodity | Grade | Unit | Rate ₹/Kg | Rate ₹/Pc | Effective From | Effective To | Status |
| ----- | ----- | ----- | ----: | ----: | ----- | ----- | ----- |
| Turmeric | A | Kg | 120 | — | 01/04/2025 | 31/03/2026 | Archived |
| Turmeric | A | Kg | 130 | — | 01/04/2026 | null | Active |
| Honey | A | Pieces | — | 350 | 01/04/2025 | null | Active |

**System Behaviour:**

* No DPM approval required for rate revisions (administrative function).  
* Approved transactions retain their original rate (rate is snapshotted per row).  
* Draft transactions lock the rate at draft time — do not re-fetch on rate revision.  
* New transactions use the rate effective on the transaction date.  
* All rate changes are recorded in the Audit Trail.

---

**Page 7 – Commodity Management**

Manage the Commodity Master with versioned unit-of-measure.

**Functions:**

* View all commodities (current and historical unit assignments)  
* Add new commodity (Code auto-generated, Name + Default Unit required)  
* Revise commodity unit (e.g., Honey from Pieces → Kg): system archives old unit with Effective To, inserts new unit with Effective From  
* Activate / Deactivate commodity (inactive commodities hidden from transaction dropdowns)

**Commodity Master Table:**

| Code | Commodity | Default Unit | Unit Eff. From | Unit Eff. To | Status |
| ----- | ----- | ----- | ----- | ----- | ----- |
| CMD-001 | Turmeric | Kg | 01/04/2025 | null | Active |
| CMD-002 | Honey | Pieces | 01/04/2025 | 31/03/2026 | Active |
| CMD-002 | Honey | Kg | 01/04/2026 | null | Active |

**System Behaviour:**

* Unit revisions do not affect historical transactions (each row snapshots its own unit).  
* New transactions use the unit effective on the transaction date.  
* Deactivated commodities remain valid in historical records but cannot be selected in new entries.

---

**Page 8 – Grade Management**

Manage quality grades per commodity with effective dates.

**Functions:**

* View all grades (current and retired)  
* Add new grade for a commodity  
* Retire a grade (set Effective To) — retired grades hidden from new transaction dropdowns

**Grade Master Table:**

| Code | Commodity | Grade | Eff. From | Eff. To | Status |
| ----- | ----- | ----- | ----- | ----- | ----- |
| GRD-001 | CMD-001 Turmeric | A | 01/04/2025 | null | Active |
| GRD-002 | CMD-001 Turmeric | B | 01/04/2025 | null | Active |
| GRD-003 | CMD-002 Honey | A | 01/04/2025 | null | Active |

---

**Page 9 – Scheme Management**

Manage government schemes with versioned names.

**Functions:**

* View all schemes (current and historical names)  
* Add new scheme  
* Rename scheme: system archives old name with Effective To, inserts new name with Effective From

**Scheme Master Table:**

| Code | Scheme Name | Eff. From | Eff. To | Status |
| ----- | ----- | ----- | ----- | ----- |
| SCH-001 | PMJVM | 01/04/2025 | null | Active |
| SCH-002 | PM JANMAN | 01/04/2025 | null | Active |

---

**Page 10 – Expenditure Head Management**

Manage the Expenditure Head Master used by Form 10 (Weekly Fund Utilisation).

**Functions:**

* View all expenditure heads (active and retired)  
* Add new expenditure head  
* Rename an existing head (versioned)  
* Retire a head (hidden from new Form 10 entries; historical entries remain valid)  
* Toggle `Excluded From Processing` flag

**Expenditure Head Table:**

| Code | Head Name | Eff. From | Eff. To | Excluded | Status |
| ----- | ----- | ----- | ----- | :---: | ----- |
| EXP-001 | Logistics & Transportation | 01/04/2025 | null | No | Active |
| EXP-004 | Processing Cost | 01/04/2025 | null | Yes | Active |

---

**Page 11 – Administrative Data Correction**

Used to correct approved transactions after obtaining **offline approval from the DPM**.

Applicable Forms:

* Form 1 – MFP Collection  
* Form 2 – Stock Transfer  
* Form 3 – Processing  
* Form 4 – Sales  
* Form 5 – VDVK  
* Form 6 – Beneficiary  
* Form 7 – Machinery  
* Form 8 – Machinery Utilisation  
* Form 9 – Training  
* Form 10 – Weekly Fund Utilisation  
* Form 11 – Facility Registration

**Mandatory Fields**

* Reason for Correction  
* DPM Offline Approval Obtained (Yes/No)  
* Remarks

Every correction shall be recorded in the Audit Trail.

---

**Page 12 – User Management**

**Functions**

* Add New User  
* Edit User  
* Transfer User  
* Change Role  
* Activate User  
* Deactivate User  
* Reset Password  
* Change VDVK Head

---

**User Directory**

| User ID | Name | Role | Mandal | Assigned Area | Status | Action |

**Available Actions**

* View  
* Edit  
* Transfer  
* Change Role  
* Activate  
* Deactivate  
* Reset Password

---

**Supported Roles**

* Project Officer (PO)  
* Divisional Project Manager (DPM)  
* Assistant Project Manager (APM)  
* Community Coordinator (CC)  
* Hub Supervisor  
* Multipurpose Centre Supervisor  
* Haat Bazaar Supervisor  
* VDVK Head

Role-based mapping shall be maintained automatically.

---

**Page 13 – Master Reports & Registers**

View and download:

**Master Registers**

* VDVK Master Register  
* Beneficiary Master Register  
* Machinery Master Register  
* Facility Master Register  
* User Master Register

**Movement Registers**

* Machinery Movement History  
* User Transfer History  
* VDVK Head Change History

**Audit Registers**

* Audit Trail Register  
* Administrative Correction Register

Reports shall support filtering by:

* Date  
* Mandal  
* Scheme  
* Commodity  
* Facility  
* Status

Export options:

* PDF  
* Excel

---

**Developer Logic**

**General**

* The MDA shall manage only master records.  
* Operational data entry is not permitted.

---

**VDVK**

* Created through Form 5\.  
* Becomes active only after DPM approval.

---

**Beneficiary**

* Added through Form 6\.  
* Automatically mapped to the selected VDVK.

---

**Machinery**

* Registered through Form 7\.  
* Transfer managed directly from the Machinery Management page.  
* Only machinery with **Active/Available** status can be transferred.  
* During transfer, status becomes **In Transit**.  
* After Admin confirms receipt, the status changes back to **Active** and the destination facility is updated.

---

**Facilities**

* Managed through Form 11\.  
* Any changes automatically update all related mappings.

---

**Users**

* Role changes and transfers automatically update dashboard access and mappings.  
* Historical records remain unchanged.

---

**Administrative Corrections**

* Corrections require offline DPM approval.  
* Original values shall always be retained in the Audit Trail.  
* Corrected records shall be marked as **Corrected**.

---

**Removal Rules**

Before removing any master record, the system shall display:

**Warning:**  
Are you sure you want to remove this record? This action may affect linked records.

If the record is linked to approved transactions:

* Permanent deletion shall not be allowed.  
* The record shall be marked as **Inactive**.

If there are no linked approved transactions:

* Permanent removal shall be allowed.

---

**Registers Updated**

The MDA module shall automatically maintain:

1. VDVK Master Register  
2. Beneficiary Master Register  
3. Machinery Master Register  
4. Machinery Movement History Register  
5. Facility Master Register  
6. **Facility → Supervisor Assignment Register**  
7. User Master Register  
8. **Customer Master Register** (buyer master for Form 4 – Sales)  
9. User Transfer Register  
10. VDVK Head Change Register  
11. **Commodity Master Register** (with unit revision history)  
12. **Grade Master Register** (with grade retirement history)  
13. **Scheme Master Register** (with name revision history)  
14. **Commodity Rate Master Register** (rate revision history)  
15. **Expenditure Head Master Register** (head revision history)  
16. Administrative Correction Register  
17. Audit Trail Register

---

**Advantages**

* Centralized management of all master data in a single interface.  
* Reduces workload on APMs by assigning master data responsibilities to the MDA.  
* Eliminates the need for a separate Machinery Transfer Form by integrating transfer into Machinery Management.  
* Simplifies user administration, role changes, and responsibility transfers.  
* Maintains complete audit history for every administrative action.  
* Prevents accidental deletion of records linked to approved transactions.  
* Ensures all dashboards, reports, registers, and operational modules remain synchronized with the latest approved master data.  
* Improves data governance, consistency, traceability, and ease of system maintenance.

