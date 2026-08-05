import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { formsApi } from "@/api/endpoints/forms";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { KPICard } from "@/components/shared/KPICard";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { MapPin, Camera, Eye } from "lucide-react";

interface FieldVisit {
  id: string;
  visitDate?: string;
  location?: string;
  gpsCoordinates?: string;
  purpose?: string;
  keyObservations?: string;
  photos?: string[];
  status?: string;
  createdAt?: string;
}

export function FieldVisitMonitoring() {
  const [selectedVisit, setSelectedVisit] = useState<FieldVisit | null>(null);

  const { data: rawData, isLoading, isError } = useQuery({
    queryKey: ["forms", "form12"],
    queryFn: () => formsApi.list("form12").then((r) => r.data ?? []),
  });

  const visits: FieldVisit[] = useMemo(() => {
    return Array.isArray(rawData) ? (rawData as FieldVisit[]) : [];
  }, [rawData]);

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const monthPrefix = useMemo(() => format(new Date(), "yyyy-MM"), []);

  const kpis = useMemo(() => {
    if (!visits.length) {
      return { total: 0, todayVisits: 0, weekVisits: 0, monthVisits: 0, locationsVisited: 0, taggedPhotos: 0 };
    }

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    let todayVisits = 0;
    let weekVisits = 0;
    let monthVisits = 0;
    let taggedPhotos = 0;
    const locations = new Set<string>();

    for (const v of visits) {
      const dateStr = (v.visitDate || v.createdAt || "").slice(0, 10);
      if (dateStr === today) todayVisits++;
      if (dateStr >= format(startOfWeek, "yyyy-MM-dd")) weekVisits++;
      if (dateStr.slice(0, 7) === monthPrefix) monthVisits++;
      if (v.location) locations.add(v.location);
      if (v.gpsCoordinates) {
        taggedPhotos += Array.isArray(v.photos) ? v.photos.length : 0;
      }
    }

    return {
      total: visits.length,
      todayVisits,
      weekVisits,
      monthVisits,
      locationsVisited: locations.size,
      taggedPhotos,
    };
  }, [visits, today, monthPrefix]);

  const columns: ColumnDef<FieldVisit, unknown>[] = [
    {
      accessorKey: "id",
      header: "Visit ID",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{String(getValue() ?? "--")}</span>
      ),
    },
    {
      accessorKey: "visitDate",
      header: "Date",
      cell: ({ row }) => {
        const d = row.original.visitDate || row.original.createdAt;
        if (!d) return "--";
        return format(
          new Date(d + (d.includes("T") ? "" : "T00:00:00")),
          "dd/MM/yyyy"
        );
      },
    },
    {
      accessorKey: "location",
      header: "VDVK / Location",
      cell: ({ getValue }) => (
        <div className="flex items-center gap-1">
          <MapPin size={12} className="text-gray-400" />
          <span className="font-semibold text-sm">{String(getValue() ?? "--")}</span>
        </div>
      ),
    },
    {
      accessorKey: "purpose",
      header: "Purpose",
      cell: ({ getValue }) => <span>{String(getValue() ?? "--")}</span>,
    },
    {
      accessorKey: "gpsCoordinates",
      header: "GPS",
      cell: ({ getValue, row }) => {
        const gps = getValue<string>();
        const hasGps = typeof gps === "string" && gps.length > 0;
        const photos = Array.isArray(row.original.photos) ? row.original.photos.length : 0;
        return (
          <div className="flex items-center gap-1.5">
            <Camera size={14} className="text-gray-400" />
            <span className="font-mono text-xs">{photos || 0}</span>
            {!hasGps && (
              <span className="text-[8px] font-black text-red-500 uppercase">No GPS</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge status={String(getValue() ?? "Draft")} />,
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label="Total Visits" value={kpis.total.toLocaleString()} accent="yellow" />
        <KPICard label="Visits Today" value={kpis.todayVisits.toLocaleString()} accent="green" />
        <KPICard label="This Week" value={kpis.weekVisits.toLocaleString()} accent="blue" />
        <KPICard label="This Month" value={kpis.monthVisits.toLocaleString()} accent="purple" />
        <KPICard label="VDVKs Visited" value={kpis.locationsVisited.toLocaleString()} accent="yellow" />
        <KPICard label="Tagged Photos" value={kpis.taggedPhotos.toLocaleString()} accent="green" />
      </div>

      {visits.length === 0 ? (
        <EmptyState
          title="No Field Visits Logged"
          description="Field visit entries will appear here once logged via Form 12."
        />
      ) : (
        <DataTable columns={columns} data={visits} searchable searchPlaceholder="Search visits..." />
      )}

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
              <h3 className="font-display text-lg text-charcoal">Visit Details — {selectedVisit.id}</h3>
              <button
                onClick={() => setSelectedVisit(null)}
                className="text-gray-400 hover:text-charcoal p-1"
              >
                &times;
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="kpi-label">Date</p>
                <p>
                  {selectedVisit.visitDate
                    ? format(
                        new Date(
                          selectedVisit.visitDate +
                            (selectedVisit.visitDate.includes("T") ? "" : "T00:00:00")
                        ),
                        "dd/MM/yyyy"
                      )
                    : selectedVisit.createdAt
                      ? format(new Date(selectedVisit.createdAt), "dd/MM/yyyy")
                      : "--"}
                </p>
              </div>
              <div>
                <p className="kpi-label">Location</p>
                <p className="font-semibold">{selectedVisit.location ?? "--"}</p>
              </div>
              <div>
                <p className="kpi-label">Purpose</p>
                <p className="font-semibold">{selectedVisit.purpose ?? "--"}</p>
              </div>
              <div>
                <p className="kpi-label">GPS Status</p>
                <p className={selectedVisit.gpsCoordinates ? "text-green-600" : "text-red-500"}>
                  {selectedVisit.gpsCoordinates ? "Tagged" : "Not Tagged"}
                </p>
              </div>
              <div>
                <p className="kpi-label">Photos</p>
                <p>{Array.isArray(selectedVisit.photos) ? selectedVisit.photos.length : 0}</p>
              </div>
              <div>
                <p className="kpi-label">Status</p>
                <StatusBadge status={selectedVisit.status ?? "Draft"} />
              </div>
              {selectedVisit.gpsCoordinates && (
                <div className="col-span-2">
                  <p className="kpi-label">GPS Coordinates</p>
                  <p className="font-mono text-xs">{selectedVisit.gpsCoordinates}</p>
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
