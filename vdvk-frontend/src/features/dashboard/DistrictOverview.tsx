import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api/endpoints/dashboard";
import { KPICard } from "@/components/shared/KPICard";
import { DataTable } from "@/components/shared/DataTable";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { type ColumnDef } from "@tanstack/react-table";
import type { HubItem } from "@/types";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, TrendingUp, Building2, Factory,
  ShoppingBag, Package, Warehouse, BarChart3, Eye,
} from "lucide-react";
import { useSidebarStore } from "@/stores/sidebarStore";
import { useAuth } from "@/hooks/useAuth";
import { CommodityCollectionChart, OperationalTrendChart, GradeCollectionChart, DonutChart } from "@/components/shared/Charts";

const timeFilters = ["Today", "Week", "Month", "Quarter", "Year", "Custom"];

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Maps the active period filter to an ISO [from, to] range so the dashboard
// charts/tables re-query the backend for that period. "Custom" returns
// undefined (all-time) unless a picker is provided.
function periodRange(period: string): { from?: string; to?: string } {
  const now = new Date();
  switch (period) {
    case "Today": {
      const s = toISO(now);
      return { from: s, to: s };
    }
    case "Week": {
      const day = now.getDay() || 7; // Sunday=0 -> 7
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { from: toISO(monday), to: toISO(sunday) };
    }
    case "Month":
      return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISO(now) };
    case "Quarter": {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return { from: toISO(new Date(now.getFullYear(), qStartMonth, 1)), to: toISO(now) };
    }
    case "Year":
      return { from: `${now.getFullYear()}-01-01`, to: toISO(now) };
    default:
      return {};
  }
}

interface VdvkRankingRow {
  rank: number;
  code: string;
  name: string;
  mandal: string;
  collectionCount: number;
  processingCount: number;
  revenue: number;
  amountSanctioned: number;
  amountReleased: number;
}

