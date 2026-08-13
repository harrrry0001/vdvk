import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api/endpoints/dashboard";
import { masterApi } from "@/api/endpoints/master";
import { mdaApi } from "@/api/endpoints/mda";
import { KPICard } from "@/components/shared/KPICard";
import { DataTable } from "@/components/shared/DataTable";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import {
  Factory,
  Package,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";

type TabType = "Hub" | "Haat Bazaar" | "MPC";

const TABS: { key: TabType; label: string }[] = [
  { key: "Hub", label: "Hub" },
  { key: "Haat Bazaar", label: "Haat Bazaar" },
  { key: "MPC", label: "MPC" },
];

interface Facility {
  code: string;
  name: string;
  type: string;
  mandal?: string;
  village?: string;
  location?: string;
  status?: string;
  vdvkCount?: number;
  machineryCount?: number;
  collectionKg?: number;
  processingKg?: number;
  rawSalesKg?: number;
  processedSalesKg?: number;
  revenue?: number;
}

function StatusBadge({ status }: { status?: string }) {
  const normalized = (status ?? "").toLowerCase();
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    active: {
      bg: "bg-green-100",
      text: "text-green-800",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    operational: {
      bg: "bg-green-100",
      text: "text-green-800",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    maintenance: {
      bg: "bg-yellow-100",
      text: "text-yellow-800",
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    partial: {
      bg: "bg-yellow-100",
      text: "text-yellow-800",
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    inactive: {
      bg: "bg-red-100",
      text: "text-red-800",
      icon: <XCircle className="w-3 h-3" />,
    },
  };
  const style = config[normalized] ?? {
    bg: "bg-gray-100",
    text: "text-gray-600",
    icon: <Info className="w-3 h-3" />,
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase",
        style.bg,
        style.text
      )}
    >
      {style.icon}
      {status ?? "Unknown"}
    </span>
  );
}

const hubColumns: ColumnDef<Facility, unknown>[] = [
  {
    accessorKey: "name",
    header: "Hub Name",
    cell: ({ getValue }) => (
      <span className="font-bold text-charcoal">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "mandal",
    header: "Mandal",
    cell: ({ getValue }) => (
      <span className="text-xs font-medium uppercase">
        {getValue<string>() || "—"}
      </span>
    ),
  },
  {
    accessorKey: "vdvkCount",
    header: "VDVKs",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: "machineryCount",
    header: "Machinery",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: "collectionKg",
    header: "Collection (Kg)",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{Number(getValue() ?? 0).toLocaleString()}</span>
    ),
  },
  {
    accessorKey: "processingKg",
    header: "Processing (Kg)",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{Number(getValue() ?? 0).toLocaleString()}</span>
    ),
  },
  {
    accessorKey: "rawSalesKg",
    header: "Raw Sales (Kg)",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{Number(getValue() ?? 0).toLocaleString()}</span>
    ),
  },
  {
    accessorKey: "processedSalesKg",
    header: "Processed Sales (Kg)",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{Number(getValue() ?? 0).toLocaleString()}</span>
    ),
  },
  {
    accessorKey: "revenue",
    header: "Revenue (₹)",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs font-semibold text-emerald-600">
        {Number(getValue() ?? 0).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
  },
];

const haatColumns: ColumnDef<Facility, unknown>[] = [
  {
    accessorKey: "name",
    header: "Market Name",
    cell: ({ getValue }) => (
      <span className="font-bold text-charcoal">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "village",
    header: "Location",
    cell: ({ getValue }) => (
      <span className="text-xs font-medium uppercase">
        {getValue<string>() || "—"}
      </span>
    ),
  },
  {
    accessorKey: "mandal",
    header: "Mandal",
    cell: ({ getValue }) => (
      <span className="text-xs font-medium uppercase">
        {getValue<string>() || "—"}
      </span>
    ),
  },
  {
    accessorKey: "vdvkCount",
    header: "VDVKs",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: "collectionKg",
    header: "Collection (Kg)",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{Number(getValue() ?? 0).toLocaleString()}</span>
    ),
  },
  {
    accessorKey: "processingKg",
    header: "Processing (Kg)",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{Number(getValue() ?? 0).toLocaleString()}</span>
    ),
  },
  {
    accessorKey: "revenue",
    header: "Revenue (₹)",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs font-semibold text-emerald-600">
        {Number(getValue() ?? 0).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
  },
];

