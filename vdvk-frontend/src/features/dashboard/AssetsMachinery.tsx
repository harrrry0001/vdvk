import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api/endpoints/dashboard";
import { KPICard } from "@/components/shared/KPICard";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { AlertTriangle } from "lucide-react";

export function AssetsMachinery() {
  const { data: machineryRaw, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard", "machinery-summary"],
    queryFn: () => dashboardApi.getMachinerySummary().then((r) => r.data),
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

  const stats: Record<string, number> = {};
  if (Array.isArray(machineryRaw)) {
    machineryRaw.forEach((item: { status: string; count: number }) => {
      stats[item.status] = item.count;
    });
  }

  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const available = stats["Available"] ?? 0;
  const inUse = stats["In Use"] ?? 0;
  const underMaintenance = stats["Under Maintenance"] ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-4xl tracking-tight text-charcoal">Assets &amp; Machinery</h2>
        <p className="text-charcoal/50 text-sm font-medium uppercase tracking-[0.2em] mt-1">Asset Inventory &amp; Maintenance Tracking</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total Machinery" value={total.toLocaleString()} accent="yellow" />
        <KPICard label="Available" value={available.toLocaleString()} accent="green" />
        <KPICard label="In Use" value={inUse.toLocaleString()} accent="blue" />
        <KPICard label="Under Maintenance" value={underMaintenance.toLocaleString()} accent="red" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
        <p className="text-sm text-gray-500">
          Individual machinery details available in MDA Machinery Management
        </p>
      </div>
    </div>
  );
}
