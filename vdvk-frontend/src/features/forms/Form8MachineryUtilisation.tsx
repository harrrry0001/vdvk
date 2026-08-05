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
import { cn } from "@/lib/utils";

const LOCATION_TYPES = ["Hub", "Collection Centre", "Haat Bazaar"] as const;
const UNITS = ["Kg", "Pieces", "Both"] as const;

const emptyToNull = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

const itemFormSchema = z.object({
  locationType: z.enum(LOCATION_TYPES),
  facilityCode: z.string().optional(),
  facilityNameSnapshot: z.string(),
  vdvkCode: z.string().optional(),
  vdvkNameSnapshot: z.string().optional(),
  mandal: z.string().optional(),
  machineryId: z.string().min(1, "Required"),
  machineryNameSnapshot: z.string().min(1, "Required"),
  commodityCode: z.string().min(1, "Required"),
  commodityNameSnapshot: z.string().min(1, "Required"),
  unit: z.enum(UNITS),
  rawQtyKg: z.number().nullable(),
  rawQtyPcs: z.number().nullable(),
  packetDetails: z.string().nullable(),
  finalOutputKg: z.number().nullable(),
  finalOutputPcs: z.number().nullable(),
  utilisationHours: z.number().nullable(),
  remarks: z.string().nullable().optional(),
  form3ReferenceId: z.string().nullable().optional(),
});

type ItemFormData = z.infer<typeof itemFormSchema>;

interface BatchEntry extends ItemFormData {
  id: string;
}

