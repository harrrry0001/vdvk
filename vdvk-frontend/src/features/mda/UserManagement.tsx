import { useState, useMemo, useRef, useEffect } from "react";
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
import { mdaApi } from "@/api/endpoints/mda";
import { masterApi } from "@/api/endpoints/master";
import { ROLE_LABELS, ROLES } from "@/lib/constants";
import {
  UserPlus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Users,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  UserCog,
  ArrowRightLeft,
  KeyRound,
  UserX,
  Eye,
  Pencil,
  Crown,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MdaUser {
  id: string;
  userId: string;
  name: string;
  username: string;
  email: string;
  mobile: string;
  role: string;
  designation: string;
  mandal: string;
  assignedArea: string;
  status: "Active" | "Inactive";
}

/* ------------------------------------------------------------------ */
/*  Zod Schemas                                                        */
/* ------------------------------------------------------------------ */

const addUserSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  role: z.string().min(1, "Role is required"),
  email: z.string().min(1, "Email is required").email("Invalid email"),
  mobile: z.string().optional().or(z.literal("")),
  mandals: z.array(z.string()),
  facilities: z.array(z.string()),
  password: z.string().min(6, "Password must be at least 6 characters"),
  isActive: z.boolean(),
});
type AddUserForm = z.infer<typeof addUserSchema>;

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm the password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

const transferSchema = z.object({
  destinationMandal: z.string().min(1, "Destination mandal is required"),
  effectiveDate: z.string().min(1, "Effective date is required"),
  reason: z.string().min(1, "Reason is required"),
});
type TransferForm = z.infer<typeof transferSchema>;

const headChangeSchema = z.object({
  newHeadName: z.string().min(1, "Name is required"),
  newHeadUserId: z.string().min(1, "User ID is required"),
  effectiveDate: z.string().min(1, "Effective date is required"),
  reason: z.string().min(1, "Reason is required"),
});
type HeadChangeForm = z.infer<typeof headChangeSchema>;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ROLE_OPTIONS = Object.values(ROLES);