const mpcColumns: ColumnDef<Facility, unknown>[] = [
  {
    accessorKey: "name",
    header: "Centre Name",
    cell: ({ getValue }) => (
      <span className="font-bold text-charcoal">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "village",
    header: "Location",
    cell: ({ getValue }) => (
      <span className="text-xs font-medium uppercase">
        {getValue<string>() || "—"}
      </span>
    ),
  },
  {
    accessorKey: "mandal",
    header: "Mandal",
    cell: ({ getValue }) => (
      <span className="text-xs font-medium uppercase">
        {getValue<string>() || "—"}
      </span>
    ),
  },
  {
    accessorKey: "vdvkCount",
    header: "VDVKs",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: "machineryCount",
    header: "Machinery",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: "revenue",
    header: "Revenue (₹)",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs font-semibold text-emerald-600">
        {Number(getValue() ?? 0).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
  },
];

const COLUMNS_BY_TAB: Record<TabType, ColumnDef<Facility, unknown>[]> = {
  Hub: hubColumns,
  "Haat Bazaar": haatColumns,
  MPC: mpcColumns,
};

const TAB_TITLES: Record<TabType, string> = {
  Hub: "HUB NETWORK DIRECTORY",
  "Haat Bazaar": "HAAT BAZAAR NETWORK DIRECTORY",
  MPC: "MPC NETWORK DIRECTORY",
};

export function HubFacilityPerformance() {
  const [activeTab, setActiveTab] = useState<TabType>("Hub");

  const { data: vdvkData, isLoading: vdvkLoading, isError: vdvkError, refetch: vdvkRefetch } = useQuery({
    queryKey: ["master", "vdvks"],
    queryFn: () => masterApi.getVdvks().then((r) => r.data ?? []),
  });

  const { data: facilitiesData, isLoading: facilitiesLoading, isError: facilitiesError, refetch: facilitiesRefetch } = useQuery({
    queryKey: ["mda", "facilities", "by-type", activeTab],
    queryFn: () =>
      mdaApi.getFacilitiesByType(activeTab).then((r) => r.data ?? []),
  });

  const { data: machinerySummary, isLoading: machineryLoading, isError: machineryError, refetch: machineryRefetch } = useQuery({
    queryKey: ["dashboard", "machinery-summary"],
    queryFn: () => dashboardApi.getMachinerySummary().then((r) => (Array.isArray(r.data) ? r.data : []) as { status: string; count: number }[]),
  });

  const { data: facilityPerf, isLoading: perfLoading, isError: perfError, refetch: perfRefetch } = useQuery({
    queryKey: ["dashboard", "facility-performance", activeTab],
    queryFn: () => dashboardApi.getFacilityPerformance(activeTab).then((r) => r.data ?? []),
  });

  const facilities = useMemo(() => {
    const arr = Array.isArray(facilitiesData) ? facilitiesData : [];
    const perfArr = Array.isArray(facilityPerf) ? facilityPerf : [];
    const perfByCode: Record<string, Record<string, unknown>> = {};
    perfArr.forEach((p: Record<string, unknown>) => {
      perfByCode[(p.code as string) ?? ""] = p;
    });
    return arr.map((f: Record<string, unknown>) => {
      const code = (f.code as string) ?? (f.facilityCode as string) ?? "";
      const p = perfByCode[code] ?? {};
      return {
        code,
        name: (f.name as string) ?? (f.facilityName as string) ?? "",
        type: (f.type as string) ?? activeTab,
        mandal: (f.mandal as string) ?? (p.mandal as string) ?? "",
        village: (f.village as string) ?? (f.location as string) ?? "",
        location: (f.location as string) ?? (f.village as string) ?? "",
        status: (f.status as string) ?? "active",
        vdvkCount: Number(p.vdvksServed ?? f.vdvkCount ?? 0),
        machineryCount: Number(p.machineryCount ?? f.machineryCount ?? 0),
        collectionKg: Number(p.collectionKg ?? 0),
        processingKg: Number(p.processingKg ?? 0),
        rawSalesKg: Number(p.rawSalesKg ?? 0),
        processedSalesKg: Number(p.processedSalesKg ?? 0),
        revenue: Number(p.revenue ?? 0),
      };
    });
  }, [facilitiesData, facilityPerf, activeTab]);

  const isLoading = vdvkLoading || facilitiesLoading || machineryLoading || perfLoading;
  const isError = vdvkError || facilitiesError || machineryError || perfError;

  const handleRetry = () => {
    vdvkRefetch();
    facilitiesRefetch();
    machineryRefetch();
    perfRefetch();
  };

  if (isLoading) return <PageLoading />;

  if (isError)
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-red-500 font-semibold">Failed to load data</p>
          <button onClick={handleRetry} className="mt-2 text-sm text-charcoal underline">
            Retry
          </button>
        </div>
      </div>
    );

  const machinery = Array.isArray(machinerySummary)
    ? machinerySummary.reduce(
        (acc, item: { status: string; count: number }) => {
          acc[item.status] = item.count;
          return acc;
        },
        {} as Record<string, number>
      )
    : machinerySummary ?? {};
  const totalMachinery = Object.values(machinery).reduce((a: number, b: number) => a + b, 0);
  const availableMachinery = machinery["Available"] ?? 0;

  const totalVdvks = Array.isArray(vdvkData) ? vdvkData.length : 0;

  const totalCollectionKg = facilities.reduce((s, f) => s + (f.collectionKg ?? 0), 0);
  const totalRevenue = facilities.reduce((s, f) => s + (f.revenue ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-charcoal text-golden text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Overview
          </a>
          <h1 className="font-display text-5xl tracking-tight text-charcoal mt-4">
            FACILITY PERFORMANCE
          </h1>
          <p className="text-charcoal/50 text-sm font-medium uppercase tracking-[0.2em] mt-2">
            Hubs, Haat Bazaars and Multipurpose Centres
          </p>
        </div>

        <div className="flex bg-white border border-charcoal/10 p-1 self-start">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-colors",
                activeTab === tab.key
                  ? "bg-charcoal text-golden"
                  : "text-charcoal/40 hover:text-charcoal"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          label="Total Facilities"
          value={facilities.length}
          changeLabel={`${totalVdvks} VDVKs across Mandals`}
        />
        <KPICard
          label="Machinery Deployed"
          value={totalMachinery}
          changeLabel={`${availableMachinery} Available`}
        />
        <KPICard
          label="Collection Volume"
          value={`${(totalCollectionKg / 1000).toFixed(1)} MT`}
          accent="green"
          changeLabel={`${totalCollectionKg.toLocaleString()} Kg`}
        />
        <KPICard
          label="Revenue Generated"
          value={`₹ ${totalRevenue.toLocaleString()}`}
          accent="yellow"
          className="bg-golden border-golden"
          changeLabel="Approved Sales"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3 bg-white border border-charcoal/5 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-charcoal/5 flex justify-between items-center bg-gray-50/50">
            <h4 className="font-display text-xl tracking-wide">
              {TAB_TITLES[activeTab]}
            </h4>
            <div className="flex gap-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 text-charcoal/40 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-8 pr-4 py-2 border border-charcoal/10 text-xs font-bold focus:ring-1 focus:ring-golden outline-none w-48"
                />
              </div>
              <button className="p-2 bg-charcoal text-white hover:bg-black transition-colors">
                <Factory className="w-4 h-4" />
              </button>
            </div>
          </div>

          {facilities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-charcoal/40">
              <Package className="w-12 h-12 mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest">
                No {activeTab} facilities found
              </p>
              <p className="text-xs mt-1">Facilities data will appear here once registered.</p>
            </div>
          ) : (
            <DataTable
              columns={COLUMNS_BY_TAB[activeTab]}
              data={facilities}
              searchable
              searchPlaceholder={`Search ${activeTab.toLowerCase()} facilities...`}
              className="border-0"
            />
          )}
        </div>

        <div className="bg-dark-gray p-8 flex flex-col relative overflow-hidden">
          <div className="relative z-10">
            <h4 className="font-display text-2xl tracking-tight text-golden mb-2">
              FACILITY MAP
            </h4>
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-8">
              Paderu District Cluster View
            </p>

            <div className="aspect-[3/4] bg-charcoal border border-white/10 relative rounded-lg overflow-hidden group">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,#ffe17c,transparent)]" />

              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] -rotate-45">
                  Interactive Grid
                </span>
              </div>

              <div className="absolute top-1/4 left-1/3 w-3 h-3 bg-golden rounded-full animate-pulse shadow-[0_0_10px_#ffe17c]" />
              <div className="absolute top-1/2 left-2/3 w-3 h-3 bg-white rounded-full opacity-60" />
              <div className="absolute bottom-1/4 left-1/2 w-3 h-3 bg-white rounded-full opacity-60" />
              <div className="absolute top-2/3 left-1/4 w-3 h-3 bg-white rounded-full opacity-60" />
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-golden rounded-full" />
                <span className="text-[10px] font-black text-white/60 uppercase">
                  {activeTab}s
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-white rounded-full opacity-60" />
                <span className="text-[10px] font-black text-white/60 uppercase">
                  VDVK Clusters
                </span>
              </div>
            </div>

            <button className="w-full mt-10 py-3 bg-golden text-charcoal text-xs font-black uppercase tracking-widest hover:bg-white transition-colors">
              Expand Full Map
            </button>
          </div>

          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-golden/5 rounded-full" />
        </div>

        {/* Facility Rankings Leaderboard */}
        <div className="mt-8 bg-white border border-charcoal/10 rounded-2xl overflow-hidden">
          <div className="bg-charcoal px-6 py-4 flex items-center justify-between">
            <h4 className="font-display text-lg tracking-tight text-golden">
              {activeTab} RANKINGS
            </h4>
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
              Top 5
            </span>
          </div>
          {(() => {
            const ranked = [...facilities]
              .map((f) => ({
                ...f,
                score: (f.vdvkCount ?? 0) * 2 + (f.machineryCount ?? 0),
              }))
              .sort((a, b) => b.score - a.score)
              .slice(0, 5);
            if (ranked.length === 0) {
              return (
                <div className="px-6 py-10 text-center">
                  <Package className="w-8 h-8 text-charcoal/15 mx-auto mb-3" />
                  <p className="text-xs font-bold text-charcoal/40 uppercase tracking-widest">
                    No facilities to rank
                  </p>
                </div>
              );
            }
            return (
              <div className="divide-y divide-charcoal/5">
                {ranked.map((f, i) => (
                  <div key={f.code || f.name} className="flex items-center gap-4 px-6 py-4">
                    <span
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-display text-sm shrink-0",
                        i < 3 ? "bg-golden text-charcoal" : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-charcoal truncate">{f.name}</p>
                      <p className="text-[10px] text-charcoal/40 uppercase tracking-wider truncate">
                        {f.mandal || "—"} · {f.vdvkCount ?? 0} VDVKs · {f.machineryCount ?? 0} Mach
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-golden h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, (f.score / (ranked[0]?.score || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-charcoal/50">{f.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
