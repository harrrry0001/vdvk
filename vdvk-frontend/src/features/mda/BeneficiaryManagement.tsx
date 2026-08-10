import { useState, useMemo, useRef, useCallback } from "react";
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
import { formsApi } from "@/api/endpoints/forms";
import {
  Upload,
  FileUp,
  Download,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Users,
  UserPlus,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Eye,
  Trash2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Vdvk {
  code: string;
  name: string;
  mandal?: string;
  district?: string;
  state?: string;
  status?: string;
}

interface Beneficiary {
  id: string;
  vdvkCode: string;
  name: string;
  age?: number;
  gender?: string;
  mobile?: string;
  aadhaar?: string;
  address?: string;
  state?: string;
  district?: string;
  mandal: string;
  village?: string;
  pinCode?: string;
  category?: string;
  registrationMode?: string;
  status?: string;
}

/* ------------------------------------------------------------------ */
/*  Zod Schema — matches backend benSchema                             */
/* ------------------------------------------------------------------ */

const GENDERS = ["Male", "Female", "Other"] as const;
const CATEGORIES = ["SC", "ST", "OBC", "General", "Minority", "Others"] as const;
const REGISTRATION_MODES = ["Individual", "Bulk"] as const;

const beneficiarySchema = z.object({
  name: z.string().min(1, "Beneficiary name is required"),
  age: z.coerce.number().min(1, "Age must be at least 1").max(120).optional(),
  gender: z.enum(GENDERS).optional(),
  mobile: z.string().optional(),
  aadhaar: z.string().optional(),
  address: z.string().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  mandal: z.string().min(1, "Mandal is required"),
  village: z.string().optional(),
  pinCode: z.string().optional(),
  category: z.enum(CATEGORIES).optional(),
  commodities: z.array(z.string()).optional(),
  registrationMode: z.enum(REGISTRATION_MODES).default("Individual"),
});

type BeneficiaryForm = z.infer<typeof beneficiarySchema>;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_VARIANTS: Record<string, string> = {
  Active: "bg-green-50 text-green-700 border-green-200",
  Inactive: "bg-gray-100 text-gray-500 border-gray-200",
  Draft: "bg-gray-100 text-gray-500 border-gray-200",
  "Pending Approval": "bg-blue-50 text-blue-700 border-blue-200",
  Approved: "bg-green-50 text-green-700 border-green-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
  Verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Pending Verification": "bg-amber-50 text-amber-700 border-amber-200",
};

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
      <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">
        {label}
      </label>
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

export function BeneficiaryManagement() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* --- state --- */
  const [activeTab, setActiveTab] = useState<"individual" | "bulk" | "registered">(
    "individual",
  );
  const [selectedVdvkCode, setSelectedVdvkCode] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [stagingRows, setStagingRows] = useState<
    Array<Record<string, string> & { _id: string }>
  >([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [notif, setNotif] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const notify = (message: string, type: "success" | "error") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 5000);
  };

  /* --- queries --- */

  const {
    data: vdvks,
    isLoading: vdvksLoading,
    isError: vdvksError,
  } = useQuery({
    queryKey: ["master", "vdvks"],
    queryFn: async () => {
      const res = await masterApi.getVdvks();
      return (res.data?.data ?? res.data ?? []) as Vdvk[];
    },
  });

  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");

  const { data: states = [] } = useQuery({
    queryKey: ["master", "geo", "states"],
    queryFn: async () => {
      const res = await masterApi.getStates();
      return (res.data?.data ?? res.data ?? []) as { code: string; name: string }[];
    },
  });

  const { data: districts = [] } = useQuery({
    queryKey: ["master", "geo", "districts", selectedState],
    queryFn: async () => {
      const res = await masterApi.getDistricts(selectedState);
      return (res.data?.data ?? res.data ?? []) as { code: string; name: string }[];
    },
    enabled: selectedState.length > 0,
  });

  const { data: mandals = [] } = useQuery({
    queryKey: ["master", "geo", "mandals", selectedDistrict],
    queryFn: async () => {
      const res = await masterApi.getMandals(selectedDistrict);
      return (res.data?.data ?? res.data ?? []) as { code: string; name: string }[];
    },
    enabled: selectedDistrict.length > 0,
  });

  const {
    data: beneficiaries,
    isLoading: beneficiariesLoading,
    isError: beneficiariesError,
    error: beneficiariesErr,
  } = useQuery({
    queryKey: ["forms", "form6", selectedVdvkCode],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedVdvkCode) params.vdvkCode = selectedVdvkCode;
      const res = await formsApi.list("form6", params);
      return (res.data?.data ?? res.data ?? []) as Beneficiary[];
    },
    enabled: !!selectedVdvkCode,
  });

  /* --- mutations --- */

  const createMutation = useMutation({
    mutationFn: (data: BeneficiaryForm) => {
      const payload: Record<string, unknown> = {
        vdvkCode: selectedVdvkCode,
        name: data.name,
        mandal: data.mandal,
        registrationMode: data.registrationMode || "Individual",
      };
      if (data.age != null) payload.age = data.age;
      if (data.gender) payload.gender = data.gender;
      if (data.mobile) payload.mobile = data.mobile;
      if (data.aadhaar) payload.aadhaar = data.aadhaar;
      if (data.address) payload.address = data.address;
      if (data.state) payload.state = data.state;
      if (data.district) payload.district = data.district;
      if (data.village) payload.village = data.village;
      if (data.pinCode) payload.pinCode = data.pinCode;
      if (data.category) payload.category = data.category;
      if (data.commodities?.length) payload.commodities = data.commodities;
      return formsApi.create("form6", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form6"] });
      notify("Beneficiary registered successfully", "success");
      addForm.reset();
    },
    onError: (err: Error) =>
      notify(err?.message ?? "Failed to register beneficiary", "error"),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => formsApi.submit("form6", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form6"] });
      notify("Beneficiary submitted for approval", "success");
    },
    onError: () => notify("Failed to submit beneficiary", "error"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => formsApi.update("form6", id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form6"] });
      notify("Beneficiary updated successfully", "success");
    },
    onError: () => notify("Failed to update beneficiary", "error"),
  });

  const importMutation = useMutation({
    mutationFn: (formData: FormData) => formsApi.importBeneficiaries(formData),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form6"] });
      const stagingData = res.data?.data?.failed ||
        res.data?.failed ? [] : [];
      const totalImported = res.data?.data?.imported ?? res.data?.imported ?? 0;
      notify(`Import successful — ${totalImported} rows processed`, "success");
    },
    onError: (err: Error) =>
      notify(err?.message ?? "Import failed", "error"),
  });

  const bulkMutation = useMutation({
    mutationFn: (data: { vdvkCode: string; beneficiaries: Array<Record<string, unknown>> }) =>
      formsApi.bulkRegisterBeneficiaries(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form6"] });
      setStagingRows([]);
      notify("Bulk registration processed", "success");
    },
    onError: (err: Error) =>
      notify(err?.message ?? "Bulk registration failed", "error"),
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => formsApi.reopen("form6", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form6"] });
      notify("Beneficiary reopened", "success");
    },
    onError: () => notify("Failed to reopen beneficiary", "error"),
  });

  /* --- forms --- */

  const addForm = useForm<BeneficiaryForm>({
    resolver: zodResolver(beneficiarySchema) as any,
    defaultValues: {
      name: "",
      age: undefined,
      gender: undefined,
      mobile: "",
      aadhaar: "",
      address: "",
      state: "",
      district: "",
      mandal: "",
      village: "",
      pinCode: "",
      category: undefined,
      commodities: [],
      registrationMode: "Individual",
    },
  });

  /* --- file handlers --- */

  const handleFileDrop = useCallback(
    (files: FileList | File[]) => {
      const file = Array.from(files)[0];
      if (!file) return;
      if (
        !file.name.endsWith(".xlsx") &&
        !file.name.endsWith(".csv") &&
        !file.name.endsWith(".xls")
      ) {
        notify("Please upload an Excel (.xlsx, .xls) or CSV file", "error");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        notify("File must be under 5MB", "error");
        return;
      }
      const fd = new FormData();
      fd.append("file", file);
      if (selectedVdvkCode) fd.append("vdvkCode", selectedVdvkCode);
      importMutation.mutate(fd);
    },
    [importMutation, notify, selectedVdvkCode],
  );

  /* --- table data --- */

  const filteredBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    let list = [...beneficiaries];
    if (statusFilter !== "All Status") {
      list = list.filter((b) => b.status === statusFilter);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(
        (b) =>
          b.name?.toLowerCase().includes(q) ||
          b.aadhaar?.toLowerCase().includes(q) ||
          b.id?.toLowerCase().includes(q) ||
          b.mobile?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [beneficiaries, statusFilter, searchText]);

  const columns: ColumnDef<Beneficiary>[] = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-bold">
            {getValue<string>() || "\u2014"}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div>
            <div className="font-black text-sm uppercase">{row.original.name}</div>
            {row.original.mobile && (
              <div className="text-[10px] text-charcoal/50">{row.original.mobile}</div>
            )}
          </div>
        ),
      },
      {
        id: "ageGender",
        header: "Age / Gender",
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.age ?? "\u2014"} / {row.original.gender ?? "\u2014"}
          </span>
        ),
      },
      {
        accessorKey: "aadhaar",
        header: "Aadhaar",
        cell: ({ getValue }) => (
          <span className="text-[10px] font-mono">{getValue<string>() || "\u2014"}</span>
        ),
      },
      {
        accessorKey: "vdvkCode",
        header: "VDVK",
        cell: ({ getValue }) => (
          <span className="text-[10px] font-bold">
            {getValue<string>() || "\u2014"}
          </span>
        ),
      },
      {
        accessorKey: "mandal",
        header: "Mandal",
        cell: ({ getValue }) => (
          <span className="text-[10px] uppercase font-medium">
            {getValue<string>() || "\u2014"}
          </span>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ getValue }) => {
          const cat = getValue<string>();
          return cat ? (
            <span className="px-2 py-0.5 text-[10px] font-black bg-charcoal text-golden uppercase">
              {cat}
            </span>
          ) : (
            "\u2014"
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const s = getValue<string>() || "Draft";
          return (
            <span
              className={cn(
                "px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter border",
                STATUS_VARIANTS[s] ?? "bg-gray-100 text-gray-500 border-gray-200",
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
        cell: ({ row }) => (
          <div className="flex gap-2">
            {row.original.status === "Draft" && (
              <button
                onClick={() => submitMutation.mutate(row.original.id)}
                disabled={submitMutation.isPending}
                className="text-[9px] font-black uppercase tracking-wider text-charcoal hover:underline"
              >
                Submit
              </button>
            )}
            {row.original.status === "Rejected" && (
              <button
                onClick={() => reopenMutation.mutate(row.original.id)}
                disabled={reopenMutation.isPending}
                className="text-[9px] font-black uppercase tracking-wider text-charcoal hover:underline"
              >
                Reopen
              </button>
            )}
          </div>
        ),
      },
    ],
    [submitMutation, reopenMutation],
  );

  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: filteredBeneficiaries,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  /* --- loading / error --- */

  if (vdvksLoading) return <PageLoading />;

  if (vdvksError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="section-heading text-2xl mb-2">Failed to Load VDVKs</h2>
          <p className="text-sm text-gray-400">Unable to fetch VDVK centers</p>
        </div>
      </div>
    );
  }

  const selectedVdvk = vdvks?.find((v) => v.code === selectedVdvkCode);

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

      {/* VDVK Selection Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-2 border-charcoal pb-8">
        <div>
          <h1 className="section-heading text-6xl leading-[0.9] tracking-tighter text-charcoal">
            BENEFICIARY
          </h1>
          <p className="text-charcoal/50 text-xs font-black uppercase tracking-[0.3em] mt-4">
            Registration &amp; Verification Management
          </p>
        </div>
        <div className="w-full md:w-80">
          <Field label="Select Active VDVK Center">
            <select
              value={selectedVdvkCode}
              onChange={(e) => setSelectedVdvkCode(e.target.value)}
              className={inputClass}
            >
              <option value="">\u2014 Select VDVK \u2014</option>
              {vdvks?.map((v) => (
                <option key={v.code} value={v.code}>
                  {v.code}: {v.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* VDVK Not Selected State */}
      {!selectedVdvkCode && (
        <EmptyState
          icon={<Users size={48} />}
          title="Select a VDVK Center"
          description="Choose a VDVK center above to manage its beneficiaries"
        />
      )}

      {selectedVdvkCode && (
        <>
          {/* Active VDVK Badge */}
          {selectedVdvk && (
            <div className="flex items-center gap-3 px-6 py-3 bg-golden/10 border border-golden/30 text-xs font-bold">
              <span className="font-mono text-charcoal">{selectedVdvk.code}</span>
              <span className="text-charcoal/60">|</span>
              <span className="uppercase tracking-wider">{selectedVdvk.name}</span>
              {selectedVdvk.mandal && (
                <>
                  <span className="text-charcoal/60">|</span>
                  <span className="text-charcoal/50">{selectedVdvk.mandal}</span>
                </>
              )}
              {selectedVdvk.status && (
                <span
                  className={cn(
                    "ml-auto px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter border",
                    selectedVdvk.status === "Active"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-100 text-gray-500 border-gray-200",
                  )}
                >
                  {selectedVdvk.status}
                </span>
              )}
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-1 bg-gray-100 p-1 w-fit">
            <button
              onClick={() => setActiveTab("individual")}
              className={cn(
                "px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === "individual"
                  ? "bg-charcoal text-golden"
                  : "text-charcoal/50 hover:text-charcoal",
              )}
            >
              Individual Registration
            </button>
            <button
              onClick={() => setActiveTab("bulk")}
              className={cn(
                "px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === "bulk"
                  ? "bg-charcoal text-golden"
                  : "text-charcoal/50 hover:text-charcoal",
              )}
            >
              Bulk Upload
            </button>
            <button
              onClick={() => setActiveTab("registered")}
              className={cn(
                "px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === "registered"
                  ? "bg-charcoal text-golden"
                  : "text-charcoal/50 hover:text-charcoal",
              )}
            >
              Registered Beneficiaries
            </button>
          </div>

          {/* ============================================================ */}
          {/*  Individual Registration Tab                                 */}
          {/* ============================================================ */}
          {activeTab === "individual" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
              <div className="md:col-span-2">
                <h3 className="section-heading text-2xl mb-6">New Beneficiary Profile</h3>
                <form
                  onSubmit={addForm.handleSubmit((data) => createMutation.mutate(data))}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field
                      label="Beneficiary Name"
                      error={addForm.formState.errors.name?.message}
                    >
                      <input
                        {...addForm.register("name")}
                        placeholder="Enter Full Name"
                        className={inputClass}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field
                        label="Age"
                        error={addForm.formState.errors.age?.message}
                      >
                        <input
                          {...addForm.register("age")}
                          type="number"
                          placeholder="25"
                          className={inputClass}
                        />
                      </Field>
                      <Field
                        label="Gender"
                      >
                        <select {...addForm.register("gender")} className={inputClass}>
                          <option value="">Select</option>
                          {GENDERS.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field label="Mobile Number">
                      <input
                        {...addForm.register("mobile")}
                        type="tel"
                        placeholder="+91"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Aadhaar">
                      <input
                        {...addForm.register("aadhaar")}
                        placeholder="XXXX-XXXX-XXXX"
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field
                      label="Category"
                    >
                      <div className="flex flex-wrap gap-2 pt-2">
                        {CATEGORIES.map((cat) => (
                          <label key={cat} className="inline-flex items-center cursor-pointer">
                            <input
                              type="radio"
                              value={cat}
                              className="hidden peer"
                              checked={addForm.watch("category") === cat}
                              onChange={() => addForm.setValue("category", cat)}
                            />
                            <span className="px-4 py-2 border border-charcoal/10 text-[10px] font-black peer-checked:bg-charcoal peer-checked:text-white uppercase transition-colors">
                              {cat}
                            </span>
                          </label>
                        ))}
                      </div>
                    </Field>
                    <Field label="Registration Mode">
                      <select {...addForm.register("registrationMode")} className={inputClass}>
                        {REGISTRATION_MODES.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="State">
                      <select
                        value={selectedState}
                        onChange={(e) => {
                          setSelectedState(e.target.value);
                          setSelectedDistrict("");
                          addForm.setValue("district", "");
                          addForm.setValue("mandal", "");
                        }}
                        className={inputClass}
                      >
                        <option value="">Select State</option>
                        {states.map((s) => (
                          <option key={s.code} value={s.code}>{s.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="District">
                      <select
                        value={selectedDistrict}
                        onChange={(e) => {
                          setSelectedDistrict(e.target.value);
                          addForm.setValue("district", e.target.value);
                          addForm.setValue("mandal", "");
                        }}
                        disabled={!selectedState}
                        className={cn(inputClass, !selectedState && "bg-gray-50 text-gray-400")}
                      >
                        <option value="">Select District</option>
                        {districts.map((d) => (
                          <option key={d.code} value={d.code}>{d.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label="Mandal"
                      error={addForm.formState.errors.mandal?.message}
                    >
                      <select {...addForm.register("mandal")} className={inputClass} disabled={!selectedDistrict}>
                        <option value="">Select Mandal</option>
                        {mandals.map((m) => (
                          <option key={m.code} value={m.code}>{m.name}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Village">
                      <input
                        {...addForm.register("village")}
                        placeholder="Village Name"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="PIN Code">
                      <input
                        {...addForm.register("pinCode")}
                        placeholder="531XXX"
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <Field label="Complete Address">
                    <textarea
                      {...addForm.register("address")}
                      rows={2}
                      className={inputClass}
                      placeholder="Door No, Landmark..."
                    />
                  </Field>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="w-full md:w-auto px-12 py-4 bg-charcoal text-white font-display uppercase tracking-widest text-sm hover:bg-dark-gray transition-all disabled:opacity-50"
                    >
                      {createMutation.isPending
                        ? "Submitting..."
                        : "Register Beneficiary"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <div className="bg-charcoal p-8 text-golden">
                  <h4 className="font-display text-xl mb-4 tracking-wide">Guidelines</h4>
                  <ul className="text-xs space-y-3 leading-relaxed opacity-80">
                    <li className="flex gap-2">
                      <CheckCircle size={14} className="shrink-0 mt-0.5" />
                      Aadhaar is recommended for DBT enablement.
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle size={14} className="shrink-0 mt-0.5" />
                      Ensure category matches official records.
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle size={14} className="shrink-0 mt-0.5" />
                      Bulk mode marks details as incomplete.
                    </li>
                  </ul>
                </div>
                <div className="border-4 border-dashed border-charcoal/10 p-8">
                  <UserPlus size={40} className="text-charcoal/20 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">
                    Recent Registrations
                  </p>
                  <p className="text-2xl font-display mt-1">{beneficiaries?.length ?? 0}</p>
                  <p className="text-[9px] text-gray-400 uppercase mt-4">
                    Total in {selectedVdvk?.name ?? "this VDVK"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/*  Bulk Upload Tab                                             */}
          {/* ============================================================ */}
          {activeTab === "bulk" && (
            <div className="space-y-10">
              <h3 className="section-heading text-2xl">Excel Bulk Import</h3>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upload Area */}
                <div className="lg:col-span-1">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      handleFileDrop(e.dataTransfer.files);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed p-12 flex flex-col items-center justify-center text-center bg-gray-50 hover:bg-white transition-all cursor-pointer group",
                      isDragOver
                        ? "border-charcoal bg-golden/5"
                        : "border-charcoal/20",
                    )}
                  >
                    <FileUp
                      size={48}
                      className={cn(
                        "mb-4 transition-all",
                        isDragOver
                          ? "text-charcoal"
                          : "text-charcoal/20 group-hover:text-charcoal",
                      )}
                    />
                    <p className="text-xs font-bold uppercase tracking-widest mb-2">
                      Drop Excel File Here
                    </p>
                    <p className="text-[10px] text-gray-400 mb-6">
                      Format: .xlsx, .csv (Max 5MB)
                    </p>
                    <button
                      type="button"
                      className="px-8 py-3 bg-charcoal text-white text-[10px] font-black uppercase tracking-widest hover:bg-dark-gray transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Browse Files
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) handleFileDrop(e.target.files);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="w-full mt-4 py-3 border border-charcoal text-charcoal text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-golden/10 transition-colors"
                    onClick={() => {
                      const template = "vdvkcode,name,age,gender,mandal,mobile,aadhaar\n" +
                        "VDK-ABC,name,34,Female,Paderu,98480XXXXX,123456789012\n" +
                        "VDK-ABC,name2,45,Male,Araku,99123XXXXX,987654321098";
                      const blob = new Blob([template], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "beneficiary_template.csv";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download size={14} />
                    Download Sample Template
                  </button>
                </div>

                {/* Sample Format */}
                <div className="lg:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60 block mb-4">
                    Sample Data Format (CSV Columns)
                  </label>
                  <div className="overflow-x-auto border border-charcoal/10">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-charcoal text-white">
                        <tr>
                          <th className="p-3 uppercase tracking-widest">vdvkcode*</th>
                          <th className="p-3 uppercase tracking-widest">name*</th>
                          <th className="p-3 uppercase tracking-widest">age</th>
                          <th className="p-3 uppercase tracking-widest">gender</th>
                          <th className="p-3 uppercase tracking-widest">mandal*</th>
                          <th className="p-3 uppercase tracking-widest">mobile</th>
                          <th className="p-3 uppercase tracking-widest">aadhaar</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-charcoal/5">
                        <tr>
                          <td className="p-3 font-mono">VDK-ABC</td>
                          <td className="p-3 font-bold">Korunda Devi</td>
                          <td className="p-3">34</td>
                          <td className="p-3">Female</td>
                          <td className="p-3">Paderu</td>
                          <td className="p-3">98480XXXXX</td>
                          <td className="p-3">123456789012</td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="p-3 font-mono">VDK-ABC</td>
                          <td className="p-3 font-bold">Bojji Ramu</td>
                          <td className="p-3">45</td>
                          <td className="p-3">Male</td>
                          <td className="p-3">Araku</td>
                          <td className="p-3">99123XXXXX</td>
                          <td className="p-3">987654321098</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[9px] text-red-600 font-bold mt-2 uppercase tracking-tighter">
                    * vdvkcode, name, and mandal are mandatory. Gender values: Male/Female/Other.
                  </p>
                </div>
              </div>

              {importMutation.isPending && (
                <div className="flex items-center justify-center gap-3 p-8 text-sm font-bold uppercase tracking-widest text-charcoal/50">
                  <FileSpreadsheet size={20} className="animate-pulse" />
                  Importing file...
                </div>
              )}

              {/* Bulk Quick-Add */}
              <div className="border-t border-charcoal/10 pt-6">
                <h4 className="section-heading text-xl mb-4">Quick Bulk Entry</h4>
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setStagingRows((prev) => [
                        ...prev,
                        {
                          _id: `staged-${Date.now()}`,
                          vdvkcode: selectedVdvkCode,
                          name: "",
                          age: "",
                          gender: "",
                          mandal: "",
                        },
                      ]);
                    }}
                    className="px-4 py-2 border border-charcoal text-charcoal text-[10px] font-black uppercase tracking-widest hover:bg-golden/10 transition-colors"
                  >
                    + Add Row
                  </button>
                  {stagingRows.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setStagingRows([])}
                        className="px-4 py-2 bg-gray-100 text-charcoal text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          bulkMutation.mutate({
                            vdvkCode: selectedVdvkCode,
                            beneficiaries: stagingRows.map(({ _id, ...rest }) => ({
                              name: rest.name,
                              age: rest.age ? Number(rest.age) : undefined,
                              gender: rest.gender || undefined,
                              mandal: rest.mandal,
                            })),
                          })
                        }
                        disabled={bulkMutation.isPending}
                        className="px-6 py-2 bg-charcoal text-golden text-[10px] font-black uppercase tracking-widest hover:bg-dark-gray transition-colors disabled:opacity-50"
                      >
                        {bulkMutation.isPending ? "Processing..." : "Submit All"}
                      </button>
                    </>
                  )}
                </div>

                {stagingRows.length > 0 && (
                  <div className="overflow-x-auto border border-charcoal/10">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-charcoal text-white">
                        <tr>
                          <th className="p-2 font-black uppercase tracking-widest">Name*</th>
                          <th className="p-2 font-black uppercase tracking-widest">Age</th>
                          <th className="p-2 font-black uppercase tracking-widest">Gender</th>
                          <th className="p-2 font-black uppercase tracking-widest">Mandal*</th>
                          <th className="p-2 font-black uppercase tracking-widest">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-charcoal/5 bg-white">
                        {stagingRows.map((row) => (
                          <tr key={row._id}>
                            <td className="p-1">
                              <input
                                value={row.name}
                                onChange={(e) =>
                                  setStagingRows((prev) =>
                                    prev.map((r) =>
                                      r._id === row._id ? { ...r, name: e.target.value } : r,
                                    ),
                                  )
                                }
                                className="border border-charcoal/15 px-2 py-1.5 text-xs w-full outline-none"
                                placeholder="Name"
                              />
                            </td>
                            <td className="p-1">
                              <input
                                value={row.age}
                                onChange={(e) =>
                                  setStagingRows((prev) =>
                                    prev.map((r) =>
                                      r._id === row._id ? { ...r, age: e.target.value } : r,
                                    ),
                                  )
                                }
                                className="border border-charcoal/15 px-2 py-1.5 text-xs w-16 outline-none"
                                placeholder="Age"
                                type="number"
                              />
                            </td>
                            <td className="p-1">
                              <select
                                value={row.gender}
                                onChange={(e) =>
                                  setStagingRows((prev) =>
                                    prev.map((r) =>
                                      r._id === row._id ? { ...r, gender: e.target.value } : r,
                                    ),
                                  )
                                }
                                className="border border-charcoal/15 px-2 py-1.5 text-xs outline-none"
                              >
                                <option value="">--</option>
                                {GENDERS.map((g) => (
                                  <option key={g} value={g}>{g}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-1">
                              <input
                                value={row.mandal}
                                onChange={(e) =>
                                  setStagingRows((prev) =>
                                    prev.map((r) =>
                                      r._id === row._id ? { ...r, mandal: e.target.value } : r,
                                    ),
                                  )
                                }
                                className="border border-charcoal/15 px-2 py-1.5 text-xs w-full outline-none"
                                placeholder="Mandal"
                              />
                            </td>
                            <td className="p-1">
                              <button
                                onClick={() =>
                                  setStagingRows((prev) => prev.filter((r) => r._id !== row._id))
                                }
                                className="text-red-600 hover:text-red-700 p-1"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/*  Registered Beneficiaries Tab                                */}
          {/* ============================================================ */}
          {activeTab === "registered" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="section-heading text-2xl text-charcoal">
                  Registered Beneficiaries
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40"
                    />
                    <input
                      type="text"
                      placeholder="Search by Name, ID or Aadhaar..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className={cn(inputClass, "pl-10")}
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={inputClass}
                  >
                    <option>All Status</option>
                    <option>Draft</option>
                    <option>Pending Approval</option>
                    <option>Approved</option>
                    <option>Rejected</option>
                  </select>
                </div>
              </div>

              {/* Loading table */}
              {beneficiariesLoading && <PageLoading />}

              {/* Error table */}
              {beneficiariesError && (
                <div className="flex items-center justify-center min-h-[40vh]">
                  <div className="text-center">
                    <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
                    <h2 className="section-heading text-2xl mb-2">Failed to Load Beneficiaries</h2>
                    <p className="text-sm text-gray-400">
                      {(beneficiariesErr as Error)?.message ?? "An unexpected error occurred"}
                    </p>
                  </div>
                </div>
              )}

              {/* Table */}
              {!beneficiariesLoading && !beneficiariesError && (
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
                                  header.column.getCanSort()
                                    ? "cursor-pointer select-none"
                                    : "",
                                )}
                              >
                                <div className="flex items-center gap-1">
                                  {typeof header.column.columnDef.header === "function"
                                    ? (
                                        header.column.columnDef.header as () => React.ReactNode
                                      )()
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
                          <tr
                            key={row.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            {row.getVisibleCells().map((cell) => (
                              <td key={cell.id} className="p-4">
                                {typeof cell.column.columnDef.cell === "function"
                                  ? (
                                      cell.column.columnDef.cell as (
                                        ctx: unknown,
                                      ) => React.ReactNode
                                    )(cell.getContext())
                                  : null}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {table.getRowModel().rows.length === 0 && (
                          <tr>
                            <td colSpan={columns.length} className="p-0">
                              <EmptyState
                                icon={<Users size={48} />}
                                title="No beneficiaries found"
                                description="Register beneficiaries individually or via bulk upload"
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {filteredBeneficiaries.length > 0 && (
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
                          filteredBeneficiaries.length,
                        )}{" "}
                        of {filteredBeneficiaries.length}
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
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default BeneficiaryManagement;
