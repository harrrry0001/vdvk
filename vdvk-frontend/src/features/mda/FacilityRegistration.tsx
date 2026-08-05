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
import { masterApi } from "@/api/endpoints/master";
import {
  Building2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Facility {
  code: string;
  type: string;
  name: string;
  schemeCode?: string;
  state?: string;
  district?: string;
  mandal?: string;
  village?: string;
  address?: string;
  pinCode?: string;
  dateOfEstablishment?: string;
  operationalStatus: string;
  storageCapacityKg?: number;
  processingCapacityKgPerDay?: number;
  electricityAvailable?: boolean;
  waterFacility?: boolean;
  internetConnectivity?: boolean;
  machineryAvailable?: boolean;
  otherInfrastructure?: string;
  totalFundSanctioned?: number;
  totalFundReleased?: number;
  totalFundUtilised?: number;
  balanceFund?: number;
  status: string;
}

interface Scheme {
  code: string;
  name: string;
}

interface GeoOption {
  code: string;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Zod Schema — matches backend form11 insert fields                  */
/* ------------------------------------------------------------------ */

const FACILITY_TYPES = ["Processing Hub", "MPC (Multi-Purpose Center)", "Haat Bazaar", "Warehouse"] as const;

const facilitySchema = z.object({
  type: z.string().min(1, "Facility type is required"),
  name: z.string().min(1, "Facility name is required"),
  schemeCode: z.string().optional(),
  operationalStatus: z.string().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  mandal: z.string().min(1, "Mandal is required"),
  village: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  pinCode: z.string().optional(),
  dateOfEstablishment: z.string().min(1, "Date of establishment is required"),
  storageCapacityKg: z.coerce.number().min(0).optional(),
  processingCapacityKgPerDay: z.coerce.number().min(0).optional(),
  electricityAvailable: z.boolean().optional(),
  waterFacility: z.boolean().optional(),
  internetConnectivity: z.boolean().optional(),
  machineryAvailable: z.boolean().optional(),
  otherInfrastructure: z.string().optional(),
  totalFundSanctioned: z.coerce.number().min(0).optional(),
  totalFundReleased: z.coerce.number().min(0).optional(),
  totalFundUtilised: z.coerce.number().min(0).optional(),
});

type FacilityForm = z.infer<typeof facilitySchema>;

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
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-black uppercase tracking-widest">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[10px] text-red-600 font-bold">{error}</p>}
    </div>
  );
}

const inputClass =
  "border border-charcoal/15 px-3 py-3 text-sm w-full outline-none focus:border-charcoal focus:shadow-[0_0_0_1px_#171e19] bg-white";

const checkboxClass =
  "border border-charcoal/15 px-3 py-3 text-sm w-full outline-none focus:border-charcoal focus:shadow-[0_0_0_1px_#171e19] bg-white flex items-center gap-3";

