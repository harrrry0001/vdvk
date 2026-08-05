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
import { formsApi } from "@/api/endpoints/forms";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileText,
  Wrench,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AuditRecord {
  id: string;
  formType?: string;
  transactionId?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  correctedBy?: string;
  correctedAt?: string;
  reason?: string;
  status?: string;
}

interface RejectedRecord {
  id: string;
  formType?: string;
  transactionId?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  status?: string;
}

interface CorrectionEntry {
  id: string;
  transactionId: string;
  field: string;
  oldValue: string;
  newValue: string;
}

/* ------------------------------------------------------------------ */
/*  Zod Schema                                                         */
/* ------------------------------------------------------------------ */

const correctionSchema = z.object({
  formType: z.string().min(1, "Form type is required"),
  field: z.string().min(1, "Field to correct is required"),
  transactionId: z.string().min(1, "Transaction ID is required"),
  dateFrom: z.string().optional().or(z.literal("")),
  dateTo: z.string().optional().or(z.literal("")),
  reason: z.string().min(1, "Reason is required"),
});

type CorrectionForm = z.infer<typeof correctionSchema>;

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

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function DataCorrection() {
  const queryClient = useQueryClient();
  const [notif, setNotif] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [searchText, setSearchText] = useState("");
  const [previewRows, setPreviewRows] = useState<CorrectionEntry[]>([]);

  const notify = (message: string, type: "success" | "error") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 5000);
  };

  /* --- queries --- */

  const { data: auditTrail, isLoading, isError } = useQuery({
    queryKey: ["mda", "audit-trail"],
    queryFn: async () => {
      const res = await mdaApi.getAuditTrail();
      return (res.data?.data ?? res.data ?? []) as AuditRecord[];
    },
  });

  const { data: rejectedRecords = [], isLoading: rejectedLoading } = useQuery({
    queryKey: ["mda", "rejected-records"],
    queryFn: async () => {
      const res = await mdaApi.getRejectedRecords();
      return (res.data?.data ?? res.data ?? []) as RejectedRecord[];
    },
  });

  /* --- form --- */

  const correctionForm = useForm<CorrectionForm>({
    resolver: zodResolver(correctionSchema),
    defaultValues: { formType: "", field: "", transactionId: "", dateFrom: "", dateTo: "", reason: "" },
  });

  /* --- mock preview --- */

  const handlePreview = (data: CorrectionForm) => {
    setPreviewRows([
      {
        id: "1",
        transactionId: data.transactionId,
        field: data.field,
        oldValue: "(Fetching old value...)",
        newValue: "",
      },
    ]);
  };

  /* --- mutation --- */

  const correctMutation = useMutation({
    mutationFn: (entry: { formType: string; transactionId: string; updates: Record<string, unknown> }) =>
      formsApi.update(entry.formType, entry.transactionId, entry.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "audit-trail"] });
      setPreviewRows([]);
      correctionForm.reset();
      notify("Correction applied successfully", "success");
    },
    onError: () => notify("Failed to apply correction", "error"),
  });

  const handleApplyCorrection = () => {
    const formData = correctionForm.getValues();
    const updates = previewRows.reduce(
      (acc, row) => ({ ...acc, [row.field]: row.newValue }),
      {} as Record<string, unknown>,
    );
    correctMutation.mutate({ formType: formData.formType, transactionId: formData.transactionId, updates });
  };

  /* --- audit trail columns --- */

  const filteredAuditTrail = useMemo(() => {
    if (!auditTrail) return [];
    if (!searchText.trim()) return auditTrail;
    const q = searchText.toLowerCase();
    return auditTrail.filter(
      (r) =>
        r.transactionId?.toLowerCase().includes(q) ||
        r.field?.toLowerCase().includes(q) ||
        r.correctedBy?.toLowerCase().includes(q),
    );
  }, [auditTrail, searchText]);

  const auditColumns: ColumnDef<AuditRecord>[] = useMemo(
    () => [
      {
        accessorKey: "transactionId",
        header: "Transaction ID",
        cell: ({ getValue }) => <span className="font-mono text-xs font-bold">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "formType",
        header: "Form Type",
        cell: ({ getValue }) => <span className="text-[10px] font-black uppercase">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "field",
        header: "Field",
        cell: ({ getValue }) => <span className="text-xs font-bold">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "oldValue",
        header: "Old Value",
        cell: ({ getValue }) => <span className="text-xs text-red-600 line-through">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "newValue",
        header: "New Value",
        cell: ({ getValue }) => <span className="text-xs text-green-600 font-bold">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "correctedBy",
        header: "Corrected By",
        cell: ({ getValue }) => <span className="text-xs font-medium">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "correctedAt",
        header: "Date",
        cell: ({ getValue }) => <span className="text-[10px] font-mono">{getValue<string>() || "—"}</span>,
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ getValue }) => <span className="text-xs text-charcoal/60 max-w-[200px] truncate block">{getValue<string>() || "—"}</span>,
      },
    ],
    [],
  );

  const [sorting, setSorting] = useState<SortingState>([]);

  const auditTable = useReactTable({
    data: filteredAuditTrail,
    columns: auditColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  /* --- loading / error --- */

  if (isLoading) return <PageLoading />;

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="section-heading text-2xl mb-2">Failed to Load Audit Trail</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {notif && <NotificationBanner message={notif.message} type={notif.type} onDismiss={() => setNotif(null)} />}

      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-300 p-6 flex items-start gap-4">
        <AlertTriangle size={24} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-black uppercase text-amber-800 mb-1">Administrative Data Correction</h3>
          <p className="text-xs text-amber-700 leading-relaxed">
            This utility is strictly for correction of approved transactions where data entry errors have been identified.
            All corrections require offline DPM approval before execution. Misuse is logged and auditable.
          </p>
        </div>
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-2 border-charcoal pb-8">
        <div>
          <h1 className="section-heading text-6xl leading-[0.9] tracking-tighter text-charcoal">
            DATA CORRECTION
          </h1>
          <p className="text-charcoal/50 text-xs font-black uppercase tracking-[0.3em] mt-4">
            Administrative correction of approved transactions
          </p>
        </div>
      </div>

      {/* Two-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Panel - Correction Form */}
        <div className="bg-white border border-charcoal/10 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-charcoal text-golden flex items-center justify-center">
              <Wrench size={20} />
            </div>
            <h3 className="section-heading text-2xl">Record Correction</h3>
          </div>

          <form onSubmit={correctionForm.handleSubmit(handlePreview)} className="space-y-5">
            <Field label="Form Type" error={correctionForm.formState.errors.formType?.message}>
              <select {...correctionForm.register("formType")} className={inputClass}>
                <option value="">Select Form Type</option>
                <option value="form1">Form 1 - MFP Collection</option>
                <option value="form2">Form 2 - Stock Transfer</option>
                <option value="form3">Form 3 - Processing</option>
                <option value="form4">Form 4 - Sales Entry</option>
                <option value="form6">Form 6 - Beneficiary Registration</option>
                <option value="form5">Form 5 - VDVK Registration</option>
                <option value="form7">Form 7 - Machinery Registration</option>
                <option value="form8">Form 8 - Machinery Utilisation</option>
                <option value="form10">Form 10 - Fund Utilisation</option>
                <option value="form11">Form 11 - Facility Registration</option>
              </select>
            </Field>

            <Field label="Field to Correct" error={correctionForm.formState.errors.field?.message}>
              <input {...correctionForm.register("field")} className={inputClass} placeholder="e.g. quantity, amount, name" />
            </Field>

            <Field label="Transaction / Record ID" error={correctionForm.formState.errors.transactionId?.message}>
              <input {...correctionForm.register("transactionId")} className={inputClass} placeholder="e.g. F1-2024-00123" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Date From">
                <input {...correctionForm.register("dateFrom")} type="date" className={inputClass} />
              </Field>
              <Field label="Date To">
                <input {...correctionForm.register("dateTo")} type="date" className={inputClass} />
              </Field>
            </div>

            <Field label="Reason for Correction" error={correctionForm.formState.errors.reason?.message}>
              <textarea
                {...correctionForm.register("reason")}
                className={cn(inputClass, "h-24 resize-none")}
                placeholder="Detailed justification for the correction..."
              />
            </Field>

            <button
              type="submit"
              className="w-full py-4 bg-charcoal text-golden text-xs font-black uppercase tracking-widest hover:bg-dark-gray transition-colors"
            >
              Preview Correction
            </button>
          </form>
        </div>

        {/* Right Panel - Preview */}
        <div className="bg-white border border-charcoal/10 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-charcoal text-golden flex items-center justify-center">
              <ClipboardCheck size={20} />
            </div>
            <h3 className="section-heading text-2xl">Correction Preview</h3>
          </div>

          {previewRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText size={48} className="text-gray-300 mb-4" />
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No Preview Available</p>
              <p className="text-xs text-gray-400 mt-1">Search for a record and preview changes</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b-2 border-charcoal">
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest">Field</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest">Old Value</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest bg-amber-50">New Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal/5">
                    {previewRows.map((row) => (
                      <tr key={row.id}>
                        <td className="p-3 text-xs font-bold">{row.field}</td>
                        <td className="p-3 text-xs text-red-600 line-through">{row.oldValue}</td>
                        <td className="p-3">
                          <input
                            type="text"
                            className="border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-bold w-full outline-none focus:border-charcoal"
                            value={row.newValue}
                            onChange={(e) =>
                              setPreviewRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, newValue: e.target.value } : r)),
                              )
                            }
                            placeholder="Enter new value..."
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 pt-4 border-t border-charcoal/10">
                <button
                  onClick={() => setPreviewRows([])}
                  className="flex-1 py-3 text-xs font-black uppercase tracking-widest border-2 border-charcoal hover:bg-gray-50 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={handleApplyCorrection}
                  disabled={correctMutation.isPending}
                  className="flex-1 py-3 text-xs font-black uppercase tracking-widest bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50"
                >
                  {correctMutation.isPending ? "Applying..." : "Apply Correction"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audit Trail Table */}
      <div className="space-y-4">
        <div className="flex items-end justify-between">
          <h3 className="section-heading text-2xl">Audit Trail</h3>
          <div className="w-72 flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">Search</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40" />
              <input
                type="text"
                placeholder="Search by ID, field, user..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className={cn(inputClass, "pl-10")}
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-charcoal/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                {auditTable.getHeaderGroups().map((hg) => (
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
                {auditTable.getRowModel().rows.map((row) => (
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
                {auditTable.getRowModel().rows.length === 0 && (
                  <tr>
                    <td colSpan={auditColumns.length} className="p-0">
                      <EmptyState
                        icon={<FileText size={48} />}
                        title="No audit records found"
                        description="Corrected records will appear here"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredAuditTrail.length > 0 && (
            <div className="p-4 flex items-center justify-between border-t border-charcoal/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">
                Showing {auditTable.getState().pagination.pageIndex * auditTable.getState().pagination.pageSize + 1}
                {" \u2013 "}
                {Math.min(
                  (auditTable.getState().pagination.pageIndex + 1) * auditTable.getState().pagination.pageSize,
                  filteredAuditTrail.length,
                )}{" "}
                of {filteredAuditTrail.length}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => auditTable.previousPage()}
                  disabled={!auditTable.getCanPreviousPage()}
                  className="w-8 h-8 flex items-center justify-center border border-charcoal/10 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: auditTable.getPageCount() }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => auditTable.setPageIndex(i)}
                    className={cn(
                      "w-8 h-8 flex items-center justify-center text-[10px] font-bold",
                      auditTable.getState().pagination.pageIndex === i ? "bg-charcoal text-white" : "border border-charcoal/10 hover:bg-gray-50",
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => auditTable.nextPage()}
                  disabled={!auditTable.getCanNextPage()}
                  className="w-8 h-8 flex items-center justify-center border border-charcoal/10 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rejected Records */}
      <div className="space-y-4">
        <h3 className="section-heading text-2xl">Rejected Records</h3>

        {rejectedLoading ? (
          <PageLoading />
        ) : rejectedRecords.length === 0 ? (
          <EmptyState
            icon={<FileText size={48} />}
            title="No rejected records found"
            description="Rejected transactions will appear here"
          />
        ) : (
          <div className="bg-white border border-charcoal/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-charcoal text-golden">
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Transaction ID</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Form Type</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Rejected By</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Reason</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Date</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/5">
                  {rejectedRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-xs font-mono font-bold">{r.transactionId || "—"}</td>
                      <td className="p-4 text-[10px] font-black uppercase">{r.formType || "—"}</td>
                      <td className="p-4 text-xs font-medium">{r.rejectedBy || "—"}</td>
                      <td className="p-4 text-xs text-red-600 max-w-[250px] truncate block">{r.rejectionReason || "—"}</td>
                      <td className="p-4 text-[10px] font-mono">{r.rejectedAt || "—"}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-red-50 text-red-700 border border-red-200">
                          {r.status || "Rejected"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataCorrection;