const ROLE_BADGE: Record<string, string> = {
  PO: "bg-red-100 text-red-700",
  DPM: "bg-blue-100 text-blue-700",
  APM: "bg-green-100 text-green-700",
  CC: "bg-purple-100 text-purple-700",
  Supervisor: "bg-orange-100 text-orange-700",
  "VDVK Head": "bg-teal-100 text-teal-700",
  Admin: "bg-amber-100 text-amber-700",
  APD: "bg-indigo-100 text-indigo-700",
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
/*  Modal Shell                                                        */
/* ------------------------------------------------------------------ */

function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-charcoal/90 z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="section-heading text-4xl tracking-tighter">{title}</h2>
              <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-[0.2em]">
                {subtitle}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 transition-colors">
              <X size={24} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function SmallModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-charcoal/90 z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg">
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="section-heading text-4xl tracking-tighter">{title}</h2>
              <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-[0.2em]">
                {subtitle}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 transition-colors">
              <X size={24} />
            </button>
          </div>
          {children}
        </div>
      </div>
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
/*  Actions Dropdown                                                   */
/* ------------------------------------------------------------------ */

function ActionsMenu({
  user,
  onTransfer,
  onResetPassword,
  onHeadChange,
  onDeactivate,
}: {
  user: MdaUser;
  onTransfer: (u: MdaUser) => void;
  onResetPassword: (u: MdaUser) => void;
  onHeadChange: (u: MdaUser) => void;
  onDeactivate: (u: MdaUser) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 hover:bg-charcoal/5 transition-colors"
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <div className="absolute right-0 mt-0 w-48 bg-white border border-charcoal/10 shadow-xl z-10">
          <button className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-golden transition-colors flex items-center gap-2">
            <Eye size={14} /> VIEW PROFILE
          </button>
          <button className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-golden transition-colors flex items-center gap-2">
            <Pencil size={14} /> EDIT USER
          </button>
          <button
            onClick={() => { onTransfer(user); setOpen(false); }}
            className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-golden transition-colors flex items-center gap-2"
          >
            <ArrowRightLeft size={14} /> TRANSFER
          </button>
          <button
            onClick={() => { onResetPassword(user); setOpen(false); }}
            className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-golden transition-colors flex items-center gap-2"
          >
            <KeyRound size={14} /> RESET PASSWORD
          </button>
          <button
            onClick={() => { onHeadChange(user); setOpen(false); }}
            className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-golden transition-colors flex items-center gap-2"
          >
            <Crown size={14} /> HEAD CHANGE
          </button>
          <div className="border-t border-charcoal/5" />
          <button
            onClick={() => { onDeactivate(user); setOpen(false); }}
            className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
          >
            <UserX size={14} /> DEACTIVATE
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function UserManagement() {
  const queryClient = useQueryClient();

  /* --- queries --- */
  const { data: users, isLoading, isError, error } = useQuery({
    queryKey: ["mda", "users"],
    queryFn: async () => {
      const res = await mdaApi.getUsers();
      return (res.data?.data ?? res.data ?? []) as MdaUser[];
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

  const { data: mandalOptions = [] } = useQuery({
    queryKey: ["master", "geo", "mandals", selectedDistrict],
    queryFn: async () => {
      const res = await masterApi.getMandals(selectedDistrict);
      return (res.data?.data ?? res.data ?? []) as { code: string; name: string }[];
    },
    enabled: selectedDistrict.length > 0,
  });

  const { data: facilityOptions = [] } = useQuery({
    queryKey: ["mda", "facilities", "by-type"],
    queryFn: async () => {
      const res = await mdaApi.getFacilitiesByType();
      return (res.data?.data ?? res.data ?? []) as { code: string; name: string }[];
    },
  });

  /* --- filters --- */
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [mandalFilter, setMandalFilter] = useState("All Mandals");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [searchText, setSearchText] = useState("");

  /* --- modals --- */
  const [modal, setModal] = useState<{
    type: "add" | "transfer" | "resetPassword" | "headChange" | null;
    user?: MdaUser;
  }>({ type: null });
  const [deactivateUser, setDeactivateUser] = useState<MdaUser | null>(null);

  /* --- notification --- */
  const [notif, setNotif] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const notify = (message: string, type: "success" | "error") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 5000);
  };

  /* --- mutations --- */

  const createMutation = useMutation({
    mutationFn: (data: AddUserForm) => mdaApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "users"] });
      setModal({ type: null });
      notify("User created successfully", "success");
    },
    onError: () => notify("Failed to create user", "error"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => mdaApi.deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "users"] });
      setDeactivateUser(null);
      notify("User deactivated", "success");
    },
    onError: () => notify("Failed to deactivate user", "error"),
  });

  const resetPwMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { newPassword: string } }) =>
      mdaApi.resetPassword(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "users"] });
      setModal({ type: null });
      notify("Password reset successfully", "success");
    },
    onError: () => notify("Failed to reset password", "error"),
  });

  const transferMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransferForm }) =>
      mdaApi.transferUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mda", "users"] });
      setModal({ type: null });
      notify("User transfer initiated", "success");
    },
    onError: () => notify("Failed to transfer user", "error"),
  });

  /* --- forms --- */

  const addForm = useForm<AddUserForm>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { name: "", role: "", email: "", mobile: "", mandals: [], facilities: [], password: "", isActive: true },
  });

  const resetPwForm = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const transferForm = useForm<TransferForm>({
    resolver: zodResolver(transferSchema),
    defaultValues: { destinationMandal: "", effectiveDate: "", reason: "" },
  });

  const headChangeForm = useForm<HeadChangeForm>({
    resolver: zodResolver(headChangeSchema),
    defaultValues: { newHeadName: "", newHeadUserId: "", effectiveDate: "", reason: "" },
  });

  /* --- table data --- */

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    let list = [...users];
    if (roleFilter !== "All Roles") {
      list = list.filter((u) => u.role === roleFilter);
    }
    if (mandalFilter !== "All Mandals") {
      list = list.filter((u) => u.mandal === mandalFilter);
    }
    if (statusFilter !== "All Status") {
      list = list.filter((u) => u.status === statusFilter);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.userId.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }
    return list;
  }, [users, roleFilter, mandalFilter, statusFilter, searchText]);

  const columns: ColumnDef<MdaUser>[] = useMemo(
    () => [
      {
        accessorKey: "userId",
        header: "User ID",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-bold">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name & Contact",
        cell: ({ row }) => (
          <div>
            <div className="font-black text-sm uppercase">{row.original.name}</div>
            <div className="text-[10px] text-charcoal/50">{row.original.email}</div>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ getValue }) => {
          const role = getValue<string>();
          return (
            <span
              className={cn(
                "px-2 py-1 text-[10px] font-black uppercase tracking-tighter",
                ROLE_BADGE[role] ?? "bg-gray-100 text-gray-600",
              )}
            >
              {ROLE_LABELS[role] ?? role}
            </span>
          );
        },
      },
      {
        accessorKey: "mandal",
        header: "Mandal(s)",
        cell: ({ getValue }) => (
          <span className="text-xs font-medium">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "assignedArea",
        header: "Assigned Area",
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>()}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const s = getValue<string>();
          const active = s === "Active";
          return (
            <span
              className={cn(
                "flex items-center gap-1.5 text-[10px] font-black uppercase",
                active ? "text-green-600" : "text-gray-400",
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  active ? "bg-green-600" : "bg-gray-400",
                )}
              />
              {s}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <ActionsMenu
            user={row.original}
            onTransfer={(u) => setModal({ type: "transfer", user: u })}
            onResetPassword={(u) => setModal({ type: "resetPassword", user: u })}
            onHeadChange={(u) => setModal({ type: "headChange", user: u })}
            onDeactivate={setDeactivateUser}
          />
        ),
      },
    ],
    [],
  );

  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: filteredUsers,
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
          <h2 className="section-heading text-2xl mb-2">Failed to Load Users</h2>
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
            DIRECTORY
          </h1>
          <p className="text-charcoal/50 text-xs font-black uppercase tracking-[0.3em] mt-4">
            System Access Control &amp; Hierarchy Management
          </p>
        </div>
        <button
          onClick={() => setModal({ type: "add" })}
          className="px-8 py-4 bg-charcoal text-white text-xs font-black uppercase tracking-widest flex items-center gap-3 hover:bg-dark-gray transition-all"
        >
          <UserPlus size={18} />
          Add New User
        </button>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">
            Role
          </label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={inputClass}
          >
            <option>All Roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r}>{ROLE_LABELS[r] ?? r}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">
            State
          </label>
          <select
            value={selectedState}
            onChange={(e) => {
              setSelectedState(e.target.value);
              setSelectedDistrict("");
            }}
            className={inputClass}
          >
            <option value="">All States</option>
            {states.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">
            District
          </label>
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            disabled={!selectedState}
            className={cn(inputClass, !selectedState && "bg-gray-50 text-gray-400")}
          >
            <option value="">All Districts</option>
            {districts.map((d) => (
              <option key={d.code} value={d.code}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">
            Mandal
          </label>
          <select
            value={mandalFilter}
            onChange={(e) => setMandalFilter(e.target.value)}
            disabled={!selectedDistrict}
            className={cn(inputClass, !selectedDistrict && "bg-gray-50 text-gray-400")}
          >
            <option>All Mandals</option>
            {mandalOptions.map((m) => (
              <option key={m.code}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={inputClass}
          >
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">
            Search Name/ID
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Enter name or ID..."
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
                        "p-4 text-[10px] font-black uppercase tracking-widest",
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
                    <td key={cell.id} className="p-4">
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
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      icon={<Users size={48} />}
                      title="No users found"
                      description="Try adjusting the filters or add a new user"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredUsers.length > 0 && (
          <div className="p-4 flex items-center justify-between border-t border-charcoal/5">
            <p className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">
              Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
              {" \u2013 "}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) *
                  table.getState().pagination.pageSize,
                filteredUsers.length,
              )}
              {" of "}
              {filteredUsers.length} Users
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

      {/* ======================== */}
      {/*  ADD USER MODAL           */}
      {/* ======================== */}
      <ModalShell
        open={modal.type === "add"}
        onClose={() => {
          setModal({ type: null });
          addForm.reset();
        }}
        title="ADD NEW USER"
        subtitle="Provisioning New System Access"
      >
        <form
          onSubmit={addForm.handleSubmit((data) => createMutation.mutate(data))}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <Field label="Full Name" error={addForm.formState.errors.name?.message}>
            <input
              {...addForm.register("name")}
              className={inputClass}
              placeholder="e.g. Ramesh Kumar"
            />
          </Field>
          <Field label="Login ID (Auto-generated)">
            <input
              className={cn(inputClass, "bg-gray-50 text-gray-400")}
              value="USR-AUTO"
              readOnly
              disabled
            />
          </Field>
          <Field label="User Role" error={addForm.formState.errors.role?.message}>
            <select {...addForm.register("role")} className={inputClass}>
              <option value="">Select Role</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r] ?? r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <div className="flex items-center gap-3 mt-2">
              <span className={cn("text-xs font-bold", !addForm.watch("isActive") && "text-charcoal")}>
                Inactive
              </span>
              <button
                type="button"
                onClick={() => addForm.setValue("isActive", !addForm.watch("isActive"))}
                className={cn(
                  "w-10 h-5 rounded-full relative cursor-pointer transition-colors",
                  addForm.watch("isActive") ? "bg-charcoal" : "bg-gray-300",
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 w-3 h-3 rounded-full transition-all",
                    addForm.watch("isActive") ? "right-1 bg-golden" : "left-1 bg-white",
                  )}
                />
              </button>
              <span className={cn("text-xs font-bold", addForm.watch("isActive") && "text-charcoal")}>
                Active
              </span>
            </div>
          </Field>
          <Field label="Email Address" error={addForm.formState.errors.email?.message}>
            <input
              {...addForm.register("email")}
              className={inputClass}
              placeholder="user@itda.gov.in"
            />
          </Field>
          <Field label="Mobile Number">
            <input
              {...addForm.register("mobile")}
              className={inputClass}
              placeholder="+91 00000 00000"
            />
          </Field>
          <Field label="Assigned Mandal(s)">
            <div className={cn(inputClass, "h-auto space-y-2")}>
              {mandalOptions.length === 0 && (
                <p className="text-xs text-gray-400">Select State & District to load mandals</p>
              )}
              {mandalOptions.map((m) => (
                <label key={m.code} className="flex items-center gap-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={addForm.watch("mandals").includes(m.code)}
                    onChange={(e) => {
                      const cur = addForm.watch("mandals");
                      addForm.setValue(
                        "mandals",
                        e.target.checked ? [...cur, m.code] : cur.filter((v) => v !== m.code),
                      );
                    }}
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Facility / VDVK Multi-Select">
            <div className={cn(inputClass, "h-auto space-y-2")}>
              {facilityOptions.length === 0 && (
                <p className="text-xs text-gray-400">No facilities available</p>
              )}
              {facilityOptions.map((f) => (
                <label key={f.code} className="flex items-center gap-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={addForm.watch("facilities").includes(f.code)}
                    onChange={(e) => {
                      const cur = addForm.watch("facilities");
                      addForm.setValue(
                        "facilities",
                        e.target.checked ? [...cur, f.code] : cur.filter((v) => v !== f.code),
                      );
                    }}
                  />
                  {f.name}
                </label>
              ))}
            </div>
          </Field>
          <div className="md:col-span-2">
            <Field label="Set Initial Password" error={addForm.formState.errors.password?.message}>
              <input
                {...addForm.register("password")}
                type="password"
                className={inputClass}
                placeholder="********"
              />
            </Field>
          </div>
          <div className="md:col-span-2 mt-4 pt-6 border-t border-charcoal/10 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setModal({ type: null });
                addForm.reset();
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
              {createMutation.isPending ? "Creating..." : "Create User Profile"}
            </button>
          </div>
        </form>
      </ModalShell>

      {/* ======================== */}
      {/*  TRANSFER USER MODAL      */}
      {/* ======================== */}
      <SmallModalShell
        open={modal.type === "transfer"}
        onClose={() => {
          setModal({ type: null });
          transferForm.reset();
        }}
        title="TRANSFER USER"
        subtitle="Reassigning Jurisdiction & Facilities"
      >
        <form
          onSubmit={transferForm.handleSubmit((data) => {
            if (modal.user) transferMutation.mutate({ id: modal.user.id, data });
          })}
          className="space-y-6"
        >
          <Field
            label="Destination Mandal"
            error={transferForm.formState.errors.destinationMandal?.message}
          >
            <select {...transferForm.register("destinationMandal")} className={inputClass}>
              <option value="">Select Mandal</option>
              {mandalOptions.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Effective Date"
            error={transferForm.formState.errors.effectiveDate?.message}
          >
            <input {...transferForm.register("effectiveDate")} type="date" className={inputClass} />
          </Field>
          <Field label="Reason for Transfer" error={transferForm.formState.errors.reason?.message}>
            <textarea
              {...transferForm.register("reason")}
              className={cn(inputClass, "h-24 resize-none")}
              placeholder="Administrative requirement / Request / etc."
            />
          </Field>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest">
              Supporting Document
            </label>
            <input type="file" className="text-xs font-bold" />
          </div>
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={transferMutation.isPending}
              className="flex-1 py-3 text-xs font-black uppercase bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50"
            >
              {transferMutation.isPending ? "Initiating..." : "Initiate Transfer"}
            </button>
          </div>
        </form>
      </SmallModalShell>

      {/* ======================== */}
      {/*  RESET PASSWORD MODAL     */}
      {/* ======================== */}
      <SmallModalShell
        open={modal.type === "resetPassword"}
        onClose={() => {
          setModal({ type: null });
          resetPwForm.reset();
        }}
        title="RESET PASSWORD"
        subtitle="Set a new password for the user"
      >
        {modal.user && (
          <div className="mb-6 p-4 bg-gray-50 border border-charcoal/5">
            <p className="text-xs font-bold uppercase">
              {modal.user.name}{" "}
              <span className="text-charcoal/40">({modal.user.userId})</span>
            </p>
          </div>
        )}
        <form
          onSubmit={resetPwForm.handleSubmit((data) => {
            if (modal.user) resetPwMutation.mutate({ id: modal.user.id, data: { newPassword: data.newPassword } });
          })}
          className="space-y-6"
        >
          <Field
            label="New Password"
            error={resetPwForm.formState.errors.newPassword?.message}
          >
            <input
              {...resetPwForm.register("newPassword")}
              type="password"
              className={inputClass}
              placeholder="********"
            />
          </Field>
          <Field
            label="Confirm Password"
            error={resetPwForm.formState.errors.confirmPassword?.message}
          >
            <input
              {...resetPwForm.register("confirmPassword")}
              type="password"
              className={inputClass}
              placeholder="********"
            />
          </Field>
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={resetPwMutation.isPending}
              className="flex-1 py-3 text-xs font-black uppercase bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50"
            >
              {resetPwMutation.isPending ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </form>
      </SmallModalShell>

      {/* ======================== */}
      {/*  HEAD CHANGE MODAL        */}
      {/* ======================== */}
      <SmallModalShell
        open={modal.type === "headChange"}
        onClose={() => {
          setModal({ type: null });
          headChangeForm.reset();
        }}
        title="CHANGE FACILITY HEAD"
        subtitle="VDVK In-charge / Supervisor Transition"
      >
        {modal.user && (
          <div className="mb-6 p-4 bg-gray-50 border border-charcoal/5">
            <label className="text-[10px] font-black uppercase tracking-widest text-charcoal/60">
              Current Head
            </label>
            <input
              className={cn(inputClass, "bg-gray-50 text-gray-400 mt-1")}
              value={`${modal.user.name} (${modal.user.userId})`}
              readOnly
              disabled
            />
          </div>
        )}
        <form
          onSubmit={headChangeForm.handleSubmit((data) => {
            if (modal.user) transferMutation.mutate({ id: modal.user.id, data: data as unknown as TransferForm });
          })}
          className="space-y-6"
        >
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="New Head Name"
              error={headChangeForm.formState.errors.newHeadName?.message}
            >
              <input
                {...headChangeForm.register("newHeadName")}
                className={inputClass}
                placeholder="Full Name"
              />
            </Field>
            <Field
              label="New Head User ID"
              error={headChangeForm.formState.errors.newHeadUserId?.message}
            >
              <input
                {...headChangeForm.register("newHeadUserId")}
                className={inputClass}
                placeholder="USR-XXXX"
              />
            </Field>
          </div>
          <Field
            label="Effective Date"
            error={headChangeForm.formState.errors.effectiveDate?.message}
          >
            <input
              {...headChangeForm.register("effectiveDate")}
              type="date"
              className={inputClass}
            />
          </Field>
          <Field label="Reason for Change" error={headChangeForm.formState.errors.reason?.message}>
            <textarea
              {...headChangeForm.register("reason")}
              className={cn(inputClass, "h-24 resize-none")}
              placeholder="Provide administrative justification..."
            />
          </Field>
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={resetPwMutation.isPending}
              className="flex-1 py-3 text-xs font-black uppercase bg-charcoal text-golden hover:bg-dark-gray transition-colors disabled:opacity-50"
            >
              Confirm Head Change
            </button>
          </div>
        </form>
      </SmallModalShell>

      {/* ======================== */}
      {/*  DEACTIVATE CONFIRMATION  */}
      {/* ======================== */}
      <SmallModalShell
        open={deactivateUser !== null}
        onClose={() => setDeactivateUser(null)}
        title="DEACTIVATE USER"
        subtitle="This action will revoke system access"
      >
        {deactivateUser && (
          <>
            <div className="mb-6 p-4 bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold uppercase text-red-700 mb-1">
                  Are you sure?
                </p>
                <p className="text-xs text-red-600">
                  This will deactivate{" "}
                  <strong>
                    {deactivateUser.name} ({deactivateUser.userId})
                  </strong>
                  . The user will no longer be able to log in.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setDeactivateUser(null)}
                className="flex-1 py-3 text-xs font-black uppercase border-2 border-charcoal hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deactivateMutation.mutate(deactivateUser.id)}
                disabled={deactivateMutation.isPending}
                className="flex-1 py-3 text-xs font-black uppercase bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deactivateMutation.isPending ? "Deactivating..." : "Confirm Deactivation"}
              </button>
            </div>
          </>
        )}
      </SmallModalShell>
    </div>
  );
}

export default UserManagement;
