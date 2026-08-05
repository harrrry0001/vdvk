import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, Send, Camera, X } from "lucide-react";
import { format } from "date-fns";
import { masterApi } from "@/api/endpoints/master";
import { mdaApi } from "@/api/endpoints/mda";
import { formsApi } from "@/api/endpoints/forms";
import { uploadApi } from "@/api/endpoints/upload";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";

const VISIT_LOCATION_TYPES = [
  "VDVK",
  "Hub",
  "Collection Centre",
  "Haat Bazaar",
  "Beneficiary",
  "Other",
] as const;

const emptyToNull = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

interface VisitPhoto {
  photoUrl: string;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  capturedAt: string | null;
}

const fieldVisitSchema = z.object({
  visitDate: z.string().min(1, "Required"),
  visitStartTime: z.string().min(1, "Required"),
  visitEndTime: z.string().nullable(),
  mandal: z.string().min(1, "Required"),
  visitLocationType: z.enum(VISIT_LOCATION_TYPES),
  locationName: z.string().nullable(),
  relatedVdvkCodes: z.array(z.string()).nullable(),
  purposeOfVisit: z.string().nullable(),
  visitDescription: z.string().nullable(),
  keyObservations: z.string().nullable(),
  gpsLatitude: z.number().nullable(),
  gpsLongitude: z.number().nullable(),
  supportingDocuments: z.array(z.string()).nullable(),
  remarks: z.string().nullable(),
});

type FieldVisitFormData = z.infer<typeof fieldVisitSchema>;

