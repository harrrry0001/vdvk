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
  Star,
  ClipboardList,
  Briefcase,
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

interface Grade {
  code: string;
  commodityCode?: string;
  commodityName?: string;
  name: string;
  effectiveFrom?: string;
  status?: string;
}

interface ExpenditureHead {
  code: string;
  name: string;
  headType?: string;
  scheme?: string;
  status?: string;
}

interface Customer {
  code: string;
  name: string;
  type?: string;
  contactPerson?: string;
  mobile?: string;
  address?: string;
  status?: string;
}

/* ------------------------------------------------------------------ */
/*  Zod Schemas                                                        */
/* ------------------------------------------------------------------ */

const gradeSchema = z.object({
  code: z.string().min(1, "Grade code is required"),
  commodityCode: z.string().min(1, "Commodity is required"),
  name: z.string().min(1, "Grade name is required"),
  effectiveFrom: z.string().min(1, "Effective date is required"),
});

const expenditureHeadSchema = z.object({
  code: z.string().min(1, "Head code is required"),
  name: z.string().min(1, "Head name is required"),
  headType: z.string().optional().or(z.literal("")),
  scheme: z.string().optional().or(z.literal("")),
});

const customerSchema = z.object({
  code: z.string().min(1, "Customer code is required"),
  name: z.string().min(1, "Customer name is required"),
  type: z.string().optional().or(z.literal("")),
  contactPerson: z.string().optional().or(z.literal("")),
  mobile: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
});

