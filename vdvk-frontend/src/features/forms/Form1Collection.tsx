import { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, AlertTriangle, CheckCircle } from "lucide-react";
import { masterApi } from "@/api/endpoints/master";
import { formsApi } from "@/api/endpoints/forms";
import { PageLoading } from "@/components/shared/LoadingSpinner";

const itemSchema = z.object({
  beneficiaryId: z.string().min(1, "Required"),
  beneficiaryNameSnapshot: z.string().min(1, "Required"),
  commodityCode: z.string().min(1, "Required"),
  commodityNameSnapshot: z.string().min(1, "Required"),
  gradeCode: z.string().nullable().optional(),
  gradeNameSnapshot: z.string().nullable().optional(),
  unit: z.enum(["Kg", "Pieces", "Both"]),
  unitSnapshot: z.string(),
  qtyKg: z.number().nullable().optional(),
  qtyPieces: z.number().nullable().optional(),
  ratePerKg: z.number().nullable().optional(),
  ratePerPiece: z.number().nullable().optional(),
  rateSnapshot: z.string().nullable().optional(),
  totalCost: z.number().min(0),
  remarks: z.string().nullable().optional(),
});

const form1Schema = z.object({
  vdvkCode: z.string().min(1, "VDVK is required"),
  vdvkNameSnapshot: z.string().min(1, "VDVK name required"),
  collectionDate: z.string().min(1, "Date is required"),
  placeOfSubmission: z.enum(["VDVK Facility", "Multipurpose Centre", "Haat Bazaar", "Hub"]),
  transactionType: z.enum(["Cash", "Bank Transfer", "Credit", "Advance", "Other"]),
  overallRemarks: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1, "At least one collection item is required"),
});

type Form1Data = z.infer<typeof form1Schema>;

interface VdvkItem { code: string; name: string; }
interface CommodityItem { code: string; name: string; defaultUnit?: string; }

