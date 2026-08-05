import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formsApi } from "@/api/endpoints/forms";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { KPICard } from "@/components/shared/KPICard";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { type ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { GraduationCap, Plus, Calendar, Users, MapPin, Clock } from "lucide-react";

interface TrainingRecord {
  id: string;
  title: string;
  date: string;
  venue: string;
  trainer: string;
  participants: number;
  vdvks: number;
  budget: number;
  topics: string;
  status: string;
}

interface TrainingFormData {
  title: string;
  date: string;
  duration: string;
  venue: string;
  trainer: string;
  participants: string;
  budget: string;
  vdvks: string;
  topics: string;
}

const emptyForm: TrainingFormData = {
  title: "",
  date: "",
  duration: "",
  venue: "",
  trainer: "",
  participants: "",
  budget: "",
  vdvks: "",
  topics: "",
};

const statusFilters = ["All", "Completed", "Upcoming"];

export function TrainingManagement() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TrainingFormData>(emptyForm);

  const {
    data: rawData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["forms", "form9"],
    queryFn: () => formsApi.list("form9").then((r) => r.data ?? []),
  });

  const trainingData: TrainingRecord[] = useMemo(() => {
    const arr = Array.isArray(rawData) ? rawData : [];
    return arr.map((item: Record<string, unknown>) => ({
      id: (item.id as string) ?? (item._id as string) ?? "",
      title: (item.title as string) ?? (item.trainingTitle as string) ?? "",
      date: (item.date as string) ?? (item.trainingDate as string) ?? "",
      venue: (item.venue as string) ?? "",
      trainer: (item.trainer as string) ?? (item.trainerName as string) ?? "",
      participants: (item.participants as number) ?? (item.participantCount as number) ?? 0,
      vdvks: (item.vdvks as number) ?? (item.vdvksCovered as number) ?? 0,
      budget: (item.budget as number) ?? 0,
      topics: (item.topics as string) ?? "",
      status: (item.status as string) ?? "Upcoming",
    }));
  }, [rawData]);

  const kpis = useMemo(() => {
    if (!trainingData.length) return { total: 0, completed: 0, upcoming: 0, totalParticipants: 0 };
    return {
      total: trainingData.length,
      completed: trainingData.filter((t) => t.status === "Completed").length,
      upcoming: trainingData.filter((t) => t.status === "Upcoming").length,
      totalParticipants: trainingData.reduce((s, t) => s + t.participants, 0),
    };
  }, [trainingData]);

  const filtered = trainingData.filter(
    (t) => activeFilter === "All" || t.status === activeFilter,
  );

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => formsApi.create("form9", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form9"] });
      setShowForm(false);
      setForm(emptyForm);
    },
  });

  const handleFormChange = (field: keyof TrainingFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!form.title || !form.date) return;
    createMutation.mutate({
      title: form.title,
      date: form.date,
      duration: Number(form.duration) || 0,
      venue: form.venue,
      trainer: form.trainer,
      participants: Number(form.participants) || 0,
      budget: Number(form.budget) || 0,
      vdvks: Number(form.vdvks) || 0,
      topics: form.topics,
    });
  };

  const columns: ColumnDef<TrainingRecord, unknown>[] = [
    {
      accessorKey: "id",
      header: "Session ID",
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
    },
    {
      accessorKey: "title",
      header: "Training Title",
      cell: ({ getValue }) => <span className="font-semibold text-sm">{getValue<string>()}</span>,
    },
    { accessorKey: "date", header: "Date" },
    { accessorKey: "venue", header: "Venue" },
    {
      accessorKey: "participants",
      header: "Participants",
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<number>()}</span>,
    },
    {
      accessorKey: "vdvks",
      header: "VDVKs Covered",
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<number>()}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
    },
  ];

  if (isLoading) return <PageLoading />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <GraduationCap className="w-12 h-12 text-charcoal/20" />
        <p className="text-sm text-charcoal/40 uppercase tracking-widest font-bold">
          Failed to load training data
        </p>
        <p className="text-xs text-gray-400">
          {(error as Error)?.message ?? "An unexpected error occurred"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-4xl tracking-tight text-charcoal">Training Management</h2>
          <p className="text-charcoal/50 text-sm font-medium uppercase tracking-[0.2em] mt-1">Capacity Building & Skill Development</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) setForm(emptyForm);
          }}
          className="btn-bold"
        >
          <Plus size={16} /> Log New Training
        </button>
      </div>

      {createMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Failed to create training session. Please try again.
        </div>
      )}
      {createMutation.isSuccess && !showForm && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          Training session created successfully.
        </div>
      )}

      {showForm && (
        <div className="bg-white border-2 border-charcoal/5 rounded-2xl p-8 animate-fade-in">
          <h3 className="font-display text-lg text-charcoal mb-6">New Training Session</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="kpi-label">Training Title</label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter training title"
                value={form.title}
                onChange={(e) => handleFormChange("title", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="kpi-label">Date</label>
              <input
                type="date"
                className="input-field"
                value={form.date}
                onChange={(e) => handleFormChange("date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="kpi-label">Duration (Hours)</label>
              <input
                type="number"
                className="input-field"
                placeholder="8"
                value={form.duration}
                onChange={(e) => handleFormChange("duration", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="kpi-label">Venue</label>
              <input
                type="text"
                className="input-field"
                placeholder="Venue name"
                value={form.venue}
                onChange={(e) => handleFormChange("venue", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="kpi-label">Trainer Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="Trainer name"
                value={form.trainer}
                onChange={(e) => handleFormChange("trainer", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="kpi-label">Participant Count</label>
              <input
                type="number"
                className="input-field"
                placeholder="0"
                value={form.participants}
                onChange={(e) => handleFormChange("participants", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="kpi-label">Budget (Rs)</label>
              <input
                type="number"
                className="input-field"
                placeholder="0"
                value={form.budget}
                onChange={(e) => handleFormChange("budget", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="kpi-label">VDVKs Covered</label>
              <input
                type="text"
                className="input-field"
                placeholder="VDVK codes, comma-separated"
                value={form.vdvks}
                onChange={(e) => handleFormChange("vdvks", e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSubmit}
              className="btn-bold"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Saving..." : "Save & Schedule"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total Sessions" value={kpis.total.toLocaleString()} accent="yellow" />
        <KPICard label="Completed" value={kpis.completed.toLocaleString()} accent="green" />
        <KPICard label="Upcoming" value={kpis.upcoming.toLocaleString()} accent="blue" />
        <KPICard
          label="Total Participants"
          value={kpis.totalParticipants.toLocaleString()}
          accent="purple"
        />
      </div>

      <div className="flex items-center gap-2">
        {statusFilters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              "px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg transition-colors",
              activeFilter === f
                ? "bg-charcoal text-golden"
                : "bg-gray-100 text-charcoal/50 hover:text-charcoal",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="w-12 h-12" />}
          title="No Training Sessions Found"
          description="Log a new training session to get started."
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          searchable
          searchPlaceholder="Search training sessions..."
        />
      )}
    </div>
  );
}