export function DistrictOverview() {
  const [activeFilter, setActiveFilter] = useState("Month");
  const { isCollapsed } = useSidebarStore();
  const { isManagement, isAPM, isFieldUser, isAdmin } = useAuth();
  const canViewFull = isManagement || isAPM || isAdmin;

  const { data: overview, isLoading: overviewLoading, isError: overviewError, refetch: overviewRefetch } = useQuery({
    queryKey: ["dashboard", "district-overview"],
    queryFn: () => dashboardApi.getDistrictOverview().then((r) => r.data),
    enabled: canViewFull,
  });

  const { data: vdvkRaw, isLoading: vdvkLoading, isError: vdvkError, refetch: vdvkRefetch } = useQuery({
    queryKey: ["dashboard", "vdvk-performance", activeFilter],
    queryFn: () => dashboardApi.getVdvkPerformance(periodRange(activeFilter)).then((r) => r.data ?? []),
    enabled: canViewFull,
  });

  const { data: chartCollection, isLoading: chartCollLoading } = useQuery({
    queryKey: ["dashboard", "collection-by-commodity", activeFilter],
    queryFn: () => dashboardApi.getCollectionByCommodity(periodRange(activeFilter)).then((r) => r.data ?? []),
    enabled: canViewFull,
  });

  const { data: chartTrend, isLoading: chartTrendLoading } = useQuery({
    queryKey: ["dashboard", "operational-trend"],
    queryFn: () => dashboardApi.getOperationalTrend(12).then((r) => r.data ?? []),
    enabled: canViewFull,
  });

  const { data: commodityRank, isLoading: commodityRankLoading } = useQuery({
    queryKey: ["dashboard", "commodity-ranking", activeFilter],
    queryFn: () => dashboardApi.getCommodityRanking(periodRange(activeFilter)).then((r) => r.data ?? []),
    enabled: canViewFull,
  });

  const { data: mandalPerf, isLoading: mandalLoading } = useQuery({
    queryKey: ["dashboard", "mandal-performance"],
    queryFn: () => dashboardApi.getMandalPerformance().then((r) => r.data ?? []),
    enabled: canViewFull,
  });

  const { data: gradeData, isLoading: gradeLoading } = useQuery({
    queryKey: ["dashboard", "commodity-grade", activeFilter],
    queryFn: () => dashboardApi.getCommodityGrade(periodRange(activeFilter)).then((r) => r.data ?? []),
    enabled: canViewFull,
  });

  const { data: productTypeData, isLoading: productTypeLoading } = useQuery({
    queryKey: ["dashboard", "sales-product-type", activeFilter],
    queryFn: () => dashboardApi.getSalesProductType(periodRange(activeFilter)).then((r) => r.data ?? []),
    enabled: canViewFull,
  });

  const { data: customerData, isLoading: customerLoading } = useQuery({
    queryKey: ["dashboard", "top-customers", activeFilter],
    queryFn: () => dashboardApi.getTopCustomers({ ...periodRange(activeFilter), limit: 8 }).then((r) => r.data ?? []),
    enabled: canViewFull,
  });

  const isError = overviewError || vdvkError;

  const handleRetry = () => {
    overviewRefetch();
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
        revenue: item.revenue ?? 0,
        amountSanctioned: item.amountSanctioned ?? 0,
        amountReleased: item.amountReleased ?? 0,
      }))
    : [];

  const hubs: HubItem[] = overview?.totalHubs ?? [];
  const commodityRanking = Array.isArray(commodityRank) ? commodityRank : [];
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

  // Commodity Performance Ranking (per plan: Rank | Commodity | Collection |
  // Processed | Unprocessed Stock | Sales | Revenue)
  const rankingColumns: ColumnDef<Record<string, unknown>>[] = [
    {
      id: "rank",
      header: "#",
      cell: ({ row }) => (
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-display bg-gray-100 text-gray-500">
          {row.index + 1}
        </span>
      ),
    },
    {
      accessorKey: "commodityName",
      header: "Commodity",
      cell: ({ getValue }) => <span className="font-semibold text-sm">{String(getValue() ?? "")}</span>,
    },
    {
      accessorKey: "collectionKg",
      header: "Collection (Kg)",
      cell: ({ getValue }) => <span className="font-mono text-xs">{Number(getValue() ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: "processedKg",
      header: "Processed (Kg)",
      cell: ({ getValue }) => <span className="font-mono text-xs">{Number(getValue() ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: "unprocessedStockKg",
      header: "Unprocessed (Kg)",
      cell: ({ getValue }) => <span className="font-mono text-xs text-amber-600">{Number(getValue() ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: "salesKg",
      header: "Sales (Kg)",
      cell: ({ getValue }) => <span className="font-mono text-xs">{Number(getValue() ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: "revenue",
      header: "Revenue (₹)",
      cell: ({ getValue }) => <span className="font-mono text-xs font-semibold text-emerald-600">{Number(getValue() ?? 0).toLocaleString()}</span>,
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
      accessorKey: "revenue",
      header: "Revenue",
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

      {/* Charts: MFP Collection by Commodity + Operational Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl text-charcoal tracking-wide">MFP Collection by Commodity</h3>
            <span className="text-[10px] font-black text-charcoal uppercase bg-golden px-3 py-1">Contribution %</span>
          </div>
          {chartCollLoading ? (
            <div className="h-64 flex items-center justify-center"><PageLoading /></div>
          ) : (
            <CommodityCollectionChart data={chartCollection ?? []} />
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl text-charcoal tracking-wide">Sales, Collection & Processing Trend</h3>
            <span className="text-[10px] font-black text-charcoal uppercase bg-sage px-3 py-1">Last 12 Months</span>
          </div>
          {chartTrendLoading ? (
            <div className="h-72 flex items-center justify-center"><PageLoading /></div>
          ) : (
            <OperationalTrendChart data={chartTrend ?? []} />
          )}
        </div>
      </div>

      {/* Grade-wise + Raw/Processed + Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl text-charcoal tracking-wide">Grade-wise Collection</h3>
            <span className="text-[10px] font-black text-charcoal uppercase bg-sage px-3 py-1">By Commodity</span>
          </div>
          {gradeLoading ? (
            <div className="h-64 flex items-center justify-center"><PageLoading /></div>
          ) : (
            <GradeCollectionChart data={gradeData ?? []} />
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-display text-xl text-charcoal tracking-wide mb-4">Sales by Product Type</h3>
            {productTypeLoading ? (
              <div className="h-48 flex items-center justify-center"><PageLoading /></div>
            ) : (
              <DonutChart
                data={(Array.isArray(productTypeData) ? productTypeData : []).map((p) => ({
                  name: p.productType,
                  value: p.revenue,
                  color: String(p.productType).toLowerCase().includes("raw") ? "#e5ca70" : "#171e19",
                }))}
                height={230}
                currency
              />
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-display text-xl text-charcoal tracking-wide mb-4">Top Customers</h3>
            {customerLoading ? (
              <div className="h-48 flex items-center justify-center"><PageLoading /></div>
            ) : (
              <div className="space-y-3">
                {(Array.isArray(customerData) ? customerData : []).slice(0, 6).map((c, i) => (
                  <div key={c.customer} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-display shrink-0",
                        i < 3 ? "bg-golden text-charcoal" : "bg-gray-100 text-gray-500"
                      )}>
                        {i + 1}
                      </span>
                      <span className="truncate text-charcoal/80">{c.customer}</span>
                    </div>
                    <span className="font-mono text-xs font-semibold text-emerald-600">
                      ₹ {Number(c.revenue ?? 0).toLocaleString()}
                    </span>
                  </div>
                ))}
                {(Array.isArray(customerData) ? customerData : []).length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-6">No customer sales yet</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mandal Performance Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl text-charcoal tracking-wide">Mandal Performance</h3>
          <span className="text-[10px] font-black text-charcoal uppercase bg-sage px-3 py-1">
            {Array.isArray(mandalPerf) ? mandalPerf.length : 0} Mandals
          </span>
        </div>
        {mandalLoading ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8"><PageLoading /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.isArray(mandalPerf) && mandalPerf.map((m) => (
              <div key={m.mandal} className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-display text-lg text-charcoal">{m.mandalName || m.mandal}</h4>
                    <p className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{m.mandal}</p>
                  </div>
                  <span className="text-[10px] font-black text-charcoal bg-golden px-2 py-0.5">
                    {m.vdvks} VDVKs
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Beneficiaries</p>
                    <p className="font-display text-lg text-charcoal">{Number(m.beneficiaries ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Collection</p>
                    <p className="font-display text-lg text-sage-700">{(Number(m.collectionKg ?? 0) / 1000).toFixed(1)} MT</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Revenue</p>
                    <p className="font-display text-lg text-emerald-600">₹ {Number(m.revenue ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Facilities</p>
                    <p className="font-display text-lg text-charcoal">
                      {Number(m.hubs ?? 0)}H · {Number(m.mpc ?? 0)}M · {Number(m.haatBazaars ?? 0)}B
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Commodity Table + Value Split */}
      <div className="grid gap-6 lg:grid-cols-3 items-stretch">
        <div className="lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl text-charcoal tracking-wide">Commodity Performance Ranking</h3>
            <span className="text-[10px] font-black text-charcoal uppercase bg-golden px-3 py-1">
              By MFP Collection
            </span>
          </div>
          {commodityRankLoading ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 flex-1"><PageLoading /></div>
          ) : (
            <div className="flex-1">
              <DataTable columns={rankingColumns} data={commodityRanking.slice(0, 8)} pageSize={8} />
            </div>
          )}
        </div>

        <div className="space-y-6 flex flex-col">
          {/* Value Split */}
          <div className="dark-panel space-y-4 flex-1">
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
      <div className="grid gap-6 lg:grid-cols-2 items-stretch">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl text-charcoal tracking-wide">VDVK Rankings</h3>
            <span className="text-xs text-gray-400 font-mono">{vdvkRankings.length} VDVKs</span>
          </div>
          {vdvkLoading ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 flex-1"><PageLoading /></div>
          ) : (
            <div className="flex-1 min-h-0">
              <DataTable columns={vdvkColumns} data={vdvkRankings} pageSize={10} fillHeight />
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <h3 className="font-display text-xl text-charcoal tracking-wide mb-4">Hub Capacity</h3>
          <div className="bg-white rounded-xl border border-gray-100 p-6 flex-1 flex flex-col min-h-0">
            {hubs.length > 0 ? (
              <div className="space-y-1 overflow-y-auto custom-scrollbar pr-1 -mr-1">
                {hubs.map((hub) => (
                  <div key={hub.code || hub.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-semibold truncate">{hub.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">{hub.vdvks} VDVKs</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-golden to-golden-600 h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(hub.capacity, 100)}%` }} />
                      </div>
                      <span className="text-xs font-mono font-bold text-charcoal w-8 text-right">{hub.capacity}%</span>
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
            {vdvkRankings.length > 0 ? (
              <div className="space-y-3">
                {vdvkRankings.slice(0, 3).map((v) => {
                  const released = v.amountReleased ?? 0;
                  const sanctioned = v.amountSanctioned ?? 0;
                  const pct = sanctioned > 0 ? Math.min(Math.round((released / sanctioned) * 100), 100) : 0;
                  return (
                    <div key={v.code} className="border-b border-gray-50 last:border-0 last:pb-0 py-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-gray-500">{v.code}</span>
                        <span className="font-semibold">{v.name}</span>
                        <span className="font-mono text-emerald-600">₹ {released.toLocaleString()}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-gradient-to-r from-golden to-golden-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-gray-400">
                          {pct}% of ₹ {sanctioned.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No fund data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
