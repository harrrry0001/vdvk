import { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, Send, AlertTriangle, CheckCircle } from "lucide-react";
import { masterApi } from "@/api/endpoints/master";
import { mdaApi } from "@/api/endpoints/mda";
import { formsApi } from "@/api/endpoints/forms";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";

const goodsTypes = ["Raw", "Processed"] as const;
const units = ["Kg", "Pieces", "Both"] as const;

const itemSchema = z.object({
  vdvkCode: z.string().min(1, "Required"),
  vdvkNameSnapshot: z.string().min(1, "Required"),
  beneficiaryId: z.string().min(1, "Required"),
  beneficiaryNameSnapshot: z.string().min(1, "Required"),
  commodityCode: z.string().min(1, "Required"),
  commodityNameSnapshot: z.string().min(1, "Required"),
  gradeCode: z.string().nullable().optional(),
  gradeNameSnapshot: z.string().nullable().optional(),
  goodsType: z.enum(goodsTypes),
  unit: z.enum(units),
  availableKg: z.number().nullable(),
  transferQtyKg: z.number().nullable(),
  availablePieces: z.number().nullable(),
  transferQtyPieces: z.number().nullable(),
  ratePerKg: z.number().nullable(),
  ratePerPiece: z.number().nullable(),
  totalValue: z.number().min(0),
});

