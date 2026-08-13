import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api/endpoints/dashboard";
import { KPICard } from "@/components/shared/KPICard";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { AlertTriangle } from "lucide-react";
import { DonutChart, VerticalBarChart, HorizontalBarChart } from "@/components/shared/Charts";

const WARRANTY_COLORS: Record<string, string> = {
  valid: "#171e19",
  expiring: "#ffe17c",
  expired: "#e0655a",
  noWarranty: "#d3d8d6",
};

export function AssetsMachinery() {
  const { data: machineryRaw, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard", "machinery-summary"],
    queryFn: () => dashboardApi.getMachinerySummary().then((r) => r.data),
  });

  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError, refetch: analyticsRefetch } = useQuery({
    queryKey: ["dashboard", "machinery-analytics"],
    queryFn: () => dashboardApi.getMachineryAnalytics().then((r) => r.data),
  });

  if (isLoading || analyticsLoading) return <PageLoading />;

  if (isError || analyticsError)
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-red-500 font-semibold">Failed to load data</p>
          <button onClick={() => { refetch(); analyticsRefetch(); }} className="mt-2 text-sm text-charcoal underline">
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

  const statusDonut = Object.entries(stats).map(([name, value]) => ({ name, value }));

  const funding = Array.isArray(analytics?.fundingSource) ? analytics.fundingSource : [];
  const fundingBars = (funding as { source?: string; cost: number }[])
    .filter((f) => f.cost > 0)
    .map((f) => ({ name: f.source || "Unspecified", value: f.cost }));

  const byMandal = Array.isArray(analytics?.byMandal) ? analytics.byMandal : [];
  const mandalBars = (byMandal as { mandal?: string; mandalName?: string; count: number }[])
    .filter((m) => m.count > 0)
    .map((m) => ({ name: m.mandalName || m.mandal, value: m.count }));

  const warranty = analytics?.warranty ?? { expired: 0, expiring: 0, valid: 0, noWarranty: 0 };
  const warrantyData = [
    { name: "Under Warranty", value: warranty.valid, color: WARRANTY_COLORS.valid },
    { name: "Expiring Soon", value: warranty.expiring, color: WARRANTY_COLORS.expiring },
    { name: "Expired", value: warranty.expired, color: WARRANTY_COLORS.expired },
    { name: "No Warranty", value: warranty.noWarranty, color: WARRANTY_COLORS.noWarranty },
  ];

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status distribution */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-display text-xl text-charcoal tracking-wide mb-2">Asset Status</h3>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Current deployment state</p>
          <DonutChart data={statusDonut} height={230} />
        </div>

        {/* Warranty health */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-display text-xl text-charcoal tracking-wide mb-2">Warranty Health</h3>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Coverage &amp; expiry outlook</p>
          <DonutChart data={warrantyData} height={230} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Asset value by funding source */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-display text-xl text-charcoal tracking-wide mb-2">Asset Value by Funding Source</h3>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Total cost contribution</p>
          <VerticalBarChart data={fundingBars} dataKey="value" name="Value" color="#171e19" currency height={280} />
        </div>

        {/* Assets by mandal */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-display text-xl text-charcoal tracking-wide mb-2">Machinery by Mandal</h3>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Deployment footprint</p>
          <HorizontalBarChart data={mandalBars} dataKey="value" name="Machinery" color="#e5ca70" height={Math.max(160, mandalBars.length * 34)} />
        </div>
      </div>
    </div>
  );
}
