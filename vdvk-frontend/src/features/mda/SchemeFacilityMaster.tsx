import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { mdaApi } from "@/api/endpoints/mda";
import { masterApi } from "@/api/endpoints/master";
import {
  Building2,
  Layers,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Facility {
  code?: string;
  type: string;
  name: string;
  scheme?: string;
  status?: string;
  address?: string;
  commodities?: string[];
  infrastructure?: string;
  financial?: string;
}

interface Scheme {
  code: string;
  name: string;
  type?: string;
  fundingAgency?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

/* ------------------------------------------------------------------ */
/*  Zod Schemas                                                        */
/* ------------------------------------------------------------------ */

const facilitySchema = z.object({
  type: z.string().min(1, "Facility type is required"),
  name: z.string().min(1, "Facility name is required"),
  code: z.string().min(1, "Facility code is required"),
  scheme: z.string().optional().or(z.literal("")),
  status: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  commodities: z.array(z.string()).optional(),
  infrastructure: z.string().optional().or(z.literal("")),
  financial: z.string().optional().or(z.literal("")),
});

const schemeSchema = z.object({
  code: z.string().min(1, "Scheme code is required"),
  name: z.string().min(1, "Scheme name is required"),
  type: z.string().optional().or(z.literal("")),
  fundingAgency: z.string().optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
});

type FacilityForm = z.infer<typeof facilitySchema>;
type SchemeForm = z.infer<typeof schemeSchema>;

/* ------------------------------------------------------------------ */
/*  Notification Banner                                                */
/* ------------------------------------------------------------------ */

function NotificationBanner({
  message,
  type,
  onDismiss,
}: {
  message: string;
  type: "success" | "error";
  onDismiss: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-6 py-3 text-xs font-bold uppercase tracking-widest",
        type === "success"
          ? "bg-green-600/10 text-green-700 border border-green-200"
          : "bg-red-600/10 text-red-700 border border-red-200",
      )}
    >
      <div className="flex items-center gap-2">
        {type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
        {message}
      </div>
      <button onClick={onDismiss} className="p-1 hover:opacity-60">
        <X size={16} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal Shell                                                        */
/* ------------------------------------------------------------------ */

function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-charcoal/90 z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="section-heading text-4xl tracking-tighter">{title}</h2>
              <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-[0.2em]">{subtitle}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 transition-colors">
              <X size={24} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Form Field                                                         */
/* ------------------------------------------------------------------ */

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-black uppercase tracking-widest">{label}</label>
      {children}
      {error && <p className="text-[10px] text-red-600 font-bold">{error}</p>}
    </div>
  );
}

const inputClass =
  "border border-charcoal/15 px-3 py-3 text-sm w-full outline-none focus:border-charcoal focus:shadow-[0_0_0_1px_#171e19] bg-white";

const STATUS_VARIANTS: Record<string, string> = {
  Active: "bg-green-100 text-green-800 border border-green-200",
  Inactive: "bg-gray-100 text-gray-500 border border-gray-200",
  Operational: "bg-green-100 text-green-800 border border-green-200",
  "Under Construction": "bg-yellow-100 text-yellow-800 border border-yellow-200",
};

const COMMODITIES_OPTIONS = [
  "Tamarind",
  "Honey",
  "Aonla",
  "Adda Leaves",
  "Coffee",
  "Pepper",
  "Turmeric",
  "Ginger",
  "Hill Broom",
  "Soapnut",
];

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function SchemeFacilityMaster() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"facility" | "scheme">("facility");
  const [notif, setNotif] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [modal, setModal] = useState<{ type: "facility" | "scheme" } | null>(null);
  const [searchText, setSearchText] = useState("");
  const [facilityTypeFilter, setFacilityTypeFilter] = useState("");

  const notify = (message: string, type: "success" | "error") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 5000);
  };

  /* --- queries --- */

  const {
    data: facilities,
    isLoading: facilitiesLoading,
    isError: facilitiesError,
  } = useQuery({
    queryKey: ["mda", "facilities", "by-type", facilityTypeFilter],
    queryFn: async () => {
      const res = await mdaApi.getFacilitiesByType(facilityTypeFilter || undefined);
      return (res.data?.data ?? res.data ?? []) as Facility[];
    },
  });

  const { data: schemes, isLoading: schemesLoading, isError: schemesError } = useQuery({
    queryKey: ["mda", "schemes"],
    queryFn: async () => {
      const res = await mdaApi.crud("schemes").list();
      return (res.data?.data ?? res.data ?? []) as Scheme[];
    },
  });

  const { data: commodities = [] } = useQuery({
    queryKey: ["master", "commodities"],
    queryFn: async () => {
      const res = await masterApi.getCommodities();
      return (res.data?.data ?? res.data ?? []) as { code: string; name: string }[];
    },
  });

  const schemeMap = useMemo(() => {
    const map: Record<string, string> = {};
    (schemes ?? []).forEach((s: any) => { map[s.code] = s.name; });
    return map;
  }, [schemes]);

  const commodityMap = useMemo(() => {
    const map: Record<string, string> = {};
    commodities.forEach((c: any) => { map[c.code] = c.name; });
    return map;
  }, [commodities]);

  /* --- mutations --- */

  const facilitiesApi = mdaApi.crud("facilities");
  const schemesApi = mdaApi.crud("schemes");

  const createFacilityMutation = useMutation({
    mutationFn: (data: FacilityForm) => facilitiesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "facilities"] });
      setModal(null);
      facilityForm.reset();
      notify("Facility registered successfully", "success");
    },
    onError: () => notify("Failed to register facility", "error"),
  });

  const deleteFacilityMutation = useMutation({
    mutationFn: (id: string) => facilitiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "facilities"] });
      notify("Facility deleted", "success");
    },
    onError: () => notify("Failed to delete facility", "error"),
  });

  const createSchemeMutation = useMutation({
    mutationFn: (data: SchemeForm) => schemesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "schemes"] });
      setModal(null);
      schemeForm.reset();
      notify("Scheme registered successfully", "success");
    },
    onError: () => notify("Failed to register scheme", "error"),
  });

  const updateSchemeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SchemeForm }) => schemesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "schemes"] });
      notify("Scheme updated successfully", "success");
    },
    onError: () => notify("Failed to update scheme", "error"),
  });

  const deleteSchemeMutation = useMutation({
    mutationFn: (id: string) => schemesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "schemes"] });
      notify("Scheme deleted", "success");
    },
    onError: () => notify("Failed to delete scheme", "error"),
  });

  /* --- forms --- */

  const facilityForm = useForm<FacilityForm>({
    resolver: zodResolver(facilitySchema),
    defaultValues: {
      type: "",
      name: "",
      code: "",
      scheme: "",
      status: "Active",
      address: "",
      commodities: [],
      infrastructure: "",
      financial: "",
    },
  });

  const schemeForm = useForm<SchemeForm>({
    resolver: zodResolver(schemeSchema),
    defaultValues: { code: "", name: "", type: "", fundingAgency: "", startDate: "", endDate: "" },
  });

  /* --- table data --- */

  const filterList = <T extends { name?: string; code?: string }>(list: T[] | undefined) => {
    if (!list) return [];
    if (!searchText.trim()) return list;
    const q = searchText.toLowerCase();
    return list.filter((item) => (item.name?.toLowerCase().includes(q)) || (item.code?.toLowerCase().includes(q)));
  };

  const filteredFacilities = useMemo(() => filterList(facilities), [facilities, searchText]);
  const filteredSchemes = useMemo(() => filterList(schemes), [schemes, searchText]);

  /* --- columns --- */

  const facilityColumns: ColumnDef<Facility>[] = useMemo(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ getValue }) => <span className="font-mono text-xs font-bold">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ getValue }) => <span className="text-[10px] font-black uppercase">{getValue<string>()}</span>,
      },
      {
        accessorKey: "name",
        header: "Facility Name",
        cell: ({ getValue }) => <span className="font-bold text-sm uppercase">{getValue<string>()}</span>,
      },
      {
        accessorKey: "scheme",
        header: "Scheme",
        cell: ({ row }) => {
          const code = row.original.scheme;
          return <span className="text-xs font-medium">{schemeMap[code || ""] || code || "—"}</span>;
        },
      },
      {
        accessorKey: "address",
        header: "Address",
        cell: ({ getValue }) => <span className="text-xs text-charcoal/60 max-w-[200px] truncate block">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const s = getValue<string>() || "Active";
          return (
            <span className={cn("px-2 py-0.5 text-[9px] font-black uppercase", STATUS_VARIANTS[s] ?? STATUS_VARIANTS.Active)}>
              {s}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <button
            onClick={() => {
              if (window.confirm(`Delete facility ${row.original.name}?`)) {
                deleteFacilityMutation.mutate(row.original.code || "");
              }
            }}
            className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:underline"
          >
            Delete
          </button>
        ),
      },
    ],
    [schemes],
  );

  const schemeColumns: ColumnDef<Scheme>[] = useMemo(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ getValue }) => <span className="font-mono text-xs font-bold">{getValue<string>()}</span>,
      },
      {
        accessorKey: "name",
        header: "Scheme Name",
        cell: ({ getValue }) => <span className="font-black text-sm uppercase">{getValue<string>()}</span>,
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ getValue }) => <span className="text-xs font-medium">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "fundingAgency",
        header: "Funding Agency",
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "startDate",
        header: "Start Date",
        cell: ({ getValue }) => <span className="text-xs font-mono">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "endDate",
        header: "End Date",
        cell: ({ getValue }) => <span className="text-xs font-mono">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const s = getValue<string>() || "Active";
          return (
            <span className={cn("px-2 py-0.5 text-[9px] font-black uppercase", STATUS_VARIANTS[s] ?? STATUS_VARIANTS.Active)}>
              {s}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <button
            onClick={() => {
              if (window.confirm(`Delete scheme ${row.original.name}?`)) {
                deleteSchemeMutation.mutate(row.original.code);
              }
            }}
            className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:underline"
          >
            Delete
          </button>
        ),
      },
    ],
    [],
  );

  /* --- table instances --- */

  const [facilitySorting, setFacilitySorting] = useState<SortingState>([]);
  const [schemeSorting, setSchemeSorting] = useState<SortingState>([]);

  const facilityTable = useReactTable({
    data: filteredFacilities,
    columns: facilityColumns,
    state: { sorting: facilitySorting },
    onSortingChange: setFacilitySorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  const schemeTable = useReactTable({
    data: filteredSchemes,
    columns: schemeColumns,
    state: { sorting: schemeSorting },
    onSortingChange: setSchemeSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  /* --- render helpers --- */

  const renderTable = (
    table: ReturnType<typeof useReactTable>,
    data: unknown[],
    cols: ColumnDef<unknown>[],
    emptyIcon: React.ReactNode,
    emptyTitle: string,
    emptyDesc: string,
  ) => (
    <div className="bg-white border border-charcoal/10">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-charcoal text-golden">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={cn(
                      "p-4 text-[10px] font-black uppercase tracking-widest",
                      header.column.getCanSort() ? "cursor-pointer select-none" : "",
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {typeof header.column.columnDef.header === "function"
                        ? (header.column.columnDef.header as () => React.ReactNode)()
                        : (header.column.columnDef.header as string)}
                      {header.column.getCanSort() && (
                        <span className="flex flex-col -space-y-1">
                          <ChevronUp size={12} className={cn(header.column.getIsSorted() === "asc" ? "text-golden" : "text-golden/30")} />
                          <ChevronDown size={12} className={cn(header.column.getIsSorted() === "desc" ? "text-golden" : "text-golden/30")} />
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-charcoal/5">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-4">
                    {typeof cell.column.columnDef.cell === "function"
                      ? (cell.column.columnDef.cell as (ctx: unknown) => React.ReactNode)(cell.getContext())
                      : null}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="p-0">
                  <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDesc} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {(data as unknown[]).length > 0 && (
        <div className="p-4 flex items-center justify-between border-t border-charcoal/5">
          <p className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            {" \u2013 "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              (data as unknown[]).length,
            )}{" "}
            of {(data as unknown[]).length}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="w-8 h-8 flex items-center justify-center border border-charcoal/10 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: table.getPageCount() }, (_, i) => (
              <button
                key={i}
                onClick={() => table.setPageIndex(i)}
                className={cn(
                  "w-8 h-8 flex items-center justify-center text-[10px] font-bold",
                  table.getState().pagination.pageIndex === i ? "bg-charcoal text-white" : "border border-charcoal/10 hover:bg-gray-50",
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="w-8 h-8 flex items-center justify-center border border-charcoal/10 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  /* --- loading / error --- */

  const isLoading = activeTab === "facility" ? facilitiesLoading : schemesLoading;
  const isError = activeTab === "facility" ? facilitiesError : schemesError;

  if (isLoading) return <PageLoading />;

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="section-heading text-2xl mb-2">Failed to Load Data</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {notif && <NotificationBanner message={notif.message} type={notif.type} onDismiss={() => setNotif(null)} />}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-2 border-charcoal pb-8">
        <div>
          <h1 className="section-heading text-6xl leading-[0.9] tracking-tighter text-charcoal">
            FACILITY & SCHEMES
          </h1>
          <p className="text-charcoal/50 text-xs font-black uppercase tracking-[0.3em] mt-4">
            Infrastructure Registry - Integrated Management
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 w-fit">
          <button
            onClick={() => { setActiveTab("facility"); setSearchText(""); }}
            className={cn(
              "px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === "facility" ? "bg-charcoal text-golden" : "text-charcoal/50 hover:text-charcoal",
            )}
          >
            Facility Registry
          </button>
          <button
            onClick={() => { setActiveTab("scheme"); setSearchText(""); }}
            className={cn(
              "px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === "scheme" ? "bg-charcoal text-golden" : "text-charcoal/50 hover:text-charcoal",
            )}
          >
            Scheme Master
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
        <div className="flex gap-3 items-end">
          <div className="w-72 flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">Search</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40" />
              <input
                type="text"
                placeholder="Search..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className={cn(inputClass, "pl-10")}
              />
            </div>
          </div>
          {activeTab === "facility" && (
            <div className="w-48 flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">Type Filter</label>
              <select
                value={facilityTypeFilter}
                onChange={(e) => setFacilityTypeFilter(e.target.value)}
                className={inputClass}
              >
                <option value="">All Types</option>
                <option value="processing-hub">Processing Hub</option>
                <option value="mpc">MPC</option>
                <option value="haat-bazaar">Haat Bazaar</option>
              </select>
            </div>
          )}
        </div>
        <button
          onClick={() => setModal({ type: activeTab })}
          className="px-6 py-3 bg-charcoal text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-dark-gray transition-colors"
        >
          <Plus size={14} />
          Add New {activeTab === "facility" ? "Facility" : "Scheme"}
        </button>
      </div>

      {activeTab === "facility" &&
        renderTable(facilityTable as ReturnType<typeof useReactTable>, filteredFacilities, facilityColumns as ColumnDef<unknown>[], <Building2 size={48} />, "No facilities found", "Register a new facility to get started")}
      {activeTab === "scheme" &&
        renderTable(schemeTable as ReturnType<typeof useReactTable>, filteredSchemes, schemeColumns as ColumnDef<unknown>[], <Layers size={48} />, "No schemes found", "Add a new scheme to get started")}

      {/* Facility Modal */}
      <ModalShell
        open={modal?.type === "facility"}
        onClose={() => { setModal(null); facilityForm.reset(); }}
        title="REGISTER FACILITY"
        subtitle="Infrastructure Setup & Configuration"
      >
        <form onSubmit={facilityForm.handleSubmit((data) => createFacilityMutation.mutate(data))} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Facility Type" error={facilityForm.formState.errors.type?.message}>
            <select {...facilityForm.register("type")} className={inputClass}>
              <option value="">Select Type</option>
              <option value="Processing Hub">Processing Hub</option>
              <option value="MPC (Multi-Purpose Center)">MPC (Multi-Purpose Center)</option>
              <option value="Haat Bazaar">Haat Bazaar</option>
            </select>
          </Field>
          <Field label="Facility Name" error={facilityForm.formState.errors.name?.message}>
            <input {...facilityForm.register("name")} className={inputClass} placeholder="e.g. Araku Valley Hub 01" />
          </Field>
          <Field label="Facility Code" error={facilityForm.formState.errors.code?.message}>
            <input {...facilityForm.register("code")} className={inputClass} placeholder="e.g. FCL-ARAKU-001" />
          </Field>
          <Field label="Scheme">
            <select {...facilityForm.register("scheme")} className={inputClass}>
              <option value="">Select Scheme</option>
              {schemes?.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select {...facilityForm.register("status")} className={inputClass}>
              <option value="Active">Active</option>
              <option value="Operational">Operational</option>
              <option value="Under Construction">Under Construction</option>
              <option value="Inactive">Inactive</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Address">
              <textarea {...facilityForm.register("address")} className={inputClass} rows={2} placeholder="Full facility address..." />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Commodities Handled">
              <div className={cn(inputClass, "h-auto space-y-1 max-h-40 overflow-y-auto custom-scrollbar")}>
                {COMMODITIES_OPTIONS.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-xs font-bold py-1">
                    <input
                      type="checkbox"
                      checked={facilityForm.watch("commodities")?.includes(c)}
                      onChange={(e) => {
                        const cur = facilityForm.watch("commodities") ?? [];
                        facilityForm.setValue("commodities", e.target.checked ? [...cur, c] : cur.filter((v) => v !== c));
                      }}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </Field>
          </div>
          <Field label="Infrastructure Details">
            <textarea {...facilityForm.register("infrastructure")} className={inputClass} rows={3} placeholder="Building area, equipment, storage capacity..." />
          </Field>
          <Field label="Financial Details">
            <textarea {...facilityForm.register("financial")} className={inputClass} rows={3} placeholder="Sanctioned amount, funding source..." />
          </Field>
          <div className="md:col-span-2 mt-4 pt-6 border-t border-charcoal/10 flex justify-end gap-4">
            <button type="button" onClick={() => { setModal(null); facilityForm.reset(); }} className="px-8 py-3 text-xs font-black uppercase tracking-widest border-2 border-charcoal hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={createFacilityMutation.isPending} className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50">
              {createFacilityMutation.isPending ? "Saving..." : "Register Facility"}
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Scheme Modal */}
      <ModalShell
        open={modal?.type === "scheme"}
        onClose={() => { setModal(null); schemeForm.reset(); }}
        title="ADD SCHEME"
        subtitle="Programme / Funding Registration"
      >
        <form onSubmit={schemeForm.handleSubmit((data) => createSchemeMutation.mutate(data))} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Scheme Code" error={schemeForm.formState.errors.code?.message}>
            <input {...schemeForm.register("code")} className={inputClass} placeholder="e.g. SCH-001" />
          </Field>
          <Field label="Scheme Name" error={schemeForm.formState.errors.name?.message}>
            <input {...schemeForm.register("name")} className={inputClass} placeholder="e.g. MSP-MFP Scheme" />
          </Field>
          <Field label="Type">
            <input {...schemeForm.register("type")} className={inputClass} placeholder="e.g. Central, State, CSS" />
          </Field>
          <Field label="Funding Agency">
            <input {...schemeForm.register("fundingAgency")} className={inputClass} placeholder="e.g. TRIFED, NSTFDC" />
          </Field>
          <Field label="Start Date">
            <input {...schemeForm.register("startDate")} type="date" className={inputClass} />
          </Field>
          <Field label="End Date">
            <input {...schemeForm.register("endDate")} type="date" className={inputClass} />
          </Field>
          <div className="md:col-span-2 mt-4 pt-6 border-t border-charcoal/10 flex justify-end gap-4">
            <button type="button" onClick={() => { setModal(null); schemeForm.reset(); }} className="px-8 py-3 text-xs font-black uppercase tracking-widest border-2 border-charcoal hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={createSchemeMutation.isPending} className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50">
              {createSchemeMutation.isPending ? "Saving..." : "Add Scheme"}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}

export default SchemeFacilityMaster;
