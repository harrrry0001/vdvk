import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ComposedChart,
  Bar,
  BarChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  RadialBarChart,
  RadialBar,
  Area,
  AreaChart,
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

function currency(n: number): string {
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

/**
 * Donut chart of MFP collection contribution (%) by commodity.
 * Uses Kg when the commodity is weight-based, otherwise Pieces.
 */
export function CommodityCollectionChart({ data, fill = false }: { data: CommoditySlice[]; fill?: boolean }) {
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
      <div className="flex items-center justify-center flex-1 min-h-64 text-sm text-gray-400 uppercase tracking-widest font-bold">
        No collection data
      </div>
    );
  }

  const top = slices.slice(0, 6);
  const restValue = slices.slice(6).reduce((s, d) => s + d.value, 0);
  const chartData = restValue > 0 ? [...top, { name: "Others", value: restValue, unit: "" }] : top;
  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className={fill ? "flex flex-1 flex-col min-h-0" : "flex flex-col"}>
      <div className={fill ? "flex-1 min-h-64" : "h-64"}>
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

// ─── GENERIC DONUT ───────────────────────────────────────────────────────
// Data: [{ name, value, unit?, color? }]. Renders a labelled donut + legend.
export function DonutChart({ data, height = 220, currency: asCurrency = false, fill = false }: {
  data: { name: string; value: number; unit?: string; color?: string }[];
  height?: number;
  currency?: boolean;
  fill?: boolean;
}) {
  const slices = (data ?? [])
    .map((d) => ({ ...d, value: Number(d.value) || 0 }))
    .filter((d) => d.value > 0);
  if (slices.length === 0) {
    return <EmptyChart label="No data" height={height} fill={fill} />;
  }
  const total = slices.reduce((s, d) => s + d.value, 0);
  const fmt = (v: number) => (asCurrency ? currency(v) : formatCompact(v));
  return (
    <div className={fill ? "flex flex-1 flex-col min-h-0" : ""}>
      <div className={fill ? "flex-1 min-h-48" : ""} style={fill ? {} : { height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
            >
              {slices.map((d, i) => (
                <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${fmt(Number(value ?? 0))} (${total ? Math.round((Number(value ?? 0) / total) * 100) : 0}%)`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 space-y-2">
        {slices.map((d, i) => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color || PALETTE[i % PALETTE.length] }} />
              <span className="text-charcoal/70 capitalize">{d.name}</span>
            </div>
            <span className="font-mono text-xs font-semibold text-charcoal">
              {fmt(d.value)} {d.unit || ""} · {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GENERIC VERTICAL BAR ────────────────────────────────────────────────
export function VerticalBarChart({ data, dataKey, name, xKey = "name", color = "#171e19", currency: asCurrency = false, height = 260 }: {
  data: Record<string, unknown>[];
  dataKey: string;
  name: string;
  xKey?: string;
  color?: string;
  currency?: boolean;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return <EmptyChart label="No data" height={height} />;
  }
  const fmt = (v: number) => (asCurrency ? currency(v) : formatCompact(v));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmt(v)} />
          <Tooltip formatter={(value) => [fmt(Number(value ?? 0)), name]} cursor={{ fill: "#ffe17c14" }} />
          <Bar dataKey={dataKey} name={name} fill={color} radius={[6, 6, 0, 0]} maxBarSize={46} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── GENERIC HORIZONTAL BAR ──────────────────────────────────────────────
// Renders from smallest to largest (top value last = near axis).
export function HorizontalBarChart({ data, dataKey, name, xKey = "name", color = "#171e19", currency: asCurrency = false, height }: {
  data: Record<string, unknown>[];
  dataKey: string;
  name: string;
  xKey?: string;
  color?: string;
  currency?: boolean;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return <EmptyChart label="No data" height={height} />;
  }
  const sorted = [...data].sort((a, b) => Number(a[dataKey]) - Number(b[dataKey]));
  const h = height || Math.max(120, sorted.length * 38 + 20);
  const fmt = (v: number) => (asCurrency ? currency(v) : formatCompact(v));
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 20, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmt(v)} />
          <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11, fill: "#4b5563" }} tickLine={false} axisLine={false} width={120} />
          <Tooltip formatter={(value) => [fmt(Number(value ?? 0)), name]} cursor={{ fill: "#ffe17c14" }} />
          <Bar dataKey={dataKey} name={name} fill={color} radius={[0, 6, 6, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── GROUPED BAR ─────────────────────────────────────────────────────────
export function GroupedBarChart({ data, keys, xKey = "name", colors, currency: asCurrency = false, height = 280 }: {
  data: Record<string, unknown>[];
  keys: { key: string; name: string }[];
  xKey?: string;
  colors: string[];
  currency?: boolean;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return <EmptyChart label="No data" height={height} />;
  }
  const fmt = (v: number) => (asCurrency ? currency(v) : formatCompact(v));
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmt(v)} />
            <Tooltip formatter={(value, key) => [fmt(Number(value ?? 0)), key]} cursor={{ fill: "#ffe17c14" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {keys.map((k, i) => (
              <Bar key={k.key} dataKey={k.key} name={k.name} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} maxBarSize={26} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── RADIAL GAUGE ────────────────────────────────────────────────────────
export function RadialGaugeChart({ value, label, color = "#ffe17c", max = 100 }: {
  value: number;
  label: string;
  color?: string;
  max?: number;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const data = [{ name: label, value: pct, fill: color }];
  return (
    <div className="text-center">
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="62%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <RadialBar dataKey="value" cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <p className="font-display text-2xl text-charcoal -mt-8">{pct}%</p>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  );
}

// ─── AREA CHART ──────────────────────────────────────────────────────────
function EmptyChart({ label, height = 220, fill = false }: { label: string; height?: number; fill?: boolean }) {
  return (
    <div
      style={fill ? {} : { height }}
      className="flex items-center justify-center flex-1 min-h-48 text-sm text-gray-400 uppercase tracking-widest font-bold"
    >
      {label}
    </div>
  );
}

// ─── AREA TREND CHART ────────────────────────────────────────────────────
// Smooth filled area for time-series (visits over months, collection volume,
// revenue). Data: [{ month, value }].
export function AreaTrendChart({ data, dataKey = "value", name, xKey = "month", color = "#e5ca70", height = 240 }: {
  data: Record<string, unknown>[];
  dataKey?: string;
  name: string;
  xKey?: string;
  color?: string;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return <EmptyChart label="No data" height={height} />;
  }
  const gradId = `grad-${dataKey.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCompact(v)} />
          <Tooltip />
          <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2.5} fill={`url(#${gradId})`} dot={{ r: 3, fill: color }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── GRADE-WISE COLLECTION STACKED BAR ───────────────────────────────────
// Aggregates commodity-grade collection rows into one stacked bar per
// commodity, with a grade (A, B, C ...) per stack.
export function GradeCollectionChart({ data, height = 280 }: {
  data: { commodityCode: string; commodityName: string; grade: string; collectionKg: number; value: number }[];
  height?: number;
}) {
  const rows = data ?? [];
  if (rows.length === 0) {
    return <EmptyChart label="No grade data" height={height} />;
  }

  // Group grades per commodity
  const commodityMap = new Map<string, { name: string; grades: Map<string, number> }>();
  rows.forEach((r) => {
    let c = commodityMap.get(r.commodityCode);
    if (!c) {
      c = { name: r.commodityName || r.commodityCode, grades: new Map() };
      commodityMap.set(r.commodityCode, c);
    }
    const v = Number(r.collectionKg) || 0;
    c.grades.set(r.grade, (c.grades.get(r.grade) || 0) + v);
  });

  // All grades present, sorted naturally
  const allGrades = Array.from(new Set(rows.map((r) => r.grade)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const chartData = Array.from(commodityMap.values()).map((c) => {
    const row: Record<string, unknown> = { name: c.name };
    allGrades.forEach((g) => { row[`Grade ${g}`] = c.grades.get(g) || 0; });
    return row;
  });

  const stackKeys = allGrades.map((g) => ({ key: `Grade ${g}`, name: `Grade ${g}` }));
  const colors = ["#171e19", "#ffe17c", "#b7c6c2", "#e5ca70", "#859892", "#ccb464", "#1e2622"];

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} interval={0} angle={-18} textAnchor="end" height={48} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCompact(v)} />
            <Tooltip cursor={{ fill: "#ffe17c14" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {stackKeys.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={colors[i % colors.length]} radius={i === stackKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} maxBarSize={46} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