const form2Schema = z.object({
  transferDate: z.string().min(1, "Required"),
  sentFromFacilityCode: z.string().min(1, "Required"),
  sentFromNameSnapshot: z.string().min(1, "Required"),
  sentToFacilityCode: z.string().min(1, "Required"),
  sentToNameSnapshot: z.string().min(1, "Required"),
  sentBy: z.string().optional(),
  sentByNameSnapshot: z.string().optional(),
  vehicleDetails: z.string().optional(),
  driverName: z.string().optional(),
  driverMobile: z.string().optional(),
  overallRemarks: z.string().optional(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
});

type Form2Data = z.infer<typeof form2Schema>;

interface FacilityItem { code: string; name: string; }
interface VdvkItem { code: string; name: string; }
interface CommodityItem { code: string; name: string; }

export function Form2StockTransfer() {
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  const { data: form2History } = useQuery({
    queryKey: ["forms", "form2"],
    queryFn: () => formsApi.list("form2").then((r) => r.data ?? []),
  });

  const {
    register, control, handleSubmit, watch, setValue, reset,
    formState: { errors },
  } = useForm<Form2Data>({
    resolver: zodResolver(form2Schema),
    defaultValues: {
      transferDate: new Date().toISOString().split("T")[0],
      sentFromFacilityCode: "",
      sentFromNameSnapshot: "",
      sentToFacilityCode: "",
      sentToNameSnapshot: "",
      sentBy: "",
      sentByNameSnapshot: "",
      vehicleDetails: "",
      driverName: "",
      driverMobile: "",
      overallRemarks: "",
      items: [{
        vdvkCode: "", vdvkNameSnapshot: "",
        beneficiaryId: "", beneficiaryNameSnapshot: "",
        commodityCode: "", commodityNameSnapshot: "",
        gradeCode: null, gradeNameSnapshot: null,
        goodsType: "Raw", unit: "Kg",
        availableKg: null, transferQtyKg: null,
        availablePieces: null, transferQtyPieces: null,
        ratePerKg: null, ratePerPiece: null,
        totalValue: 0,
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchItems = watch("items");

  const calcTotalValue = useCallback((index: number) => {
    const item = watchItems[index];
    if (!item) return;
    const kgVal = (item.unit === "Kg" || item.unit === "Both")
      ? (item.transferQtyKg ?? 0) * (item.ratePerKg ?? 0) : 0;
    const pcVal = (item.unit === "Pieces" || item.unit === "Both")
      ? (item.transferQtyPieces ?? 0) * (item.ratePerPiece ?? 0) : 0;
    setValue(`items.${index}.totalValue`, kgVal + pcVal);
  }, [watchItems, setValue]);

  const saveMutation = useMutation({
    mutationFn: (data: Form2Data) => formsApi.create("form2", data),
    onSuccess: (res) => {
      const d = (res as any).data;
      if (d?.id) {
        submitMutation.mutate(d.id);
      }
      queryClient.invalidateQueries({ queryKey: ["forms", "form2"] });
      reset();
      setSuccessMsg("Saved and submitted for approval");
      setTimeout(() => setSuccessMsg(null), 3000);
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => formsApi.submit("form2", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form2"] });
    },
  });

  const onSubmit = (data: Form2Data) => {
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

  const watchSentFrom = watch("sentFromFacilityCode");
  const watchSentTo = watch("sentToFacilityCode");

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-5 py-3 text-sm font-semibold">
          <CheckCircle size={18} />{successMsg}
        </div>
      )}

      <div>
        <h2 className="text-2xl font-display text-charcoal tracking-wide">STOCK TRANSFER REGISTER</h2>
        <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Form 02 — Stock Transfer</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-charcoal p-6 rounded-3xl text-white">
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase text-golden/60 tracking-widest">Form No.</p>
            <p className="text-sm font-bold tracking-tight font-mono">Form 02</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase text-golden/60 tracking-widest">From Facility</p>
            <p className="text-sm font-bold tracking-tight truncate">
              {facilitiesArr.find((f) => f.code === watchSentFrom)?.name || watchSentFrom || "--"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase text-golden/60 tracking-widest">To Facility</p>
            <p className="text-sm font-bold tracking-tight truncate">
              {facilitiesArr.find((f) => f.code === watchSentTo)?.name || watchSentTo || "--"}
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

        {/* Section 1 - Transfer Header */}
        <div className="bg-[#f8f9fa] border border-charcoal/5 rounded-3xl p-8">
          <h3 className="font-display text-xl text-charcoal tracking-wide uppercase border-b border-charcoal/5 pb-2 mb-6">
            1. Transfer Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">Transfer Date</label>
              <input type="date" {...register("transferDate")} className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all" />
              {errors.transferDate && <p className="text-red-500 text-[10px]">{errors.transferDate.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">Sent From Facility</label>
              <select {...register("sentFromFacilityCode")} className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all" onChange={(e) => {
                const f = facilitiesArr.find((x) => x.code === e.target.value);
                if (f) setValue("sentFromNameSnapshot", f.name);
              }}>
                <option value="">Select Facility</option>
                {facilitiesArr.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
              </select>
              {errors.sentFromFacilityCode && <p className="text-red-500 text-[10px]">{errors.sentFromFacilityCode.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">Sent To Facility</label>
              <select {...register("sentToFacilityCode")} className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all" onChange={(e) => {
                const f = facilitiesArr.find((x) => x.code === e.target.value);
                if (f) setValue("sentToNameSnapshot", f.name);
              }}>
                <option value="">Select Facility</option>
                {facilitiesArr.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
              </select>
              {errors.sentToFacilityCode && <p className="text-red-500 text-[10px]">{errors.sentToFacilityCode.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">Sent By (Optional)</label>
              <select {...register("sentBy")} className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all" onChange={(e) => {
                const f = facilitiesArr.find((x) => x.code === e.target.value);
                setValue("sentByNameSnapshot", f?.name ?? e.target.value);
              }}>
                <option value="">-- None --</option>
                {facilitiesArr.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">Vehicle Details (Optional)</label>
              <input {...register("vehicleDetails")} placeholder="e.g. Van, Truck" className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">Driver Name (Optional)</label>
              <input {...register("driverName")} placeholder="Driver name" className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">Driver Mobile (Optional)</label>
              <input {...register("driverMobile")} placeholder="Phone number" className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">Remarks (Optional)</label>
              <input {...register("overallRemarks")} placeholder="Additional notes" className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all" />
            </div>
          </div>
          <input type="hidden" {...register("sentFromNameSnapshot")} />
          <input type="hidden" {...register("sentToNameSnapshot")} />
          <input type="hidden" {...register("sentByNameSnapshot")} />
        </div>

        {/* Section 2 - Items Table */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-charcoal border-b-2 border-gray-100 pb-3 mb-4">
            2. Transfer Items
          </h3>
          {errors.items?.root && <p className="text-red-500 text-xs mb-2">{errors.items.root?.message}</p>}
          {errors.items?.message && <p className="text-red-500 text-xs mb-2">{errors.items.message}</p>}

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse min-w-[1600px]">
              <thead>
                <tr>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">VDVK</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Beneficiary</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Commodity</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Grade</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Type</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Unit</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Avail Kg</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Qty Kg</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Avail Pcs</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Qty Pcs</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Rate/Kg</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Rate/Pc</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200">Total</th>
                  <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-2 py-3 border-b border-gray-200"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
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
                        <input {...register(`items.${index}.beneficiaryId`)} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="ID" />
                        <input {...register(`items.${index}.beneficiaryNameSnapshot`)} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs" placeholder="Name" />
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
                      <select {...register(`items.${index}.goodsType`)} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs">
                        {goodsTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select {...register(`items.${index}.unit`)} className="w-18 border border-gray-200 rounded px-2 py-1 text-xs" onChange={() => calcTotalValue(index)}>
                        {units.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" {...register(`items.${index}.availableKg`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" {...register(`items.${index}.transferQtyKg`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" onChange={() => calcTotalValue(index)} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" {...register(`items.${index}.availablePieces`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" {...register(`items.${index}.transferQtyPieces`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" onChange={() => calcTotalValue(index)} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" {...register(`items.${index}.ratePerKg`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" onChange={() => calcTotalValue(index)} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" {...register(`items.${index}.ratePerPiece`, { valueAsNumber: true })} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" step="0.01" onChange={() => calcTotalValue(index)} />
                    </td>
                    <td className="px-2 py-2">
                      <span className="font-mono text-xs font-bold">₹ {(watchItems[index]?.totalValue ?? 0).toLocaleString()}</span>
                    </td>
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => remove(index)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => append({ vdvkCode: "", vdvkNameSnapshot: "", beneficiaryId: "", beneficiaryNameSnapshot: "", commodityCode: "", commodityNameSnapshot: "", gradeCode: null, gradeNameSnapshot: null, goodsType: "Raw", unit: "Kg", availableKg: null, transferQtyKg: null, availablePieces: null, transferQtyPieces: null, ratePerKg: null, ratePerPiece: null, totalValue: 0 })} className="mt-4 flex items-center gap-2 text-sm text-charcoal/60 hover:text-charcoal transition-colors">
            <Plus size={16} />Add Transfer Item
          </button>
        </div>

        {/* Submit Actions */}
        <div className="bg-[#272727] rounded-xl p-6 text-white">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-sage/60 mb-4">Final Review</h3>
          <div className="space-y-3 mb-6">
            {["Transfer details verified", "All items added correctly", "Vehicle & driver details filled"].map((label) => (
              <label key={label} className="flex items-center gap-3 text-sm text-sage/80"><input type="checkbox" className="rounded border-sage/40" />{label}</label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saveMutation.isPending || submitMutation.isPending} className="bg-white border border-gray-200 text-charcoal px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50">
              <Save size={16} />{saveMutation.isPending ? "Saving..." : submitMutation.isPending ? "Submitting..." : "Save & Submit"}
            </button>
          </div>
        </div>
      </form>

      {/* Error feedback */}
      {saveMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Failed to save. Please try again.
        </div>
      )}

      {/* Recent Transfers */}
      <div className="bg-[#f8f9fa] border border-charcoal/5 rounded-3xl overflow-hidden">
        <div className="p-8 pb-4 flex items-center justify-between">
          <h3 className="font-display text-xl text-charcoal tracking-wide uppercase">Recent Transfers</h3>
        </div>
        {!form2History || (Array.isArray(form2History) ? form2History.length === 0 : true) ? (
          <div className="px-8 pb-8">
            <EmptyState title="No Transfers Yet" description="Submitted transfers will appear here." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-charcoal/5">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-charcoal/60">Txn No</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-charcoal/60">Date</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-charcoal/60">From</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-charcoal/60">To</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-charcoal/60">Vehicle</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-charcoal/60">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5 bg-white">
                {(Array.isArray(form2History) ? form2History : []).map((r: any, i: number) => (
                  <tr key={r.id || i} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-xs font-mono font-bold">{r.txnNo || r.id?.slice(0, 8)}</td>
                    <td className="p-4 text-xs">{r.transferDate || r.createdAt?.split("T")[0] || "--"}</td>
                    <td className="p-4 text-xs">{r.sentFromNameSnapshot || r.sentFromFacilityCode || "--"}</td>
                    <td className="p-4 text-xs">{r.sentToNameSnapshot || r.sentToFacilityCode || "--"}</td>
                    <td className="p-4 text-xs font-mono">{r.vehicleDetails || "N/A"}</td>
                    <td className="p-4">
                      <StatusBadge status={r.status || "Draft"} />
                    </td>
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