export function Form12FieldVisit() {
  const queryClient = useQueryClient();
  const [photos, setPhotos] = useState<VisitPhoto[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);

  const defaultDate = format(new Date(), "yyyy-MM-dd");
  const defaultStartTime = format(new Date(), "HH:mm");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<FieldVisitFormData>({
    resolver: zodResolver(fieldVisitSchema),
    defaultValues: {
      visitDate: defaultDate,
      visitStartTime: defaultStartTime,
      visitEndTime: null,
      mandal: "",
      visitLocationType: "VDVK",
      locationName: null,
      relatedVdvkCodes: [],
      purposeOfVisit: null,
      visitDescription: null,
      keyObservations: null,
      gpsLatitude: null,
      gpsLongitude: null,
      supportingDocuments: null,
      remarks: null,
    },
  });

  const watchedRelatedVdvkCodes: string[] = watch("relatedVdvkCodes") ?? [];

  const toggleVdvkCode = (code: string) => {
    const current = getValues("relatedVdvkCodes") ?? [];
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    setValue("relatedVdvkCodes", next);
  };

  const { data: vdvks } = useQuery({
    queryKey: ["master", "vdvks"],
    queryFn: () => masterApi.getVdvks().then((r) => r.data ?? []),
  });

  const { data: states } = useQuery({
    queryKey: ["master", "geo", "states"],
    queryFn: () => masterApi.getStates().then((r) => r.data ?? []),
  });

  const { data: recentRecords } = useQuery({
    queryKey: ["forms", "form12"],
    queryFn: () => formsApi.list("form12").then((r) => r.data ?? []),
  });

  const vdvkOptions = useMemo(() => {
    const arr = Array.isArray(vdvks) ? vdvks : [];
    return arr.map((v: Record<string, unknown>) => ({
      code: (v.code as string) ?? (v.vdvkCode as string) ?? "",
      name: (v.name as string) ?? (v.vdvkName as string) ?? "",
    }));
  }, [vdvks]);

  const stateOptions = useMemo(() => {
    const arr = Array.isArray(states) ? states : [];
    return arr.map((s: Record<string, unknown>) => ({
      code: (s.code as string) ?? "",
      name: (s.name as string) ?? "",
    }));
  }, [states]);

  // Geo cascading: State → District → Mandal
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");

  const { data: districts } = useQuery({
    queryKey: ["master", "geo", "districts", selectedState],
    queryFn: () =>
      masterApi.getDistricts(selectedState).then((r) => r.data ?? []),
    enabled: !!selectedState,
  });

  const { data: mandals } = useQuery({
    queryKey: ["master", "geo", "mandals", selectedDistrict],
    queryFn: () =>
      masterApi.getMandals(selectedDistrict).then((r) => r.data ?? []),
    enabled: !!selectedDistrict,
  });

  const districtOptions = useMemo(() => {
    const arr = Array.isArray(districts) ? districts : [];
    return arr.map((d: Record<string, unknown>) => ({
      code: (d.code as string) ?? "",
      name: (d.name as string) ?? "",
    }));
  }, [districts]);

  const mandalOptions = useMemo(() => {
    const arr = Array.isArray(mandals) ? mandals : [];
    return arr.map((m: Record<string, unknown>) => ({
      code: (m.code as string) ?? "",
      name: (m.name as string) ?? "",
    }));
  }, [mandals]);

  // Reset downstream selects when state/district changes
  useEffect(() => {
    setSelectedDistrict("");
    setValue("mandal", "");
  }, [selectedState, setValue]);

  useEffect(() => {
    setValue("mandal", "");
  }, [selectedDistrict, setValue]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingCount((prev) => prev + files.length);

    for (const file of Array.from(files)) {
      try {
        const { data } = await uploadApi.upload(file);
        const url = (data as { url?: string }).url ?? "";
        if (url) {
          setPhotos((prev) => [
            ...prev,
            {
              photoUrl: url,
              gpsLatitude: null,
              gpsLongitude: null,
              capturedAt: new Date().toISOString(),
            },
          ]);
        }
      } catch {
        // silently fail per-file
      } finally {
        setUploadingCount((prev) => prev - 1);
      }
    }
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const createMutation = useMutation({
    mutationFn: async (data: FieldVisitFormData & { photos?: VisitPhoto[] }) => {
      const { data: res } = await formsApi.create("form12", data);
      return res as { id: string; txnNo: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form12"] });
      reset();
      setPhotos([]);
    },
  });

  const onSubmit = handleSubmit((data) => {
    createMutation.mutate({
      ...data,
      photos: photos.length > 0 ? photos : undefined,
    });
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-charcoal tracking-wide uppercase">
            Field Visit Register
          </h2>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Form 12</p>
        </div>
        <span className="bg-green-500/10 text-green-600 text-[10px] font-black px-3 py-1 rounded-full border border-green-500/20 uppercase tracking-widest">
          Visit Form 12
        </span>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Total Visits Logged
          </p>
          <p className="font-display text-3xl text-slate-900">
            {Array.isArray(recentRecords) ? recentRecords.length : 0}
          </p>
        </div>
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Photos Uploaded
          </p>
          <p className="font-display text-3xl text-slate-900">
            {photos.length}
          </p>
        </div>
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            VDVKs Available
          </p>
          <p className="font-display text-3xl text-slate-900">
            {vdvkOptions.length}
          </p>
        </div>
      </div>

      {/* Visit Form */}
      <form onSubmit={onSubmit} className="space-y-8">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <h3 className="font-display text-xl text-charcoal tracking-wide uppercase border-b border-charcoal/5 pb-2 mb-6">
            Visit Details
          </h3>

          {/* Row 1: Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                Visit Date
              </label>
              <input
                type="date"
                {...register("visitDate")}
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
              />
              {errors.visitDate && (
                <p className="text-red-500 text-[10px]">{errors.visitDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                Start Time
              </label>
              <input
                type="time"
                {...register("visitStartTime")}
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
              />
              {errors.visitStartTime && (
                <p className="text-red-500 text-[10px]">{errors.visitStartTime.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                End Time
              </label>
              <input
                type="time"
                {...register("visitEndTime", { setValueAs: (v) => v || null })}
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
              />
            </div>
          </div>

          {/* Row 2: Geo — State → District → Mandal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                State
              </label>
              <select
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setSelectedDistrict("");
                  setValue("mandal", "");
                }}
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
              >
                <option value="">-- Select State --</option>
                {stateOptions.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                District
              </label>
              <select
                value={selectedDistrict}
                onChange={(e) => {
                  setSelectedDistrict(e.target.value);
                  setValue("mandal", "");
                }}
                disabled={!selectedState}
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">-- Select District --</option>
                {districtOptions.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                Mandal
              </label>
              <select
                {...register("mandal")}
                disabled={!selectedDistrict}
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">-- Select Mandal --</option>
                {mandalOptions.map((m) => (
                  <option key={m.code} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
              {errors.mandal && (
                <p className="text-red-500 text-[10px]">{errors.mandal.message}</p>
              )}
            </div>
          </div>

          {/* Row 3: Location */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                Location Type
              </label>
              <select
                {...register("visitLocationType")}
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
              >
                {VISIT_LOCATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                Location Name
              </label>
              <input
                type="text"
                {...register("locationName", { setValueAs: (v) => v || null })}
                placeholder="Specific location name..."
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                GPS Latitude
              </label>
              <input
                type="number"
                step="0.000001"
                placeholder="e.g. 17.385044"
                {...register("gpsLatitude", { setValueAs: emptyToNull })}
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                GPS Longitude
              </label>
              <input
                type="number"
                step="0.000001"
                placeholder="e.g. 78.486671"
                {...register("gpsLongitude", { setValueAs: emptyToNull })}
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                Purpose of Visit
              </label>
              <input
                type="text"
                {...register("purposeOfVisit", { setValueAs: (v) => v || null })}
                placeholder="e.g. VDVK meeting, inspection"
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Related VDVKs */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <h3 className="font-display text-xl text-charcoal tracking-wide uppercase border-b border-charcoal/5 pb-2 mb-6">
            Related VDVKs
          </h3>
          <div className="border border-charcoal/10 rounded-xl bg-white p-4 max-h-56 overflow-y-auto">
            {vdvkOptions.length === 0 ? (
              <p className="text-xs text-charcoal/40">No VDVKs available.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                {vdvkOptions.map((v) => (
                  <label
                    key={v.code}
                    className="flex items-center gap-2 text-xs py-1.5 cursor-pointer hover:bg-slate-50 px-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={watchedRelatedVdvkCodes.includes(v.code)}
                      onChange={() => toggleVdvkCode(v.code)}
                      className="w-3.5 h-3.5 rounded"
                    />
                    {v.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Description & Observations */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <h3 className="font-display text-xl text-charcoal tracking-wide uppercase border-b border-charcoal/5 pb-2 mb-6">
            Observations
          </h3>
          <div className="grid grid-cols-1 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                Visit Description
              </label>
              <textarea
                {...register("visitDescription", {
                  setValueAs: (v) => v || null,
                })}
                rows={3}
                placeholder="Describe the visit activities..."
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all resize-y"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                Key Observations
              </label>
              <textarea
                {...register("keyObservations", {
                  setValueAs: (v) => v || null,
                })}
                rows={3}
                placeholder="Findings, action items, recommendations..."
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all resize-y"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-charcoal/40">
                Remarks
              </label>
              <textarea
                {...register("remarks", { setValueAs: (v) => v || null })}
                rows={2}
                placeholder="General remarks or notes..."
                className="w-full p-3 rounded-xl bg-white border border-charcoal/10 focus:border-charcoal focus:shadow-[0_0_0_2px_rgba(255,225,124,0.2)] outline-none transition-all resize-y"
              />
            </div>
          </div>
        </div>

        {/* Photos */}
        <div className="bg-[#f8f9fa] border border-charcoal/5 rounded-3xl p-8">
          <h3 className="font-display text-xl text-charcoal tracking-wide uppercase border-b border-charcoal/5 pb-2 mb-6">
            Visit Photos
          </h3>

          <label className="flex items-center gap-3 px-6 py-3 border-2 border-dashed border-charcoal/20 rounded-xl cursor-pointer hover:border-charcoal/40 transition-colors text-sm text-charcoal/60 mb-4">
            <Camera size={20} />
            Upload Photos
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </label>

          {uploadingCount > 0 && (
            <p className="text-xs text-charcoal/40 mb-4">
              Uploading {uploadingCount} file{uploadingCount > 1 ? "s" : ""}...
            </p>
          )}

          {photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {photos.map((photo, idx) => (
                <div
                  key={idx}
                  className="relative bg-white rounded-xl border border-charcoal/10 overflow-hidden group"
                >
                  <img
                    src={photo.photoUrl}
                    alt={`Visit photo ${idx + 1}`}
                    className="w-full h-32 object-cover"
                  />
                  <div className="p-3 space-y-1">
                    <p className="text-[10px] text-charcoal/40 truncate">
                      {photo.photoUrl.split("/").pop() ?? `Photo ${idx + 1}`}
                    </p>
                    {photo.capturedAt && (
                      <p className="text-[10px] text-charcoal/30">
                        {format(new Date(photo.capturedAt), "dd/MM HH:mm")}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-xs font-bold text-charcoal/40">
              Visit Status:
            </span>
            <span className="bg-amber-500/10 text-amber-600 text-[10px] font-black px-3 py-1 rounded-full border border-amber-500/20 uppercase tracking-widest">
              Draft
            </span>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 md:flex-initial px-8 py-4 bg-slate-50 hover:bg-slate-100 text-charcoal text-xs font-black uppercase tracking-[0.2em] rounded-xl border border-slate-200 transition-all disabled:opacity-50"
            >
              <Save size={18} className="inline mr-2" />
              {createMutation.isPending ? "Saving..." : "Save Visit"}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 md:flex-initial px-10 py-4 bg-charcoal text-golden text-xs font-black uppercase tracking-[0.2em] rounded-xl hover:bg-black transition-all shadow-lg disabled:opacity-50"
            >
              <Send size={18} className="inline mr-2" />
              {createMutation.isPending ? "Submitting..." : "Submit Visit"}
            </button>
          </div>
        </div>

        {createMutation.isError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            Failed to save visit. Please try again.
          </div>
        )}
        {createMutation.isSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            Field visit saved successfully.
          </div>
        )}
      </form>

      {/* Recent Visits Table */}
      <div className="bg-[#f8f9fa] border border-charcoal/5 rounded-3xl overflow-hidden">
        <div className="bg-charcoal px-6 py-4 flex justify-between items-center">
          <h3 className="font-display text-lg tracking-widest text-white">
            Field Visit History
          </h3>
        </div>

        {!Array.isArray(recentRecords) || recentRecords.length === 0 ? (
          <div className="px-8 pb-8 pt-4">
            <EmptyState
              title="No Field Visits Logged"
              description="Record your field visits using the form above."
            />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-charcoal/50 border-b border-slate-200">
                <tr>
                  <th className="p-4 border-r border-slate-200">Date</th>
                  <th className="p-4 border-r border-slate-200">Mandal</th>
                  <th className="p-4 border-r border-slate-200">Location Type</th>
                  <th className="p-4 border-r border-slate-200">Location</th>
                  <th className="p-4 border-r border-slate-200">Purpose</th>
                  <th className="p-4 border-r border-slate-200 text-center">Photos</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-charcoal">
                {(recentRecords as Record<string, unknown>[]).map((record) => {
                  const status = (record.status as string) ?? "Submitted";
                  const dateStr = record.visitDate
                    ? format(
                        new Date(
                          (record.visitDate as string) +
                            ((record.visitDate as string).includes("T") ? "" : "T00:00:00")
                        ),
                        "dd/MM/yyyy"
                      )
                    : record.createdAt
                      ? format(new Date(record.createdAt as string), "dd/MM/yyyy")
                      : "--";
                  const photoCount = (record.photoCount as number) ?? 0;
                  return (
                    <tr
                      key={record.id as string}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-4 border-r border-slate-100 text-xs">
                        {dateStr}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-xs">
                        {(record.mandal as string) ?? "--"}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-xs">
                        {(record.visitLocationType as string) ?? "--"}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-xs">
                        {(record.locationName as string) ?? "--"}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-xs max-w-[200px] truncate">
                        {(record.purposeOfVisit as string) ?? "--"}
                      </td>
                      <td className="p-4 border-r border-slate-100 text-center text-xs">
                        {photoCount > 0 ? photoCount : "--"}
                      </td>
                      <td className="p-4 text-center">
                        <StatusBadge status={status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