type GradeForm = z.infer<typeof gradeSchema>;
type ExpenditureHeadForm = z.infer<typeof expenditureHeadSchema>;
type CustomerForm = z.infer<typeof customerSchema>;

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
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function GradeExpCustomerMgmt() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"grades" | "expenditure" | "customers">("grades");
  const [notif, setNotif] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [modal, setModal] = useState<{ type: "grades" | "expenditure" | "customers" } | null>(null);
  const [searchText, setSearchText] = useState("");

  const notify = (message: string, type: "success" | "error") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 5000);
  };

  /* --- queries --- */

  const { data: grades, isLoading: gradesLoading, isError: gradesError } = useQuery({
    queryKey: ["mda", "grades"],
    queryFn: async () => {
      const res = await mdaApi.crud("grades").list();
      return (res.data?.data ?? res.data ?? []) as Grade[];
    },
  });

  const { data: commodities = [] } = useQuery({
    queryKey: ["master", "commodities"],
    queryFn: async () => {
      const res = await masterApi.getCommodities();
      return (res.data?.data ?? res.data ?? []) as { code: string; name: string }[];
    },
  });

  const commodityMap = useMemo(() => {
    const map: Record<string, string> = {};
    commodities.forEach((c: any) => { map[c.code] = c.name; });
    return map;
  }, [commodities]);

  const { data: expenditureHeads, isLoading: headsLoading, isError: headsError } = useQuery({
    queryKey: ["mda", "expenditure-heads"],
    queryFn: async () => {
      const res = await mdaApi.crud("expenditure-heads").list();
      return (res.data?.data ?? res.data ?? []) as ExpenditureHead[];
    },
  });

  const { data: customers, isLoading: customersLoading, isError: customersError } = useQuery({
    queryKey: ["mda", "customers"],
    queryFn: async () => {
      const res = await mdaApi.crud("customers").list();
      return (res.data?.data ?? res.data ?? []) as Customer[];
    },
  });

  /* --- mutations --- */

  const gradesApi = mdaApi.crud("grades");
  const expenditureHeadsApi = mdaApi.crud("expenditure-heads");
  const customersApi = mdaApi.crud("customers");

  const createGradeMutation = useMutation({
    mutationFn: (data: GradeForm) => gradesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "grades"] });
      setModal(null);
      gradeForm.reset();
      notify("Grade added successfully", "success");
    },
    onError: () => notify("Failed to add grade", "error"),
  });

  const updateGradeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GradeForm }) => gradesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "grades"] });
      notify("Grade updated successfully", "success");
    },
    onError: () => notify("Failed to update grade", "error"),
  });

  const deleteGradeMutation = useMutation({
    mutationFn: (id: string) => gradesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "grades"] });
      notify("Grade deleted", "success");
    },
    onError: () => notify("Failed to delete grade", "error"),
  });

  const createHeadMutation = useMutation({
    mutationFn: (data: ExpenditureHeadForm) => expenditureHeadsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "expenditure-heads"] });
      setModal(null);
      headForm.reset();
      notify("Expenditure head added", "success");
    },
    onError: () => notify("Failed to add expenditure head", "error"),
  });

  const updateHeadMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExpenditureHeadForm }) => expenditureHeadsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "expenditure-heads"] });
      notify("Expenditure head updated", "success");
    },
    onError: () => notify("Failed to update expenditure head", "error"),
  });

  const deleteHeadMutation = useMutation({
    mutationFn: (id: string) => expenditureHeadsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "expenditure-heads"] });
      notify("Expenditure head deleted", "success");
    },
    onError: () => notify("Failed to delete expenditure head", "error"),
  });

  const createCustomerMutation = useMutation({
    mutationFn: (data: CustomerForm) => customersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "customers"] });
      setModal(null);
      customerForm.reset();
      notify("Customer added", "success");
    },
    onError: () => notify("Failed to add customer", "error"),
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CustomerForm }) => customersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "customers"] });
      notify("Customer updated", "success");
    },
    onError: () => notify("Failed to update customer", "error"),
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "customers"] });
      notify("Customer deleted", "success");
    },
    onError: () => notify("Failed to delete customer", "error"),
  });

  /* --- forms --- */

  const gradeForm = useForm<GradeForm>({
    resolver: zodResolver(gradeSchema),
    defaultValues: { code: "", commodityCode: "", name: "", effectiveFrom: "" },
  });

  const headForm = useForm<ExpenditureHeadForm>({
    resolver: zodResolver(expenditureHeadSchema),
    defaultValues: { code: "", name: "", headType: "", scheme: "" },
  });

  const customerForm = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: { code: "", name: "", type: "", contactPerson: "", mobile: "", address: "" },
  });

  /* --- table data --- */

  const filterList = <T extends { name?: string; code?: string }>(list: T[] | undefined) => {
    if (!list) return [];
    if (!searchText.trim()) return list;
    const q = searchText.toLowerCase();
    return list.filter((item) => (item.name?.toLowerCase().includes(q)) || (item.code?.toLowerCase().includes(q)));
  };

  const filteredGrades = useMemo(() => filterList(grades), [grades, searchText]);
  const filteredHeads = useMemo(() => filterList(expenditureHeads), [expenditureHeads, searchText]);
  const filteredCustomers = useMemo(() => filterList(customers), [customers, searchText]);

  /* --- columns --- */

  const gradeColumns: ColumnDef<Grade>[] = useMemo(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ getValue }) => <span className="font-mono text-xs font-bold">{getValue<string>()}</span>,
      },
      {
        accessorKey: "commodityCode",
        header: "Commodity",
        cell: ({ row }) => {
          const code = row.original.commodityCode;
          return <span className="text-xs font-black uppercase">{commodityMap[code || ""] || "—"}</span>;
        },
      },
      {
        accessorKey: "name",
        header: "Grade Name",
        cell: ({ getValue }) => <span className="font-bold text-sm italic">{getValue<string>()}</span>,
      },
      {
        accessorKey: "effectiveFrom",
        header: "Eff. From",
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
        header: "Action",
        cell: ({ row }) => (
          <button
            onClick={() => {
              if (window.confirm(`Delete grade ${row.original.name}?`)) {
                deleteGradeMutation.mutate(row.original.code);
              }
            }}
            className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:underline"
          >
            Delete
          </button>
        ),
      },
    ],
    [commodities],
  );

  const headColumns: ColumnDef<ExpenditureHead>[] = useMemo(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ getValue }) => <span className="font-mono text-xs font-bold">{getValue<string>()}</span>,
      },
      {
        accessorKey: "name",
        header: "Head Name",
        cell: ({ getValue }) => <span className="font-black text-sm uppercase">{getValue<string>()}</span>,
      },
      {
        accessorKey: "headType",
        header: "Type",
        cell: ({ getValue }) => <span className="text-xs font-medium">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "scheme",
        header: "Scheme",
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>() || "—"}</span>,
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
        header: "Action",
        cell: ({ row }) => (
          <button
            onClick={() => {
              if (window.confirm(`Delete head ${row.original.name}?`)) {
                deleteHeadMutation.mutate(row.original.code);
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

  const customerColumns: ColumnDef<Customer>[] = useMemo(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ getValue }) => <span className="font-mono text-xs font-bold">{getValue<string>()}</span>,
      },
      {
        accessorKey: "name",
        header: "Customer Name",
        cell: ({ getValue }) => <span className="font-black text-sm uppercase">{getValue<string>()}</span>,
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ getValue }) => <span className="text-xs font-medium">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "contactPerson",
        header: "Contact Person",
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "mobile",
        header: "Mobile",
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
        header: "Action",
        cell: ({ row }) => (
          <button
            onClick={() => {
              if (window.confirm(`Delete customer ${row.original.name}?`)) {
                deleteCustomerMutation.mutate(row.original.code);
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

  const [gradeSorting, setGradeSorting] = useState<SortingState>([]);
  const [headSorting, setHeadSorting] = useState<SortingState>([]);
  const [customerSorting, setCustomerSorting] = useState<SortingState>([]);

  const gradeTable = useReactTable({
    data: filteredGrades,
    columns: gradeColumns,
    state: { sorting: gradeSorting },
    onSortingChange: setGradeSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  const headTable = useReactTable({
    data: filteredHeads,
    columns: headColumns,
    state: { sorting: headSorting },
    onSortingChange: setHeadSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  const customerTable = useReactTable({
    data: filteredCustomers,
    columns: customerColumns,
    state: { sorting: customerSorting },
    onSortingChange: setCustomerSorting,
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

  const isLoading = activeTab === "grades" ? gradesLoading : activeTab === "expenditure" ? headsLoading : customersLoading;
  const isError = activeTab === "grades" ? gradesError : activeTab === "expenditure" ? headsError : customersError;

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
          <h1 className="section-heading text-6xl leading-[0.9] tracking-tighter text-charcoal">ADMIN MASTERS</h1>
          <p className="text-charcoal/50 text-xs font-black uppercase tracking-[0.3em] mt-4">
            Grade, Expenditure & Customer Management
          </p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 w-fit">
        <button
          onClick={() => { setActiveTab("grades"); setSearchText(""); }}
          className={cn(
            "px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === "grades" ? "bg-charcoal text-golden" : "text-charcoal/50 hover:text-charcoal",
          )}
        >
          Grade Mgmt
        </button>
        <button
          onClick={() => { setActiveTab("expenditure"); setSearchText(""); }}
          className={cn(
            "px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === "expenditure" ? "bg-charcoal text-golden" : "text-charcoal/50 hover:text-charcoal",
          )}
        >
          Expenditure Heads
        </button>
        <button
          onClick={() => { setActiveTab("customers"); setSearchText(""); }}
          className={cn(
            "px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === "customers" ? "bg-charcoal text-golden" : "text-charcoal/50 hover:text-charcoal",
          )}
        >
          Customer Mgmt
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
        <div className="w-full sm:w-72 flex flex-col gap-1">
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
        <button
          onClick={() => setModal({ type: activeTab })}
          className="px-6 py-3 bg-charcoal text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-dark-gray transition-colors"
        >
          <Plus size={14} />
          Add New {activeTab === "grades" ? "Grade" : activeTab === "expenditure" ? "Expenditure Head" : "Customer"}
        </button>
      </div>

      {activeTab === "grades" &&
        renderTable(gradeTable as ReturnType<typeof useReactTable>, filteredGrades, gradeColumns as ColumnDef<unknown>[], <Star size={48} />, "No grades found", "Add a new grade to get started")}
      {activeTab === "expenditure" &&
        renderTable(headTable as ReturnType<typeof useReactTable>, filteredHeads, headColumns as ColumnDef<unknown>[], <ClipboardList size={48} />, "No expenditure heads found", "Add a new head to get started")}
      {activeTab === "customers" &&
        renderTable(customerTable as ReturnType<typeof useReactTable>, filteredCustomers, customerColumns as ColumnDef<unknown>[], <Briefcase size={48} />, "No customers found", "Add a new customer to get started")}

      {/* Grade Modal */}
      <ModalShell
        open={modal?.type === "grades"}
        onClose={() => { setModal(null); gradeForm.reset(); }}
        title="ADD NEW GRADE"
        subtitle="Commodity Specific Quality Grading"
      >
        <form onSubmit={gradeForm.handleSubmit((data) => createGradeMutation.mutate(data))} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Grade Code" error={gradeForm.formState.errors.code?.message}>
            <input {...gradeForm.register("code")} className={inputClass} placeholder="e.g. TAM-G1" />
          </Field>
          <Field label="Commodity" error={gradeForm.formState.errors.commodityCode?.message}>
            <select {...gradeForm.register("commodityCode")} className={inputClass}>
              <option value="">Select Commodity</option>
              {commodities.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Grade Name" error={gradeForm.formState.errors.name?.message}>
            <input {...gradeForm.register("name")} className={inputClass} placeholder="e.g. Premium Export Grade" />
          </Field>
          <Field label="Effective From" error={gradeForm.formState.errors.effectiveFrom?.message}>
            <input {...gradeForm.register("effectiveFrom")} type="date" className={inputClass} />
          </Field>
          <div className="md:col-span-2 mt-4 pt-6 border-t border-charcoal/10 flex justify-end gap-4">
            <button type="button" onClick={() => { setModal(null); gradeForm.reset(); }} className="px-8 py-3 text-xs font-black uppercase tracking-widest border-2 border-charcoal hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={createGradeMutation.isPending} className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50">
              {createGradeMutation.isPending ? "Saving..." : "Add Grade"}
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Expenditure Head Modal */}
      <ModalShell
        open={modal?.type === "expenditure"}
        onClose={() => { setModal(null); headForm.reset(); }}
        title="ADD EXPENDITURE HEAD"
        subtitle="Ledger / Cost Center Registration"
      >
        <form onSubmit={headForm.handleSubmit((data) => createHeadMutation.mutate(data))} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Head Code" error={headForm.formState.errors.code?.message}>
            <input {...headForm.register("code")} className={inputClass} placeholder="e.g. EXP-001" />
          </Field>
          <Field label="Head Name" error={headForm.formState.errors.name?.message}>
            <input {...headForm.register("name")} className={inputClass} placeholder="e.g. Raw Material Procurement" />
          </Field>
          <Field label="Head Type">
            <input {...headForm.register("headType")} className={inputClass} placeholder="e.g. Capital, Revenue" />
          </Field>
          <Field label="Scheme">
            <input {...headForm.register("scheme")} className={inputClass} placeholder="Scheme name/code" />
          </Field>
          <div className="md:col-span-2 mt-4 pt-6 border-t border-charcoal/10 flex justify-end gap-4">
            <button type="button" onClick={() => { setModal(null); headForm.reset(); }} className="px-8 py-3 text-xs font-black uppercase tracking-widest border-2 border-charcoal hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={createHeadMutation.isPending} className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50">
              {createHeadMutation.isPending ? "Saving..." : "Add Head"}
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Customer Modal */}
      <ModalShell
        open={modal?.type === "customers"}
        onClose={() => { setModal(null); customerForm.reset(); }}
        title="ADD CUSTOMER"
        subtitle="Buyer / Agency Registration"
      >
        <form onSubmit={customerForm.handleSubmit((data) => createCustomerMutation.mutate(data))} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Customer Code" error={customerForm.formState.errors.code?.message}>
            <input {...customerForm.register("code")} className={inputClass} placeholder="e.g. CUST-001" />
          </Field>
          <Field label="Customer Name" error={customerForm.formState.errors.name?.message}>
            <input {...customerForm.register("name")} className={inputClass} placeholder="e.g. GCC - Araku" />
          </Field>
          <Field label="Type">
            <input {...customerForm.register("type")} className={inputClass} placeholder="e.g. Govt, Private, Exporter" />
          </Field>
          <Field label="Contact Person">
            <input {...customerForm.register("contactPerson")} className={inputClass} placeholder="Contact name" />
          </Field>
          <Field label="Mobile">
            <input {...customerForm.register("mobile")} className={inputClass} placeholder="+91 00000 00000" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Address">
              <textarea {...customerForm.register("address")} className={inputClass} rows={2} placeholder="Full address..." />
            </Field>
          </div>
          <div className="md:col-span-2 mt-4 pt-6 border-t border-charcoal/10 flex justify-end gap-4">
            <button type="button" onClick={() => { setModal(null); customerForm.reset(); }} className="px-8 py-3 text-xs font-black uppercase tracking-widest border-2 border-charcoal hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={createCustomerMutation.isPending} className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50">
              {createCustomerMutation.isPending ? "Saving..." : "Add Customer"}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}

export default GradeExpCustomerMgmt;
