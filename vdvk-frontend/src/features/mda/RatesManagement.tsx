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
  IndianRupee,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  History,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

interface ApiRate {
  id: string | number;
  commodityCode?: string;
  gradeCode?: string;
  ratePerKg?: number | null;
  ratePerPiece?: number | null;
  unit?: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
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
  effectiveTo?: string | null;
  status?: string;
}

interface Commodity {
  code: string;
  name: string;
}

interface Grade {
  code: string;
  name: string;
  commodityCode?: string;
}

const rateRevisionSchema = z.object({
  commodityCode: z.string().min(1, "Commodity is required"),
  gradeCode: z.string().min(1, "Grade is required"),
  newRate: z.coerce.number({ invalid_type_error: "Rate is required" }).min(0),
  unit: z.string().min(1, "Unit is required"),
  effectiveFrom: z.string().min(1, "Effective date is required"),
  autoCloseOld: z.boolean(),
});
type RateRevisionForm = z.infer<typeof rateRevisionSchema>;

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
    <div className={cn("flex items-center justify-between px-6 py-3 text-xs font-bold uppercase tracking-widest", type === "success" ? "bg-green-600/10 text-green-700 border border-green-200" : "bg-red-600/10 text-red-700 border border-red-200")}>
      <div className="flex items-center gap-2">
        {type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
        {message}
      </div>
      <button onClick={onDismiss} className="p-1 hover:opacity-60"><X size={16} /></button>
    </div>
  );
}

function ModalShell({ open, onClose, title, subtitle, children }: { open: boolean; onClose: () => void; title: string; subtitle: string; children: React.ReactNode }) {
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
            <button onClick={onClose} className="p-2 hover:bg-gray-100 transition-colors"><X size={24} /></button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-black uppercase tracking-widest">{label}</label>
      {children}
      {error && <p className="text-[10px] text-red-600 font-bold">{error}</p>}
    </div>
  );
}

const inputClass = "border border-charcoal/15 px-3 py-3 text-sm w-full outline-none focus:border-charcoal focus:shadow-[0_0_0_1px_#171e19] bg-white";
const STATUS_VARIANTS: Record<string, string> = { Active: "bg-green-100 text-green-800 border border-green-200", Inactive: "bg-gray-100 text-gray-500 border border-gray-200", Expired: "bg-red-50 text-red-700 border border-red-200" };

