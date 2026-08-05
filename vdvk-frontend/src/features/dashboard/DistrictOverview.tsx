import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api/endpoints/dashboard";
import { KPICard } from "@/components/shared/KPICard";
import { DataTable } from "@/components/shared/DataTable";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { type ColumnDef } from "@tanstack/react-table";
import type { CommodityPerformance, HubItem } from "@/types";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, TrendingUp, TrendingDown, Building2, Factory,
  ShoppingBag, Package, Warehouse, BarChart3, Eye,
} from "lucide-react";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useAuth } from "@/hooks/useAuth";

const timeFilters = ["Today", "Week", "Month", "Quarter", "Year", "Custom"];

interface VdvkRankingRow {
  rank: number;
  code: string;
  name: string;
  mandal: string;
  collectionCount: number;
  processingCount: number;
  sales: number;
  amountReleased: number;
  status: string;
}

export function DistrictOverview() {
  const [activeFilter, setActiveFilter] = useState("Month");
  const { isCollapsed } = useSidebarStore();
  const { isManagement, isAPM, isFieldUser } = useAuth();
  const canViewFull = isManagement || isAPM;

  const { data: overview, isLoading: overviewLoading, isError: overviewError, refetch: overviewRefetch } = useQuery({
    queryKey: ["dashboard", "district-overview"],
    queryFn: () => dashboardApi.getDistrictOverview().then((r) => r.data),
    enabled: canViewFull,
  });

  const { data: commodityPerf, isLoading: commodityLoading, isError: commodityError, refetch: commodityRefetch } = useQuery({
    queryKey: ["dashboard", "commodity-performance"],
    queryFn: () =>
      dashboardApi.getCommodityPerformance().then((r) => ({
        items: (r.data?.stockByCommodity ?? []) as CommodityPerformance[],
        totalSales: r.data?.totalSales ?? 0,
      })),
    enabled: canViewFull,
  });

  const { data: vdvkRaw, isLoading: vdvkLoading, isError: vdvkError, refetch: vdvkRefetch } = useQuery({
    queryKey: ["dashboard", "vdvk-performance"],
    queryFn: () => dashboardApi.getVdvkPerformance().then((r) => r.data ?? []),
    enabled: canViewFull,
  });

  const isError = overviewError || commodityError || vdvkError;

  const handleRetry = () => {
    overviewRefetch();
    commodityRefetch();
    vdvkRefetch();
  };

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

  if (overviewLoading) return <PageLoading />;

  // Field user simplified view
  if (isFieldUser) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-charcoal to-charcoal-700 rounded-2xl p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#ffe17c15_0%,_transparent_60%)]" />
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-golden/60 mb-2">Field User Access</p>
            <h1 className="font-display text-4xl lg:text-5xl tracking-tight text-white">District Overview</h1>
            <p className="text-sm text-white/40 mt-2 max-w-lg">
              View-only access to operational data. Full analytics available to management roles.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <Eye size={48} className="text-gray-200 mx-auto mb-4" />
            <h3 className="font-display text-xl text-charcoal mb-2">Read-Only View</h3>
            <p className="text-sm text-gray-500">Your role provides operational data entry access. Full district analytics and KPIs are available to PO, DPM, and APM roles.</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <Building2 size={48} className="text-gray-200 mx-auto mb-4" />
            <h3 className="font-display text-xl text-charcoal mb-2">Your Forms</h3>
            <p className="text-sm text-gray-500">Access data entry forms from the sidebar. Submit collection, transfer, processing, and other operational data.</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <BarChart3 size={48} className="text-gray-200 mx-auto mb-4" />
            <h3 className="font-display text-xl text-charcoal mb-2">Reports Hub</h3>
            <p className="text-sm text-gray-500">Download operational reports and registers relevant to your assigned facility and role.</p>
          </div>
        </div>
      </div>
    );
  }

  const vdvkRankings: VdvkRankingRow[] = Array.isArray(vdvkRaw)
    ? vdvkRaw.map((item, i) => ({
        rank: i + 1,
        code: item.code,
        name: item.name,
        mandal: item.mandal,
        collectionCount: item.collectionCount ?? 0,
        processingCount: item.processingCount ?? 0,
        sales: 0,
        amountReleased: item.amountReleased ?? 0,
        status: "Stable",
      }))
    : [];

  const topCommodities = commodityPerf?.items?.slice(0, 5) ?? [];
  const hubs: HubItem[] = overview?.totalHubs ?? [];
  const totalSchemes = overview?.totalSchemes ?? 0;
  const totalVdvks = overview?.totalVdvks ?? 0;
  const totalBeneficiaries = overview?.totalBeneficiaries ?? 0;
  const totalFacilities = overview?.totalFacilities ?? 0;
  const salesTransactions = overview?.salesTransactions ?? 0;
  const rawStockKg = overview?.rawStockKg ?? 0;
  const processedStockKg = overview?.processedStockKg ?? 0;
  const processingShare = rawStockKg + processedStockKg > 0
    ? Math.round((processedStockKg / (rawStockKg + processedStockKg)) * 100)
    : 0;
  const rawShare = 100 - processingShare;

  const kpiGridCols = isCollapsed
    ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-7"
    : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7";

  const commodityColumns: ColumnDef<CommodityPerformance>[] = [
    { accessorKey: "commodityName", header: "Commodity", cell: ({ getValue }) => <span className="font-semibold text-sm">{getValue<string>()}</span> },
    { accessorKey: "commodityCode", header: "Code", cell: ({ getValue }) => <span className="font-mono text-xs text-gray-400">{getValue<string>()}</span> },
    {
      accessorKey: "totalKg",
      header: "Stock (Kg)",
      cell: ({ getValue }) => <span className="font-mono text-sm font-medium">{Number(getValue()).toLocaleString()}</span>,
    },
    {
      accessorKey: "totalPcs",
      header: "Stock (Pcs)",
      cell: ({ getValue }) => <span className="font-mono text-sm font-medium">{Number(getValue()).toLocaleString()}</span>,
    },
    {
      accessorKey: "stockType",
      header: "Type",
      cell: ({ getValue }) => (
        <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", getValue<string>() === "Raw" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>
          {getValue<string>()}
        </span>
      ),
    },
  ];

  const vdvkColumns: ColumnDef<VdvkRankingRow>[] = [
    {
      accessorKey: "rank",
      header: "#",
      cell: ({ getValue }) => (
        <span className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-display",
          getValue<number>() <= 3 ? "bg-golden text-charcoal" : "bg-gray-100 text-gray-500"
        )}>
          {getValue<number>()}
        </span>
      ),
    },
    { accessorKey: "code", header: "VDVK Code", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
    { accessorKey: "name", header: "VDVK Name", cell: ({ getValue }) => <span className="font-semibold text-sm">{getValue<string>()}</span> },
    { accessorKey: "mandal", header: "Mandal", cell: ({ getValue }) => <span className="text-xs text-gray-500">{getValue<string>()}</span> },
    {
      accessorKey: "collectionCount",
      header: "Collections",
      cell: ({ getValue }) => <span className="font-mono text-xs font-medium">{getValue<number>()}</span>,
    },
    {
      accessorKey: "processingCount",
      header: "Processing",
      cell: ({ getValue }) => <span className="font-mono text-xs font-medium">{getValue<number>()}</span>,
    },
    {
      accessorKey: "amountReleased",
      header: "Released",
      cell: ({ getValue }) => <span className="font-mono text-xs font-semibold text-emerald-600">Rs {Number(getValue()).toLocaleString()}</span>,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-charcoal to-charcoal-700 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#ffe17c15_0%,_transparent_60%)]" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-golden/60 mb-2">
              Unified Monitoring System · All Mandals
            </p>
            <h1 className="font-display text-4xl lg:text-5xl tracking-tight text-white">
              District Overview
            </h1>
            <p className="text-sm text-white/40 mt-2 max-w-lg">
              Real-time operational intelligence across {totalVdvks.toLocaleString()} VDVK centers,
              {" "}{totalBeneficiaries.toLocaleString()} beneficiaries, and {totalFacilities} facilities.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {timeFilters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  activeFilter === f
                    ? "bg-golden text-charcoal shadow-lg shadow-golden/10"
                    : "text-white/40 hover:text-white/80 hover:bg-white/5"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={cn("grid gap-4", kpiGridCols)}>
        <KPICard label="Active VDVKs" value={totalVdvks.toLocaleString()} accent="yellow" />
        <KPICard label="Beneficiaries" value={totalBeneficiaries.toLocaleString()} accent="blue" />
        <KPICard label="Total Schemes" value={totalSchemes.toLocaleString()} accent="purple" />
        <KPICard label="Facilities" value={totalFacilities.toLocaleString()} accent="green" />
        <KPICard label="Raw Stock" value={`${(rawStockKg / 1000).toFixed(1)} MT`} accent="yellow" />
        <KPICard label="Processed Stock" value={`${(processedStockKg / 1000).toFixed(1)} MT`} accent="green" />
        <KPICard label="Total Sales" value={salesTransactions.toLocaleString()} accent="yellow" />
      </div>

      {/* Quick Stats Mini Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { icon: Building2, label: "VDVK Centers", value: totalVdvks, color: "text-blue-600 bg-blue-50" },
          { icon: Factory, label: "Processing", value: `${(processedStockKg / 1000).toFixed(1)} MT`, color: "text-emerald-600 bg-emerald-50" },
          { icon: ShoppingBag, label: "Sales Txn", value: salesTransactions, color: "text-amber-600 bg-amber-50" },
          { icon: Package, label: "Raw Stock", value: `${(rawStockKg / 1000).toFixed(1)} MT`, color: "text-purple-600 bg-purple-50" },
          { icon: Warehouse, label: "Facilities", value: totalFacilities, color: "text-indigo-600 bg-indigo-50" },
          { icon: BarChart3, label: "Schemes", value: totalSchemes, color: "text-rose-600 bg-rose-50" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", stat.color)}>
              <stat.icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{stat.label}</p>
              <p className="font-display text-lg text-charcoal">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Commodity Table + Value Split */}
      <div className={cn("grid gap-6", isCollapsed ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 lg:grid-cols-3")}>
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl text-charcoal tracking-wide">Stock by Commodity</h3>
          </div>
          {commodityLoading ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8"><PageLoading /></div>
          ) : (
            <DataTable columns={commodityColumns} data={topCommodities} pageSize={5} />
          )}
        </div>

        <div className="space-y-6">
          {/* Value Split */}
          <div className="dark-panel space-y-4">
            <h3 className="font-display text-sm text-golden tracking-wide">Stock Split</h3>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/70">Processed Stock</span>
                  <span className="font-display text-golden">{processingShare}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-golden h-full rounded-full transition-all duration-700" style={{ width: `${processingShare}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/70">Raw Stock</span>
                  <span className="font-display text-sage">{rawShare}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-sage h-full rounded-full transition-all duration-700" style={{ width: `${rawShare}%` }} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Processed</p>
                <p className="font-display text-lg text-golden">{(processedStockKg / 1000).toFixed(1)} MT</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Raw</p>
                <p className="font-display text-lg text-sage">{(rawStockKg / 1000).toFixed(1)} MT</p>
              </div>
            </div>
          </div>

          {/* Sales Summary */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-display text-sm text-charcoal tracking-wide mb-4">Sales Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Total Sales Transactions</span>
                <span className="font-display text-xl text-charcoal">{salesTransactions.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Collection Transactions</span>
                <span className="font-display text-xl text-charcoal">{(overview?.collectionTransactions ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Processing Batches</span>
                <span className="font-display text-xl text-charcoal">{(overview?.processingTransactions ?? 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VDVK Rankings + Mandal Info */}
      <div className={cn("grid gap-6", isCollapsed ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 lg:grid-cols-2")}>
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl text-charcoal tracking-wide">VDVK Rankings</h3>
            <span className="text-xs text-gray-400 font-mono">{vdvkRankings.length} VDVKs</span>
          </div>
          {vdvkLoading ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8"><PageLoading /></div>
          ) : (
            <DataTable columns={vdvkColumns} data={vdvkRankings} pageSize={5} />
          )}
        </div>

        <div>
          <h3 className="font-display text-xl text-charcoal tracking-wide mb-4">Hub Capacity</h3>
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            {hubs.length > 0 ? (
              <div className="space-y-4">
                {hubs.map((hub) => (
                  <div key={hub.name} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-semibold">{hub.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">{hub.vdvks} VDVKs</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-28 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-golden to-golden-600 h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(hub.capacity, 100)}%` }} />
                      </div>
                      <span className="text-xs font-mono font-bold text-charcoal">{hub.capacity}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No hubs configured yet</p>
              </div>
            )}
          </div>

          <div className="mt-6 bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <TrendingUp size={18} className="text-amber-600" />
              </div>
              <div>
                <h4 className="font-display text-sm text-charcoal">Fund Overview</h4>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Sanctioned vs Released</p>
              </div>
            </div>
            <div className="space-y-2">
              {vdvkRankings.slice(0, 3).map((v) => (
                <div key={v.code} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0">
                  <span className="font-mono text-gray-500">{v.code}</span>
                  <span className="font-semibold">{v.name}</span>
                  <span className="font-mono text-emerald-600">Rs {v.amountReleased.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