export function Form1Collection() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"new" | "tracking">("new");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: vdvks, isError: vdvksError, refetch: vdvksRefetch } = useQuery({
    queryKey: ["master", "vdvks"],
    queryFn: () => masterApi.getVdvks().then((r) => (Array.isArray(r.data) ? r.data : []) as VdvkItem[]),
  });

  const { data: commodities, isError: commoditiesError, refetch: commoditiesRefetch } = useQuery({
    queryKey: ["master", "commodities"],
    queryFn: () => masterApi.getCommodities().then((r) => (Array.isArray(r.data) ? r.data : []) as CommodityItem[]),
  });

  const { data: form1History } = useQuery({
    queryKey: ["forms", "form1"],
    queryFn: () => formsApi.list("form1").then((r) => r.data ?? []),
  });

  const {
    register, control, handleSubmit, watch, setValue, reset,
    formState: { errors },
  } = useForm<Form1Data>({
    resolver: zodResolver(form1Schema),
    defaultValues: {
      collectionDate: new Date().toISOString().split("T")[0],
      placeOfSubmission: "VDVK Facility",
      transactionType: "Cash",
      items: [{
        beneficiaryId: "", beneficiaryNameSnapshot: "",
        commodityCode: "", commodityNameSnapshot: "",
        gradeCode: null, gradeNameSnapshot: null,
        unit: "Kg", unitSnapshot: "Kg",
        qtyKg: null, qtyPieces: null,
        ratePerKg: null, ratePerPiece: null, rateSnapshot: null,
        totalCost: 0, remarks: null,
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchItems = watch("items");
  const watchVdvkCode = watch("vdvkCode");

  const calculateTotal = useCallback((index: number) => {
    const item = watchItems[index];
    if (!item) return;
    const kgTotal = (item.unit === "Kg" || item.unit === "Both") ? (item.qtyKg ?? 0) * (item.ratePerKg ?? 0) : 0;
    const pcTotal = (item.unit === "Pieces" || item.unit === "Both") ? (item.qtyPieces ?? 0) * (item.ratePerPiece ?? 0) : 0;
    setValue(`items.${index}.totalCost`, kgTotal + pcTotal);
  }, [watchItems, setValue]);

  const saveMutation = useMutation({
    mutationFn: (data: Form1Data) => {
      const subData = {
        ...data,
        items: data.items.map((i) => ({
          ...i,
          qtyKg: i.qtyKg ?? undefined,
          qtyPieces: i.qtyPieces ?? undefined,
          ratePerKg: i.ratePerKg ?? undefined,
          ratePerPiece: i.ratePerPiece ?? undefined,
          gradeCode: i.gradeCode ?? undefined,
          gradeNameSnapshot: i.gradeNameSnapshot ?? undefined,
          rateSnapshot: i.rateSnapshot ?? undefined,
          remarks: i.remarks ?? undefined,
        })),
      };
      return formsApi.create("form1", subData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form1"] });
      setSuccessMsg("Collection saved as draft");
      reset();
      setTimeout(() => setSuccessMsg(null), 3000);
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => formsApi.submit("form1", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form1"] });
      setSuccessMsg("Submitted for approval");
      reset();
      setTimeout(() => setSuccessMsg(null), 3000);
    },
  });

  const onSubmit = (data: Form1Data) => {
    saveMutation.mutate(data);
  };

  const isError = vdvksError || commoditiesError;

  if (isError)
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-red-500 font-semibold">Failed to load data</p>
          <button onClick={() => { vdvksRefetch(); commoditiesRefetch(); }} className="mt-2 text-sm text-charcoal underline">Retry</button>
        </div>
      </div>
    );

  if (!vdvks || !commodities) return <PageLoading />;

  const selectedVdvk = vdvks.find((v) => v.code === watchVdvkCode);
  const commodityMap: Record<string, string> = {};
  commodities.forEach((c) => { commodityMap[c.code] = c.name; });

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-5 py-3 text-sm font-semibold">
          <CheckCircle size={18} />{successMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display text-charcoal tracking-wide">MFP COLLECTION REGISTER</h2>
          <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Form 01 — Community Coordinator</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setActiveTab("new")} className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === "new" ? "bg-charcoal text-golden" : "text-charcoal/50 hover:text-charcoal"}`}>New Collection</button>
          <button onClick={() => setActiveTab("tracking")} className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === "tracking" ? "bg-charcoal text-golden" : "text-charcoal/50 hover:text-charcoal"}`}>Submissions</button>
        </div>
      </div>

      {activeTab === "new" && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="kpi-label">VDVK Code / Name</label>
                <select
                  {...register("vdvkCode")}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-charcoal/10 focus:border-charcoal/30 transition-all"
                  onChange={(e) => {
                    const v = vdvks.find((x) => x.code === e.target.value);
                    if (v) setValue("vdvkNameSnapshot", v.name);
                  }}
                >
                  <option value="">Select VDVK</option>
                  {vdvks.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.name}</option>)}
                </select>
                {errors.vdvkCode && <p className="text-red-500 text-xs mt-1">{errors.vdvkCode.message}</p>}
              </div>
              <div>
                <label className="kpi-label">Date of Submission</label>
                <input type="date" {...register("collectionDate")} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-charcoal/10 focus:border-charcoal/30 transition-all" />
              </div>
              <div>
                <label className="kpi-label">Place of Submission</label>
                <select {...register("placeOfSubmission")} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-charcoal/10 focus:border-charcoal/30 transition-all">
                  <option value="VDVK Facility">VDVK Facility</option>
                  <option value="Multipurpose Centre">Multipurpose Centre</option>
                  <option value="Haat Bazaar">Haat Bazaar</option>
                  <option value="Hub">Hub</option>
                </select>
              </div>
              <div>
                <label className="kpi-label">Transaction Type</label>
                <select {...register("transactionType")} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-charcoal/10 focus:border-charcoal/30 transition-all">
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit">Credit</option>
                  <option value="Advance">Advance</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <input type="hidden" {...register("vdvkNameSnapshot")} />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-charcoal border-b-2 border-gray-100 pb-3 mb-4">Beneficiary-wise Collection</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-3 py-3 border-b border-gray-200">Ben. ID</th>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-3 py-3 border-b border-gray-200">Name</th>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-3 py-3 border-b border-gray-200">Commodity</th>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-3 py-3 border-b border-gray-200">Grade</th>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-3 py-3 border-b border-gray-200">Unit</th>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-3 py-3 border-b border-gray-200">Qty (Kg)</th>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-3 py-3 border-b border-gray-200">Qty (Pcs)</th>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-3 py-3 border-b border-gray-200">Rate/Kg</th>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-3 py-3 border-b border-gray-200">Rate/Pc</th>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-3 py-3 border-b border-gray-200">Total</th>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-3 py-3 border-b border-gray-200">Remarks</th>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-3 py-3 border-b border-gray-200"></th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => (
                    <tr key={field.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-3 py-2">
                        <input {...register(`items.${index}.beneficiaryId`)} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="BEN-001" onChange={(e) => { setValue(`items.${index}.beneficiaryId`, e.target.value); }} />
                      </td>
                      <td className="px-3 py-2">
                        <input {...register(`items.${index}.beneficiaryNameSnapshot`)} className="w-24 border border-gray-200 rounded px-2 py-1 text-xs" placeholder="Name" onChange={(e) => { setValue(`items.${index}.beneficiaryNameSnapshot`, e.target.value); }} />
                      </td>
                      <td className="px-3 py-2">
                        <select {...register(`items.${index}.commodityCode`)} className="w-28 border border-gray-200 rounded px-2 py-1 text-xs" onChange={(e) => { const c = commodities.find((x) => x.code === e.target.value); setValue(`items.${index}.commodityCode`, e.target.value); if (c) setValue(`items.${index}.commodityNameSnapshot`, c.name); }}>
                          <option value="">Select</option>
                          {commodities.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select {...register(`items.${index}.gradeCode`)} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs" onChange={(e) => { const g = e.target.value; setValue(`items.${index}.gradeCode`, g || undefined); setValue(`items.${index}.gradeNameSnapshot`, g || undefined); }}>
                          <option value="">—</option>
                          <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="Default">Default</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select {...register(`items.${index}.unit`)} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs" onChange={(e) => { const u = e.target.value; setValue(`items.${index}.unit`, u as any); setValue(`items.${index}.unitSnapshot`, u); calculateTotal(index); }}>
                          <option value="Kg">Kg</option><option value="Pieces">Pieces</option><option value="Both">Both</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" {...register(`items.${index}.qtyKg`, { valueAsNumber: true })} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" onChange={(e) => { setValue(`items.${index}.qtyKg`, e.target.valueAsNumber); calculateTotal(index); }} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" {...register(`items.${index}.qtyPieces`, { valueAsNumber: true })} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" onChange={(e) => { setValue(`items.${index}.qtyPieces`, e.target.valueAsNumber); calculateTotal(index); }} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" {...register(`items.${index}.ratePerKg`, { valueAsNumber: true })} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" onChange={(e) => { setValue(`items.${index}.ratePerKg`, e.target.valueAsNumber); setValue(`items.${index}.rateSnapshot`, `Kg:${e.target.valueAsNumber}`); calculateTotal(index); }} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" {...register(`items.${index}.ratePerPiece`, { valueAsNumber: true })} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs font-mono" placeholder="0" onChange={(e) => { setValue(`items.${index}.ratePerPiece`, e.target.valueAsNumber); calculateTotal(index); }} />
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs font-bold">₹ {(watchItems[index]?.totalCost ?? 0).toLocaleString()}</span>
                      </td>
                      <td className="px-3 py-2">
                        <input {...register(`items.${index}.remarks`)} className="w-24 border border-gray-200 rounded px-2 py-1 text-xs" placeholder="Remarks" onChange={(e) => setValue(`items.${index}.remarks`, e.target.value || undefined)} />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => remove(index)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => append({ beneficiaryId: "", beneficiaryNameSnapshot: "", commodityCode: "", commodityNameSnapshot: "", gradeCode: null, gradeNameSnapshot: null, unit: "Kg", unitSnapshot: "Kg", qtyKg: null, qtyPieces: null, ratePerKg: null, ratePerPiece: null, rateSnapshot: null, totalCost: 0, remarks: null })} className="mt-4 flex items-center gap-2 text-sm text-charcoal/60 hover:text-charcoal transition-colors">
              <Plus size={16} />Add Beneficiary Entry
            </button>
          </div>

          <div className="bg-[#272727] rounded-xl p-6 text-white">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-sage/60 mb-4">Final Review</h3>
            <div className="space-y-3 mb-6">
              {["Beneficiary Data Matched", "Calculations Validated", "GPS Coordinates Tagged"].map((label) => (
                <label key={label} className="flex items-center gap-3 text-sm text-sage/80"><input type="checkbox" className="rounded border-sage/40" />{label}</label>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" className="bg-white border border-gray-200 text-charcoal px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2" disabled={saveMutation.isPending}>
                <Save size={16} />{saveMutation.isPending ? "Saving..." : "Save Draft"}
              </button>
            </div>
          </div>
        </form>
      )}

      {activeTab === "tracking" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-charcoal border-b-2 border-gray-100 pb-3 mb-4">Submission History</h3>
          {!form1History || (Array.isArray(form1History) ? form1History.length === 0 : true) ? (
            <div className="text-center py-12 text-gray-400 text-sm">No submissions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-4 py-3 border-b border-gray-200">ID</th>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-4 py-3 border-b border-gray-200">VDVK</th>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-4 py-3 border-b border-gray-200">Date</th>
                    <th className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-left px-4 py-3 border-b border-gray-200">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(form1History) ? form1History : []).map((r: any, i: number) => (
                    <tr key={r.id || i} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm font-mono text-xs">{r.txnNo || r.id}</td>
                      <td className="px-4 py-3 text-sm">{r.vdvkNameSnapshot || r.vdvkCode}</td>
                      <td className="px-4 py-3 text-sm">{r.collectionDate}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${r.status === "Approved" ? "bg-green-50 text-green-600 border-green-200" : r.status === "Submitted" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-amber-50 text-amber-600 border-amber-200"}`}>{r.status || "Draft"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
