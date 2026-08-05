export interface GeoState {
  code: string;
  name: string;
  status: string;
}

export interface GeoDistrict {
  code: string;
  name: string;
  stateCode: string;
  status: string;
}

export interface GeoMandal {
  code: string;
  name: string;
  districtCode: string;
  status: string;
}

export interface GeoVillage {
  code: string;
  name: string;
  mandalCode: string;
  pinCode?: string;
  status: string;
}

export interface Commodity {
  code: string;
  name: string;
  defaultUnit: string;
  unitEffectiveFrom?: string;
  unitEffectiveTo?: string;
  status: string;
}

export interface Grade {
  code: string;
  commodityCode: string;
  gradeName: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface CommodityRate {
  id: string;
  commodityCode: string;
  gradeCode?: string;
  unit: string;
  ratePerKg?: number;
  ratePerPiece?: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface Scheme {
  code: string;
  name: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  status: string;
}

export interface ExpenditureHead {
  code: string;
  name: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  excludedFromProcessing: boolean;
}

export interface Customer {
  code: string;
  name: string;
  mobile?: string;
  address?: string;
  gstNo?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface Supplier {
  code: string;
  name: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  gstNo?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface VDVK {
  code: string;
  schemeCode?: string;
  name: string;
  stateCode?: string;
  districtCode?: string;
  mandalCode?: string;
  villageCode?: string;
  sanctionedAmount?: number;
  releasedAmount?: number;
  status: string;
  commodities?: string[];
}

export interface Beneficiary {
  id: string;
  vdvkCode: string;
  name: string;
  aadhaar?: string;
  mobile?: string;
  age?: number;
  gender?: string;
  category?: string;
  shgName?: string;
  stateCode?: string;
  districtCode?: string;
  mandalCode?: string;
  villageCode?: string;
  address?: string;
  status: string;
  commodities?: string[];
}

export interface Facility {
  code: string;
  type: string;
  name: string;
  location?: string;
  capacity?: number;
  fundSanctioned?: number;
  fundReleased?: number;
  infrastructure?: Record<string, unknown>;
  status: string;
}

export interface Machinery {
  id: string;
  name: string;
  commodityMapping?: Record<string, unknown>;
  location?: string;
  cost?: number;
  warrantyMonths?: number;
  purchaseDate?: string;
  status: string;
}

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  designation: string;
  email?: string;
  mobile?: string;
  mandal?: string;
  status: string;
  roles: { role: string; isPrimary: boolean }[];
}
