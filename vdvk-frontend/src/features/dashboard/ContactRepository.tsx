import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { mdaApi } from "@/api/endpoints/mda";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/types";
import {
  Download,
  FileText,
  Filter,
  ShieldAlert,
  Phone,
  MoreVertical,
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  UserX,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-charcoal text-golden",
  "bg-sage text-charcoal",
  "bg-golden text-charcoal",
  "bg-charcoal/10 text-charcoal",
  "bg-charcoal/5 text-charcoal",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ------------------------------------------------------------------ */
/*  Field Staff / District Staff designation sets                      */
/* ------------------------------------------------------------------ */

const FIELD_STAFF_DESIGNATIONS = [
  "APM",
  "Assistant Project Manager",
  "Hub Supervisor",
  "MPC Supervisor",
  "Community Coordinator",
  "Field Coordinator",
  "Extension Officer",
];

const DISTRICT_STAFF_DESIGNATIONS = [
  "PO",
  "Project Officer",
  "APD",
  "Assistant Project Director",
  "DPM",
  "District Project Manager",
];

const VDVK_HEAD_DESIGNATIONS = [
  "VDVK Head",
  "Vdvk Head",
  "VDVK President",
  "Vdvk President",
];

/* ------------------------------------------------------------------ */
/*  Designation set for the filter dropdown                            */
/* ------------------------------------------------------------------ */

const DESIGNATION_OPTIONS = [
  "Project Officer",
  "APD",
  "DPM",
  "APM",
  "Hub Supervisor",
  "MPC Supervisor",
  "VDVK Head",
  "Community Coordinator",
  "Field Coordinator",
  "Extension Officer",
];

const FACILITY_TYPES = ["Hub", "MPC", "Haat Bazaar"];

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 20;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ContactRepository() {
  const [nameSearch, setNameSearch] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [mandalFilter, setMandalFilter] = useState("");
  const [facilityFilter, setFacilityFilter] = useState("");
  const [page, setPage] = useState(0);

  const { data: users, isLoading, isError, error } = useQuery({
    queryKey: ["mda", "users"],
    queryFn: () =>
      mdaApi.getUsers().then((r) => (Array.isArray(r.data) ? (r.data as UserProfile[]) : [])),
  });

  const userList = users ?? [];

  /* ---- computed KPIs ---- */
  const kpiTotal = userList.length;
  const kpiFieldStaff = userList.filter((u) => {
    const d = u.designation?.trim() ?? "";
    return FIELD_STAFF_DESIGNATIONS.some(
      (fd) => d.toLowerCase() === fd.toLowerCase()
    );
  }).length;
  const kpiVdvkHeads = userList.filter((u) => {
    const d = u.designation?.trim() ?? "";
    return VDVK_HEAD_DESIGNATIONS.some(
      (vh) => d.toLowerCase() === vh.toLowerCase()
    );
  }).length;
  const kpiDistrictStaff = userList.filter((u) => {
    const d = u.designation?.trim() ?? "";
    return DISTRICT_STAFF_DESIGNATIONS.some(
      (ds) => d.toLowerCase() === ds.toLowerCase()
    );
  }).length;

  /* ---- unique mandals from data ---- */
  const mandalsFromData = useMemo(() => {
    const set = new Set<string>();
    userList.forEach((u) => {
      if (u.mandal?.trim()) set.add(u.mandal.trim());
    });
    return Array.from(set).sort();
  }, [userList]);

  /* ---- filter + paginate ---- */
  const filtered = useMemo(() => {
    let result = userList;

    if (nameSearch.trim()) {
      const q = nameSearch.toLowerCase();
      result = result.filter((u) => u.name?.toLowerCase().includes(q));
    }
    if (designationFilter) {
      result = result.filter(
        (u) => (u.designation?.trim() ?? "").toLowerCase() === designationFilter.toLowerCase()
      );
    }
    if (mandalFilter) {
      result = result.filter(
        (u) => (u.mandal?.trim() ?? "").toLowerCase() === mandalFilter.toLowerCase()
      );
    }
    if (facilityFilter) {
      result = result.filter(
        (u) =>
          (u.designation?.trim() ?? "").toLowerCase().includes(facilityFilter.toLowerCase()) ||
          (u.mandal?.trim() ?? "").toLowerCase().includes(facilityFilter.toLowerCase())
      );
    }

    return result;
  }, [userList, nameSearch, designationFilter, mandalFilter, facilityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  /* ---- reset handlers ---- */
  function applyFilters() {
    setPage(0);
  }

  function clearFilters() {
    setNameSearch("");
    setDesignationFilter("");
    setMandalFilter("");
    setFacilityFilter("");
    setPage(0);
  }

  const hasActiveFilters =
    nameSearch.trim() !== "" ||
    designationFilter !== "" ||
    mandalFilter !== "" ||
    facilityFilter !== "";

  /* ---- export stubs ---- */
  function handleExportExcel() {}
  function handleExportPdf() {}

  /* ---- render helpers ---- */
  if (isLoading) return <PageLoading />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <UserX className="w-12 h-12 text-charcoal/20" />
        <p className="text-sm text-charcoal/40 uppercase tracking-widest font-bold">
          Failed to load contacts
        </p>
        <p className="text-xs text-gray-400">
          {(error as Error)?.message ?? "An unexpected error occurred"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 custom-scrollbar">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-5xl tracking-tight text-charcoal">
            Contact Repository
          </h1>
          <p className="text-charcoal/40 text-sm font-medium uppercase tracking-[0.2em] mt-2">
            Van Dhan Programme &mdash; Stakeholder Directory
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportExcel}
            className="px-6 py-3 bg-white border border-charcoal/10 text-charcoal text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Excel
          </button>
          <button
            onClick={handleExportPdf}
            className="px-6 py-3 bg-white border border-charcoal/10 text-charcoal text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* ---------- KPI Cards ---------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#f8f9fa] p-6 border-l-4 border-charcoal transition-transform duration-300 hover:-translate-y-1">
          <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-widest mb-1">
            Total Contacts
          </p>
          <h3 className="font-display text-4xl text-charcoal">{kpiTotal.toLocaleString()}</h3>
        </div>
        <div className="bg-[#f8f9fa] p-6 border-l-4 border-sage transition-transform duration-300 hover:-translate-y-1">
          <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-widest mb-1">
            Field Staff
          </p>
          <h3 className="font-display text-4xl text-charcoal">{kpiFieldStaff.toLocaleString()}</h3>
        </div>
        <div className="bg-[#f8f9fa] p-6 border-l-4 border-charcoal transition-transform duration-300 hover:-translate-y-1">
          <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-widest mb-1">
            VDVK Heads
          </p>
          <h3 className="font-display text-4xl text-charcoal">{kpiVdvkHeads.toLocaleString()}</h3>
        </div>
        <div className="bg-[#f8f9fa] p-6 border-l-4 border-charcoal/10 transition-transform duration-300 hover:-translate-y-1">
          <p className="text-[10px] font-black text-charcoal/40 uppercase tracking-widest mb-1">
            District Staff
          </p>
          <h3 className="font-display text-4xl text-charcoal">
            {kpiDistrictStaff.toLocaleString()}
          </h3>
        </div>
      </div>

      {/* ---------- Filters ---------- */}
      <div className="bg-[#f8f9fa] p-8 border border-charcoal/5 rounded-2xl">
        <div className="flex items-center gap-2 mb-6">
          <Filter className="w-4 h-4 text-charcoal" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-charcoal/60">
            Advanced Filters
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-[9px] font-bold text-charcoal/30 uppercase mb-2">
              Name Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-charcoal/30" />
              <input
                type="text"
                placeholder="Search stakeholders..."
                value={nameSearch}
                onChange={(e) => {
                  setNameSearch(e.target.value);
                  setPage(0);
                }}
                className="w-full bg-white border border-charcoal/10 pl-9 pr-4 py-2.5 text-xs text-charcoal focus:outline-none focus:border-charcoal rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-charcoal/30 uppercase mb-2">
              Designation
            </label>
            <select
              value={designationFilter}
              onChange={(e) => {
                setDesignationFilter(e.target.value);
                setPage(0);
              }}
              className="w-full bg-white border border-charcoal/10 px-4 py-2.5 text-xs text-charcoal focus:outline-none focus:border-charcoal appearance-none rounded-lg"
            >
              <option value="">All Designations</option>
              {DESIGNATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-charcoal/30 uppercase mb-2">
              Mandal
            </label>
            <select
              value={mandalFilter}
              onChange={(e) => {
                setMandalFilter(e.target.value);
                setPage(0);
              }}
              className="w-full bg-white border border-charcoal/10 px-4 py-2.5 text-xs text-charcoal focus:outline-none focus:border-charcoal appearance-none rounded-lg"
            >
              <option value="">All Mandals</option>
              {mandalsFromData.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-charcoal/30 uppercase mb-2">
              Facility Type
            </label>
            <select
              value={facilityFilter}
              onChange={(e) => {
                setFacilityFilter(e.target.value);
                setPage(0);
              }}
              className="w-full bg-white border border-charcoal/10 px-4 py-2.5 text-xs text-charcoal focus:outline-none focus:border-charcoal appearance-none rounded-lg"
            >
              <option value="">All Facilities</option>
              {FACILITY_TYPES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={applyFilters}
              className="flex-1 bg-charcoal text-golden py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors rounded-lg"
            >
              Apply Filters
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2.5 bg-white border border-charcoal/10 text-charcoal/40 hover:text-charcoal transition-colors rounded-lg"
              >
                <UserX className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Role visibility notice */}
        <div className="mt-4 p-4 bg-charcoal/5 border-l-4 border-golden flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-charcoal shrink-0" />
          <p className="text-[10px] font-bold text-charcoal uppercase tracking-wider">
            Role Visibility Status: PO &amp; DPM contact details are visible to District staff only;
            APM and field users see only their assigned jurisdiction contacts.
          </p>
        </div>
      </div>

      {/* ---------- Directory Table ---------- */}
      <div className="bg-white border-2 border-charcoal/5 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-charcoal/5 flex justify-between items-center bg-[#f8f9fa]">
          <h4 className="font-display text-xl tracking-wide text-charcoal">
            Contact Directory
          </h4>
          <span className="text-[10px] font-black text-charcoal uppercase bg-golden px-3 py-1">
            Showing {filtered.length.toLocaleString()} Records
          </span>
        </div>

        {paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Users className="w-10 h-10 text-charcoal/10" />
            <p className="text-sm font-bold text-charcoal/30 uppercase tracking-widest">
              No contacts found
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-golden-600 hover:text-golden font-semibold underline transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-charcoal/40 border-b border-charcoal/5">
                      Full Name
                    </th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-charcoal/40 border-b border-charcoal/5">
                      Designation
                    </th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-charcoal/40 border-b border-charcoal/5">
                      Mandal / Facility
                    </th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-charcoal/40 border-b border-charcoal/5">
                      Mobile Number
                    </th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-charcoal/40 border-b border-charcoal/5">
                      Email ID
                    </th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-charcoal/40 border-b border-charcoal/5 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/5">
                  {paged.map((user) => {
                    const initials = getInitials(user.name ?? "");
                    const avatarColor = getAvatarColor(user.name ?? "");
                    const designation = (user.designation ?? "").trim();
                    const mandal = (user.mandal ?? "").trim();
                    const mobile = (user.mobile ?? "").trim();
                    const email = (user.email ?? "").trim();

                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-gray-50 transition-colors group"
                      >
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-8 h-8 rounded flex items-center justify-center font-black text-xs shrink-0",
                                avatarColor
                              )}
                            >
                              {initials}
                            </div>
                            <span className="font-bold text-sm tracking-wide text-charcoal whitespace-nowrap">
                              {user.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-6">
                          {designation ? (
                            <span className="px-2 py-1 bg-charcoal/5 border border-charcoal/10 text-[9px] font-black uppercase tracking-widest text-charcoal whitespace-nowrap">
                              {designation}
                            </span>
                          ) : (
                            <span className="text-xs text-charcoal/30">&mdash;</span>
                          )}
                        </td>
                        <td className="p-6">
                          <div className="text-xs font-medium text-charcoal">
                            {mandal || <span className="text-charcoal/30">&mdash;</span>}
                          </div>
                          {designation && (
                            <div className="text-[10px] text-charcoal/40 uppercase mt-1">
                              {designation.includes("Hub")
                                ? "Facility"
                                : designation.includes("MPC")
                                  ? "Facility"
                                  : "Management Unit"}
                            </div>
                          )}
                        </td>
                        <td className="p-6 font-mono text-xs text-charcoal whitespace-nowrap">
                          {mobile ? (
                            <a
                              href={`tel:${mobile}`}
                              className="hover:text-golden-600 transition-colors"
                            >
                              {mobile}
                            </a>
                          ) : (
                            <span className="text-charcoal/30">&mdash;</span>
                          )}
                        </td>
                        <td className="p-6 text-xs text-charcoal/60 underline decoration-charcoal/20 whitespace-nowrap">
                          {email || <span className="text-charcoal/30 no-underline">&mdash;</span>}
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {mobile && (
                              <a
                                href={`tel:${mobile}`}
                                className="w-9 h-9 flex items-center justify-center bg-charcoal text-golden rounded-lg hover:bg-black transition-colors"
                                title="Call"
                              >
                                <Phone className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              className="w-9 h-9 flex items-center justify-center border border-charcoal/10 text-charcoal rounded-lg hover:bg-gray-50 transition-colors"
                              title="More actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-6 flex justify-between items-center bg-gray-50">
              <div className="text-[10px] font-bold text-charcoal/20 uppercase tracking-[0.2em]">
                Page {safePage + 1} of {totalPages}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="w-8 h-8 flex items-center justify-center border border-charcoal/10 text-charcoal/40 disabled:opacity-30 rounded hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i;
                  } else if (safePage < 3) {
                    pageNum = i;
                  } else if (safePage > totalPages - 4) {
                    pageNum = totalPages - 5 + i;
                  } else {
                    pageNum = safePage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center border border-charcoal/10 text-charcoal/40 text-xs font-bold rounded transition-colors",
                        pageNum === safePage &&
                          "bg-charcoal text-golden font-black border-charcoal"
                      )}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
                {totalPages > 5 && safePage < totalPages - 3 && (
                  <span className="w-8 h-8 flex items-center justify-center text-charcoal/20 text-xs">
                    ...
                  </span>
                )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  className="w-8 h-8 flex items-center justify-center border border-charcoal/10 text-charcoal/40 disabled:opacity-30 rounded hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ContactRepository;