export function Form8MachineryUtilisation() {
  const queryClient = useQueryClient();
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>([]);
  const [isDraft, setIsDraft] = useState(true);
  const [processingDate, setProcessingDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [overallRemarks, setOverallRemarks] = useState("");

  const {
    register,
    handleSubmit: handleEntrySubmit,
    reset: resetEntryForm,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ItemFormData>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      locationType: "Hub",
      facilityCode: "",
      facilityNameSnapshot: "",
      vdvkCode: "",
      vdvkNameSnapshot: "",
      mandal: "",
      machineryId: "",
      machineryNameSnapshot: "",
      commodityCode: "",
      commodityNameSnapshot: "",
      unit: "Kg",
      rawQtyKg: null,
      rawQtyPcs: null,
      packetDetails: null,
      finalOutputKg: null,
      finalOutputPcs: null,
      utilisationHours: null,
      remarks: null,
      form3ReferenceId: null,
    },
  });

  const watchedLocationType = watch("locationType");
  const watchedFacilityCode = watch("facilityCode");
  const watchedVdvkCode = watch("vdvkCode");
  const watchedMachineryId = watch("machineryId");
  const watchedCommodityCode = watch("commodityCode");
  const watchedUnit = watch("unit");

  const { data: commodities, isLoading: commoditiesLoading } = useQuery({
    queryKey: ["master", "commodities"],
    queryFn: () => masterApi.getCommodities().then((r) => r.data ?? []),
  });

  const { data: machinery, isLoading: machineryLoading } = useQuery({
    queryKey: ["mda", "machinery", "list"],
    queryFn: () =>
      mdaApi
        .crud("machinery")
        .list()
        .then((r) => r.data ?? []),
  });

  const { data: vdvks } = useQuery({
    queryKey: ["master", "vdvks"],
    queryFn: () => masterApi.getVdvks().then((r) => r.data ?? []),
  });

  const { data: facilities } = useQuery({
    queryKey: ["mda", "facilities", "by-type"],
    queryFn: () => mdaApi.getFacilitiesByType().then((r) => r.data ?? []),
  });

  const { data: recentRecords } = useQuery({
    queryKey: ["forms", "form8"],
    queryFn: () => formsApi.list("form8").then((r) => r.data ?? []),
  });

  const machineryOptions = useMemo(() => {
    const arr = Array.isArray(machinery) ? machinery : [];
    return arr.map((m: Record<string, unknown>) => ({
      id: (m.id as string) ?? (m.machineId as string) ?? (m.code as string) ?? "",
      name: (m.name as string) ?? (m.machineName as string) ?? (m.make as string) ?? "",
    }));
  }, [machinery]);

  const vdvkOptions = useMemo(() => {
    const arr = Array.isArray(vdvks) ? vdvks : [];
    return arr.map((v: Record<string, unknown>) => ({
      code: (v.code as string) ?? (v.vdvkCode as string) ?? "",
      name: (v.name as string) ?? (v.vdvkName as string) ?? "",
    }));
  }, [vdvks]);

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
    if (watchedFacilityCode) {
      const fac = facilityOptions.find((f) => f.code === watchedFacilityCode);
      setValue("facilityNameSnapshot", fac?.name ?? "");
    } else {
      setValue("facilityNameSnapshot", "");
    }
  }, [watchedFacilityCode, facilityOptions, setValue]);

  useEffect(() => {
    if (watchedVdvkCode) {
      const v = vdvkOptions.find((v) => v.code === watchedVdvkCode);
      setValue("vdvkNameSnapshot", v?.name ?? "");
    } else {
      setValue("vdvkNameSnapshot", "");
    }
  }, [watchedVdvkCode, vdvkOptions, setValue]);

  useEffect(() => {
    if (watchedMachineryId) {
      const m = machineryOptions.find((m) => m.id === watchedMachineryId);
      setValue("machineryNameSnapshot", m?.name ?? "");
    } else {
      setValue("machineryNameSnapshot", "");
    }
  }, [watchedMachineryId, machineryOptions, setValue]);

  useEffect(() => {
    if (watchedCommodityCode) {
      const c = Array.isArray(commodities)
        ? (commodities as Record<string, unknown>[]).find(
            (c) => (c.code as string) === watchedCommodityCode
          )
        : undefined;
      setValue("commodityNameSnapshot", (c?.name as string) ?? "");
    } else {
      setValue("commodityNameSnapshot", "");
    }
  }, [watchedCommodityCode, commodities, setValue]);

  const createMutation = useMutation({
    mutationFn: async (data: {
      processingDate: string;
      overallRemarks?: string;
      items: ItemFormData[];
    }) => {
      const { data: res } = await formsApi.create("form8", data);
      return res as { id: string; txnNo: string; status: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form8"] });
      setBatchEntries([]);
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => formsApi.submit("form8", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form8"] });
    },
  });

  const onAddEntry = handleEntrySubmit((data) => {
    setBatchEntries((prev) => [...prev, { ...data, id: crypto.randomUUID() }]);
    resetEntryForm({
      locationType: data.locationType,
      facilityCode: "",
      facilityNameSnapshot: "",
      vdvkCode: "",
      vdvkNameSnapshot: "",
      mandal: "",
      machineryId: "",
      machineryNameSnapshot: "",
      commodityCode: "",
      commodityNameSnapshot: "",
      unit: data.unit,
      rawQtyKg: null,
      rawQtyPcs: null,
      packetDetails: null,
      finalOutputKg: null,
      finalOutputPcs: null,
      utilisationHours: null,
      remarks: null,
      form3ReferenceId: null,
    });
  });

  const removeEntry = (id: string) => {
    setBatchEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const onSubmitBatch = async () => {
    if (batchEntries.length === 0) return;
    const items = batchEntries.map(({ id: _id, ...rest }) => rest);
    const body = {
      processingDate,
      overallRemarks: overallRemarks.trim() || undefined,
      items,
    };
    const result = await createMutation.mutateAsync(body);
    if (result?.id && !isDraft) {
      await submitMutation.mutateAsync(result.id);
    }
  };

  const totalRawKg = useMemo(
    () => batchEntries.reduce((sum, e) => sum + (e.rawQtyKg ?? 0), 0),
    [batchEntries]
  );
  const totalRawPcs = useMemo(
    () => batchEntries.reduce((sum, e) => sum + (e.rawQtyPcs ?? 0), 0),
    [batchEntries]
  );
  const totalOutputKg = useMemo(
    () => batchEntries.reduce((sum, e) => sum + (e.finalOutputKg ?? 0), 0),
    [batchEntries]
  );
  const totalOutputPcs = useMemo(
    () => batchEntries.reduce((sum, e) => sum + (e.finalOutputPcs ?? 0), 0),
    [batchEntries]
  );
  const totalHours = useMemo(
    () => batchEntries.reduce((sum, e) => sum + (e.utilisationHours ?? 0), 0),
    [batchEntries]
  );

  if (commoditiesLoading || machineryLoading) return <PageLoading />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-charcoal tracking-wide uppercase">
            Machinery Utilisation Register
          </h2>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Form 08</p>
        </div>
        <span className="bg-purple-500/10 text-purple-600 text-[10px] font-black px-3 py-1 rounded-full border border-purple-500/20 uppercase tracking-widest">
          Asset Form 8
        </span>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Raw Input (Kg)
          </p>
          <p className="font-display text-2xl text-slate-900">
            {totalRawKg > 0 ? totalRawKg.toLocaleString() : "--"}
          </p>
        </div>
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Raw Input (Pcs)
          </p>
          <p className="font-display text-2xl text-slate-900">
            {totalRawPcs > 0 ? totalRawPcs.toLocaleString() : "--"}
          </p>
        </div>
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Final Output (Kg)
          </p>
          <p className="font-display text-2xl text-slate-900">
            {totalOutputKg > 0 ? totalOutputKg.toLocaleString() : "--"}
          </p>
        </div>
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Final Output (Pcs)
          </p>
          <p className="font-display text-2xl text-slate-900">
            {totalOutputPcs > 0 ? totalOutputPcs.toLocaleString() : "--"}
          </p>
        </div>
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Total Hours
          </p>
          <p className="font-display text-2xl text-slate-900">
            {totalHours > 0 ? `${totalHours.toFixed(1)}h` : "--"}
          </p>
        </div>
      </div>

      {/* Form Header */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
        <h3 className="font-display text-xl text-charcoal tracking-wide uppercase border-b border-charcoal/5 pb-2 mb-6">
          Register Header
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Processing Date
            </label>
            <input
              type="date"
              value={processingDate}
              onChange={(e) => setProcessingDate(e.target.value)}
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
              placeholder="Batch-level observations..."
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Entry Form */}
      <div className="bg-[#f8f9fa] border border-charcoal/5 rounded-3xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl text-charcoal tracking-wide uppercase border-b border-charcoal/5 pb-2">
            Utilisation Entry
          </h3>
          {batchEntries.length > 0 && (
            <span className="px-3 py-1 bg-purple-100 text-purple-700 text-[10px] font-black uppercase tracking-widest rounded border border-purple-200">
              {batchEntries.length} Entries Pending
            </span>
          )}
        </div>

        {/* Row 1: Location */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Location Type
            </label>
            <select
              {...register("locationType")}
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
            >
              {LOCATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Facility
            </label>
            <select
              {...register("facilityCode")}
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
            >
              <option value="">-- Select Facility --</option>
              {facilityOptions.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              VDVK
            </label>
            <select
              {...register("vdvkCode")}
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
            >
              <option value="">-- Select VDVK --</option>
              {vdvkOptions.map((v) => (
                <option key={v.code} value={v.code}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Mandal
            </label>
            <input
              type="text"
              {...register("mandal")}
              placeholder="Mandal"
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
            />
          </div>
        </div>

        {/* Row 2: Machinery, Commodity, Unit */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Machinery
            </label>
            <select
              {...register("machineryId")}
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
            >
              <option value="">-- Select Machinery --</option>
              {machineryOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {errors.machineryId && (
              <p className="text-red-500 text-[10px]">{errors.machineryId.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Commodity
            </label>
            <select
              {...register("commodityCode")}
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
            >
              <option value="">-- Select Commodity --</option>
              {Array.isArray(commodities) &&
                commodities.map((c: Record<string, unknown>) => (
                  <option key={c.code as string} value={c.code as string}>
                    {c.name as string}
                  </option>
                ))}
            </select>
            {errors.commodityCode && (
              <p className="text-red-500 text-[10px]">{errors.commodityCode.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Unit
            </label>
            <select
              {...register("unit")}
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Raw Qty / Input */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {(watchedUnit === "Kg" || watchedUnit === "Both") && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                Raw Qty (Kg)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("rawQtyKg", { setValueAs: emptyToNull })}
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all font-mono"
              />
            </div>
          )}
          {(watchedUnit === "Pieces" || watchedUnit === "Both") && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                Raw Qty (Pcs)
              </label>
              <input
                type="number"
                step="1"
                placeholder="0"
                {...register("rawQtyPcs", { setValueAs: emptyToNull })}
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all font-mono"
              />
            </div>
          )}
          {(watchedUnit === "Pieces" || watchedUnit === "Both") && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                Packet Details
              </label>
              <input
                type="text"
                {...register("packetDetails", { setValueAs: (v) => v || null })}
                placeholder="e.g. 100g x 50"
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
              />
            </div>
          )}
        </div>

        {/* Row 4: Final Output */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {(watchedUnit === "Kg" || watchedUnit === "Both") && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                Final Output (Kg)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("finalOutputKg", { setValueAs: emptyToNull })}
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all font-mono"
              />
            </div>
          )}
          {(watchedUnit === "Pieces" || watchedUnit === "Both") && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                Final Output (Pcs)
              </label>
              <input
                type="number"
                step="1"
                placeholder="0"
                {...register("finalOutputPcs", { setValueAs: emptyToNull })}
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all font-mono"
              />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Utilisation Hours
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="0.0"
              {...register("utilisationHours", { setValueAs: emptyToNull })}
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all font-mono"
            />
          </div>
        </div>

        {/* Row 5: Remarks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Remarks
            </label>
            <textarea
              {...register("remarks", { setValueAs: (v) => v || null })}
              rows={1}
              placeholder="Operational notes, downtime reasons..."
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all resize-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
              Form 3 Reference ID
            </label>
            <input
              type="text"
              {...register("form3ReferenceId", { setValueAs: (v) => v || null })}
              placeholder="Linked processing batch ref"
              className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
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
            Add Utilisation Entry
          </button>
        </div>
      </div>

      {/* Utilisation Register Table */}
      <div className="bg-[#f8f9fa] border border-charcoal/5 rounded-3xl overflow-hidden">
        <div className="bg-charcoal px-6 py-4 flex justify-between items-center">
          <h3 className="font-display text-lg tracking-widest text-white">
            Utilisation Register
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
              title="No Utilisation Entries Yet"
              description="Log machinery utilisation using the form above."
            />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-charcoal/50 border-b border-slate-200">
                <tr>
                  <th className="p-4 border-r border-slate-200">Facility</th>
                  <th className="p-4 border-r border-slate-200">VDVK</th>
                  <th className="p-4 border-r border-slate-200">Machinery</th>
                  <th className="p-4 border-r border-slate-200">Commodity</th>
                  <th className="p-4 border-r border-slate-200">Unit</th>
                  <th className="p-4 border-r border-slate-200 text-center">Raw (Kg)</th>
                  <th className="p-4 border-r border-slate-200 text-center">Raw (Pcs)</th>
                  <th className="p-4 border-r border-slate-200 text-center">Out (Kg)</th>
                  <th className="p-4 border-r border-slate-200 text-center">Out (Pcs)</th>
                  <th className="p-4 border-r border-slate-200 text-center">Hours</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-charcoal">
                {batchEntries.map((entry) => {
                  const facName =
                    facilityOptions.find((f) => f.code === entry.facilityCode)
                      ?.name ?? entry.facilityCode ?? "--";
                  const vdvkName =
                    vdvkOptions.find((v) => v.code === entry.vdvkCode)
                      ?.name ?? entry.vdvkCode ?? "--";
                  const machName =
                    machineryOptions.find((m) => m.id === entry.machineryId)
                      ?.name ?? entry.machineryId;
                  const comName =
                    (Array.isArray(commodities)
                      ? (commodities as Record<string, unknown>[]).find(
                          (c) => (c.code as string) === entry.commodityCode
                        )?.name
                      : undefined) ?? entry.commodityCode;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 border-r border-slate-100 text-xs">
                        {facName}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-xs">
                        {vdvkName}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-xs font-bold">
                        {machName}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-xs">
                        {comName}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-xs text-center">
                        {entry.unit}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-center font-mono text-xs">
                        {entry.rawQtyKg != null ? entry.rawQtyKg.toFixed(2) : "--"}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-center font-mono text-xs">
                        {entry.rawQtyPcs != null ? entry.rawQtyPcs.toFixed(0) : "--"}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-center font-mono text-xs">
                        {entry.finalOutputKg != null
                          ? entry.finalOutputKg.toFixed(2)
                          : "--"}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-center font-mono text-xs">
                        {entry.finalOutputPcs != null
                          ? entry.finalOutputPcs.toFixed(0)
                          : "--"}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-center font-mono text-xs">
                        {entry.utilisationHours != null
                          ? entry.utilisationHours.toFixed(1)
                          : "--"}
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
          Failed to save utilisation entries. Please try again.
        </div>
      )}
      {createMutation.isSuccess && batchEntries.length === 0 && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          {isDraft
            ? "Draft saved successfully."
            : "Utilisation register submitted for verification."}
        </div>
      )}
    </div>
  );
}
