import { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { masterApi } from "@/api/endpoints/master";
import { mdaApi } from "@/api/endpoints/mda";
import { formsApi } from "@/api/endpoints/forms";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";

const units = ["Kg", "Pieces", "Both"] as const;

const packagingSchema = z.object({
  packetSize: z.string().min(1, "Required"),
  numberOfPackets: z.number().min(0),
  totalQtyKg: z.number().nullable(),
  totalQtyPieces: z.number().nullable(),
});

const itemSchema = z.object({
  vdvkCode: z.string().min(1, "Required"),
  vdvkNameSnapshot: z.string().min(1, "Required"),
  beneficiaryId: z.string().nullable().optional(),
  beneficiaryNameSnapshot: z.string().nullable().optional(),
  commodityCode: z.string().min(1, "Required"),
  commodityNameSnapshot: z.string().min(1, "Required"),
  gradeCode: z.string().nullable().optional(),
  gradeNameSnapshot: z.string().nullable().optional(),
  unit: z.enum(units),
  availableStockKg: z.number().nullable(),
  qtyTakenKg: z.number().nullable(),
  ratePerKg: z.number().nullable(),
  availableStockPcs: z.number().nullable(),
  qtyTakenPcs: z.number().nullable(),
  ratePerPiece: z.number().nullable(),
  finishedKg: z.number().nullable(),
  finishedPcs: z.number().nullable(),
  finalCostPerKg: z.number().nullable(),
  finalCostPerPiece: z.number().nullable(),
  remarks: z.string().nullable().optional(),
  sourceStockLedgerIds: z.array(z.number()).optional(),
  packaging: z.array(packagingSchema).optional(),
});

const form3Schema = z.object({
  processingLocationCode: z.string().min(1, "Required"),
  processingLocationNameSnapshot: z.string().min(1, "Required"),
  processingDate: z.string().min(1, "Required"),
  overallRemarks: z.string().optional(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
});

type Form3Data = z.infer<typeof form3Schema>;

interface FacilityItem { code: string; name: string; }
interface VdvkItem { code: string; name: string; }
interface CommodityItem { code: string; name: string; }

const emptyItem = {
  vdvkCode: "", vdvkNameSnapshot: "",
  beneficiaryId: null, beneficiaryNameSnapshot: null,
  commodityCode: "", commodityNameSnapshot: "",
  gradeCode: null, gradeNameSnapshot: null,
  unit: "Kg" as const,
  availableStockKg: null, qtyTakenKg: null, ratePerKg: null,
  availableStockPcs: null, qtyTakenPcs: null, ratePerPiece: null,
  finishedKg: null, finishedPcs: null,
  finalCostPerKg: null, finalCostPerPiece: null,
  remarks: null, sourceStockLedgerIds: undefined,
  packaging: [],
};

const emptyPackaging = {
  packetSize: "", numberOfPackets: 0,
  totalQtyKg: null, totalQtyPieces: null,
};

export function Form3Processing() {
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});

  const { data: facilities, isError: facErr, refetch: facRefetch } = useQuery({
    queryKey: ["mda", "facilities", "by-type"],
    queryFn: () => mdaApi.getFacilitiesByType().then((r) => {
      const arr = Array.isArray(r.data) ? r.data : [];
      return arr.map((f: Record<string, unknown>) => ({
        code: (f.code as string) ?? (f.facilityCode as string) ?? "",
        name: (f.name as string) ?? (f.facilityName as string) ?? "",
      })) as FacilityItem[];
    }),
  });

  const { data: vdvks, isError: vdvksError, refetch: vdvksRefetch } = useQuery({
    queryKey: ["master", "vdvks"],
    queryFn: () => masterApi.getVdvks().then((r) =>
      (Array.isArray(r.data) ? r.data : []) as VdvkItem[]),
  });

  const { data: commodities, isError: commoditiesError, refetch: commoditiesRefetch } = useQuery({
    queryKey: ["master", "commodities"],
    queryFn: () => masterApi.getCommodities().then((r) =>
      (Array.isArray(r.data) ? r.data : []) as CommodityItem[]),
  });

  const { data: form3History } = useQuery({
    queryKey: ["forms", "form3"],
    queryFn: () => formsApi.list("form3").then((r) => r.data ?? []),
  });

  const {
    register, control, handleSubmit, watch, setValue, reset,
    formState: { errors },
  } = useForm<Form3Data>({
    resolver: zodResolver(form3Schema),
    defaultValues: {
      processingLocationCode: "",
      processingLocationNameSnapshot: "",
      processingDate: new Date().toISOString().split("T")[0],
      overallRemarks: "",
      items: [{ ...emptyItem }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchItems = watch("items");

  const calcRawValue = useCallback((index: number) => {
    const item = watchItems[index];
    if (!item) return 0;
    return ((item.qtyTakenKg ?? 0) * (item.ratePerKg ?? 0)) + ((item.qtyTakenPcs ?? 0) * (item.ratePerPiece ?? 0));
  }, [watchItems]);

  const calcFinishedValue = useCallback((index: number) => {
    const item = watchItems[index];
    if (!item) return 0;
    return ((item.finishedKg ?? 0) * (item.finalCostPerKg ?? 0)) + ((item.finishedPcs ?? 0) * (item.finalCostPerPiece ?? 0));
  }, [watchItems]);

  const toggleExpandItem = (index: number) => {
    setExpandedItems((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const addPackaging = (itemIndex: number) => {
    const current = watchItems[itemIndex]?.packaging ?? [];
    setValue(`items.${itemIndex}.packaging`, [...current, { ...emptyPackaging }]);
  };

  const removePackaging = (itemIndex: number, pkgIndex: number) => {
    const current = [...(watchItems[itemIndex]?.packaging ?? [])];
    current.splice(pkgIndex, 1);
    setValue(`items.${itemIndex}.packaging`, current);
  };

  const saveMutation = useMutation({
    mutationFn: (data: Form3Data) => formsApi.create("form3", data),
    onSuccess: (res) => {
      const d = (res as any).data;
      if (d?.id) {
        submitMutation.mutate(d.id);
      }
      queryClient.invalidateQueries({ queryKey: ["forms", "form3"] });
      reset();
      setSuccessMsg("Saved and submitted for approval");
      setTimeout(() => setSuccessMsg(null), 3000);
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => formsApi.submit("form3", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form3"] });
    },
  });

  const onSubmit = (data: Form3Data) => {
    saveMutation.mutate(data);
  };

  const isError = facErr || vdvksError || commoditiesError;
  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-red-500 font-semibold">Failed to load data</p>
          <button onClick={() => { facRefetch(); vdvksRefetch(); commoditiesRefetch(); }} className="mt-2 text-sm text-charcoal underline">Retry</button>
        </div>
      </div>
    );
  }

  if (!facilities || !vdvks || !commodities) return <PageLoading />;

  const facilitiesArr = facilities ?? [];
  const vdvksArr = vdvks ?? [];
  const commoditiesArr = commodities ?? [];

  const watchLocation = watch("processingLocationCode");

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-5 py-3 text-sm font-semibold">
          <CheckCircle size={18} />{successMsg}
        </div>
      )}

      <div>
        <h2 className="text-2xl font-display text-charcoal tracking-wide">PROCESSING REGISTER</h2>
        <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Form 03 — Processing</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-charcoal p-6 rounded-3xl text-white">
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase text-golden/60 tracking-widest">Form No.</p>
            <p className="text-sm font-bold tracking-tight font-mono">Form 03</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase text-golden/60 tracking-widest">Location</p>
            <p className="text-sm font-bold tracking-tight truncate">
              {facilitiesArr.find((f) => f.code === watchLocation)?.name || watchLocation || "--"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase text-golden/60 tracking-widest">Items</p>
            <p className="text-sm font-bold tracking-tight font-mono">{fields.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase text-golden/60 tracking-widest">Status</p>
            <StatusBadge status="Draft" />
          </div>
        </div>

        {/* Header Details */}
        <div className="bg-[#f8f9fa] border border-charcoal/5 rounded-3xl p-8">
          <h3 className="font-display text-xl text-charcoal tracking-wide uppercase border-b border-charcoal/5 pb-2 mb-6">
            Processing Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">Processing Location</label>
              <select {...register("processingLocationCode")} className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all" onChange={(e) => {
                const f = facilitiesArr.find((x) => x.code === e.target.value);
                if (f) setValue("processingLocationNameSnapshot", f.name);
              }}>
                <option value="">Select Facility</option>
                {facilitiesArr.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
              </select>
              {errors.processingLocationCode && <p className="text-red-500 text-[10px]">{errors.processingLocationCode.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">Processing Date</label>
              <input type="date" {...register("processingDate")} className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all" />
              {errors.processingDate && <p className="text-red-500 text-[10px]">{errors.processingDate.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">Remarks (Optional)</label>
              <input {...register("overallRemarks")} placeholder="Overall remarks" className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all" />
            </div>
          </div>
          <input type="hidden" {...register("processingLocationNameSnapshot")} />
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-charcoal border-b-2 border-gray-100 pb-3 mb-4">
            Processing Items
          </h3>
          {errors.items?.message && <p className="text-red-500 text-xs mb-2">{errors.items.message}</p>}

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse min-w-[1800px]">
              <thead>
                <tr>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">VDVK</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Beneficiary</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Commodity</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Grade</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Unit</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Avail Kg</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Taken Kg</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Rate/Kg</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Avail Pcs</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Taken Pcs</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Rate/Pc</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Fin Kg</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Fin Pcs</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Cost/Kg</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Cost/Pc</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">R.M. Value</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Finished Val</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Pkg</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <>
                    <tr key={field.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-2 py-2">
                        <select {...register(`items.${index}.vdvkCode`)} className="w-32 border border-gray-200 rounded px-2 py-1 text-xs" onChange={(e) => {
                          const v = vdvksArr.find((x) => x.code === e.target.value);
                          if (v) setValue(`items.${index}.vdvkNameSnapshot`, v.name);
                        }}>
                          <option value="">Select</option>
                          {vdvksArr.map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-col gap-1">
                          <input {...register(`items.${index}.beneficiaryId`)} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="ID (opt)" />
                          <input {...register(`items.${index}.beneficiaryNameSnapshot`)} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs" placeholder="Name (opt)" />
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <select {...register(`items.${index}.commodityCode`)} className="w-28 border border-gray-200 rounded px-2 py-1 text-xs" onChange={(e) => {
                          const c = commoditiesArr.find((x) => x.code === e.target.value);
                          if (c) setValue(`items.${index}.commodityNameSnapshot`, c.name);
                        }}>
                          <option value="">Select</option>
                          {commoditiesArr.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select {...register(`items.${index}.gradeCode`)} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs" onChange={(e) => {
                          setValue(`items.${index}.gradeCode`, e.target.value || null);
                          setValue(`items.${index}.gradeNameSnapshot`, e.target.value || null);
                        }}>
                          <option value="">--</option>
                          <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="Default">Default</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select {...register(`items.${index}.unit`)} className="w-18 border border-gray-200 rounded px-2 py-1 text-xs">
                          {units.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2"><input type="number" {...register(`items.${index}.availableStockKg`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" /></td>
                      <td className="px-2 py-2"><input type="number" {...register(`items.${index}.qtyTakenKg`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" /></td>
                      <td className="px-2 py-2"><input type="number" {...register(`items.${index}.ratePerKg`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" /></td>
                      <td className="px-2 py-2"><input type="number" {...register(`items.${index}.availableStockPcs`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" /></td>
                      <td className="px-2 py-2"><input type="number" {...register(`items.${index}.qtyTakenPcs`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" /></td>
                      <td className="px-2 py-2"><input type="number" {...register(`items.${index}.ratePerPiece`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" /></td>
                      <td className="px-2 py-2"><input type="number" {...register(`items.${index}.finishedKg`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" /></td>
                      <td className="px-2 py-2"><input type="number" {...register(`items.${index}.finishedPcs`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" /></td>
                      <td className="px-2 py-2"><input type="number" {...register(`items.${index}.finalCostPerKg`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" /></td>
                      <td className="px-2 py-2"><input type="number" {...register(`items.${index}.finalCostPerPiece`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" /></td>
                      <td className="px-2 py-2"><span className="font-mono text-xs font-bold">₹ {calcRawValue(index).toLocaleString()}</span></td>
                      <td className="px-2 py-2"><span className="font-mono text-xs font-bold">₹ {calcFinishedValue(index).toLocaleString()}</span></td>
                      <td className="px-2 py-2">
                        <button type="button" onClick={() => toggleExpandItem(index)} className="text-[10px] font-bold bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded flex items-center gap-1 transition-colors">
                          {(watchItems[index]?.packaging?.length ?? 0) > 0 ? `${watchItems[index]?.packaging?.length} pkg` : "+Pkg"}
                          {expandedItems[index] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <button type="button" onClick={() => remove(index)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                    {expandedItems[index] && (watchItems[index]?.packaging ?? []).length > 0 && (
                      <tr key={`${field.id}-pkg`}>
                        <td colSpan={19} className="px-2 py-3 bg-amber-50/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Packaging Details</span>
                            <button type="button" onClick={() => addPackaging(index)} className="text-[10px] font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1">
                              <Plus size={12} />Add
                            </button>
                          </div>
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-amber-200">
                                <th className="text-left px-2 py-1 text-[10px] uppercase text-amber-600">Packet Size</th>
                                <th className="text-left px-2 py-1 text-[10px] uppercase text-amber-600"># Packets</th>
                                <th className="text-left px-2 py-1 text-[10px] uppercase text-amber-600">Total Kg</th>
                                <th className="text-left px-2 py-1 text-[10px] uppercase text-amber-600">Total Pcs</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {(watchItems[index]?.packaging ?? []).map((_pkg, pkgIndex) => (
                                <tr key={pkgIndex} className="border-b border-amber-100">
                                  <td className="px-2 py-1">
                                    <input {...register(`items.${index}.packaging.${pkgIndex}.packetSize`)} className="w-24 border border-gray-200 rounded px-2 py-1" placeholder="e.g. 1Kg" />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input type="number" {...register(`items.${index}.packaging.${pkgIndex}.numberOfPackets`, { valueAsNumber: true })} className="w-20 border border-gray-200 rounded px-2 py-1 font-mono" placeholder="0" />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input type="number" {...register(`items.${index}.packaging.${pkgIndex}.totalQtyKg`, { valueAsNumber: true })} className="w-20 border border-gray-200 rounded px-2 py-1 font-mono" placeholder="0" step="0.01" />
                                  </td>
                                  <td className="px-2 py-1">
                                    <input type="number" {...register(`items.${index}.packaging.${pkgIndex}.totalQtyPieces`, { valueAsNumber: true })} className="w-20 border border-gray-200 rounded px-2 py-1 font-mono" placeholder="0" step="0.01" />
                                  </td>
                                  <td className="px-2 py-1">
                                    <button type="button" onClick={() => removePackaging(index, pkgIndex)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                    {expandedItems[index] && (watchItems[index]?.packaging ?? []).length === 0 && (
                      <tr key={`${field.id}-pkg-empty`}>
                        <td colSpan={19} className="px-2 py-3 bg-amber-50/50">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Packaging (Optional)</span>
                            <button type="button" onClick={() => addPackaging(index)} className="text-[10px] font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1">
                              <Plus size={12} />Add Packaging
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr key={`${field.id}-remarks`}>
                      <td colSpan={19} className="px-2 py-1">
                        <input {...register(`items.${index}.remarks`)} placeholder="Item remarks (optional)" className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                      </td>
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => append({ ...emptyItem })} className="mt-4 flex items-center gap-2 text-sm text-charcoal/60 hover:text-charcoal transition-colors">
            <Plus size={16} />Add Processing Item
          </button>
        </div>

        {/* Submit */}
        <div className="bg-[#272727] rounded-xl p-6 text-white">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-sage/60 mb-4">Final Review</h3>
          <div className="space-y-3 mb-6">
            {["Processing details verified", "Stock quantities checked", "Finished goods cost calculated"].map((label) => (
              <label key={label} className="flex items-center gap-3 text-sm text-sage/80"><input type="checkbox" className="rounded border-sage/40" />{label}</label>
            ))}
          </div>
          <button type="submit" disabled={saveMutation.isPending || submitMutation.isPending} className="bg-white border border-gray-200 text-charcoal px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50">
            <Save size={16} />{saveMutation.isPending ? "Saving..." : submitMutation.isPending ? "Submitting..." : "Save & Submit"}
          </button>
        </div>
      </form>

      {saveMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Failed to save. Please try again.
        </div>
      )}

      {/* Recent Records */}
      <div className="bg-[#f8f9fa] border border-charcoal/5 rounded-3xl overflow-hidden">
        <div className="p-8 pb-4">
          <h3 className="font-display text-xl text-charcoal tracking-wide uppercase">Recent Processing</h3>
        </div>
        {!form3History || (Array.isArray(form3History) ? form3History.length === 0 : true) ? (
          <div className="px-8 pb-8">
            <EmptyState title="No Processing Records Yet" description="Submitted records will appear here." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-charcoal/5">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-charcoal/60">Txn No</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-charcoal/60">Date</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-charcoal/60">Location</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-charcoal/60">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5 bg-white">
                {(Array.isArray(form3History) ? form3History : []).map((r: any, i: number) => (
                  <tr key={r.id || i} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-xs font-mono font-bold">{r.txnNo || r.id?.slice(0, 8)}</td>
                    <td className="p-4 text-xs">{r.processingDate || r.createdAt?.split("T")[0] || "--"}</td>
                    <td className="p-4 text-xs">{r.processingLocationNameSnapshot || r.processingLocationCode || "--"}</td>
                    <td className="p-4"><StatusBadge status={r.status || "Draft"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
