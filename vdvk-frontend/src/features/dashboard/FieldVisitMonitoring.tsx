import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { dashboardApi } from "@/api/endpoints/dashboard";
import { DataTable } from "@/components/shared/DataTable";
import { KPICard } from "@/components/shared/KPICard";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { DonutChart, AreaTrendChart } from "@/components/shared/Charts";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { MapPin, Camera, Eye, Navigation, Clock, Crosshair } from "lucide-react";

interface FieldVisit {
  id: string;
  txnNo?: string;
  visitDate?: string;
  visitStartTime?: string;
  visitEndTime?: string;
  mandal?: string;
  mandalName?: string;
  visitLocationType?: string;
  locationName?: string;
  relatedVdvkCodes?: string[] | null;
  purposeOfVisit?: string;
  visitDescription?: string;
  keyObservations?: string;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  photoCount?: number;
  createdAt?: string;
}

const TYPE_COLORS: Record<string, string> = {
  VDVK: "#171e19",
  Hub: "#ffe17c",
  "Collection Centre": "#e5ca70",
  "Haat Bazaar": "#b7c6c2",
  Beneficiary: "#859892",
  Other: "#ccb464",
};

function hasGps(v: FieldVisit): boolean {
  return typeof v.gpsLatitude === "number" && typeof v.gpsLongitude === "number";
}