const STATUS_VARIANTS: Record<string, string> = {
  Operational: "bg-green-100 text-green-800 border border-green-200",
  "Under Construction": "bg-yellow-100 text-yellow-800 border border-yellow-200",
  Inactive: "bg-gray-100 text-gray-500 border border-gray-200",
  Draft: "bg-gray-100 text-gray-500 border border-gray-200",
  "Pending Approval": "bg-blue-50 text-blue-700 border-blue-200",
  Approved: "bg-green-50 text-green-700 border-green-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function FacilityRegistration() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"register" | "list">("register");
  const [notif, setNotif] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [searchText, setSearchText] = useState("");

  const notify = (message: string, type: "success" | "error") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 5000);
  };

  /* --- queries --- */

  const { data: facilities, isLoading, isError } = useQuery({
    queryKey: ["forms", "form11"],
    queryFn: async () => {
      const res = await formsApi.list("form11");
      return (res.data?.data ?? res.data ?? []) as Facility[];
    },
  });

  const { data: schemes = [] } = useQuery({
    queryKey: ["master", "schemes"],
    queryFn: async () => {
      const res = await masterApi.getSchemes();
      return (res.data?.data ?? res.data ?? []) as Scheme[];
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

  /* --- mutations --- */

  const createMutation = useMutation({
    mutationFn: (data: FacilityForm) => {
      const payload: Record<string, unknown> = {
        type: data.type,
        name: data.name,
        address: data.address,
        mandal: data.mandal,
        dateOfEstablishment: data.dateOfEstablishment,
      };
      if (data.schemeCode) payload.schemeCode = data.schemeCode;
      if (data.operationalStatus) payload.operationalStatus = data.operationalStatus;
      if (data.state) payload.state = data.state;
      if (data.district) payload.district = data.district;
      if (data.village) payload.village = data.village;
      if (data.pinCode) payload.pinCode = data.pinCode;
      if (data.storageCapacityKg != null) payload.storageCapacityKg = data.storageCapacityKg;
      if (data.processingCapacityKgPerDay != null) payload.processingCapacityKgPerDay = data.processingCapacityKgPerDay;
      if (data.electricityAvailable != null) payload.electricityAvailable = data.electricityAvailable;
      if (data.waterFacility != null) payload.waterFacility = data.waterFacility;
      if (data.internetConnectivity != null) payload.internetConnectivity = data.internetConnectivity;
      if (data.machineryAvailable != null) payload.machineryAvailable = data.machineryAvailable;
      if (data.otherInfrastructure) payload.otherInfrastructure = data.otherInfrastructure;
      if (data.totalFundSanctioned != null) payload.totalFundSanctioned = data.totalFundSanctioned;
      if (data.totalFundReleased != null) payload.totalFundReleased = data.totalFundReleased;
      if (data.totalFundUtilised != null) payload.totalFundUtilised = data.totalFundUtilised;
      return formsApi.create("form11", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form11"] });
      queryClient.invalidateQueries({ queryKey: ["mda", "facilities", "by-type"] });
      facilityForm.reset();
      setActiveTab("list");
      notify("Facility registered successfully", "success");
    },
    onError: () => notify("Failed to register facility", "error"),
  });

  const submitMutation = useMutation({
    mutationFn: (code: string) => formsApi.submit("form11", code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form11"] });
      notify("Facility submitted for approval", "success");
    },
    onError: () => notify("Failed to submit facility", "error"),
  });

  const reopenMutation = useMutation({
    mutationFn: (code: string) => formsApi.reopen("form11", code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", "form11"] });
      notify("Facility reopened", "success");
    },
    onError: () => notify("Failed to reopen facility", "error"),
  });

  /* --- form --- */

  const facilityForm = useForm<FacilityForm>({
    resolver: zodResolver(facilitySchema),
    defaultValues: {
      type: "",
      name: "",
      schemeCode: "",
      operationalStatus: "Operational",
      state: "",
      district: "",
      mandal: "",
      village: "",
      address: "",
      pinCode: "",
      dateOfEstablishment: "",
      storageCapacityKg: undefined,
      processingCapacityKgPerDay: undefined,
      electricityAvailable: undefined,
      waterFacility: undefined,
      internetConnectivity: undefined,
      machineryAvailable: undefined,
      otherInfrastructure: "",
      totalFundSanctioned: undefined,
      totalFundReleased: undefined,
      totalFundUtilised: undefined,
    },
  });

  /* --- table data --- */

  const filteredFacilities = useMemo(() => {
    if (!facilities) return [];
    if (!searchText.trim()) return facilities;
    const q = searchText.toLowerCase();
    return facilities.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.code?.toLowerCase().includes(q) ||
        f.type?.toLowerCase().includes(q),
    );
  }, [facilities, searchText]);

  const facilityColumns: ColumnDef<Facility>[] = useMemo(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ getValue }) => <span className="font-mono text-xs font-bold">{getValue<string>() || "\u2014"}</span>,
      },
      {
        accessorKey: "name",
        header: "Facility Name",
        cell: ({ row }) => (
          <div>
            <div className="font-black text-sm uppercase">{row.original.name}</div>
            <div className="text-[10px] text-charcoal/50">{row.original.type}</div>
          </div>
        ),
      },
      {
        accessorKey: "schemeCode",
        header: "Scheme",
        cell: ({ getValue }) => {
          const v = getValue<string>();
          return <span className="text-xs font-medium">{v ? (schemeMap[v] || v) : "\u2014"}</span>;
        },
      },
      {
        id: "location",
        header: "Location",
        cell: ({ row }) => (
          <div className="text-xs">
            <div className="font-medium">{row.original.mandal || "\u2014"}</div>
            <div className="text-[10px] text-charcoal/50 max-w-[200px] truncate">{row.original.address || "\u2014"}</div>
          </div>
        ),
      },
      {
        id: "capacity",
        header: "Capacity",
        cell: ({ row }) => (
          <div className="text-xs">
            {row.original.storageCapacityKg != null && (
              <div>Storage: {new Intl.NumberFormat("en-IN").format(row.original.storageCapacityKg)} kg</div>
            )}
            {row.original.processingCapacityKgPerDay != null && (
              <div>Processing: {new Intl.NumberFormat("en-IN").format(row.original.processingCapacityKgPerDay)} kg/day</div>
            )}
            {row.original.storageCapacityKg == null && row.original.processingCapacityKgPerDay == null && "\u2014"}
          </div>
        ),
      },
      {
        id: "infra",
        header: "Infrastructure",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.electricityAvailable && (
              <span className="px-1.5 py-0.5 text-[9px] font-black bg-gray-100 uppercase">Power</span>
            )}
            {row.original.waterFacility && (
              <span className="px-1.5 py-0.5 text-[9px] font-black bg-gray-100 uppercase">Water</span>
            )}
            {row.original.internetConnectivity && (
              <span className="px-1.5 py-0.5 text-[9px] font-black bg-gray-100 uppercase">Internet</span>
            )}
            {row.original.machineryAvailable && (
              <span className="px-1.5 py-0.5 text-[9px] font-black bg-gray-100 uppercase">Machinery</span>
            )}
            {!row.original.electricityAvailable && !row.original.waterFacility && !row.original.internetConnectivity && !row.original.machineryAvailable && "\u2014"}
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.status || "Draft";
          return (
            <span className={cn("px-2 py-0.5 text-[9px] font-black uppercase", STATUS_VARIANTS[s] ?? STATUS_VARIANTS.Draft)}>
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
    [schemes, submitMutation, reopenMutation],
  );

  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: filteredFacilities,
    columns: facilityColumns,
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
          <h2 className="section-heading text-2xl mb-2">Failed to Load Facilities</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {notif && <NotificationBanner message={notif.message} type={notif.type} onDismiss={() => setNotif(null)} />}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-2 border-charcoal pb-8">
        <div>
          <h1 className="section-heading text-6xl leading-[0.9] tracking-tighter text-charcoal">
            FACILITY REGISTRATION
          </h1>
          <p className="text-charcoal/50 text-xs font-black uppercase tracking-[0.3em] mt-4">
            Infrastructure Setup & Configuration (Form 11)
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 w-fit">
          <button
            onClick={() => setActiveTab("register")}
            className={cn(
              "px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === "register" ? "bg-charcoal text-golden" : "text-charcoal/50 hover:text-charcoal",
            )}
          >
            Register Facility
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={cn(
              "px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === "list" ? "bg-charcoal text-golden" : "text-charcoal/50 hover:text-charcoal",
            )}
          >
            Facility Directory
          </button>
        </div>
      </div>

      {/* Register Tab */}
      {activeTab === "register" && (
        <form
          onSubmit={facilityForm.handleSubmit((data) => createMutation.mutate(data))}
          className="space-y-10"
        >
          {/* Section 1: Basic Details */}
          <div className="bg-white border border-charcoal/10 p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 bg-charcoal text-golden flex items-center justify-center font-display text-xl font-bold">01</span>
              <h3 className="section-heading text-2xl">Basic Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Field label="Facility Type" required error={facilityForm.formState.errors.type?.message}>
                <select {...facilityForm.register("type")} className={inputClass}>
                  <option value="">Select Type</option>
                  {FACILITY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Facility Name" required error={facilityForm.formState.errors.name?.message}>
                <input {...facilityForm.register("name")} className={inputClass} placeholder="e.g. Araku Valley Hub 01" />
              </Field>
              <Field label="Scheme">
                <select {...facilityForm.register("schemeCode")} className={inputClass}>
                  <option value="">Select Scheme</option>
                  {schemes.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Date of Establishment" required error={facilityForm.formState.errors.dateOfEstablishment?.message}>
                <input {...facilityForm.register("dateOfEstablishment")} type="date" className={inputClass} />
              </Field>
              <Field label="Operational Status">
                <select {...facilityForm.register("operationalStatus")} className={inputClass}>
                  <option value="Operational">Operational</option>
                  <option value="Under Construction">Under Construction</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Section 2: Location & Contact */}
          <div className="bg-white border border-charcoal/10 p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 bg-charcoal text-golden flex items-center justify-center font-display text-xl font-bold">02</span>
              <h3 className="section-heading text-2xl">Location</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Field label="State">
                <select {...facilityForm.register("state")} className={inputClass}>
                  <option value="">Select State</option>
                  {states.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="District">
                <input {...facilityForm.register("district")} className={inputClass} placeholder="District name" />
              </Field>
              <Field label="Mandal" required error={facilityForm.formState.errors.mandal?.message}>
                <input {...facilityForm.register("mandal")} className={inputClass} placeholder="Mandal name" />
              </Field>
              <Field label="Village">
                <input {...facilityForm.register("village")} className={inputClass} placeholder="Village name" />
              </Field>
              <Field label="Pin Code">
                <input {...facilityForm.register("pinCode")} className={inputClass} placeholder="e.g. 531024" />
              </Field>
              <div className="md:col-span-3">
                <Field label="Complete Address" required error={facilityForm.formState.errors.address?.message}>
                  <textarea {...facilityForm.register("address")} className={inputClass} rows={2} placeholder="Full facility address" />
                </Field>
              </div>
            </div>
          </div>

          {/* Section 3: Operational Metrics */}
          <div className="bg-white border border-charcoal/10 p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 bg-charcoal text-golden flex items-center justify-center font-display text-xl font-bold">03</span>
              <h3 className="section-heading text-2xl">Operational Metrics</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Storage Capacity (kg)">
                <div className="relative">
                  <input
                    {...facilityForm.register("storageCapacityKg")}
                    type="number"
                    className={inputClass}
                    placeholder="e.g. 50000"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-charcoal/50 font-bold">kg</span>
                </div>
              </Field>
              <Field label="Processing Capacity (kg/day)">
                <div className="relative">
                  <input
                    {...facilityForm.register("processingCapacityKgPerDay")}
                    type="number"
                    className={inputClass}
                    placeholder="e.g. 5000"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-charcoal/50 font-bold">kg/day</span>
                </div>
              </Field>
            </div>
          </div>

          {/* Section 4: Infrastructure */}
          <div className="bg-white border border-charcoal/10 p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 bg-charcoal text-golden flex items-center justify-center font-display text-xl font-bold">04</span>
              <h3 className="section-heading text-2xl">Infrastructure</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className={cn(checkboxClass, "cursor-pointer")}>
                <input type="checkbox" {...facilityForm.register("electricityAvailable")} />
                <span className="text-xs font-bold">Electricity Available</span>
              </label>
              <label className={cn(checkboxClass, "cursor-pointer")}>
                <input type="checkbox" {...facilityForm.register("waterFacility")} />
                <span className="text-xs font-bold">Water Facility</span>
              </label>
              <label className={cn(checkboxClass, "cursor-pointer")}>
                <input type="checkbox" {...facilityForm.register("internetConnectivity")} />
                <span className="text-xs font-bold">Internet Connectivity</span>
              </label>
              <label className={cn(checkboxClass, "cursor-pointer")}>
                <input type="checkbox" {...facilityForm.register("machineryAvailable")} />
                <span className="text-xs font-bold">Machinery Available</span>
              </label>
            </div>
            <div className="mt-4">
              <Field label="Other Infrastructure Details">
                <textarea
                  {...facilityForm.register("otherInfrastructure")}
                  className={inputClass}
                  rows={3}
                  placeholder="Building details, equipment, utilities, power backup..."
                />
              </Field>
            </div>
          </div>

          {/* Section 5: Financial */}
          <div className="bg-white border border-charcoal/10 p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 bg-charcoal text-golden flex items-center justify-center font-display text-xl font-bold">05</span>
              <h3 className="section-heading text-2xl">Financial Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Field label="Total Fund Sanctioned (\u20B9)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-charcoal/50 font-bold">\u20B9</span>
                  <input {...facilityForm.register("totalFundSanctioned")} type="number" className={cn(inputClass, "pl-8")} placeholder="0" />
                </div>
              </Field>
              <Field label="Total Fund Released (\u20B9)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-charcoal/50 font-bold">\u20B9</span>
                  <input {...facilityForm.register("totalFundReleased")} type="number" className={cn(inputClass, "pl-8")} placeholder="0" />
                </div>
              </Field>
              <Field label="Total Fund Utilised (\u20B9)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-charcoal/50 font-bold">\u20B9</span>
                  <input {...facilityForm.register("totalFundUtilised")} type="number" className={cn(inputClass, "pl-8")} placeholder="0" />
                </div>
              </Field>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4 pt-4 border-t border-charcoal/10">
            <button
              type="button"
              onClick={() => facilityForm.reset()}
              className="px-8 py-3 text-xs font-black uppercase tracking-widest border-2 border-charcoal hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? "Registering..." : "Register Facility"}
            </button>
          </div>
        </form>
      )}

      {/* List Tab */}
      {activeTab === "list" && (
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="section-heading text-2xl">Registered Facilities</h3>
              <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-[0.2em] mt-1">
                {filteredFacilities.length} {filteredFacilities.length === 1 ? "Facility" : "Facilities"}
              </p>
            </div>
            <div className="w-72 flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40" />
                <input
                  type="text"
                  placeholder="Search by name, code..."
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
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-4 whitespace-nowrap">
                          {typeof cell.column.columnDef.cell === "function"
                            ? (cell.column.columnDef.cell as (ctx: unknown) => React.ReactNode)(cell.getContext())
                            : null}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {table.getRowModel().rows.length === 0 && (
                    <tr>
                      <td colSpan={facilityColumns.length} className="p-0">
                        <EmptyState icon={<Building2 size={48} />} title="No facilities found" description="Register a new facility to get started" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredFacilities.length > 0 && (
              <div className="p-4 flex items-center justify-between border-t border-charcoal/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">
                  Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
                  {" \u2013 "}
                  {Math.min(
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                    filteredFacilities.length,
                  )}{" "}
                  of {filteredFacilities.length}
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
                        table.getState().pagination.pageIndex === i ? "bg-charcoal text-white" : "border border-charcoal/10 hover:bg-gray-50",
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
      )}
    </div>
  );
}

export default FacilityRegistration;
