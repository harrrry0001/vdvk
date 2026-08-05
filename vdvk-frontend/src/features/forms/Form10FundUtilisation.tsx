import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, Send } from "lucide-react";
import { format } from "date-fns";
import { masterApi } from "@/api/endpoints/master";
import { mdaApi } from "@/api/endpoints/mda";
import { formsApi } from "@/api/endpoints/forms";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";

const LOCATION_TYPES = ["Hub", "Collection Centre", "Haat Bazaar"] as const;

const emptyToNull = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

const itemFormSchema = z.object({
  expenditureDate: z.string().min(1, "Required"),
  expenditureHeadCode: z.string().min(1, "Required"),
  expenditureHeadNameSnapshot: z.string().min(1, "Required"),
  relatedToVdvk: z.boolean(),
  vdvkCodes: z.array(z.string()).nullable(),
  relatedToLocation: z.boolean(),
  locationType: z.string().nullable().optional(),
  locationCodes: z.array(z.string()).nullable(),
  amount: z.number({ invalid_type_error: "Must be a number" }).min(0.01, "Must be > 0"),
  purpose: z.string().optional(),
  schemeSnapshot: z.string().optional(),
  remarks: z.string().nullable().optional(),
});

type ItemFormData = z.infer<typeof itemFormSchema>;

interface BatchEntry extends ItemFormData {
  id: string;
}

