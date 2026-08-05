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
import { masterApi } from "@/api/endpoints/master";
import { mdaApi } from "@/api/endpoints/mda";
import {
  Box,
  IndianRupee,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Percent,
  FileText,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Commodity {
  code: string;
  name: string;
  category?: string;
  defaultUnit?: string;
  status?: string;
}

interface Rate {
  id: string;
  commodityCode?: string;
  commodityName?: string;
  gradeCode?: string;
  gradeName?: string;
  rate: number;
  unit?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  status?: string;
}

/* ------------------------------------------------------------------ */
/*  Zod Schemas                                                        */
/* ------------------------------------------------------------------ */

const commoditySchema = z.object({
  code: z.string().min(1, "Commodity code is required"),
  name: z.string().min(1, "Commodity name is required"),
  category: z.string().optional().or(z.literal("")),
  defaultUnit: z.string().optional().or(z.literal("")),
});

const rateSchema = z.object({
  commodityCode: z.string().min(1, "Commodity is required"),
  gradeCode: z.string().min(1, "Grade is required"),
  rate: z.coerce.number({ invalid_type_error: "Rate is required" }).min(0, "Rate must be positive"),
  unit: z.string().min(1, "Unit is required"),
  effectiveFrom: z.string().min(1, "Effective date is required"),
});

const bulkIncreaseSchema = z.object({
  commodityCode: z.string().min(1, "Commodity is required"),
  percentage: z.coerce.number({ invalid_type_error: "Percentage is required" }).min(0.01, "Percentage must be > 0"),
  effectiveFrom: z.string().min(1, "Effective date is required"),
});

type CommodityForm = z.infer<typeof commoditySchema>;
type RateForm = z.infer<typeof rateSchema>;
type BulkIncreaseForm = z.infer<typeof bulkIncreaseSchema>;

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
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="section-heading text-4xl tracking-tighter">{title}</h2>
              <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-[0.2em]">
                {subtitle}
              </p>
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
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function CommodityRateManagement() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"commodities" | "rates">("commodities");
  const [notif, setNotif] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [modal, setModal] = useState<{ type: "commodity" | "rate" | "bulk" } | null>(null);
  const [searchText, setSearchText] = useState("");

  const notify = (message: string, type: "success" | "error") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 5000);
  };

  /* --- queries --- */

  const { data: commodities, isLoading: commoditiesLoading, isError: commoditiesError } = useQuery({
    queryKey: ["mda", "commodities"],
    queryFn: async () => {
      const res = await mdaApi.crud("commodities").list();
      return (res.data?.data ?? res.data ?? []) as Commodity[];
    },
  });

  const { data: rates, isLoading: ratesLoading, isError: ratesError } = useQuery({
    queryKey: ["mda", "rates", "all"],
    queryFn: async () => {
      const res = await mdaApi.getAllRates();
      return (res.data?.data ?? res.data ?? []) as Rate[];
    },
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["master", "grades"],
    queryFn: async () => {
      const res = await masterApi.getGrades();
      return (res.data?.data ?? res.data ?? []) as { code: string; name: string; commodityCode?: string }[];
    },
  });

  const commodityMap = useMemo(() => {
    const map: Record<string, string> = {};
    (commodities ?? []).forEach((c: any) => { map[c.code] = c.name; });
    return map;
  }, [commodities]);

  const gradeMap = useMemo(() => {
    const map: Record<string, string> = {};
    grades.forEach((g: any) => { map[g.code] = g.name; });
    return map;
  }, [grades]);

  /* --- mutations --- */

  const commodityApi = mdaApi.crud("commodities");

  const createCommodityMutation = useMutation({
    mutationFn: (data: CommodityForm) => commodityApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "commodities"] });
      setModal(null);
      commodityForm.reset();
      notify("Commodity added successfully", "success");
    },
    onError: () => notify("Failed to add commodity", "error"),
  });

  const updateCommodityMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CommodityForm }) => commodityApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "commodities"] });
      notify("Commodity updated successfully", "success");
    },
    onError: () => notify("Failed to update commodity", "error"),
  });

  const deleteCommodityMutation = useMutation({
    mutationFn: (id: string) => commodityApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "commodities"] });
      notify("Commodity deleted", "success");
    },
    onError: () => notify("Failed to delete commodity", "error"),
  });

  const createRateMutation = useMutation({
    mutationFn: (data: RateForm) => mdaApi.createRate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "rates"] });
      setModal(null);
      rateForm.reset();
      notify("Rate created successfully", "success");
    },
    onError: () => notify("Failed to create rate", "error"),
  });

  const reviseRateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => mdaApi.reviseRate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "rates"] });
      notify("Rate revised successfully", "success");
    },
    onError: () => notify("Failed to revise rate", "error"),
  });

  /* --- forms --- */

  const commodityForm = useForm<CommodityForm>({
    resolver: zodResolver(commoditySchema),
    defaultValues: { code: "", name: "", category: "", defaultUnit: "" },
  });

  const rateForm = useForm<RateForm>({
    resolver: zodResolver(rateSchema),
    defaultValues: { commodityCode: "", gradeCode: "", rate: 0, unit: "", effectiveFrom: "" },
  });

  const bulkForm = useForm<BulkIncreaseForm>({
    resolver: zodResolver(bulkIncreaseSchema),
    defaultValues: { commodityCode: "", percentage: 0, effectiveFrom: "" },
  });

  /* --- tables --- */

  const filteredCommodities = useMemo(() => {
    if (!commodities) return [];
    if (!searchText.trim()) return commodities;
    const q = searchText.toLowerCase();
    return commodities.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [commodities, searchText]);

  const filteredRates = useMemo(() => {
    if (!rates) return [];
    if (!searchText.trim()) return rates;
    const q = searchText.toLowerCase();
    return rates.filter(
      (r) =>
        r.commodityName?.toLowerCase().includes(q) ||
        r.gradeName?.toLowerCase().includes(q) ||
        String(r.rate).includes(q),
    );
  }, [rates, searchText]);

  const commodityColumns: ColumnDef<Commodity>[] = useMemo(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ getValue }) => <span className="font-mono text-xs font-bold">{getValue<string>()}</span>,
      },
      {
        accessorKey: "name",
        header: "Commodity Name",
        cell: ({ getValue }) => <span className="font-black text-sm uppercase">{getValue<string>()}</span>,
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ getValue }) => <span className="text-xs font-medium">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "defaultUnit",
        header: "Default Unit",
        cell: ({ getValue }) => <span className="text-xs font-medium">{getValue<string>() || "—"}</span>,
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
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (window.confirm(`Delete ${row.original.name}?`)) {
                  deleteCommodityMutation.mutate(row.original.code);
                }
              }}
              className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:underline"
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const rateColumns: ColumnDef<Rate>[] = useMemo(
    () => [
      {
        accessorKey: "commodityName",
        header: "Commodity",
        cell: ({ row }) => (
          <span className="font-black text-xs uppercase">
            {row.original.commodityName || commodityMap[row.original.commodityCode || ""] || row.original.commodityCode || "—"}
          </span>
        ),
      },
      {
        accessorKey: "gradeName",
        header: "Grade",
        cell: ({ row }) => (
          <span className="text-xs font-bold">
            {row.original.gradeName || gradeMap[row.original.gradeCode || ""] || row.original.gradeCode || "—"}
          </span>
        ),
      },
      {
        accessorKey: "rate",
        header: "Rate",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-bold">
            ₹ {new Intl.NumberFormat("en-IN").format(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "unit",
        header: "Unit",
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "effectiveFrom",
        header: "Effective From",
        cell: ({ getValue }) => <span className="text-xs font-mono">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "effectiveTo",
        header: "Effective To",
        cell: ({ getValue }) => <span className="text-xs font-mono">{getValue<string>() || "Ongoing"}</span>,
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
          <div className="flex gap-2">
            <button
              onClick={() =>
                setModal({
                  type: "rate",
                })
              }
              className="text-[10px] font-black uppercase tracking-widest text-charcoal hover:underline"
            >
              Revise
            </button>
          </div>
        ),
      },
    ],
    [commodities, grades],
  );

  const [commoditySorting, setCommoditySorting] = useState<SortingState>([]);
  const [rateSorting, setRateSorting] = useState<SortingState>([]);

  const commodityTable = useReactTable({
    data: filteredCommodities,
    columns: commodityColumns,
    state: { sorting: commoditySorting },
    onSortingChange: setCommoditySorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  const rateTable = useReactTable({
    data: filteredRates,
    columns: rateColumns,
    state: { sorting: rateSorting },
    onSortingChange: setRateSorting,
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
                          <ChevronUp
                            size={12}
                            className={cn(header.column.getIsSorted() === "asc" ? "text-golden" : "text-golden/30")}
                          />
                          <ChevronDown
                            size={12}
                            className={cn(header.column.getIsSorted() === "desc" ? "text-golden" : "text-golden/30")}
                          />
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
                  table.getState().pagination.pageIndex === i
                    ? "bg-charcoal text-white"
                    : "border border-charcoal/10 hover:bg-gray-50",
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

  if (activeTab === "commodities" && commoditiesLoading) return <PageLoading />;
  if (activeTab === "rates" && ratesLoading) return <PageLoading />;

  if (activeTab === "commodities" && commoditiesError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="section-heading text-2xl mb-2">Failed to Load Commodities</h2>
        </div>
      </div>
    );
  }

  if (activeTab === "rates" && ratesError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="section-heading text-2xl mb-2">Failed to Load Rates</h2>
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
            COMMODITY & RATES
          </h1>
          <p className="text-charcoal/50 text-xs font-black uppercase tracking-[0.3em] mt-4">
            Master management for all forest produce
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 w-fit">
          <button
            onClick={() => { setActiveTab("commodities"); setSearchText(""); }}
            className={cn(
              "px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === "commodities" ? "bg-charcoal text-golden" : "text-charcoal/50 hover:text-charcoal",
            )}
          >
            Commodities
          </button>
          <button
            onClick={() => { setActiveTab("rates"); setSearchText(""); }}
            className={cn(
              "px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === "rates" ? "bg-charcoal text-golden" : "text-charcoal/50 hover:text-charcoal",
            )}
          >
            Rates Master
          </button>
        </div>
      </div>

      {/* Search + Add */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
        <div className="w-full sm:w-72 flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">Search</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40" />
            <input
              type="text"
              placeholder={activeTab === "commodities" ? "Search commodities..." : "Search rates..."}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className={cn(inputClass, "pl-10")}
            />
          </div>
        </div>
        <div className="flex gap-3">
          {activeTab === "commodities" && (
            <button
              onClick={() => setModal({ type: "commodity" })}
              className="px-6 py-3 bg-charcoal text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-dark-gray transition-colors"
            >
              <Plus size={14} />
              Add Commodity
            </button>
          )}
          {activeTab === "rates" && (
            <>
              <button
                onClick={() => setModal({ type: "rate" })}
                className="px-6 py-3 bg-charcoal text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-dark-gray transition-colors"
              >
                <Plus size={14} />
                New Rate Revision
              </button>
              <button
                onClick={() => setModal({ type: "bulk" })}
                className="px-6 py-3 border-2 border-charcoal text-charcoal text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-golden/10 transition-colors"
              >
                <Percent size={14} />
                Bulk % Increase
              </button>
            </>
          )}
        </div>
      </div>

      {/* Commodities Tab */}
      {activeTab === "commodities" && (
        renderTable(
          commodityTable as ReturnType<typeof useReactTable>,
          filteredCommodities,
          commodityColumns as ColumnDef<unknown>[],
          <Box size={48} />,
          "No commodities found",
          "Add a new commodity to get started",
        )
      )}

      {/* Rates Tab */}
      {activeTab === "rates" && (
        renderTable(
          rateTable as ReturnType<typeof useReactTable>,
          filteredRates,
          rateColumns as ColumnDef<unknown>[],
          <IndianRupee size={48} />,
          "No rates found",
          "Create a new rate revision to get started",
        )
      )}

      {/* Add Commodity Modal */}
      <ModalShell
        open={modal?.type === "commodity"}
        onClose={() => { setModal(null); commodityForm.reset(); }}
        title="ADD COMMODITY"
        subtitle="Register a new forest produce item"
      >
        <form
          onSubmit={commodityForm.handleSubmit((data) => createCommodityMutation.mutate(data))}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <Field label="Commodity Code" error={commodityForm.formState.errors.code?.message}>
            <input {...commodityForm.register("code")} className={inputClass} placeholder="e.g. TAM" />
          </Field>
          <Field label="Commodity Name" error={commodityForm.formState.errors.name?.message}>
            <input {...commodityForm.register("name")} className={inputClass} placeholder="e.g. Tamarind" />
          </Field>
          <Field label="Category">
            <input {...commodityForm.register("category")} className={inputClass} placeholder="e.g. MFP" />
          </Field>
          <Field label="Default Unit">
            <input {...commodityForm.register("defaultUnit")} className={inputClass} placeholder="e.g. Kg" />
          </Field>
          <div className="md:col-span-2 mt-4 pt-6 border-t border-charcoal/10 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => { setModal(null); commodityForm.reset(); }}
              className="px-8 py-3 text-xs font-black uppercase tracking-widest border-2 border-charcoal hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createCommodityMutation.isPending}
              className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50"
            >
              {createCommodityMutation.isPending ? "Saving..." : "Add Commodity"}
            </button>
          </div>
        </form>
      </ModalShell>

      {/* New Rate Revision Modal */}
      <ModalShell
        open={modal?.type === "rate"}
        onClose={() => { setModal(null); rateForm.reset(); }}
        title="NEW RATE REVISION"
        subtitle="Create a new commodity rate entry"
      >
        <form
          onSubmit={rateForm.handleSubmit((data) => createRateMutation.mutate(data))}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <Field label="Commodity" error={rateForm.formState.errors.commodityCode?.message}>
            <select {...rateForm.register("commodityCode")} className={inputClass}>
              <option value="">Select Commodity</option>
              {commodities?.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Grade" error={rateForm.formState.errors.gradeCode?.message}>
            <select {...rateForm.register("gradeCode")} className={inputClass}>
              <option value="">Select Grade</option>
              {grades.map((g) => (
                <option key={g.code} value={g.code}>{g.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Rate" error={rateForm.formState.errors.rate?.message}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-charcoal/50 font-bold">₹</span>
              <input {...rateForm.register("rate")} type="number" className={cn(inputClass, "pl-8")} placeholder="0" />
            </div>
          </Field>
          <Field label="Unit" error={rateForm.formState.errors.unit?.message}>
            <input {...rateForm.register("unit")} className={inputClass} placeholder="e.g. Kg, Quintal" />
          </Field>
          <Field label="Effective From" error={rateForm.formState.errors.effectiveFrom?.message}>
            <input {...rateForm.register("effectiveFrom")} type="date" className={inputClass} />
          </Field>
          <div className="md:col-span-2 mt-4 pt-6 border-t border-charcoal/10 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => { setModal(null); rateForm.reset(); }}
              className="px-8 py-3 text-xs font-black uppercase tracking-widest border-2 border-charcoal hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createRateMutation.isPending}
              className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50"
            >
              {createRateMutation.isPending ? "Saving..." : "Create Rate"}
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Bulk % Increase Modal */}
      <ModalShell
        open={modal?.type === "bulk"}
        onClose={() => { setModal(null); bulkForm.reset(); }}
        title="BULK % INCREASE"
        subtitle="Apply percentage increase to all grades of a commodity"
      >
        <form
          onSubmit={bulkForm.handleSubmit((data) => createRateMutation.mutate({ ...data, isBulkIncrease: true } as unknown as RateForm))}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <Field label="Commodity" error={bulkForm.formState.errors.commodityCode?.message}>
            <select {...bulkForm.register("commodityCode")} className={inputClass}>
              <option value="">Select Commodity</option>
              {commodities?.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Percentage Increase" error={bulkForm.formState.errors.percentage?.message}>
            <div className="relative">
              <input
                {...bulkForm.register("percentage")}
                type="number"
                step="0.01"
                className={cn(inputClass, "pr-8")}
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-charcoal/50 font-bold">%</span>
            </div>
          </Field>
          <Field label="Effective From" error={bulkForm.formState.errors.effectiveFrom?.message}>
            <input {...bulkForm.register("effectiveFrom")} type="date" className={inputClass} />
          </Field>
          <div className="md:col-span-2 mt-4 pt-6 border-t border-charcoal/10 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => { setModal(null); bulkForm.reset(); }}
              className="px-8 py-3 text-xs font-black uppercase tracking-widest border-2 border-charcoal hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createRateMutation.isPending}
              className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50"
            >
              {createRateMutation.isPending ? "Applying..." : "Apply Increase"}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}

export default CommodityRateManagement;
