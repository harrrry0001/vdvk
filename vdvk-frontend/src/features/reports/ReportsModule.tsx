import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen, FileText, Building2, Map, Factory, BarChart3, Users, Wrench,
  GraduationCap, IndianRupee, ShoppingCart, Tags, FileCheck, Shield, Truck,
  ClipboardCheck, UserCog, Database, Settings, Wallet, Briefcase, Calculator,
  MapPin, Eye, Download, FileSpreadsheet, Layers, Star, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { masterApi } from "@/api/endpoints/master";
import { mdaApi } from "@/api/endpoints/mda";

type Tab = "reports" | "registers" | "books";

interface ReportCard {
  icon: typeof Map;
  title: string;
  desc: string;
  file: string;
}

interface RegisterCard {
  icon: typeof Map;
  title: string;
  countKey: string;
}

interface BookCard {
  icon: typeof Map;
  title: string;
}

const reports: ReportCard[] = [
  { icon: Map, title: "District Performance", desc: "District-level performance across all metrics", file: "MIS-001" },
  { icon: BarChart3, title: "Mandal Performance", desc: "Mandal-wise operational performance report", file: "MIS-002" },
  { icon: Factory, title: "VDVK Performance", desc: "VDVK-wise collection and revenue analysis", file: "MIS-003" },
  { icon: Tags, title: "Commodity-wise", desc: "Commodity-specific procurement and sales", file: "MIS-004" },
  { icon: Building2, title: "Hub Performance", desc: "Central processing hub performance report", file: "MIS-005" },
  { icon: Building2, title: "MPC Performance", desc: "Multipurpose Centre performance metrics", file: "MIS-006" },
  { icon: Shield, title: "Haat Bazaar Performance", desc: "Haat Bazaar operations and revenue", file: "MIS-007" },
  { icon: FileText, title: "Weekly Operational", desc: "Weekly summary of VDVK operations", file: "MIS-008" },
  { icon: IndianRupee, title: "Fund Utilisation", desc: "Scheme-wise fund utilisation statement", file: "MIS-009" },
  { icon: Wrench, title: "Machinery Utilisation", desc: "Asset and machinery usage analysis", file: "MIS-010" },
  { icon: Users, title: "Beneficiary Performance", desc: "Beneficiary-wise collection analytics", file: "MIS-011" },
  { icon: Calculator, title: "Inventory Status", desc: "Current stock inventory across all facilities", file: "MIS-012" },
];

const registers: RegisterCard[] = [
  { icon: Factory, title: "VDVK Master Register", countKey: "vdvks" },
  { icon: Users, title: "Beneficiary Master Register", countKey: "—" },
  { icon: Wrench, title: "Machinery Master Register", countKey: "—" },
  { icon: Truck, title: "Machinery Movement History", countKey: "—" },
  { icon: Building2, title: "Facility Master Register", countKey: "facilities" },
  { icon: UserCog, title: "Facility-Supervisor Assignment", countKey: "—" },
  { icon: Users, title: "User Master Register", countKey: "users" },
  { icon: Briefcase, title: "Customer Master Register", countKey: "customers" },
  { icon: MapPin, title: "User Transfer Register", countKey: "—" },
  { icon: Shield, title: "VDVK Head Change Register", countKey: "—" },
  { icon: ShoppingCart, title: "Commodity Master Register", countKey: "commodities" },
  { icon: Star, title: "Grade Master Register", countKey: "grades" },
  { icon: Layers, title: "Scheme Master Register", countKey: "schemes" },
  { icon: IndianRupee, title: "Commodity Rate Master", countKey: "—" },
  { icon: ClipboardCheck, title: "Expenditure Head Master", countKey: "expenditureHeads" },
  { icon: FileCheck, title: "Administrative Correction", countKey: "—" },
  { icon: Database, title: "Audit Trail Register", countKey: "auditTrail" },
];

