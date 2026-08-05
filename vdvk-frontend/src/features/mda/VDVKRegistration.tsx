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
import { formsApi } from "@/api/endpoints/forms";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  MapPin,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Scheme {
  code: string;
  name: string;
}

interface Commodity {
  code: string;
  name: string;
}

interface GeoOption {
  code: string;
  name: string;
}

interface Vdvk {
  code: string;
  schemeCode: string;
  name: string;
  state: string;
  district: string;
  mandal: string;
  village: string;
  pinCode: string;
  sanctionDate: string;
  amountSanctioned: number;
  amountReleased: number;
  beneficiaryCount: number;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  status: string;
  commodities?: string[];
}

/* ------------------------------------------------------------------ */
/*  Zod Schema — matches backend vdvkSchema                            */
/* ------------------------------------------------------------------ */

const vdvkSchema = z.object({
  schemeCode: z.string().min(1, "Scheme is required"),
  name: z.string().min(1, "VDVK name is required"),
  state: z.string().min(1, "State is required"),
  district: z.string().min(1, "District is required"),
  mandal: z.string().min(1, "Mandal is required"),
  village: z.string().optional(),
  pinCode: z.string().optional(),
  sanctionDate: z.string().min(1, "Sanction date is required"),
  amountSanctioned: z.coerce.number().min(0, "Must be 0 or more"),
  amountReleased: z.coerce.number().min(0, "Must be 0 or more"),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifsc: z.string().optional(),
  numberOfSHGs: z.coerce.number().int().min(0).optional(),
  commodities: z.array(z.string()).optional(),
});
type VdvkForm = z.infer<typeof vdvkSchema>;

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