export function RatesManagement() {
  const queryClient = useQueryClient();
  const [notif, setNotif] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);

  const notify = (message: string, type: "success" | "error") => { setNotif({ message, type }); setTimeout(() => setNotif(null), 5000); };

  const { data: rawRates, isLoading: ratesLoading, isError: ratesError } = useQuery({
    queryKey: ["mda", "rates", "all"],
    queryFn: async () => { const res = await mdaApi.getAllRates(); return (res.data?.data ?? res.data ?? []) as ApiRate[]; },
  });
  const { data: commodities = [] } = useQuery({
    queryKey: ["master", "commodities"],
    queryFn: async () => { const res = await masterApi.getCommodities(); return (res.data?.data ?? res.data ?? []) as Commodity[]; },
  });
  const { data: grades = [] } = useQuery({
    queryKey: ["master", "grades"],
    queryFn: async () => { const res = await masterApi.getGrades(); return (res.data?.data ?? res.data ?? []) as Grade[]; },
  });

  // Map API rates to display rates with names
  const rates = useMemo(() => {
    if (!rawRates) return [];
    const commodityMap: Record<string, string> = {};
    commodities.forEach((c) => { commodityMap[c.code] = c.name; });
    const gradeMap: Record<string, string> = {};
    grades.forEach((g) => { gradeMap[g.code] = g.name; });

    return rawRates.map((r) => {
      const rateVal = (r.ratePerKg ?? r.ratePerPiece ?? 0);
      const now = new Date().toISOString().split("T")[0];
      const expired = r.effectiveTo && r.effectiveFrom && r.effectiveTo < r.effectiveFrom;
      const status = expired ? "Expired" : (!r.effectiveTo || r.effectiveTo >= now ? "Active" : "Expired");
      return {
        id: String(r.id),
        commodityCode: r.commodityCode,
        commodityName: commodityMap[r.commodityCode ?? ""] || r.commodityCode || "\u2014",
        gradeCode: r.gradeCode,
        gradeName: gradeMap[r.gradeCode ?? ""] || r.gradeCode || "\u2014",
        rate: rateVal,
        unit: r.unit || "\u2014",
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo || null,
        status,
      } as Rate;
    });
  }, [rawRates, commodities, grades]);

  const reviseRateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => mdaApi.reviseRate(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mda", "rates"] }); setModalOpen(false); revisionForm.reset(); notify("Rate revised successfully", "success"); },
    onError: () => notify("Failed to revise rate", "error"),
  });
  const createRateMutation = useMutation({
    mutationFn: (data: unknown) => mdaApi.createRate(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mda", "rates"] }); setModalOpen(false); revisionForm.reset(); notify("New rate created successfully", "success"); },
    onError: () => notify("Failed to create rate", "error"),
  });

  const revisionForm = useForm<RateRevisionForm>({
    resolver: zodResolver(rateRevisionSchema),
    defaultValues: { commodityCode: "", gradeCode: "", newRate: 0, unit: "", effectiveFrom: new Date().toISOString().split("T")[0], autoCloseOld: true },
  });

  const openRevisionModal = (rate?: Rate) => {
    setSelectedRate(rate || null);
    revisionForm.reset(rate ? { commodityCode: rate.commodityCode || "", gradeCode: rate.gradeCode || "", newRate: rate.rate, unit: rate.unit || "", effectiveFrom: new Date().toISOString().split("T")[0], autoCloseOld: true } : { commodityCode: "", gradeCode: "", newRate: 0, unit: "", effectiveFrom: new Date().toISOString().split("T")[0], autoCloseOld: true });
    setModalOpen(true);
  };

  const filteredRates = useMemo(() => {
    if (!rates) return [];
    if (!searchText.trim()) return rates;
    const q = searchText.toLowerCase();
    return rates.filter((r) => r.commodityName?.toLowerCase().includes(q) || r.gradeName?.toLowerCase().includes(q) || String(r.rate).includes(q));
  }, [rates, searchText]);

  const activeRates = useMemo(() => filteredRates.filter((r) => r.status === "Active"), [filteredRates]);
  const historyRates = useMemo(() => filteredRates.filter((r) => r.status !== "Active"), [filteredRates]);

  const rateColumns: ColumnDef<Rate>[] = useMemo(() => [
    { accessorKey: "commodityName", header: "Commodity", cell: ({ getValue }) => <span className="font-black text-xs uppercase">{getValue<string>() || "\u2014"}</span> },
    { accessorKey: "gradeName", header: "Grade", cell: ({ getValue }) => <span className="text-xs font-bold">{getValue<string>() || "\u2014"}</span> },
    { accessorKey: "rate", header: "Rate", cell: ({ getValue }) => <span className="font-mono text-sm font-bold">{"\u20B9"} {new Intl.NumberFormat("en-IN").format(getValue<number>())}</span> },
    { accessorKey: "unit", header: "Unit", cell: ({ getValue }) => <span className="text-xs">{getValue<string>() || "\u2014"}</span> },
    { accessorKey: "effectiveFrom", header: "Effective From", cell: ({ getValue }) => <span className="text-xs font-mono">{getValue<string>() || "\u2014"}</span> },
    { accessorKey: "effectiveTo", header: "Effective To", cell: ({ getValue }) => <span className="text-xs font-mono">{getValue<string>() || "Ongoing"}</span> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => { const s = getValue<string>() || "Active"; return <span className={cn("px-2 py-0.5 text-[9px] font-black uppercase", STATUS_VARIANTS[s] ?? STATUS_VARIANTS.Active)}>{s}</span>; } },
    { id: "actions", header: "Actions", cell: ({ row }) => (<button onClick={() => openRevisionModal(row.original)} className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-charcoal text-golden hover:bg-dark-gray transition-colors">Revise</button>) },
  ], []);

  const [activeSorting, setActiveSorting] = useState<SortingState>([]);
  const [historySorting, setHistorySorting] = useState<SortingState>([]);

  const activeTable = useReactTable({ data: activeRates, columns: rateColumns, state: { sorting: activeSorting }, onSortingChange: setActiveSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize: 8 } } });
  const historyTable = useReactTable({ data: historyRates, columns: rateColumns, state: { sorting: historySorting }, onSortingChange: setHistorySorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize: 8 } } });

  const renderTable = (table: ReturnType<typeof useReactTable>, data: unknown[], cols: ColumnDef<unknown>[], emptyIcon: React.ReactNode, emptyTitle: string, emptyDesc: string) => (
    <div className="bg-white border border-charcoal/10">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-charcoal text-golden">
                {hg.headers.map((header) => (
                  <th key={header.id} onClick={header.column.getToggleSortingHandler()} className={cn("p-4 text-[10px] font-black uppercase tracking-widest", header.column.getCanSort() ? "cursor-pointer select-none" : "")}>
                    <div className="flex items-center gap-1">
                      {typeof header.column.columnDef.header === "function" ? (header.column.columnDef.header as () => React.ReactNode)() : (header.column.columnDef.header as string)}
                      {header.column.getCanSort() && (<span className="flex flex-col -space-y-1"><ChevronUp size={12} className={cn(header.column.getIsSorted() === "asc" ? "text-golden" : "text-golden/30")} /><ChevronDown size={12} className={cn(header.column.getIsSorted() === "desc" ? "text-golden" : "text-golden/30")} /></span>)}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-charcoal/5">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                {row.getVisibleCells().map((cell) => (<td key={cell.id} className="p-4">{typeof cell.column.columnDef.cell === "function" ? (cell.column.columnDef.cell as (ctx: unknown) => React.ReactNode)(cell.getContext()) : null}</td>))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (<tr><td colSpan={cols.length} className="p-0"><EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDesc} /></td></tr>)}
          </tbody>
        </table>
      </div>
      {(data as unknown[]).length > 0 && (
        <div className="p-4 flex items-center justify-between border-t border-charcoal/5">
          <p className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}{" \u2013 "}{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, (data as unknown[]).length)} of {(data as unknown[]).length}</p>
          <div className="flex gap-2">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="w-8 h-8 flex items-center justify-center border border-charcoal/10 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft size={14} /></button>
            {Array.from({ length: table.getPageCount() }, (_, i) => (<button key={i} onClick={() => table.setPageIndex(i)} className={cn("w-8 h-8 flex items-center justify-center text-[10px] font-bold", table.getState().pagination.pageIndex === i ? "bg-charcoal text-white" : "border border-charcoal/10 hover:bg-gray-50")}>{i + 1}</button>))}
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="w-8 h-8 flex items-center justify-center border border-charcoal/10 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );

  if (ratesLoading) return <PageLoading />;
  if (ratesError) return (<div className="flex items-center justify-center min-h-[60vh]"><div className="text-center"><ShieldAlert size={48} className="mx-auto text-red-400 mb-4" /><h2 className="section-heading text-2xl mb-2">Failed to Load Rates</h2></div></div>);

  return (
    <div className="space-y-8">
      {notif && <NotificationBanner message={notif.message} type={notif.type} onDismiss={() => setNotif(null)} />}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-2 border-charcoal pb-8">
        <div>
          <h1 className="section-heading text-6xl leading-[0.9] tracking-tighter text-charcoal">RATES MANAGEMENT</h1>
          <p className="text-charcoal/50 text-xs font-black uppercase tracking-[0.3em] mt-4">Commodity Pricing - Current & Historical</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => openRevisionModal()} className="px-6 py-3 bg-charcoal text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-dark-gray transition-colors"><Plus size={14} />New Rate Revision</button>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <h3 className="section-heading text-2xl">Current Rates</h3>
        <div className="w-72 flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">Search</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40" />
            <input type="text" placeholder="Search by commodity, grade..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className={cn(inputClass, "pl-10")} />
          </div>
        </div>
      </div>
      {renderTable(activeTable as ReturnType<typeof useReactTable>, activeRates, rateColumns as ColumnDef<unknown>[], <IndianRupee size={48} />, "No active rates found", "Create a new rate revision to get started")}
      {historyRates.length > 0 && (
        <div className="space-y-4">
          <h3 className="section-heading text-2xl flex items-center gap-2"><History size={20} />Rate History</h3>
          {renderTable(historyTable as ReturnType<typeof useReactTable>, historyRates, rateColumns as ColumnDef<unknown>[], <History size={48} />, "No rate history", "Past rate revisions will appear here")}
        </div>
      )}
      <ModalShell open={modalOpen} onClose={() => { setModalOpen(false); revisionForm.reset(); setSelectedRate(null); }} title={selectedRate ? "REVISE RATE" : "NEW RATE"} subtitle={selectedRate ? "Updating rate for existing commodity-grade" : "Create a new commodity rate entry"}>
        <form onSubmit={revisionForm.handleSubmit((data) => { if (selectedRate) { reviseRateMutation.mutate({ id: selectedRate.id, data }); } else { createRateMutation.mutate(data); } })} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Commodity" error={revisionForm.formState.errors.commodityCode?.message}>
            <select {...revisionForm.register("commodityCode")} className={inputClass}><option value="">Select Commodity</option>{commodities.map((c) => (<option key={c.code} value={c.code}>{c.name}</option>))}</select>
          </Field>
          <Field label="Grade" error={revisionForm.formState.errors.gradeCode?.message}>
            <select {...revisionForm.register("gradeCode")} className={inputClass}><option value="">Select Grade</option>{grades.map((g) => (<option key={g.code} value={g.code}>{g.name}</option>))}</select>
          </Field>
          <Field label="New Rate" error={revisionForm.formState.errors.newRate?.message}>
            <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-charcoal/50 font-bold">{"\u20B9"}</span><input {...revisionForm.register("newRate")} type="number" className={cn(inputClass, "pl-8")} placeholder="0" /></div>
          </Field>
          <Field label="Unit" error={revisionForm.formState.errors.unit?.message}>
            <input {...revisionForm.register("unit")} className={inputClass} placeholder="e.g. Kg, Quintal, Litre" />
          </Field>
          <Field label="Effective From" error={revisionForm.formState.errors.effectiveFrom?.message}>
            <input {...revisionForm.register("effectiveFrom")} type="date" className={inputClass} />
          </Field>
          <div className="flex items-end">
            <Field label="Auto-close Old Rate">
              <div className="flex items-center gap-3 mt-2">
                <button type="button" onClick={() => revisionForm.setValue("autoCloseOld", !revisionForm.watch("autoCloseOld"))} className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", revisionForm.watch("autoCloseOld") ? "bg-charcoal" : "bg-gray-300")}>
                  <div className={cn("absolute top-1 w-3 h-3 rounded-full transition-all", revisionForm.watch("autoCloseOld") ? "right-1 bg-golden" : "left-1 bg-white")} />
                </button>
                <span className="text-xs font-bold">{revisionForm.watch("autoCloseOld") ? "Yes" : "No"}</span>
              </div>
            </Field>
          </div>
          <div className="md:col-span-2 mt-4 pt-6 border-t border-charcoal/10 flex justify-end gap-4">
            <button type="button" onClick={() => { setModalOpen(false); revisionForm.reset(); setSelectedRate(null); }} className="px-8 py-3 text-xs font-black uppercase tracking-widest border-2 border-charcoal hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={reviseRateMutation.isPending || createRateMutation.isPending} className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50">
              {reviseRateMutation.isPending || createRateMutation.isPending ? "Saving..." : selectedRate ? "Revise Rate" : "Create Rate"}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}

export default RatesManagement;