const books: BookCard[] = [
  { icon: Wallet, title: "Cash Book" },
  { icon: Calculator, title: "Credit Register" },
  { icon: ShoppingCart, title: "Purchase Register" },
  { icon: IndianRupee, title: "Sales Register" },
  { icon: FileText, title: "Receipt Book" },
  { icon: FileCheck, title: "Payment Register" },
  { icon: Factory, title: "Processing Cost Register" },
  { icon: Truck, title: "Logistics Book" },
  { icon: Wrench, title: "Machinery Purchase" },
  { icon: GraduationCap, title: "Training Expense Register" },
  { icon: IndianRupee, title: "Fund Register" },
  { icon: BarChart3, title: "Daily Collection Register" },
  { icon: Settings, title: "Asset Maintenance Book" },
  { icon: Users, title: "Labour Payment Register" },
  { icon: BookOpen, title: "Petty Cash Book" },
  { icon: Database, title: "Stock Valuation Register" },
];

export function ReportsModule() {
  const [activeTab, setActiveTab] = useState<Tab>("reports");

  const { data: vdvks, isLoading: vdvksLoading } = useQuery({
    queryKey: ["master", "vdvks"],
    queryFn: () => masterApi.getVdvks().then((r) => r.data ?? []),
    staleTime: 120_000,
  });

  const { data: commodities, isLoading: commoditiesLoading } = useQuery({
    queryKey: ["master", "commodities"],
    queryFn: () => masterApi.getCommodities().then((r) => r.data ?? []),
    staleTime: 120_000,
  });

  const { data: schemes, isLoading: schemesLoading } = useQuery({
    queryKey: ["master", "schemes"],
    queryFn: () => masterApi.getSchemes().then((r) => r.data ?? []),
    staleTime: 120_000,
  });

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["master", "customers"],
    queryFn: () => masterApi.getCustomers().then((r) => r.data ?? []),
    staleTime: 120_000,
  });

  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ["master", "grades"],
    queryFn: () => masterApi.getGrades().then((r) => r.data ?? []),
    staleTime: 120_000,
  });

  const { data: expenditureHeads, isLoading: headsLoading } = useQuery({
    queryKey: ["master", "expenditure-heads"],
    queryFn: () => masterApi.getExpenditureHeads().then((r) => r.data ?? []),
    staleTime: 120_000,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["mda", "users"],
    queryFn: () => mdaApi.getUsers().then((r) => r.data ?? []),
    staleTime: 120_000,
  });

  const { data: facilities, isLoading: facilitiesLoading } = useQuery({
    queryKey: ["mda", "facilities", "by-type"],
    queryFn: () => mdaApi.getFacilitiesByType().then((r) => r.data ?? []),
    staleTime: 120_000,
  });

  const { data: auditTrail, isLoading: auditLoading } = useQuery({
    queryKey: ["mda", "audit-trail"],
    queryFn: () => mdaApi.getAuditTrail().then((r) => r.data ?? []),
    staleTime: 120_000,
  });

  const counts = useMemo(() => {
    const vCount = Array.isArray(vdvks) ? vdvks.length : 0;
    const cCount = Array.isArray(commodities) ? commodities.length : 0;
    const sCount = Array.isArray(schemes) ? schemes.length : 0;
    const custCount = Array.isArray(customers) ? customers.length : 0;
    const gCount = Array.isArray(grades) ? grades.length : 0;
    const ehCount = Array.isArray(expenditureHeads) ? expenditureHeads.length : 0;
    const uCount = Array.isArray(users) ? users.length : 0;
    const fCount = Array.isArray(facilities) ? facilities.length : 0;
    const aCount = Array.isArray(auditTrail) ? auditTrail.length : 0;

    return {
      vdvks: `${vCount.toLocaleString("en-IN")} Records`,
      commodities: `${cCount.toLocaleString("en-IN")} Records`,
      schemes: `${sCount.toLocaleString("en-IN")} Records`,
      customers: `${custCount.toLocaleString("en-IN")} Records`,
      grades: `${gCount.toLocaleString("en-IN")} Records`,
      expenditureHeads: `${ehCount.toLocaleString("en-IN")} Records`,
      users: `${uCount.toLocaleString("en-IN")} Records`,
      facilities: `${fCount.toLocaleString("en-IN")} Records`,
      auditTrail: `${aCount.toLocaleString("en-IN")} Records`,
    };
  }, [vdvks, commodities, schemes, customers, grades, expenditureHeads, users, facilities, auditTrail]);

  const anyLoading =
    vdvksLoading ||
    commoditiesLoading ||
    schemesLoading ||
    customersLoading ||
    gradesLoading ||
    headsLoading ||
    usersLoading ||
    facilitiesLoading ||
    auditLoading;

  const fetchIcons = [Eye, Download, FileSpreadsheet];

  return (
    <div className="-mx-8 -mt-8">
      <div className="p-8 bg-white border-b border-charcoal/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="font-display text-4xl tracking-tight text-charcoal">Knowledge Base</h1>
            <p className="text-charcoal/50 text-sm font-medium uppercase tracking-[0.2em] mt-1">
              Archived Intelligence & Regulatory Books
            </p>
          </div>
          <div className="flex bg-charcoal/5 p-1 rounded-lg">
            {(["reports", "registers", "books"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-md",
                  activeTab === tab ? "bg-charcoal text-golden" : "text-charcoal/40 hover:text-charcoal"
                )}
              >
                {tab === "books" ? "Books of Accounts" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {["Date Range", "Scheme", "Mandal", "VDVK", "Commodity", "Facility"].map((label) => (
            <div key={label} className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-charcoal/40">{label}</label>
              {label === "Date Range" ? (
                <input type="date" className="w-full bg-[#f8f8f8] border border-charcoal/10 p-2 text-xs focus:ring-1 focus:ring-golden outline-none" />
              ) : (
                <select className="w-full bg-[#f8f8f8] border border-charcoal/10 p-2 text-xs focus:ring-1 focus:ring-golden outline-none">
                  <option>All {label === "VDVK" ? "VDVKs" : label === "Commodity" ? "Items" : label + "s"}</option>
                </select>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 py-12">
        {activeTab === "reports" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((r) => (
              <div
                key={r.file}
                className="bg-white border-2 border-charcoal/5 hover:border-charcoal rounded-2xl p-6 flex flex-col group transition-all"
              >
                <div className="w-12 h-12 bg-charcoal/5 flex items-center justify-center rounded-xl mb-4 text-charcoal">
                  <r.icon size={24} />
                </div>
                <h3 className="font-display text-lg text-charcoal mb-1">{r.title}</h3>
                <p className="text-xs text-charcoal/50 leading-relaxed mb-6 flex-1">{r.desc}</p>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-charcoal/30">
                    {r.file}
                  </span>
                  <div className="flex gap-1 ml-auto">
                    {fetchIcons.map((Icon, i) => (
                      <button
                        key={i}
                        className="p-1.5 rounded-lg hover:bg-charcoal/5 text-charcoal/40 hover:text-charcoal transition-colors"
                      >
                        <Icon size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "registers" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {registers.map((reg) => (
              <div
                key={reg.title}
                className="bg-white border-2 border-charcoal/5 hover:border-charcoal rounded-2xl p-6 flex flex-col transition-all"
              >
                <div className="w-12 h-12 bg-charcoal text-golden flex items-center justify-center rounded-xl mb-4">
                  <reg.icon size={24} />
                </div>
                <h3 className="font-display text-lg text-charcoal mb-2">{reg.title}</h3>
                {anyLoading ? (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-charcoal/30">
                    <Loader2 className="animate-spin" size={12} />
                    Loading…
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-wider text-charcoal/30">
                    {reg.countKey === "—" ? reg.countKey : (counts as Record<string, string>)[reg.countKey] ?? "—"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "books" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {books.map((book) => (
              <div
                key={book.title}
                className="bg-white border-2 border-charcoal/5 hover:border-charcoal rounded-2xl p-6 flex flex-col transition-all"
              >
                <div className="w-12 h-12 bg-charcoal/5 flex items-center justify-center rounded-xl mb-4 text-charcoal">
                  <book.icon size={24} />
                </div>
                <h3 className="font-display text-lg text-charcoal">{book.title}</h3>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