export function VDVKRegistration() {
  const queryClient = useQueryClient();

  /* --- queries --- */

  const { data: vdvks, isLoading, isError, error } = useQuery({
    queryKey: ["forms", "form5"],
    queryFn: async () => {
      const res = await formsApi.list("form5");
      return (res.data?.data ?? res.data ?? []) as Vdvk[];
    },
  });

  const { data: schemes = [] } = useQuery({
    queryKey: ["master", "schemes"],
    queryFn: async () => {
      const res = await masterApi.getSchemes();
      return (res.data?.data ?? res.data ?? []) as Scheme[];
    },
  });

  const { data: commodities = [] } = useQuery({
    queryKey: ["master", "commodities"],
    queryFn: async () => {
      const res = await masterApi.getCommodities();
      return (res.data?.data ?? res.data ?? []) as Commodity[];
    },
  });

  const { data: states = [] } = useQuery({
    queryKey: ["master", "geo", "states"],
    queryFn: async () => {
      const res = await masterApi.getStates();
      return (res.data?.data ?? res.data ?? []) as GeoOption[];
    },
  });

  const schemeMap = useMemo(() => {
    const map: Record<string, string> = {};
    schemes.forEach((s: any) => { map[s.code] = s.name; });
    return map;
  }, [schemes]);

  const commodityMap = useMemo(() => {
    const map: Record<string, string> = {};
    commodities.forEach((c: any) => { map[c.code] = c.name; });
    return map;
  }, [commodities]);

  const stateMap = useMemo(() => {
    const map: Record<string, string> = {};
    states.forEach((s: any) => { map[s.code] = s.name; });
    return map;
  }, [states]);

  /* --- form state --- */

  const [searchText, setSearchText] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [notif, setNotif] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const notify = (message: string, type: "success" | "error") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 5000);
  };

  /* --- dependent geo selects --- */

  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");

  const { data: districts = [] } = useQuery({
    queryKey: ["master", "geo", "districts", selectedState],
    queryFn: async () => {
      const res = await masterApi.getDistricts(selectedState);
      return (res.data?.data ?? res.data ?? []) as GeoOption[];
    },
    enabled: selectedState.length > 0,
  });

  const { data: mandals = [] } = useQuery({
    queryKey: ["master", "geo", "mandals", selectedDistrict],
    queryFn: async () => {
      const res = await masterApi.getMandals(selectedDistrict);
      return (res.data?.data ?? res.data ?? []) as GeoOption[];
    },
    enabled: selectedDistrict.length > 0,
  });

  const [selectedMandal, setSelectedMandal] = useState("");

  const { data: villages = [] } = useQuery({
    queryKey: ["master", "geo", "villages", selectedMandal],
    queryFn: async () => {
      const res = await masterApi.getVillages(selectedMandal);
      return (res.data?.data ?? res.data ?? []) as GeoOption[];
    },
    enabled: selectedMandal.length > 0,
  });

  /* --- form --- */

  const form = useForm<VdvkForm>({
    resolver: zodResolver(vdvkSchema),
    defaultValues: {
      schemeCode: "",
      name: "",
      state: "",
      district: "",
      mandal: "",
      village: "",
      pinCode: "",
      sanctionDate: "",
      amountSanctioned: 0,
      amountReleased: 0,
      bankName: "",
      accountNumber: "",
      ifsc: "",
      numberOfSHGs: 0,
      commodities: [],
    },
  });

  /* --- mutation --- */

  const createMutation = useMutation({
    mutationFn: (data: VdvkForm) => {
      const payload: Record<string, unknown> = {
        schemeCode: data.schemeCode,
        name: data.name,
        state: data.state,
        district: data.district,
        mandal: data.mandal,
        sanctionDate: data.sanctionDate,
        amountSanctioned: data.amountSanctioned,
        amountReleased: data.amountReleased,
      };
      if (data.village) payload.village = data.village;
      if (data.pinCode) payload.pinCode = data.pinCode;
      if (data.bankName) payload.bankName = data.bankName;
      if (data.accountNumber) payload.accountNumber = data.accountNumber;
      if (data.ifsc) payload.ifsc = data.ifsc;
      if (data.commodities?.length) payload.commodities = data.commodities;
      return formsApi.create("form5", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form5"] });
      form.reset();
      setShowForm(false);
      setSelectedState("");
      setSelectedDistrict("");
      setSelectedMandal("");
      notify("VDVK registered successfully", "success");
    },
    onError: () => notify("Failed to register VDVK", "error"),
  });

  const submitMutation = useMutation({
    mutationFn: (code: string) => formsApi.submit("form5", code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form5"] });
      notify("VDVK submitted for approval", "success");
    },
    onError: () => notify("Failed to submit VDVK", "error"),
  });

  const reopenMutation = useMutation({
    mutationFn: (code: string) => formsApi.reopen("form5", code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form5"] });
      notify("VDVK reopened", "success");
    },
    onError: () => notify("Failed to reopen VDVK", "error"),
  });

  /* --- table --- */

  const filteredVdvks = useMemo(() => {
    if (!vdvks) return [];
    if (!searchText.trim()) return vdvks;
    const q = searchText.toLowerCase();
    return vdvks.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q) ||
        (v.schemeCode && v.schemeCode.toLowerCase().includes(q)),
    );
  }, [vdvks, searchText]);

  const formatAmount = (value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);

  const columns: ColumnDef<Vdvk>[] = useMemo(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-bold">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "VDVK Name",
        cell: ({ row }) => (
          <div>
            <div className="font-black text-sm uppercase">{row.original.name}</div>
            <div className="text-[10px] text-charcoal/40">{schemeMap[row.original.schemeCode] || row.original.schemeCode || "\u2014"}</div>
          </div>
        ),
      },
      {
        accessorKey: "state",
        header: "State",
        cell: ({ getValue }) => <span className="text-xs font-medium">{stateMap[getValue<string>()] || getValue<string>()}</span>,
      },
      {
        accessorKey: "district",
        header: "District",
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>()}</span>,
      },
      {
        accessorKey: "mandal",
        header: "Mandal",
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>()}</span>,
      },
      {
        accessorKey: "sanctionDate",
        header: "Sanction Date",
        cell: ({ getValue }) => {
          const v = getValue<string>();
          return <span className="text-xs font-mono">{v || "\u2014"}</span>;
        },
      },
      {
        accessorKey: "amountSanctioned",
        header: "Sanctioned",
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return <span className="text-xs font-mono">{v != null ? formatAmount(v) : "\u2014"}</span>;
        },
      },
      {
        accessorKey: "amountReleased",
        header: "Released",
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return <span className="text-xs font-mono">{v != null ? formatAmount(v) : "\u2014"}</span>;
        },
      },
      {
        accessorKey: "beneficiaryCount",
        header: "Benef.",
        cell: ({ getValue }) => (
          <span className="text-xs font-bold font-mono">{getValue<number>()}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.status || "Draft";
          return (
            <span
              className={cn(
                "px-2 py-0.5 text-[9px] font-black uppercase",
                s === "Approved" ? "bg-green-100 text-green-700 border border-green-200" :
                s === "Rejected" ? "bg-red-100 text-red-700 border border-red-200" :
                s === "Pending Approval" ? "bg-blue-100 text-blue-700 border border-blue-200" :
                "bg-gray-100 text-gray-500 border border-gray-200",
              )}
            >
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
                  onClick={() => submitMutation.mutate(row.original.code)}
                  disabled={submitMutation.isPending}
                  className="text-[9px] font-black uppercase tracking-wider text-charcoal hover:underline"
                >
                  Submit
                </button>
              )}
              {s === "Rejected" && (
                <button
                  onClick={() => reopenMutation.mutate(row.original.code)}
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
    [schemes, commodities, states, submitMutation, reopenMutation],
  );

  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: filteredVdvks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  /* --- Loading --- */
  if (isLoading) return <PageLoading />;

  /* --- Error --- */
  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="section-heading text-2xl mb-2">Failed to Load VDVKs</h2>
          <p className="text-sm text-gray-400">
            {(error as Error)?.message ?? "An unexpected error occurred"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Notification */}
      {notif && (
        <NotificationBanner
          message={notif.message}
          type={notif.type}
          onDismiss={() => setNotif(null)}
        />
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-2 border-charcoal pb-8">
        <div>
          <h1 className="section-heading text-6xl leading-[0.9] tracking-tighter text-charcoal">
            VDVK REGISTRY
          </h1>
          <p className="text-charcoal/50 text-xs font-black uppercase tracking-[0.3em] mt-4">
            Vana Dhan Vikas Kendra &mdash; Unit Registration &amp; Management
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={cn(
            "px-8 py-4 text-xs font-black uppercase tracking-widest flex items-center gap-3 transition-all",
            showForm
              ? "bg-white text-charcoal border-2 border-charcoal hover:bg-gray-50"
              : "bg-charcoal text-golden hover:bg-dark-gray",
          )}
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? "Close Form" : "Register VDVK"}
        </button>
      </div>

      {/* Registration Form */}
      {showForm && (
        <div className="bg-[#f8f9fa] border border-charcoal/5 rounded-2xl p-8">
          <div className="mb-6">
            <h2 className="section-heading text-3xl tracking-tighter">NEW VDVK UNIT</h2>
            <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-[0.2em] mt-1">
              Fill the details to onboard a new VDVK
            </p>
          </div>

          <form
            onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {/* VDVK Name */}
            <Field label="VDVK Name" error={form.formState.errors.name?.message}>
              <input
                {...form.register("name")}
                className={inputClass}
                placeholder="e.g. Paderu Tribal VDVK"
              />
            </Field>

            {/* Scheme */}
            <Field label="Scheme" error={form.formState.errors.schemeCode?.message}>
              <select {...form.register("schemeCode")} className={inputClass}>
                <option value="">Select Scheme</option>
                {schemes.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>

            {/* Sanction Date */}
            <Field label="Sanction Date" error={form.formState.errors.sanctionDate?.message}>
              <input
                {...form.register("sanctionDate")}
                type="date"
                className={inputClass}
              />
            </Field>

            {/* State */}
            <Field label="State" error={form.formState.errors.state?.message}>
              <Controller
                name="state"
                control={form.control}
                render={({ field }) => (
                  <select
                    value={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      setSelectedState(e.target.value);
                      form.setValue("district", "");
                      form.setValue("mandal", "");
                      form.setValue("village", "");
                      setSelectedDistrict("");
                      setSelectedMandal("");
                    }}
                    className={inputClass}
                  >
                    <option value="">Select State</option>
                    {states.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </Field>

            {/* District */}
            <Field label="District" error={form.formState.errors.district?.message}>
              <Controller
                name="district"
                control={form.control}
                render={({ field }) => (
                  <select
                    value={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      setSelectedDistrict(e.target.value);
                      form.setValue("mandal", "");
                      form.setValue("village", "");
                      setSelectedMandal("");
                    }}
                    disabled={!selectedState}
                    className={cn(inputClass, !selectedState && "bg-gray-50 text-gray-400")}
                  >
                    <option value="">Select District</option>
                    {districts.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </Field>

            {/* Mandal */}
            <Field label="Mandal" error={form.formState.errors.mandal?.message}>
              <Controller
                name="mandal"
                control={form.control}
                render={({ field }) => (
                  <select
                    value={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      setSelectedMandal(e.target.value);
                      form.setValue("village", "");
                    }}
                    disabled={!selectedDistrict}
                    className={cn(inputClass, !selectedDistrict && "bg-gray-50 text-gray-400")}
                  >
                    <option value="">Select Mandal</option>
                    {mandals.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </Field>

            {/* Village */}
            <Field label="Village">
              <Controller
                name="village"
                control={form.control}
                render={({ field }) => (
                  <select
                    value={field.value || ""}
                    disabled={!selectedMandal}
                    onChange={field.onChange}
                    className={cn(inputClass, !selectedMandal && "bg-gray-50 text-gray-400")}
                  >
                    <option value="">Select Village</option>
                    {villages.map((v) => (
                      <option key={v.code} value={v.code}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </Field>

            {/* Pin Code */}
            <Field label="Pin Code">
              <input
                {...form.register("pinCode")}
                className={inputClass}
                placeholder="e.g. 531024"
              />
            </Field>

            {/* Sanctioned Amount */}
            <Field label="Sanctioned Amount" error={form.formState.errors.amountSanctioned?.message}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-charcoal/50 font-bold">
                  ₹
                </span>
                <input
                  {...form.register("amountSanctioned")}
                  type="number"
                  className={cn(inputClass, "pl-8")}
                  placeholder="0"
                />
              </div>
            </Field>

            {/* Released Amount */}
            <Field label="Released Amount" error={form.formState.errors.amountReleased?.message}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-charcoal/50 font-bold">
                  ₹
                </span>
                <input
                  {...form.register("amountReleased")}
                  type="number"
                  className={cn(inputClass, "pl-8")}
                  placeholder="0"
                />
              </div>
            </Field>

            {/* Number of SHGs */}
            <Field label="Number of SHGs">
              <input
                {...form.register("numberOfSHGs")}
                type="number"
                className={inputClass}
                placeholder="0"
              />
            </Field>

            {/* Bank Details Section */}
            <div className="md:col-span-2 lg:col-span-3 border-t border-charcoal/10 pt-4">
              <h4 className="text-xs font-black uppercase tracking-widest mb-4 text-charcoal/60">Bank Details</h4>
            </div>

            <Field label="Bank Name">
              <input
                {...form.register("bankName")}
                className={inputClass}
                placeholder="e.g. State Bank of India"
              />
            </Field>

            <Field label="Account Number">
              <input
                {...form.register("accountNumber")}
                className={inputClass}
                placeholder="Account number"
              />
            </Field>

            <Field label="IFSC Code">
              <input
                {...form.register("ifsc")}
                className={inputClass}
                placeholder="e.g. SBIN0001234"
              />
            </Field>

            {/* Commodities Multi-Select */}
            <div className="md:col-span-2 lg:col-span-3">
              <Field label="Commodities Handled">
                <Controller
                  name="commodities"
                  control={form.control}
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

            {/* Submit */}
            <div className="md:col-span-2 lg:col-span-3 mt-4 pt-6 border-t border-charcoal/10 flex justify-end gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  form.reset();
                  setSelectedState("");
                  setSelectedDistrict("");
                  setSelectedMandal("");
                }}
                className="px-8 py-3 text-xs font-black uppercase tracking-widest border-2 border-charcoal hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? "Registering..." : "Register VDVK"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table Section */}
      <div>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="section-heading text-3xl tracking-tighter">REGISTERED VDVKs</h2>
            <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-[0.2em] mt-1">
              {filteredVdvks.length} {filteredVdvks.length === 1 ? "Unit" : "Units"} Total
            </p>
          </div>
          <div className="w-72 flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">
              Search VDVK
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Name, Code, or Scheme..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className={cn(inputClass, "pr-10")}
              />
              <Search
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40"
              />
            </div>
          </div>
        </div>

        {/* Table */}
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
                              <ChevronUp
                                size={12}
                                className={cn(
                                  header.column.getIsSorted() === "asc"
                                    ? "text-golden"
                                    : "text-golden/30",
                                )}
                              />
                              <ChevronDown
                                size={12}
                                className={cn(
                                  header.column.getIsSorted() === "desc"
                                    ? "text-golden"
                                    : "text-golden/30",
                                )}
                              />
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
                          ? (cell.column.columnDef.cell as (ctx: unknown) => React.ReactNode)(
                              cell.getContext(),
                            )
                          : null}
                      </td>
                    ))}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="p-0">
                      <EmptyState
                        icon={<MapPin size={48} />}
                        title="No VDVKs found"
                        description="Register a new VDVK to get started"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredVdvks.length > 0 && (
            <div className="p-4 flex items-center justify-between border-t border-charcoal/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">
                Showing{" "}
                {table.getState().pagination.pageIndex *
                  table.getState().pagination.pageSize +
                  1}
                {" \u2013 "}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) *
                    table.getState().pagination.pageSize,
                  filteredVdvks.length,
                )}{" "}
                of {filteredVdvks.length} VDVKs
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
                      "w-8 h-8 flex items-center justify-center",
                      table.getState().pagination.pageIndex === i
                        ? "bg-charcoal text-white"
                        : "border border-charcoal/10 hover:bg-gray-50",
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
      </div>
    </div>
  );
}

export default VDVKRegistration;
