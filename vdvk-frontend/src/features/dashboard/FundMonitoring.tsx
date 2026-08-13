import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api/endpoints/dashboard";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { type ColumnDef } from "@tanstack/react-table";
import { Banknote, TrendingUp, Send, Wallet, AlertTriangle, Package, Factory } from "lucide-react";

interface FundMonitoringResponse {
  totalSanctioned: number;
  totalReleased: number;
  totalExpenditure: number;
  balance: number;
  totalRevenue: number;
  totalCollectionKg: number;
  totalProcessingKg: number;
  vdvkBreakdown: VdvkFundRow[];
}

interface VdvkFundRow {
  code: string;
  name: string;
  scheme: string;
  sanctioned: number;
  released: number;
  revenue?: number;
  collectionKg?: number;
  processingKg?: number;
  utilised?: number;
  balance?: number;
}

function formatLakhs(n: number): string {
  const lakhs = n / 100000;
  if (lakhs >= 100) {
    return `${(lakhs / 100).toFixed(2)} Cr`;
  }
  return `${lakhs.toFixed(2)} L`;
}

export function FundMonitoring() {
  const { data, isLoading, isError, refetch } = useQuery<FundMonitoringResponse>({
    queryKey: ["dashboard", "fund-monitoring"],
    queryFn: () => dashboardApi.getFundMonitoring().then((r) => r.data),
  });

  if (isLoading) return <PageLoading />;

  if (isError)
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-red-500 font-semibold">Failed to load data</p>
          <button onClick={() => refetch()} className="mt-2 text-sm text-charcoal underline">
            Retry
          </button>
        </div>
      </div>
    );

  const totalSanctioned = data?.totalSanctioned ?? 0;
  const totalReleased = data?.totalReleased ?? 0;
  const totalExpenditure = data?.totalExpenditure ?? 0;
  const balance = data?.balance ?? 0;
  const totalRevenue = data?.totalRevenue ?? 0;
  const totalCollectionKg = data?.totalCollectionKg ?? 0;
  const totalProcessingKg = data?.totalProcessingKg ?? 0;
  const breakdown = data?.vdvkBreakdown ?? [];

  const releasePercent =
    totalSanctioned > 0 ? Math.round((totalReleased / totalSanctioned) * 100) : 0;
  const utilisationPercent =
    totalReleased > 0 ? Math.round((totalExpenditure / totalReleased) * 100) : 0;
  const balancePercent =
    totalReleased > 0 ? Math.round((balance / totalReleased) * 100) : 0;

  const vdvkColumns: ColumnDef<VdvkFundRow>[] = [
    {
      accessorKey: "code",
      header: "VDVK Code",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs font-semibold">{getValue<string>()}</span>
      ),
    },
    { accessorKey: "name", header: "VDVK Name" },
    { accessorKey: "scheme", header: "Scheme", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
    {
      accessorKey: "sanctioned",
      header: "Sanctioned",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{formatLakhs(getValue<number>())}</span>
      ),
    },
    {
      accessorKey: "revenue",
      header: "Sales Revenue",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs font-semibold text-emerald-600">
          {formatLakhs(Number(getValue<number>() ?? 0))}
        </span>
      ),
    },
    {
      accessorKey: "collectionKg",
      header: "Collection (Kg)",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{Number(getValue<number>() ?? 0).toLocaleString()}</span>
      ),
    },
    {
      accessorKey: "processingKg",
      header: "Processing (Kg)",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{Number(getValue<number>() ?? 0).toLocaleString()}</span>
      ),
    },
    {
      accessorKey: "utilised",
      header: "Utilised",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-sage-700">{formatLakhs(Number(getValue<number>() ?? 0))}</span>
      ),
    },
    {
      accessorKey: "balance",
      header: "Balance Fund",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs font-semibold text-charcoal">{formatLakhs(Number(getValue<number>() ?? 0))}</span>
      ),
    },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-5xl tracking-tight text-charcoal">
          FUND MONITORING
        </h1>
        <p className="text-charcoal/50 text-sm font-medium uppercase tracking-[0.3em] mt-2">
          ITDA Paderu &mdash; Financial Overview
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border-t-4 border-charcoal p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-widest">
              Total Sanctioned
            </p>
            <Banknote className="w-5 h-5 text-charcoal/20" />
          </div>
          <h3 className="font-display text-4xl mb-4 text-charcoal">
            {formatLakhs(totalSanctioned)}
          </h3>
          <div className="h-1 w-full bg-gray-100">
            <div className="h-full bg-charcoal" style={{ width: "100%" }} />
          </div>
        </div>

        <div className="bg-white border-t-4 border-golden p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-widest">
              Total Released
            </p>
            <Send className="w-5 h-5 text-golden" />
          </div>
          <h3 className="font-display text-4xl mb-4 text-charcoal">
            {formatLakhs(totalReleased)}
          </h3>
          <div className="h-1 w-full bg-gray-100">
            <div
              className="h-full bg-golden"
              style={{ width: `${releasePercent}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] font-bold text-gray-400">
            {releasePercent}% of Sanctioned
          </p>
        </div>

        <div className="bg-white border-t-4 border-sage p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-widest">
              Total Expenditure
            </p>
            <TrendingUp className="w-5 h-5 text-sage" />
          </div>
          <h3 className="font-display text-4xl mb-4 text-charcoal">
            {formatLakhs(totalExpenditure)}
          </h3>
          <div className="h-1 w-full bg-gray-100">
            <div
              className="h-full bg-sage"
              style={{ width: `${utilisationPercent}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] font-bold text-gray-400">
            {utilisationPercent}% of Released
          </p>
        </div>

        <div className="bg-charcoal border-t-4 border-golden p-6 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-golden/40 uppercase tracking-widest">
              Balance
            </p>
            <Wallet className="w-5 h-5 text-golden" />
          </div>
          <h3 className="font-display text-4xl mb-4 text-golden">
            {formatLakhs(balance)}
          </h3>
          <div className="h-1 w-full bg-white/10">
            <div
              className="h-full bg-white"
              style={{ width: `${balancePercent}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] font-bold text-golden/60">
            Unspent Balance
          </p>
        </div>
      </div>

      {/* Operational KPI Row: Revenue, Collection, Processing */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border-t-4 border-emerald-500 p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-widest">
              Total Sales Revenue
            </p>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <h3 className="font-display text-4xl mb-4 text-charcoal">
            {formatLakhs(totalRevenue)}
          </h3>
          <p className="text-[10px] font-bold text-gray-400">Approved Form 4 Sales</p>
        </div>

        <div className="bg-white border-t-4 border-sage p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-widest">
              Total MFP Collection
            </p>
            <Package className="w-5 h-5 text-sage" />
          </div>
          <h3 className="font-display text-4xl mb-4 text-charcoal">
            {(totalCollectionKg / 1000).toFixed(1)} MT
          </h3>
          <p className="text-[10px] font-bold text-gray-400">
            {totalCollectionKg.toLocaleString()} Kg Approved Form 1
          </p>
        </div>

        <div className="bg-white border-t-4 border-golden p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-widest">
              Total Processing
            </p>
            <Factory className="w-5 h-5 text-golden-600" />
          </div>
          <h3 className="font-display text-4xl mb-4 text-charcoal">
            {(totalProcessingKg / 1000).toFixed(1)} MT
          </h3>
          <p className="text-[10px] font-bold text-gray-400">
            {totalProcessingKg.toLocaleString()} Kg Approved Form 3
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white p-8 border border-charcoal/5 shadow-sm">
          <h4 className="font-display text-2xl mb-8 border-b-2 border-golden pb-2 inline-block">
            Fund Summary
          </h4>
          <div className="space-y-6">
            {[
              { label: "Total VDVKs", value: breakdown.length.toLocaleString() },
              {
                label: "Overall Release Rate",
                value: `${releasePercent}%`,
              },
              {
                label: "Overall Utilisation",
                value: `${utilisationPercent}%`,
              },
              {
                label: "Unspent Balance",
                value: formatLakhs(balance),
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
              >
                <span className="text-sm font-medium text-charcoal/70">
                  {item.label}
                </span>
                <span className="font-mono text-sm font-bold text-charcoal">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="dark-panel space-y-6">
          <h4 className="font-display text-2xl text-golden">Quick Stats</h4>
          <div className="space-y-8">
            <div>
              <div className="flex justify-between mb-2 text-[10px] font-black uppercase tracking-widest text-white/40">
                <span>Release Progress</span>
                <span>{releasePercent}%</span>
              </div>
              <div className="h-4 bg-white/5">
                <div
                  className="h-full bg-golden"
                  style={{ width: `${releasePercent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-golden font-bold">
                {formatLakhs(totalReleased)} / {formatLakhs(totalSanctioned)}
              </p>
            </div>
            <div>
              <div className="flex justify-between mb-2 text-[10px] font-black uppercase tracking-widest text-white/40">
                <span>Expenditure Progress</span>
                <span>{utilisationPercent}%</span>
              </div>
              <div className="h-4 bg-white/5">
                <div
                  className="h-full bg-sage"
                  style={{ width: `${utilisationPercent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-sage font-bold">
                {formatLakhs(totalExpenditure)} / {formatLakhs(totalReleased)}
              </p>
            </div>
          </div>

          {balance > 0 && (
            <div className="mt-8 p-4 border border-white/10 bg-white/5">
              <div className="flex items-start gap-3">
                <Wallet className="w-5 h-5 text-golden shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                    Available Balance
                  </p>
                  <p className="text-sm text-golden font-bold mt-1">
                    {formatLakhs(balance)}
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Unutilised funds available for disbursement
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {breakdown.length === 0 ? (
        <EmptyState title="No VDVK fund data available" />
      ) : (
        <div className="bg-white border border-charcoal/5 shadow-sm overflow-hidden">
          <div className="bg-charcoal px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h4 className="font-display text-2xl tracking-tight text-golden">
              VDVK-wise Fund Status
            </h4>
          </div>
          <DataTable
            columns={vdvkColumns}
            data={breakdown}
            pageSize={10}
            className="border-0 rounded-none"
          />
        </div>
      )}
    </div>
  );
}
