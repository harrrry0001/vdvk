import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const PALETTE = ["#171e19", "#ffe17c", "#b7c6c2", "#e5ca70", "#859892", "#ccb464", "#1e2622"];

interface CommoditySlice {
  commodityName: string;
  totalKg: number;
  totalPcs: number;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

/**
 * Donut chart of MFP collection contribution (%) by commodity.
 * Uses Kg when the commodity is weight-based, otherwise Pieces.
 */
export function CommodityCollectionChart({ data }: { data: CommoditySlice[] }) {
  const slices = (data ?? [])
    .map((d) => {
      const isWeightBased = d.totalKg > 0;
      const value = isWeightBased ? d.totalKg : d.totalPcs;
      return { name: d.commodityName, value, unit: isWeightBased ? "Kg" : "Pcs" };
    })
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  if (slices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400 uppercase tracking-widest font-bold">
        No collection data
      </div>
    );
  }

  const top = slices.slice(0, 6);
  const restValue = slices.slice(6).reduce((s, d) => s + d.value, 0);
  const chartData = restValue > 0 ? [...top, { name: "Others", value: restValue, unit: "" }] : top;
  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => `${formatCompact(Number(value ?? 0))} (${total ? Math.round((Number(value ?? 0) / total) * 100) : 0}%)`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 space-y-2">
        {chartData.map((d, i) => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
              <span className="text-charcoal/70">{d.name}</span>
            </div>
            <span className="font-mono text-xs font-semibold text-charcoal">
              {formatCompact(d.value)} {d.unit}
              {total ? ` · ${Math.round((d.value / total) * 100)}%` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TrendPoint {
  month: string;
  collectionKg: number;
  processingKg: number;
  revenue: number;
  salesKg: number;
}

/**
 * Time-series comparison graph: MFP Collection, Processing (Kg) and Sales
 * Revenue (₹) bucketed by month — supports Last Month / Week / Type views.
 */
export function OperationalTrendChart({ data }: { data: TrendPoint[] }) {
  const rows = data ?? [];
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400 uppercase tracking-widest font-bold">
        No operational data
      </div>
    );
  }

  const maxKg = Math.max(
    ...rows.map((r) => Math.max(r.collectionKg, r.processingKg, 0)),
    1
  );
  const maxRevenue = Math.max(...rows.map((r) => r.revenue ?? 0), 1);

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="qty"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCompact}
            domain={[0, maxKg]}
          />
          <YAxis
            yAxisId="rev"
            orientation="right"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatCompact(v)}
            domain={[0, maxRevenue]}
          />
          <Tooltip
            formatter={(value, name) => {
              const v = Number(value ?? 0);
              if (name === "Revenue") return [`₹ ${formatCompact(v)}`, name];
              return [formatCompact(v), name];
            }}
          />
          <Bar yAxisId="qty" dataKey="collectionKg" name="Collection (Kg)" fill="#b7c6c2" radius={[3, 3, 0, 0]} />
          <Bar yAxisId="qty" dataKey="processingKg" name="Processing (Kg)" fill="#e5ca70" radius={[3, 3, 0, 0]} />
          <Line yAxisId="rev" dataKey="revenue" name="Revenue" stroke="#171e19" strokeWidth={2.5} dot={{ r: 3, fill: "#171e19" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