function GpsLink({ lat, lon, className }: { lat?: number | null; lon?: number | null; className?: string }) {
  if (typeof lat !== "number" || typeof lon !== "number") {
    return <span className={cn("font-mono text-xs text-gray-400", className)}>No GPS</span>;
  }
  const href = `https://www.google.com/maps?q=${lat},${lon}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Open in Google Maps"
      className={cn(
        "inline-flex items-center gap-1 font-mono text-xs text-emerald-600 hover:text-emerald-700 underline decoration-dotted underline-offset-2",
        className
      )}
    >
      <Navigation size={12} />
      {lat.toFixed(4)}, {lon.toFixed(4)}
    </a>
  );
}

function parseDate(d?: string): Date | null {
  if (!d) return null;
  const dt = new Date(d.includes("T") ? d : `${d}T00:00:00`);
  return isNaN(dt.getTime()) ? null : dt;
}

export function FieldVisitMonitoring() {
  const [selectedVisit, setSelectedVisit] = useState<FieldVisit | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("All");

  const { data: rawData, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "field-visits"],
    queryFn: () => dashboardApi.getFieldVisits().then((r) => r.data ?? []),
  });

  const visits: FieldVisit[] = useMemo(
    () => (Array.isArray(rawData) ? (rawData as FieldVisit[]) : []),
    [rawData]
  );

  const types = useMemo(() => {
    const s = new Set<string>();
    visits.forEach((v) => { if (v.visitLocationType) s.add(v.visitLocationType); });
    return Array.from(s);
  }, [visits]);

  const filtered = useMemo(
    () => (typeFilter === "All" ? visits : visits.filter((v) => v.visitLocationType === typeFilter)),
    [visits, typeFilter]
  );

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const monthPrefix = useMemo(() => format(new Date(), "yyyy-MM"), []);

  const kpis = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    let todayVisits = 0, weekVisits = 0, monthVisits = 0, geoTagged = 0, photos = 0;
    const locations = new Set<string>();
    const mandals = new Set<string>();

    for (const v of visits) {
      const dateStr = (v.visitDate || v.createdAt || "").slice(0, 10);
      if (dateStr === today) todayVisits++;
      if (dateStr >= format(startOfWeek, "yyyy-MM-dd")) weekVisits++;
      if (dateStr.slice(0, 7) === monthPrefix) monthVisits++;
      if (v.locationName) locations.add(v.locationName);
      if (v.mandal) mandals.add(v.mandal);
      if (hasGps(v)) geoTagged++;
      photos += v.photoCount || 0;
    }

    return {
      total: visits.length,
      todayVisits,
      weekVisits,
      monthVisits,
      locationsVisited: locations.size,
      mandalsVisited: mandals.size,
      geoTagged,
      photos,
    };
  }, [visits, today, monthPrefix]);

  const typeDonut = useMemo(() => {
    const counts: Record<string, number> = {};
    visits.forEach((v) => {
      const t = v.visitLocationType || "Other";
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: TYPE_COLORS[name] || "#b7c6c2",
    }));
  }, [visits]);

  const monthlyTrend = useMemo(() => {
    const counts: Record<string, number> = {};
    visits.forEach((v) => {
      const key = (v.visitDate || v.createdAt || "").slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(key)) counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => {
        const [y, m] = month.split("-");
        return { month: `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1]} '${y.slice(2)}`, value };
      });
  }, [visits]);

  const columns: ColumnDef<FieldVisit, unknown>[] = [
    {
      id: "date",
      header: "Date & Time",
      cell: ({ row }) => {
        const d = parseDate(row.original.visitDate || row.original.createdAt);
        return (
          <div>
            <p className="font-semibold text-sm text-charcoal">{d ? format(d, "dd MMM yyyy") : "--"}</p>
            {row.original.visitStartTime && (
              <p className="text-[10px] font-mono text-gray-400">
                {row.original.visitStartTime}
                {row.original.visitEndTime ? `–${row.original.visitEndTime}` : ""}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "location",
      header: "Location",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <MapPin size={12} className="text-gray-400 shrink-0" />
            <span className="font-semibold text-sm truncate">{row.original.locationName || "--"}</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">
            {row.original.mandalName || row.original.mandal || "--"}
          </p>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => {
        const t = row.original.visitLocationType || "Other";
        return (
          <span
            className="inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase rounded-full"
            style={{ backgroundColor: `${TYPE_COLORS[t] || "#b7c6c2"}18`, color: TYPE_COLORS[t] || "#171e19" }}
          >
            {t}
          </span>
        );
      },
    },
    {
      id: "purpose",
      header: "Purpose",
      cell: ({ row }) => <span className="text-sm text-charcoal/80">{row.original.purposeOfVisit || "--"}</span>,
    },
    {
      id: "gps",
      header: "GPS",
      cell: ({ row }) => (
        <GpsLink lat={row.original.gpsLatitude} lon={row.original.gpsLongitude} />
      ),
    },
    {
      id: "photos",
      header: "Photos",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Camera size={14} className="text-gray-400" />
          <span className="font-mono text-xs">{row.original.photoCount || 0}</span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          onClick={() => setSelectedVisit(row.original)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-charcoal"
        >
          <Eye size={16} />
        </button>
      ),
    },
  ];

  if (isLoading) return <PageLoading />;

  if (isError) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="font-display text-4xl tracking-tight text-charcoal">Field Visit Monitoring</h2>
          <p className="text-charcoal/50 text-sm font-medium uppercase tracking-[0.2em] mt-1">APM Visit Logs & Geo-Tagged Observations</p>
        </div>
        <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center">
          <p className="text-red-600 font-semibold">Failed to load field visit data.</p>
          <p className="text-red-400 text-sm mt-1">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-4xl tracking-tight text-charcoal">Field Visit Monitoring</h2>
        <p className="text-charcoal/50 text-sm font-medium uppercase tracking-[0.2em] mt-1">APM Visit Logs & Geo-Tagged Observations</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <KPICard label="Total Visits" value={kpis.total.toLocaleString()} accent="yellow" />
        <KPICard label="Today" value={kpis.todayVisits.toLocaleString()} accent="green" />
        <KPICard label="This Week" value={kpis.weekVisits.toLocaleString()} accent="blue" />
        <KPICard label="This Month" value={kpis.monthVisits.toLocaleString()} accent="purple" />
        <KPICard label="Locations" value={kpis.locationsVisited.toLocaleString()} accent="yellow" />
        <KPICard label="Mandals" value={kpis.mandalsVisited.toLocaleString()} accent="green" />
        <KPICard label="Geo-Tagged" value={kpis.geoTagged.toLocaleString()} accent="blue" />
        <KPICard label="Photos" value={kpis.photos.toLocaleString()} accent="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="font-display text-xl text-charcoal tracking-wide">Visit Register</h3>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Field observations</p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setTypeFilter("All")}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-full transition-colors",
                  typeFilter === "All" ? "bg-charcoal text-golden" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                All
              </button>
              {types.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-full transition-colors",
                    typeFilter === t ? "bg-charcoal text-golden" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No Field Visits Logged"
              description="Field visit entries will appear here once logged via Form 12."
            />
          ) : (
            <DataTable
              columns={columns}
              data={filtered}
              searchable
              searchPlaceholder="Search visits..."
            />
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-display text-xl text-charcoal tracking-wide mb-2">Visits by Location Type</h3>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Distribution</p>
            <DonutChart data={typeDonut} height={240} />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-display text-xl text-charcoal tracking-wide mb-2">Visits Trend</h3>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Monthly volume</p>
            <AreaTrendChart data={monthlyTrend} name="Visits" color="#e5ca70" height={200} />
          </div>
        </div>
      </div>

      {selectedVisit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedVisit(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display text-lg text-charcoal">Visit Details</h3>
                <p className="text-[10px] font-mono text-gray-400">{selectedVisit.txnNo || selectedVisit.id}</p>
              </div>
              <button
                onClick={() => setSelectedVisit(null)}
                className="text-gray-400 hover:text-charcoal p-1"
              >
                &times;
              </button>
            </div>

            <div className="flex items-center gap-2 mb-5">
              <span
                className="inline-flex items-center px-2.5 py-1 text-[10px] font-black uppercase rounded-full"
                style={{ backgroundColor: `${TYPE_COLORS[selectedVisit.visitLocationType || "Other"] || "#b7c6c2"}18`, color: TYPE_COLORS[selectedVisit.visitLocationType || "Other"] || "#171e19" }}
              >
                {selectedVisit.visitLocationType || "Other"}
              </span>
              {hasGps(selectedVisit) && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase">
                  <Crosshair size={11} /> Geo-Tagged
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="kpi-label">Date</p>
                <p className="font-semibold">
                  {(() => {
                    const d = parseDate(selectedVisit.visitDate || selectedVisit.createdAt);
                    return d ? format(d, "dd/MM/yyyy") : "--";
                  })()}
                </p>
              </div>
              <div>
                <p className="kpi-label">Time</p>
                <p className="font-semibold flex items-center gap-1">
                  <Clock size={13} className="text-gray-400" />
                  {selectedVisit.visitStartTime || "--"}
                  {selectedVisit.visitEndTime ? `–${selectedVisit.visitEndTime}` : ""}
                </p>
              </div>
              <div className="col-span-2">
                <p className="kpi-label">Location</p>
                <p className="font-semibold flex items-center gap-1.5">
                  <MapPin size={13} className="text-gray-400" />
                  {selectedVisit.locationName || "--"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedVisit.mandalName || selectedVisit.mandal || "--"} Mandal
                </p>
              </div>
              <div className="col-span-2">
                <p className="kpi-label">Purpose</p>
                <p className="font-semibold">{selectedVisit.purposeOfVisit || "--"}</p>
              </div>
              <div>
                <p className="kpi-label">Photos</p>
                <p>{selectedVisit.photoCount || 0}</p>
              </div>
              <div>
                <p className="kpi-label">Related VDVKs</p>
                <p className="font-mono text-xs">
                  {Array.isArray(selectedVisit.relatedVdvkCodes) && selectedVisit.relatedVdvkCodes.length
                    ? selectedVisit.relatedVdvkCodes.join(", ")
                    : "--"}
                </p>
              </div>
              {hasGps(selectedVisit) && (
                <div className="col-span-2">
                  <p className="kpi-label flex items-center gap-1">
                    <Navigation size={12} className="text-gray-400" /> GPS Coordinates
                  </p>
                  <GpsLink lat={selectedVisit.gpsLatitude} lon={selectedVisit.gpsLongitude} />
                </div>
              )}
              {selectedVisit.visitDescription && (
                <div className="col-span-2">
                  <p className="kpi-label">Description</p>
                  <p className="text-charcoal/70">{selectedVisit.visitDescription}</p>
                </div>
              )}
              {selectedVisit.keyObservations && (
                <div className="col-span-2">
                  <p className="kpi-label">Key Observations</p>
                  <p className="text-charcoal/70">{selectedVisit.keyObservations}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
