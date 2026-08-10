import type { FormStatus } from "@/lib/constants";

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}

export interface DashboardKPI {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
}

export interface HubItem {
  name: string;
  capacity: number;
  vdvks: number;
}

export interface DistrictOverview {
  totalVdvks: number;
  totalBeneficiaries: number;
  totalFacilities: number;
  totalHubs: HubItem[];
  totalMachinery: number;
  totalSchemes: number;
  collectionTransactions: number;
  processingTransactions: number;
  salesTransactions: number;
  rawStockKg: number;
  rawStockPcs: number;
  processedStockKg: number;
  processedStockPcs: number;
}

export interface CommodityPerformance {
  commodityCode: string;
  commodityName: string;
  totalKg: number;
  totalPcs: number;
  stockType: string;
}

export interface VDVKPerformance {
  code: string;
  name: string;
  mandal: string;
  scheme: string;
  beneficiaryCount: number;
  amountSanctioned: number;
  amountReleased: number;
  collectionCount: number;
  processingCount: number;
}

export interface MandalPerformance {
  mandal: string;
  clusters: number;
  activeSHGs: number;
  collection: number;
  status: "Elite" | "Stable" | "Warning";
}

export interface RequestItem {
  id: string;
  requestId?: string;
  formKey?: string;
  formLabel?: string;
  formType: string;
  submittedBy: string;
  submittedByRole?: string;
  facility?: string;
  locationName?: string;
  mandal?: string;
  amount?: number;
  daysPending?: number;
  status: FormStatus;
  with?: string;
  pendingWith?: string;
  remarks?: string;
  dateSubmitted?: string;
  createdAt?: string;
  requestType?: string;
  priority?: string;
  description?: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface StockLedgerEntry {
  id: string;
  vdvkCode: string;
  vdvkName?: string;
  beneficiaryId?: string;
  commodityCode: string;
  commodityName?: string;
  gradeCode?: string;
  facilityCode?: string;
  quantity: number;
  sourceTxn: string;
  isActive: boolean;
  consumed: number;
}

export interface StockMovement {
  id: string;
  stockLedgerId: string;
  movementType: "IN" | "OUT";
  quantity: number;
  createdAt: string;
}

export interface AuditTrailEntry {
  id: string;
  transactionId: string;
  formType: string;
  action: string;
  performedBy: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  createdAt: string;
}
