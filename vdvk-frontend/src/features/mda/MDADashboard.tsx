import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Factory,
  Users,
  Wrench,
  Building2,
  Box,
  Star,
  IndianRupee,
  Layers,
  ClipboardList,
  Briefcase,
  UserCog,
  FileText,
  ClipboardCheck,
  AlertTriangle,
} from "lucide-react";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { masterApi } from "@/api/endpoints/master";
import { mdaApi } from "@/api/endpoints/mda";
import { dashboardApi } from "@/api/endpoints/dashboard";

export function MDADashboard() {
  const { data: vdvks, isLoading: vdvksLoading, isError: vdvksError } = useQuery({
    queryKey: ["master", "vdvks"],
    queryFn: async () => {
      const res = await masterApi.getVdvks();
      return (res.data?.data ?? res.data ?? []) as unknown[];
    },
  });

  const { data: beneficiaries } = useQuery({
    queryKey: ["master", "beneficiaries-list"],
    queryFn: async () => {
      const res = await masterApi.getCustomers();
      return (res.data?.data ?? res.data ?? []) as unknown[];
    },
  });

  const { data: machinery, isLoading: machineryLoading } = useQuery({
    queryKey: ["dashboard", "machinery-summary"],
    queryFn: async () => {
      const res = await dashboardApi.getMachinerySummary();
      return res.data?.data ?? res.data ?? null;
    },
  });

  const { data: facilities } = useQuery({
    queryKey: ["mda", "facilities", "by-type"],
    queryFn: async () => {
      const res = await mdaApi.getFacilitiesByType();
      return (res.data?.data ?? res.data ?? []) as unknown[];
    },
  });

  const { data: commodities } = useQuery({
    queryKey: ["master", "commodities"],
    queryFn: async () => {
      const res = await masterApi.getCommodities();
      return (res.data?.data ?? res.data ?? []) as unknown[];
    },
  });

  const { data: users } = useQuery({
    queryKey: ["mda", "users"],
    queryFn: async () => {
      const res = await mdaApi.getUsers();
      return (res.data?.data ?? res.data ?? []) as unknown[];
    },
  });

  const { data: schemes } = useQuery({
    queryKey: ["master", "schemes"],
    queryFn: async () => {
      const res = await masterApi.getSchemes();
      return (res.data?.data ?? res.data ?? []) as unknown[];
    },
  });

  const { data: expenditureHeads } = useQuery({
    queryKey: ["master", "expenditure-heads"],
    queryFn: async () => {
      const res = await masterApi.getExpenditureHeads();
      return (res.data?.data ?? res.data ?? []) as unknown[];
    },
  });

  const { data: grades } = useQuery({
    queryKey: ["master", "grades"],
    queryFn: async () => {
      const res = await masterApi.getGrades();
      return (res.data?.data ?? res.data ?? []) as unknown[];
    },
  });

  const isLoading = vdvksLoading || machineryLoading;
  const isError = vdvksError;

  if (isLoading) return <PageLoading />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <AlertTriangle className="text-red-500" size={48} />
        <p className="text-charcoal text-lg font-display">Failed to load dashboard data</p>
        <p className="text-charcoal/50 text-sm">Please check your connection and try again.</p>
      </div>
    );
  }

  const machineryCount = Array.isArray(machinery)
    ? (machinery as { count?: number }[]).reduce((sum, s) => sum + (s.count ?? 0), 0)
    : (machinery as { total?: number })?.total ?? 0;

  const adminCards = [
    { label: "VDVK Master", count: (vdvks as unknown[])?.length, path: "/mda/vdvks", icon: Factory, action: "Manage Unit" },
    { label: "Beneficiary Registration", count: (beneficiaries as unknown[])?.length, path: "/mda/beneficiaries", icon: Users, action: "Register" },
    { label: "Machinery Onboarding", count: machineryCount, path: "/mda/machinery", icon: Wrench, action: "Onboard" },
    { label: "Facility Registration", count: (facilities as unknown[])?.length, path: "/mda/facilities", icon: Building2, action: "Setup" },
    { label: "Commodity Master", count: (commodities as unknown[])?.length, path: "/mda/commodities", icon: Box, action: "Catalogue" },
    { label: "Grade Master", count: (grades as unknown[])?.length, path: "/mda/grades", icon: Star, action: "Define" },
    { label: "Commodity Rate", count: "Live", path: "/mda/rates", icon: IndianRupee, action: "Update Prices" },
    { label: "Scheme Master", count: (schemes as unknown[])?.length, path: "/mda/schemes", icon: Layers, action: "Programs" },
    { label: "Expenditure Heads", count: (expenditureHeads as unknown[])?.length, path: "/mda/grades", icon: ClipboardList, action: "Ledgers" },
    { label: "Customer Master", count: (beneficiaries as unknown[])?.length, path: "/mda/grades", icon: Briefcase, action: "Clients" },
    { label: "User Management", count: (users as unknown[])?.length, path: "/mda/users", icon: UserCog, action: "Access Control" },
    { label: "Audit Trail", count: "Log", path: "/mda/data-correction", icon: FileText, action: "Security Logs" },
    { label: "Data Correction", count: "Admin", path: "/mda/data-correction", icon: ClipboardCheck, action: "Rectify Records" },
  ];

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-charcoal p-4 border-l-4 border-golden">
          <p className="text-[9px] font-bold text-golden/60 uppercase tracking-widest">Total VDVKs</p>
          <h3 className="font-display text-2xl text-white">
            {(vdvks as unknown[])?.length?.toLocaleString() ?? "—"}
          </h3>
        </div>
        <div className="bg-white p-4 border border-charcoal/5">
          <p className="text-[9px] font-bold text-charcoal/40 uppercase tracking-widest">Beneficiaries</p>
          <h3 className="font-display text-2xl">
            {(beneficiaries as unknown[])?.length?.toLocaleString() ?? "—"}
          </h3>
        </div>
        <div className="bg-white p-4 border border-charcoal/5">
          <p className="text-[9px] font-bold text-charcoal/40 uppercase tracking-widest">Machinery</p>
          <h3 className="font-display text-2xl">
            {typeof machineryCount === "number" ? machineryCount.toLocaleString() : "—"}
          </h3>
        </div>
        <div className="bg-white p-4 border border-charcoal/5">
          <p className="text-[9px] font-bold text-charcoal/40 uppercase tracking-widest">Facilities</p>
          <h3 className="font-display text-2xl">
            {(facilities as unknown[])?.length?.toLocaleString() ?? "—"}
          </h3>
        </div>
        <div className="bg-white p-4 border border-charcoal/5">
          <p className="text-[9px] font-bold text-charcoal/40 uppercase tracking-widest">Commodities</p>
          <h3 className="font-display text-2xl">
            {(commodities as unknown[])?.length?.toLocaleString() ?? "—"}
          </h3>
        </div>
        <div className="bg-white p-4 border border-charcoal/5">
          <p className="text-[9px] font-bold text-charcoal/40 uppercase tracking-widest">Total Users</p>
          <h3 className="font-display text-2xl">
            {(users as unknown[])?.length?.toLocaleString() ?? "—"}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {adminCards.map((card) => (
          <div
            key={card.label}
            className="mda-card bg-[#f8f9fa] border border-charcoal/5 rounded-2xl p-5"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-charcoal text-golden flex items-center justify-center rounded-xl">
                <card.icon size={20} />
              </div>
              <span className="px-2 py-1 bg-charcoal/5 rounded text-[10px] font-bold font-mono">
                {typeof card.count === "number" ? card.count.toLocaleString() : card.count}
              </span>
            </div>
            <h4 className="font-display text-sm text-charcoal mb-4">{card.label}</h4>
            <Link
              to={card.path}
              className="w-full inline-flex items-center justify-center py-2.5 bg-charcoal text-golden text-[10px] font-black uppercase tracking-widest rounded-lg hover:opacity-90 transition-opacity"
            >
              {card.action}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
