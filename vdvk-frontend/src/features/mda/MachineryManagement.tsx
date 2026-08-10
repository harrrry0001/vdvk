import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
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
import { formsApi } from "@/api/endpoints/forms";
import {
  Wrench,
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
  Truck,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Machinery {
  id: string;
  name: string;
  commodityMapping: string[];
  currentFacilityCode?: string;
  currentVdvkCode?: string;
  installationLocation?: string;
  mandal: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: string;
  supplierCode?: string;
  supplierNameSnapshot?: string;
  supplierContactPerson?: string;
  supplierMobile?: string;
  supplierEmail?: string;
  warrantyAvailable?: boolean;
  warrantyType?: string;
  warrantyPeriod?: string;
  warrantyStartDate?: string;
  warrantyExpiryDate?: string;
  fundingSource?: string;
  reasonPurpose?: string;
  currentStatus: string;
  status: string;
}

interface Facility {
  code: string;
  name: string;
  type: string;
}

interface Commodity {
  code: string;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Zod Schema — matches backend itemSchema                            */
/* ------------------------------------------------------------------ */

const machinerySchema = z.object({
  name: z.string().min(1, "Machine name is required"),
  commodityMapping: z.array(z.string()).min(1, "Select at least one commodity"),
  mandal: z.string().min(1, "Mandal is required"),
  quantity: z.coerce.number().min(1).default(1),
  unitCost: z.coerce.number().min(0, "Must be 0 or more"),
  totalCost: z.coerce.number().min(0, "Must be 0 or more"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  currentFacilityCode: z.string().optional(),
  installationLocation: z.string().optional(),
  currentVdvkCode: z.string().optional(),
  supplierCode: z.string().optional(),
  supplierNameSnapshot: z.string().optional(),
  supplierContactPerson: z.string().optional(),
  supplierMobile: z.string().optional(),
  supplierEmail: z.string().optional(),
  warrantyAvailable: z.boolean().optional(),
  warrantyType: z.string().optional(),
  warrantyPeriod: z.string().optional(),
  warrantyStartDate: z.string().optional(),
  warrantyExpiryDate: z.string().optional(),
  fundingSource: z.string().optional(),
  reasonPurpose: z.string().optional(),
});

type MachineryForm = z.infer<typeof machinerySchema>;

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
  Available: "bg-green-100 text-green-800 border border-green-200",
  Operational: "bg-green-100 text-green-800 border border-green-200",
  Maintenance: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  "In Transit": "bg-blue-100 text-blue-800 border border-blue-200",
  Idle: "bg-gray-100 text-gray-500 border border-gray-200",
  Draft: "bg-gray-100 text-gray-500 border border-gray-200",
  "Pending Verification": "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-green-50 text-green-700 border-green-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function MachineryManagement() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"register" | "inventory" | "transfer">("register");
  const [notif, setNotif] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [searchText, setSearchText] = useState("");

  const notify = (message: string, type: "success" | "error") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 5000);
  };

  /* --- queries --- */

  const { data: machinery, isLoading: machineryLoading, isError: machineryError } = useQuery({
    queryKey: ["forms", "form7"],
    queryFn: async () => {
      const res = await formsApi.list("form7");
      return (res.data?.data ?? res.data ?? []) as Machinery[];
    },
  });

  const { data: facilities = [] } = useQuery({
    queryKey: ["mda", "facilities", "by-type"],
    queryFn: async () => {
      const res = await mdaApi.getFacilitiesByType();
      return (res.data?.data ?? res.data ?? []) as Facility[];
    },
  });

  const { data: commodities = [] } = useQuery({
    queryKey: ["master", "commodities"],
    queryFn: async () => {
      const res = await masterApi.getCommodities();
      return (res.data?.data ?? res.data ?? []) as Commodity[];
    },
  });

  const facilityMap = useMemo(() => {
    const map: Record<string, string> = {};
    facilities.forEach((f: any) => { map[f.code] = f.name; });
    return map;
  }, [facilities]);

  const commodityMap = useMemo(() => {
    const map: Record<string, string> = {};
    commodities.forEach((c: any) => { map[c.code] = c.name; });
    return map;
  }, [commodities]);

  /* --- mutations --- */

  const createMachineryMutation = useMutation({
    mutationFn: (data: MachineryForm) =>
      formsApi.create("form7", { items: [data] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form7"] });
      machineryForm.reset();
      notify("Machinery registered successfully", "success");
    },
    onError: () => notify("Failed to register machinery", "error"),
  });

  const submitMachineryMutation = useMutation({
    mutationFn: (id: string) => formsApi.submit("form7", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form7"] });
      notify("Machinery submitted for verification", "success");
    },
    onError: () => notify("Failed to submit machinery", "error"),
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => formsApi.reopen("form7", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form7"] });
      notify("Machinery reopened", "success");
    },
    onError: () => notify("Failed to reopen machinery", "error"),
  });

  const transferMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { toFacilityCode: string; transferDate: string; reason: string } }) =>
      mdaApi.transferMachinery(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form7"] });
      notify("Transfer initiated", "success");
    },
    onError: () => notify("Failed to transfer machinery", "error"),
  });

  /* --- forms --- */

  const machineryForm = useForm<MachineryForm>({
    resolver: zodResolver(machinerySchema) as any,
    defaultValues: {
      name: "",
      commodityMapping: [],
      mandal: "",
      quantity: 1,
      unitCost: 0,
      totalCost: 0,
      purchaseDate: "",
      currentFacilityCode: "",
      installationLocation: "",
      currentVdvkCode: "",
      supplierCode: "",
      supplierNameSnapshot: "",
      supplierContactPerson: "",
      supplierMobile: "",
      supplierEmail: "",
      warrantyAvailable: false,
      warrantyType: "",
      warrantyPeriod: "",
      warrantyStartDate: "",
      warrantyExpiryDate: "",
      fundingSource: "",
      reasonPurpose: "",
    },
  });

  /* --- table data --- */

  const filteredMachinery = useMemo(() => {
    if (!machinery) return [];
    if (!searchText.trim()) return machinery;
    const q = searchText.toLowerCase();
    return machinery.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.id?.toLowerCase().includes(q) ||
        m.supplierNameSnapshot?.toLowerCase().includes(q),
    );
  }, [machinery, searchText]);

  /* --- columns --- */

  const machineryColumns: ColumnDef<Machinery>[] = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: ({ getValue }) => <span className="font-mono text-xs font-bold">{getValue<string>()}</span>,
      },
      {
        accessorKey: "name",
        header: "Machine Name",
        cell: ({ getValue }) => <span className="font-black text-sm uppercase">{getValue<string>() || "\u2014"}</span>,
      },
      {
        id: "commodities",
        header: "Commodities",
        cell: ({ row }) => {
          const items = row.original.commodityMapping;
          if (!items?.length) return "\u2014";
          const names = items.map((code: string) => commodityMap[code] || code).join(", ");
          return <span className="text-[10px] font-medium max-w-[200px] truncate block">{names}</span>;
        },
      },
      {
        accessorKey: "mandal",
        header: "Mandal",
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>() || "\u2014"}</span>,
      },
      {
        accessorKey: "quantity",
        header: "Qty",
        cell: ({ getValue }) => <span className="text-xs font-mono">{getValue<number>()}</span>,
      },
      {
        accessorKey: "totalCost",
        header: "Total Cost",
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return <span className="text-xs font-mono">{v != null ? `\u20B9 ${new Intl.NumberFormat("en-IN").format(v)}` : "\u2014"}</span>;
        },
      },
      {
        accessorKey: "purchaseDate",
        header: "Purch. Date",
        cell: ({ getValue }) => <span className="text-xs font-mono">{getValue<string>() || "\u2014"}</span>,
      },
      {
        id: "facility",
        header: "Facility",
        cell: ({ row }) => (
          <span className="text-xs font-medium">
            {facilityMap[row.original.currentFacilityCode || ""] || row.original.installationLocation || "\u2014"}
          </span>
        ),
      },
      {
        id: "approvalStatus",
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.status || "Draft";
          return (
            <span className={cn("px-2 py-0.5 text-[9px] font-black uppercase", STATUS_VARIANTS[s] ?? STATUS_VARIANTS.Draft)}>
              {s}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const s = row.original.status;
          return (
            <div className="flex gap-2">
              {s === "Draft" && (
                <button
                  onClick={() => submitMachineryMutation.mutate(row.original.id)}
                  disabled={submitMachineryMutation.isPending}
                  className="text-[9px] font-black uppercase tracking-wider text-charcoal hover:underline"
                >
                  Submit
                </button>
              )}
              {s === "Rejected" && (
                <button
                  onClick={() => reopenMutation.mutate(row.original.id)}
                  disabled={reopenMutation.isPending}
                  className="text-[9px] font-black uppercase tracking-wider text-charcoal hover:underline"
                >
                  Reopen
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [facilities, commodities, submitMachineryMutation, reopenMutation],
  );

  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: filteredMachinery,
    columns: machineryColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  /* --- render helpers --- */

  const renderTable = () => (
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
                      "p-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
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
                  <td key={cell.id} className="p-4 whitespace-nowrap">
                    {typeof cell.column.columnDef.cell === "function"
                      ? (cell.column.columnDef.cell as (ctx: unknown) => React.ReactNode)(cell.getContext())
                      : null}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={machineryColumns.length} className="p-0">
                  <EmptyState icon={<Wrench size={48} />} title="No machinery found" description="Register new machinery to get started" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {filteredMachinery.length > 0 && (
        <div className="p-4 flex items-center justify-between border-t border-charcoal/5">
          <p className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            {" \u2013 "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              filteredMachinery.length,
            )}{" "}
            of {filteredMachinery.length}
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

  if (machineryLoading) return <PageLoading />;

  if (machineryError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="section-heading text-2xl mb-2">Failed to Load Machinery</h2>
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
            MACHINERY MANAGEMENT
          </h1>
          <p className="text-charcoal/50 text-xs font-black uppercase tracking-[0.3em] mt-4">
            Procurement, Inventory Tracking & Inter-Facility Transfers
          </p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 w-fit">
        <button
          onClick={() => setActiveTab("register")}
          className={cn(
            "px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === "register" ? "bg-charcoal text-golden" : "text-charcoal/50 hover:text-charcoal",
          )}
        >
          Register Machinery
        </button>
        <button
          onClick={() => setActiveTab("inventory")}
          className={cn(
            "px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === "inventory" ? "bg-charcoal text-golden" : "text-charcoal/50 hover:text-charcoal",
          )}
        >
          Inventory List
        </button>
        <button
          onClick={() => setActiveTab("transfer")}
          className={cn(
            "px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === "transfer" ? "bg-charcoal text-golden" : "text-charcoal/50 hover:text-charcoal",
          )}
        >
          Unit Transfer
        </button>
      </div>

      {/* Register Tab */}
      {activeTab === "register" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h3 className="section-heading text-2xl mb-6">New Machinery Registration</h3>
            <form
              onSubmit={machineryForm.handleSubmit((data) => createMachineryMutation.mutate(data))}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <Field label="Machine Name" error={machineryForm.formState.errors.name?.message}>
                <input {...machineryForm.register("name")} className={inputClass} placeholder="e.g. Solar Dryer - 500kg" />
              </Field>
              <Field label="Mandal" error={machineryForm.formState.errors.mandal?.message}>
                <input {...machineryForm.register("mandal")} className={inputClass} placeholder="e.g. Paderu" />
              </Field>

              <Field label="Quantity" error={machineryForm.formState.errors.quantity?.message}>
                <input {...machineryForm.register("quantity")} type="number" className={inputClass} placeholder="1" />
              </Field>
              <Field label="Purchase Date" error={machineryForm.formState.errors.purchaseDate?.message}>
                <input {...machineryForm.register("purchaseDate")} type="date" className={inputClass} />
              </Field>

              <Field label="Unit Cost (\u20B9)" error={machineryForm.formState.errors.unitCost?.message}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-charcoal/50 font-bold">\u20B9</span>
                  <input {...machineryForm.register("unitCost")} type="number" className={cn(inputClass, "pl-8")} placeholder="0" />
                </div>
              </Field>
              <Field label="Total Cost (\u20B9)" error={machineryForm.formState.errors.totalCost?.message}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-charcoal/50 font-bold">\u20B9</span>
                  <input {...machineryForm.register("totalCost")} type="number" className={cn(inputClass, "pl-8")} placeholder="0" />
                </div>
              </Field>

              <Field label="Assigned Facility">
                <select {...machineryForm.register("currentFacilityCode")} className={inputClass}>
                  <option value="">Select Facility</option>
                  {facilities.map((f) => (
                    <option key={f.code} value={f.code}>{f.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Installation Location">
                <input {...machineryForm.register("installationLocation")} className={inputClass} placeholder="e.g. Main Shed" />
              </Field>

              <Field label="VDVK Code">
                <input {...machineryForm.register("currentVdvkCode")} className={inputClass} placeholder="e.g. VDK-ABCD" />
              </Field>
              <Field label="Funding Source">
                <input {...machineryForm.register("fundingSource")} className={inputClass} placeholder="e.g. TRIFED Grant, DMF" />
              </Field>

              <Field label="Reason / Purpose">
                <textarea {...machineryForm.register("reasonPurpose")} className={cn(inputClass, "h-20 resize-none")} placeholder="Procurement reason..." />
              </Field>

              {/* Commodity Mapping */}
              <div className="md:col-span-2">
                <Field label="Commodity Mapping" error={machineryForm.formState.errors.commodityMapping?.message}>
                  <Controller
                    name="commodityMapping"
                    control={machineryForm.control}
                    render={({ field }) => (
                      <div className={cn(inputClass, "h-auto max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 py-3")}>
                        {commodities.length === 0 && (
                          <p className="text-xs text-gray-400 px-1">No commodities available</p>
                        )}
                        {commodities.map((c) => {
                          const checked = (field.value ?? []).includes(c.code);
                          return (
                            <label
                              key={c.code}
                              className="flex items-center gap-2 px-1 text-xs font-bold cursor-pointer hover:text-charcoal transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const current = field.value ?? [];
                                  field.onChange(
                                    checked
                                      ? current.filter((v: string) => v !== c.code)
                                      : [...current, c.code],
                                  );
                                }}
                              />
                              {c.name}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  />
                </Field>
              </div>

              {/* Supplier Details */}
              <div className="md:col-span-2 border-t border-charcoal/10 pt-4">
                <h4 className="text-xs font-black uppercase tracking-widest mb-4 text-charcoal/60">Supplier Details</h4>
              </div>
              <Field label="Supplier Name">
                <input {...machineryForm.register("supplierNameSnapshot")} className={inputClass} placeholder="Supplier name" />
              </Field>
              <Field label="Supplier Code">
                <input {...machineryForm.register("supplierCode")} className={inputClass} placeholder="Supplier code" />
              </Field>
              <Field label="Contact Person">
                <input {...machineryForm.register("supplierContactPerson")} className={inputClass} placeholder="Contact person" />
              </Field>
              <Field label="Supplier Mobile">
                <input {...machineryForm.register("supplierMobile")} className={inputClass} placeholder="Phone number" />
              </Field>
              <Field label="Supplier Email">
                <input {...machineryForm.register("supplierEmail")} className={inputClass} placeholder="email@example.com" />
              </Field>

              {/* Warranty */}
              <div className="md:col-span-2 border-t border-charcoal/10 pt-4">
                <h4 className="text-xs font-black uppercase tracking-widest mb-4 text-charcoal/60">Warranty</h4>
              </div>
              <Field label="Warranty Available">
                <label className="flex items-center gap-2 pt-2">
                  <input type="checkbox" {...machineryForm.register("warrantyAvailable")} />
                  <span className="text-xs">Yes</span>
                </label>
              </Field>
              <Field label="Warranty Type">
                <input {...machineryForm.register("warrantyType")} className={inputClass} placeholder="e.g. Comprehensive" />
              </Field>
              <Field label="Warranty Period">
                <input {...machineryForm.register("warrantyPeriod")} className={inputClass} placeholder="e.g. 24 months" />
              </Field>
              <Field label="Warranty Start Date">
                <input {...machineryForm.register("warrantyStartDate")} type="date" className={inputClass} />
              </Field>
              <Field label="Warranty Expiry Date">
                <input {...machineryForm.register("warrantyExpiryDate")} type="date" className={inputClass} />
              </Field>

              <div className="md:col-span-2 mt-4 pt-6 border-t border-charcoal/10 flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => machineryForm.reset()}
                  className="px-8 py-3 text-xs font-black uppercase tracking-widest border-2 border-charcoal hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMachineryMutation.isPending}
                  className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50"
                >
                  {createMachineryMutation.isPending ? "Registering..." : "Register Machinery"}
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            <div className="bg-charcoal p-8 text-golden">
              <h4 className="font-display text-xl mb-4 tracking-wide">Guidelines</h4>
              <ul className="text-xs space-y-3 leading-relaxed opacity-80">
                <li className="flex gap-2">
                  <CheckCircle size={14} className="shrink-0 mt-0.5" />
                  Map to commodities for tracking.
                </li>
                <li className="flex gap-2">
                  <CheckCircle size={14} className="shrink-0 mt-0.5" />
                  Enter purchase date for warranty tracking.
                </li>
                <li className="flex gap-2">
                  <CheckCircle size={14} className="shrink-0 mt-0.5" />
                  Machinery IDs are auto-generated.
                </li>
              </ul>
            </div>
            <div className="border-4 border-dashed border-charcoal/10 p-8">
              <Wrench size={40} className="text-charcoal/20 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">Total Machinery</p>
              <p className="text-2xl font-display mt-1">{machinery?.length ?? 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <h3 className="section-heading text-2xl">Machinery Inventory</h3>
            <div className="w-72 flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40" />
                <input
                  type="text"
                  placeholder="Search by name, ID, supplier..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className={cn(inputClass, "pl-10")}
                />
              </div>
            </div>
          </div>
          {renderTable()}
        </div>
      )}

      {/* Transfer Tab */}
      {activeTab === "transfer" && (
        <div className="max-w-2xl">
          <h3 className="section-heading text-2xl mb-6">Inter-Facility Machinery Transfer</h3>
          {machinery && machinery.length > 0 ? (
            <div className="space-y-3">
              {machinery.map((m) => (
                <div key={m.id} className="flex items-center justify-between border border-charcoal/10 p-4 bg-white">
                  <div>
                    <p className="text-sm font-bold">{m.name}</p>
                    <p className="text-[10px] text-charcoal/50">
                      {m.id} &bull; {m.currentStatus || "Draft"} &bull; {facilityMap[m.currentFacilityCode || ""] || m.installationLocation || "Unassigned"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const facilityCode = prompt("Enter destination facility code:");
                      if (facilityCode) {
                        transferMutation.mutate({
                          id: m.id,
                          data: {
                            toFacilityCode: facilityCode,
                            transferDate: new Date().toISOString().split("T")[0],
                            reason: "Operational requirement",
                          },
                        });
                      }
                    }}
                    className="px-4 py-2 bg-charcoal text-golden text-[10px] font-black uppercase tracking-widest hover:bg-dark-gray transition-colors disabled:opacity-50"
                    disabled={transferMutation.isPending}
                  >
                    <Truck size={14} className="inline mr-1" />
                    Transfer
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Truck size={48} />} title="No machinery available" description="Register machinery to enable transfers" />
          )}
        </div>
      )}
    </div>
  );
}

export default MachineryManagement;
