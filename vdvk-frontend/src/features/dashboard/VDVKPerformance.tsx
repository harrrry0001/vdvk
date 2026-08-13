import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api/endpoints/dashboard";
import { KPICard } from "@/components/shared/KPICard";
import { DataTable } from "@/components/shared/DataTable";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import type { ColumnDef } from "@tanstack/react-table";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { BarChart3, Download, AlertTriangle } from "lucide-react";
import { HorizontalBarChart, GroupedBarChart } from "@/components/shared/Charts";

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

export function VDVKPerformancePage() {
  const [rankBy, setRankBy] = useState("Revenue");

  const { data: rawData, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard", "vdvk-performance"],
    queryFn: () => dashboardApi.getVdvkPerformance().then((r) => r.data ?? []),
  });

  const data: VdvkRankingRow[] = useMemo(() => {
    const arr = Array.isArray(rawData) ? rawData : [];
    return arr.map((item, i) => ({
      rank: i + 1,
      code: item.code ?? "",
      name: item.name ?? "",
      mandal: item.mandal ?? "",
      collectionCount: item.collectionCount ?? 0,
      processingCount: item.processingCount ?? 0,
      sales: 0,
      amountReleased: item.amountReleased ?? 0,
      status: "Stable",
    }));
  }, [rawData]);

  const kpis = useMemo(() => {
    if (!data.length) return { avgCollection: 0, avgRevenue: 0, totalVdvks: 0 };
    const total = data.length;
    const totalCollection = data.reduce((s, d) => s + d.collectionCount, 0);
    const totalRevenue = data.reduce((s, d) => s + d.amountReleased, 0);
    return {
      avgCollection: Math.round(totalCollection / total),
      avgRevenue: Math.round(totalRevenue / total),
      totalVdvks: total,
    };
  }, [data]);

  const columns: ColumnDef<VdvkRankingRow>[] = [
    {
      accessorKey: "rank",
      header: "Rank",
      cell: ({ getValue }) => {
        const rank = getValue<number>();
        return (
          <span
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-display",
              rank <= 3
                ? "bg-golden text-charcoal"
                : "bg-gray-100 text-gray-500"
            )}
          >
            #{rank}
          </span>
        );
      },
    },
    { accessorKey: "code", header: "VDVK Code", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
    { accessorKey: "name", header: "VDVK Name", cell: ({ getValue }) => <span className="font-semibold">{getValue<string>()}</span> },
    { accessorKey: "mandal", header: "Mandal" },
    {
      accessorKey: "collectionCount",
      header: "Collections",
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<number>()}</span>,
    },
    {
      accessorKey: "processingCount",
      header: "Processing",
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<number>()}</span>,
    },
    {
      accessorKey: "amountReleased",
      header: "Released (Rs)",
      cell: ({ getValue }) => <span className="font-mono text-xs font-semibold">Rs {Number(getValue()).toLocaleString()}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
          {getValue<string>()}
        </span>
      ),
    },
  ];

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

  const rankOptions = ["Revenue", "Collection", "Sales"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard label="Average Collections" value={kpis.avgCollection.toLocaleString()} accent="yellow" />
        <KPICard label="Avg Released (Rs)" value={`Rs ${kpis.avgRevenue.toLocaleString()}`} accent="green" />
        <KPICard label="Total VDVKs" value={kpis.totalVdvks.toLocaleString()} accent="blue" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-display text-xl text-charcoal tracking-wide mb-2">Top VDVKs by Revenue</h3>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Approved sales revenue</p>
          <HorizontalBarChart
            data={[...data]
              .sort((a, b) => (b.amountReleased || 0) - (a.amountReleased || 0))
              .slice(0, 10)
              .map((v) => ({ name: v.name || v.code, value: v.amountReleased || 0 }))}
            dataKey="value"
            name="Revenue"
            color="#171e19"
            currency
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-display text-xl text-charcoal tracking-wide mb-2">Collection vs Processing</h3>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Transactions per VDVK</p>
          <GroupedBarChart
            data={data.slice(0, 8).map((v) => ({
              name: v.name || v.code,
              Collections: v.collectionCount || 0,
              Processing: v.processingCount || 0,
            }))}
            keys={[
              { key: "Collections", name: "Collections" },
              { key: "Processing", name: "Processing" },
            ]}
            colors={["#e5ca70", "#b7c6c2"]}
            height={300}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold">VDVK Rankings</p>
          </div>
          <div className="flex items-center gap-2">
            {rankOptions.map((option) => (
              <button
                key={option}
                onClick={() => setRankBy(option)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-full transition-colors",
                  rankBy === option
                    ? "bg-charcoal text-golden"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                {option}
              </button>
            ))}
            <button className="btn-secondary ml-4 flex items-center gap-2 text-xs py-1.5">
              <Download className="w-3 h-3" />
              Export CSV
            </button>
          </div>
        </div>
        {data.length > 0 ? (
          <DataTable columns={columns} data={data} pageSize={10} />
        ) : (
          <div className="text-center py-12 text-gray-400 text-sm">No VDVK performance data available</div>
        )}
      </div>
    </div>
  );
}