export function Form10FundUtilisation() {
  const queryClient = useQueryClient();
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>([]);
  const [isDraft, setIsDraft] = useState(true);
  const [weekFrom, setWeekFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [weekTo, setWeekTo] = useState(
    format(new Date(Date.now() + 6 * 86400000), "yyyy-MM-dd")
  );
  const [overallRemarks, setOverallRemarks] = useState("");

  const {
    register,
    handleSubmit: handleEntrySubmit,
    reset: resetEntryForm,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ItemFormData>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      expenditureDate: format(new Date(), "yyyy-MM-dd"),
      expenditureHeadCode: "",
      expenditureHeadNameSnapshot: "",
      relatedToVdvk: false,
      vdvkCodes: [],
      relatedToLocation: false,
      locationType: null,
      locationCodes: [],
      amount: 0,
      purpose: "",
      schemeSnapshot: "",
      remarks: null,
    },
  });

  const watchedExpenditureHeadCode = watch("expenditureHeadCode");
  const watchedRelatedToVdvk = watch("relatedToVdvk");
  const watchedRelatedToLocation = watch("relatedToLocation");
  const watchedLocationType = watch("locationType");

  const { data: expenditureHeads, isLoading: headsLoading } = useQuery({
    queryKey: ["master", "expenditure-heads"],
    queryFn: () => masterApi.getExpenditureHeads().then((r) => r.data ?? []),
  });

  const { data: vdvks } = useQuery({
    queryKey: ["master", "vdvks"],
    queryFn: () => masterApi.getVdvks().then((r) => r.data ?? []),
  });

  const { data: schemes } = useQuery({
    queryKey: ["master", "schemes"],
    queryFn: () => masterApi.getSchemes().then((r) => r.data ?? []),
  });

  const { data: facilities } = useQuery({
    queryKey: ["mda", "facilities", "by-type"],
    queryFn: () => mdaApi.getFacilitiesByType().then((r) => r.data ?? []),
  });

  const { data: recentRecords } = useQuery({
    queryKey: ["forms", "form10"],
    queryFn: () => formsApi.list("form10").then((r) => r.data ?? []),
  });

  const expenditureHeadOptions = useMemo(() => {
    const arr = Array.isArray(expenditureHeads) ? expenditureHeads : [];
    return arr.map((h: Record<string, unknown>) => ({
      code: (h.code as string) ?? (h.headCode as string) ?? (h.id as string) ?? "",
      name: (h.name as string) ?? (h.headName as string) ?? (h.description as string) ?? "",
    }));
  }, [expenditureHeads]);

  const vdvkOptions = useMemo(() => {
    const arr = Array.isArray(vdvks) ? vdvks : [];
    return arr.map((v: Record<string, unknown>) => ({
      code: (v.code as string) ?? (v.vdvkCode as string) ?? "",
      name: (v.name as string) ?? (v.vdvkName as string) ?? "",
    }));
  }, [vdvks]);

  const schemeOptions = useMemo(() => {
    const arr = Array.isArray(schemes) ? schemes : [];
    return arr.map((s: Record<string, unknown>) => ({
      name: (s.name as string) ?? (s.schemeName as string) ?? "",
    }));
  }, [schemes]);

  const facilityOptions = useMemo(() => {
    const arr = Array.isArray(facilities) ? facilities : [];
    return arr
      .filter((f: Record<string, unknown>) =>
        watchedLocationType
          ? (f.type as string) === watchedLocationType
          : true
      )
      .map((f: Record<string, unknown>) => ({
        code: (f.code as string) ?? (f.facilityCode as string) ?? "",
        name: (f.name as string) ?? (f.facilityName as string) ?? "",
      }));
  }, [facilities, watchedLocationType]);

  useEffect(() => {
    if (watchedExpenditureHeadCode) {
      const h = expenditureHeadOptions.find(
        (h) => h.code === watchedExpenditureHeadCode
      );
      setValue("expenditureHeadNameSnapshot", h?.name ?? "");
    } else {
      setValue("expenditureHeadNameSnapshot", "");
    }
  }, [watchedExpenditureHeadCode, expenditureHeadOptions, setValue]);

  const selectedVdvkCodes: string[] = watch("vdvkCodes") ?? [];

  const toggleVdvkCode = (code: string) => {
    const current = getValues("vdvkCodes") ?? [];
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    setValue("vdvkCodes", next as any);
  };

  const selectedLocationCodes: string[] = watch("locationCodes") ?? [];

  const toggleLocationCode = (code: string) => {
    const current = getValues("locationCodes") ?? [];
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    setValue("locationCodes", next as any);
  };

  const createMutation = useMutation({
    mutationFn: async (data: {
      weekFrom: string;
      weekTo: string;
      supportingDocuments?: string[];
      overallRemarks?: string;
      items: ItemFormData[];
    }) => {
      const { data: res } = await formsApi.create("form10", data);
      return res as { id: string; txnNo: string; status: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form10"] });
      setBatchEntries([]);
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => formsApi.submit("form10", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form10"] });
    },
  });

  const onAddEntry = handleEntrySubmit((data) => {
    setBatchEntries((prev) => [
      ...prev,
      { ...data, id: crypto.randomUUID() },
    ]);
    resetEntryForm({
      expenditureDate: data.expenditureDate,
      expenditureHeadCode: "",
      expenditureHeadNameSnapshot: "",
      relatedToVdvk: false,
      vdvkCodes: [],
      relatedToLocation: false,
      locationType: null,
      locationCodes: [],
      amount: 0,
      purpose: "",
      schemeSnapshot: "",
      remarks: null,
    });
  });

  const removeEntry = (id: string) => {
    setBatchEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const onSubmitBatch = async () => {
    if (batchEntries.length === 0) return;
    const items = batchEntries.map(({ id: _id, ...rest }) => rest);
    const body = {
      weekFrom,
      weekTo,
      overallRemarks: overallRemarks.trim() || undefined,
      items,
    };
    const result = await createMutation.mutateAsync(body);
    if (result?.id && !isDraft) {
      await submitMutation.mutateAsync(result.id);
    }
  };

  const totalAmount = useMemo(
    () => batchEntries.reduce((sum, e) => sum + e.amount, 0),
    [batchEntries]
  );

  if (headsLoading) return <PageLoading />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-charcoal tracking-wide uppercase">
            Weekly Fund Utilisation
          </h2>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Form 10</p>
        </div>
        <span className="bg-amber-500/10 text-amber-600 text-[10px] font-black px-3 py-1 rounded-full border border-amber-500/20 uppercase tracking-widest">
          Expense Form 10
        </span>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Pending Total
          </p>
          <p className="font-display text-3xl text-slate-900">
            {"\u20B9"} {totalAmount > 0 ? totalAmount.toLocaleString() : "--"}
          </p>
        </div>
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Entries This Batch
          </p>
          <p className="font-display text-3xl text-slate-900">
            {batchEntries.length}
          </p>
        </div>
        <div className="bg-charcoal p-6 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">
            Budget Utilised
          </p>
          <p className="font-display text-3xl text-golden">&mdash;</p>
        </div>
      </div>

      {/* Form Header */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
        <h3 className="font-display text-xl text-charcoal tracking-wide uppercase border-b border-charcoal/5 pb-2 mb-6">
          Week Range
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Week From
            </label>
            <input
              type="date"
              value={weekFrom}
              onChange={(e) => setWeekFrom(e.target.value)}
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Week To
            </label>
            <input
              type="date"
              value={weekTo}
              onChange={(e) => setWeekTo(e.target.value)}
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Overall Remarks
            </label>
            <input
              type="text"
              value={overallRemarks}
              onChange={(e) => setOverallRemarks(e.target.value)}
              placeholder="Week-level notes..."
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Entry Form */}
      <div className="bg-[#f8f9fa] border border-charcoal/5 rounded-3xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl text-charcoal tracking-wide uppercase border-b border-charcoal/5 pb-2">
            Fund Utilisation Entry
          </h3>
          {batchEntries.length > 0 && (
            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded border border-amber-200">
              {batchEntries.length} Entries Pending
            </span>
          )}
        </div>

        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Expenditure Date
            </label>
            <input
              type="date"
              {...register("expenditureDate")}
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
            />
            {errors.expenditureDate && (
              <p className="text-red-500 text-[10px]">{errors.expenditureDate.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Expenditure Head
            </label>
            <select
              {...register("expenditureHeadCode")}
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
            >
              <option value="">-- Select Head --</option>
              {expenditureHeadOptions.map((h) => (
                <option key={h.code} value={h.code}>
                  {h.name}
                </option>
              ))}
            </select>
            {errors.expenditureHeadCode && (
              <p className="text-red-500 text-[10px]">
                {errors.expenditureHeadCode.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Amount ({'\u20B9'})
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("amount", { valueAsNumber: true })}
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all font-mono"
            />
            {errors.amount && (
              <p className="text-red-500 text-[10px]">{errors.amount.message}</p>
            )}
          </div>
        </div>

        {/* Row 2: Related to VDVK toggle */}
        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register("relatedToVdvk")}
              className="w-4 h-4 rounded border-charcoal/20 text-charcoal"
            />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Related to VDVK
            </span>
          </label>
          {watchedRelatedToVdvk && (
            <div className="mt-3 border border-charcoal/10 rounded-xl bg-white p-4 max-h-48 overflow-y-auto">
              <p className="text-[10px] font-black uppercase tracking-widest text-charcoal/40 mb-2">
                Select VDVKs
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                {vdvkOptions.map((v) => (
                  <label
                    key={v.code}
                    className="flex items-center gap-2 text-xs py-1 cursor-pointer hover:bg-slate-50 px-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedVdvkCodes.includes(v.code)}
                      onChange={() => toggleVdvkCode(v.code)}
                      className="w-3 h-3 rounded"
                    />
                    {v.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Row 3: Related to Location toggle */}
        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register("relatedToLocation")}
              className="w-4 h-4 rounded border-charcoal/20 text-charcoal"
            />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Related to Location
            </span>
          </label>
          {watchedRelatedToLocation && (
            <div className="mt-3 space-y-3">
              <select
                {...register("locationType", { setValueAs: (v) => v || null })}
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
              >
                <option value="">-- Select Location Type --</option>
                {LOCATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="border border-charcoal/10 rounded-xl bg-white p-4 max-h-48 overflow-y-auto">
                <p className="text-[10px] font-black uppercase tracking-widest text-charcoal/40 mb-2">
                  Select Locations
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                  {facilityOptions.map((f) => (
                    <label
                      key={f.code}
                      className="flex items-center gap-2 text-xs py-1 cursor-pointer hover:bg-slate-50 px-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedLocationCodes.includes(f.code)}
                        onChange={() => toggleLocationCode(f.code)}
                        className="w-3 h-3 rounded"
                      />
                      {f.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Row 4: Purpose, Scheme, Remarks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Purpose
            </label>
            <input
              type="text"
              {...register("purpose")}
              placeholder="e.g. Procurement, Transport"
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Scheme
            </label>
            <select
              {...register("schemeSnapshot")}
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
            >
              <option value="">-- Select Scheme --</option>
              {schemeOptions.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Remarks
            </label>
            <textarea
              {...register("remarks", { setValueAs: (v) => v || null })}
              rows={1}
              placeholder="Voucher no, notes..."
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onAddEntry}
            className="px-10 py-4 bg-charcoal text-golden rounded-xl text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-black transition-all shadow-lg"
          >
            <Plus size={18} />
            Add Fund Entry
          </button>
        </div>
      </div>

      {/* Fund Utilisation Table */}
      <div className="bg-[#f8f9fa] border border-charcoal/5 rounded-3xl overflow-hidden">
        <div className="bg-charcoal px-6 py-4 flex justify-between items-center">
          <h3 className="font-display text-lg tracking-widest text-white">
            Fund Utilisation Register
          </h3>
          {batchEntries.length > 0 && (
            <span className="text-[10px] font-black uppercase tracking-widest text-golden/80">
              {batchEntries.length} pending
            </span>
          )}
        </div>

        {batchEntries.length === 0 &&
        (!Array.isArray(recentRecords) || recentRecords.length === 0) ? (
          <div className="px-8 pb-8 pt-4">
            <EmptyState
              title="No Fund Entries Yet"
              description="Add fund utilisation entries using the form above."
            />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-charcoal/50 border-b border-slate-200">
                <tr>
                  <th className="p-4 border-r border-slate-200">Date</th>
                  <th className="p-4 border-r border-slate-200">Head</th>
                  <th className="p-4 border-r border-slate-200 text-center">Amount</th>
                  <th className="p-4 border-r border-slate-200">VDVK</th>
                  <th className="p-4 border-r border-slate-200">Location</th>
                  <th className="p-4 border-r border-slate-200">Purpose</th>
                  <th className="p-4 border-r border-slate-200">Scheme</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-charcoal">
                {batchEntries.map((entry) => {
                  const headName =
                    expenditureHeadOptions.find(
                      (h) => h.code === entry.expenditureHeadCode
                    )?.name ?? entry.expenditureHeadCode;
                  const vdvkNames = (entry.vdvkCodes ?? [])
                    .map(
                      (c) =>
                        vdvkOptions.find((v) => v.code === c)?.name ?? c
                    )
                    .join(", ");
                  const locNames = (entry.locationCodes ?? [])
                    .map(
                      (c) =>
                        facilityOptions.find((f) => f.code === c)?.name ?? c
                    )
                    .join(", ");
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 border-r border-slate-100 text-xs">
                        {format(
                          new Date(entry.expenditureDate + "T00:00:00"),
                          "dd/MM/yyyy"
                        )}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-xs font-bold">
                        {headName}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-center font-mono text-xs font-bold">
                        {"\u20B9"} {entry.amount.toLocaleString()}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-xs">
                        {vdvkNames || "--"}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-xs">
                        {locNames || "--"}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-xs">
                        {entry.purpose || "--"}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-xs">
                        {entry.schemeSnapshot || "--"}
                      </td>
                      <td className="p-4 text-center">
                        <StatusBadge status="Draft" />
                      </td>
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit Actions */}
      {batchEntries.length > 0 && (
        <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-xs font-bold text-charcoal/40">
              Batch Status:
            </span>
            <span className="bg-amber-500/10 text-amber-600 text-[10px] font-black px-3 py-1 rounded-full border border-amber-500/20 uppercase tracking-widest">
              Draft / In-Progress
            </span>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button
              type="button"
              onClick={() => {
                setIsDraft(true);
                onSubmitBatch();
              }}
              disabled={createMutation.isPending || submitMutation.isPending}
              className="flex-1 md:flex-initial px-8 py-4 bg-slate-50 hover:bg-slate-100 text-charcoal text-xs font-black uppercase tracking-[0.2em] rounded-xl border border-slate-200 transition-all disabled:opacity-50"
            >
              <Save size={18} className="inline mr-2" />
              {createMutation.isPending ? "Saving..." : "Save Progress"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsDraft(false);
                onSubmitBatch();
              }}
              disabled={createMutation.isPending || submitMutation.isPending}
              className="flex-1 md:flex-initial px-10 py-4 bg-charcoal text-golden text-xs font-black uppercase tracking-[0.2em] rounded-xl hover:bg-black transition-all shadow-lg disabled:opacity-50"
            >
              <Send size={18} className="inline mr-2" />
              {createMutation.isPending || submitMutation.isPending
                ? "Submitting..."
                : "Submit Register"}
            </button>
          </div>
        </div>
      )}

      {createMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Failed to save fund entries. Please try again.
        </div>
      )}
      {createMutation.isSuccess && batchEntries.length === 0 && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          {isDraft
            ? "Draft saved successfully."
            : "Fund utilisation register submitted for approval."}
        </div>
      )}
    </div>
  );
}
