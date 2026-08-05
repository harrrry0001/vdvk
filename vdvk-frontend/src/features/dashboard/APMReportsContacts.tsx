import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { mdaApi } from "@/api/endpoints/mda";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Contact2,
  MapPin,
  Cog,
  BarChart3,
  Building2,
  Search,
  Phone,
  Mail,
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

interface ReportCard {
  id: string;
  icon: React.ReactNode;
  title: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const REPORTS: ReportCard[] = [
  { id: "MIS-01", icon: <BookOpen className="w-6 h-6" />, title: "All Registers & Books" },
  { id: "MIS-02", icon: <Contact2 className="w-6 h-6" />, title: "Contact Repository" },
  { id: "MIS-03", icon: <MapPin className="w-6 h-6" />, title: "Field Visit Register" },
  { id: "MIS-04", icon: <Cog className="w-6 h-6" />, title: "Machinery Utilisation" },
  { id: "MIS-05", icon: <BarChart3 className="w-6 h-6" />, title: "VDVK Performance" },
  { id: "MIS-06", icon: <Building2 className="w-6 h-6" />, title: "Hub & Facility Performance" },
];

interface QuickDialCard {
  label: string;
  name: string;
  phone: string;
  mail: string;
  variant: "gold" | "white" | "charcoal";
}

const QUICK_DIAL: QuickDialCard[] = [
  {
    label: "DPM Office",
    name: "DPM Vishakha Agency",
    phone: "+919848022331",
    mail: "dpm.paderu@itda.ap.gov.in",
    variant: "gold",
  },
  {
    label: "MIS Support",
    name: "District MIS Officer",
    phone: "+919440112233",
    mail: "mis.itdapaderu@gmail.com",
    variant: "white",
  },
  {
    label: "Local Admin",
    name: "MDO Paderu",
    phone: "+918912233445",
    mail: "mdo.paderu@ap.gov.in",
    variant: "white",
  },
  {
    label: "Reporting Authority",
    name: "APM Rama Rao",
    phone: "+919844556677",
    mail: "apm.paderu@vdvk.com",
    variant: "charcoal",
  },
];

function formatMobile(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 12) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0]?.[0] ?? "").toUpperCase();
}

function getDesignationPillClass(designation: string): string {
  const upper = (designation ?? "").toUpperCase();
  if (upper === "DPM") return "bg-[#ffe17c] text-[#171e19]";
  return "text-black/40";
}

/* ------------------------------------------------------------------ */
/*  QuickDialCard Component                                            */
/* ------------------------------------------------------------------ */

function QuickDialCardItem({ item }: { item: QuickDialCard }) {
  const isGold = item.variant === "gold";
  const isCharcoal = item.variant === "charcoal";
  const isWhite = item.variant === "white";

  return (
    <div
      className={cn(
        "p-4 border border-[#171e19]/10",
        isGold && "bg-[#ffe17c]",
        isCharcoal && "bg-[#171e19] text-white",
        isWhite && "bg-white shadow-sm",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-black uppercase tracking-widest",
          isGold && "text-[#171e19]/60",
          isCharcoal && "text-white/40",
          isWhite && "text-[#171e19]/60",
        )}
      >
        {item.label}
      </p>
      <h4 className="font-bold text-sm mb-3">{item.name}</h4>
      <div className="flex gap-2">
        <a
          href={`tel:${item.phone}`}
          className={cn(
            "flex-1 py-2 flex items-center justify-center rounded hover:opacity-80 transition-colors",
            isCharcoal && "bg-[#ffe17c] text-[#171e19] hover:bg-white",
            isGold && "bg-[#171e19] text-white hover:bg-black",
            isWhite && "border border-black/10 hover:bg-gray-50",
          )}
        >
          <Phone className="w-3 h-3" />
        </a>
        <a
          href={`mailto:${item.mail}`}
          className={cn(
            "flex-1 py-2 flex items-center justify-center rounded hover:opacity-80 transition-colors",
            isCharcoal && "bg-white/10 text-white hover:bg-white/20",
            isGold && "bg-[#171e19] text-white hover:bg-black",
            isWhite && "border border-black/10 hover:bg-gray-50",
          )}
        >
          <Mail className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reports View                                                       */
/* ------------------------------------------------------------------ */

function ReportsView({ search, setSearch }: { search: string; setSearch: (v: string) => void }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="heading-anton text-4xl tracking-tight text-[#171e19]">
            Knowledge Repository
          </h1>
          <p className="text-[#171e19]/50 text-sm font-medium uppercase tracking-widest mt-1">
            Standardized Reporting • Analytics Export
          </p>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search reports..."
            className="bg-white border border-black/10 px-4 pr-10 py-2 text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-[#171e19] w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search className="absolute right-3 top-2.5 text-black/40 w-4 h-4" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {REPORTS.filter(
          (r) =>
            !search ||
            r.title.toLowerCase().includes(search.toLowerCase()) ||
            r.id.toLowerCase().includes(search.toLowerCase()),
        ).map((report) => (
          <div
            key={report.id}
            className="bg-white border border-[#171e19]/5 p-6 flex flex-col card-lift"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-gray-50 flex items-center justify-center border border-black/5">
                {report.icon}
              </div>
              <span className="text-[10px] font-black uppercase text-black/20 tracking-widest">
                {report.id}
              </span>
            </div>
            <h3 className="heading-anton text-sm tracking-widest mb-8 text-[#171e19]">
              {report.title}
            </h3>
            <div className="mt-auto flex gap-2">
              <button className="flex-1 py-2 bg-[#171e19] text-white text-[10px] text-center font-black uppercase tracking-widest hover:bg-[#272727] transition-colors">
                View
              </button>
              <button className="px-3 py-2 border border-black/10 hover:bg-gray-50 text-[10px] font-bold uppercase tracking-tighter">
                PDF
              </button>
              <button className="px-3 py-2 border border-black/10 hover:bg-gray-50 text-[10px] font-bold uppercase tracking-tighter">
                XLS
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Contacts View                                                      */
/* ------------------------------------------------------------------ */

function ContactsView({
  designationFilter,
  setDesignationFilter,
  searchQuery,
  setSearchQuery,
  users,
}: {
  designationFilter: string;
  setDesignationFilter: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  users: MdaUser[];
}) {
  const designationOptions = useMemo(() => {
    const deduped = new Set(users.map((u) => u.designation).filter(Boolean));
    return Array.from(deduped).sort();
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (designationFilter && u.designation !== designationFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          (u.mobile ?? "").includes(q) ||
          (u.designation ?? "").toLowerCase().includes(q) ||
          (u.mandal ?? "").toLowerCase().includes(q) ||
          (u.assignedArea ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, designationFilter, searchQuery]);

  const mandals = useMemo(() => {
    const m = new Set(filtered.map((u) => u.mandal).filter(Boolean));
    return Array.from(m).join(", ") || "—";
  }, [filtered]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="heading-anton text-4xl tracking-tight text-[#171e19]">
            Field Network
          </h1>
          <p className="text-[#171e19]/50 text-sm font-medium uppercase tracking-widest mt-1">
            Assigned Mandal Contacts • ITDA Paderu
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={designationFilter}
            onChange={(e) => setDesignationFilter(e.target.value)}
            className="bg-white border border-black/10 px-4 py-2 text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-[#171e19] cursor-pointer"
          >
            <option value="">Filter Designation</option>
            {designationOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <div className="relative">
            <input
              type="text"
              placeholder="Search contacts..."
              className="bg-white border border-black/10 px-4 pr-10 py-2 text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-[#171e19] w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute right-3 top-2.5 text-black/40 w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_DIAL.map((qd) => (
          <QuickDialCardItem key={qd.label} item={qd} />
        ))}
      </div>

      <div className="bg-white border border-[#171e19]/5 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-[#171e19]/40 border-b border-[#171e19]/5">
                Name
              </th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-[#171e19]/40 border-b border-[#171e19]/5">
                Designation
              </th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-[#171e19]/40 border-b border-[#171e19]/5">
                Mobile
              </th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-[#171e19]/40 border-b border-[#171e19]/5">
                Mandal
              </th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-[#171e19]/40 border-b border-[#171e19]/5">
                VDVK/Facility
              </th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-[#171e19]/40 border-b border-[#171e19]/5">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#171e19]/5">
            {filtered.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-gray-50 transition-colors group"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center font-black text-[10px]">
                      {getInitials(user.name)}
                    </div>
                    <span className="font-bold text-sm">{user.name}</span>
                  </div>
                </td>
                <td className="p-4">
                  <span
                    className={cn(
                      "text-[10px] font-black uppercase px-2 py-0.5",
                      getDesignationPillClass(user.designation),
                      user.designation?.toUpperCase() === "DPM" && "bg-[#ffe17c]",
                    )}
                  >
                    {user.designation}
                  </span>
                </td>
                <td className="p-4 text-xs font-medium text-blue-600 data-font">
                  {user.mobile ? formatMobile(user.mobile) : "—"}
                </td>
                <td className="p-4 text-xs font-medium">
                  {user.mandal || "—"}
                </td>
                <td className="p-4 text-xs text-black/50">
                  {user.assignedArea || "—"}
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    {user.mobile && (
                      <a
                        href={`tel:${user.mobile}`}
                        className="p-2 bg-[#171e19] text-white hover:bg-black transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                      </a>
                    )}
                    <button className="px-3 py-2 border border-black/10 text-[8px] font-black uppercase tracking-widest hover:bg-gray-100">
                      Details
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-sm text-black/30 font-medium uppercase tracking-widest">
                  No contacts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center mt-10">
        <p className="text-[10px] text-black/30 font-bold uppercase tracking-widest">
          Showing verified field network for Mandal: {mandals} • ₹ 0 Total
          outstanding allowances
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  APMReportsContacts Page                                            */
/* ------------------------------------------------------------------ */

type Tab = "reports" | "contacts";

export function APMReportsContacts() {
  const [activeTab, setActiveTab] = useState<Tab>("reports");
  const [reportSearch, setReportSearch] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [contactSearch, setContactSearch] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["mda", "users"],
    queryFn: () => mdaApi.getUsers().then((r) => (r.data ?? []) as MdaUser[]),
  });

  const userList = useMemo(() => (Array.isArray(users) ? users : []), [users]);

  if (activeTab === "contacts" && isLoading) return <PageLoading />;

  return (
    <div className="space-y-8">
      <div className="flex gap-8 items-end">
        <button
          onClick={() => setActiveTab("reports")}
          className={cn(
            "text-xs font-black uppercase tracking-[0.2em] py-2 border-b-4 transition-all",
            activeTab === "reports"
              ? "border-[#ffe17c] text-[#ffe17c]"
              : "border-transparent text-black/30 hover:text-black/60",
          )}
        >
          REPORTS
        </button>
        <button
          onClick={() => setActiveTab("contacts")}
          className={cn(
            "text-xs font-black uppercase tracking-[0.2em] py-2 border-b-4 transition-all",
            activeTab === "contacts"
              ? "border-[#ffe17c] text-[#ffe17c]"
              : "border-transparent text-black/30 hover:text-black/60",
          )}
        >
          CONTACTS
        </button>
      </div>

      {activeTab === "reports" ? (
        <ReportsView search={reportSearch} setSearch={setReportSearch} />
      ) : (
        <ContactsView
          designationFilter={designationFilter}
          setDesignationFilter={setDesignationFilter}
          searchQuery={contactSearch}
          setSearchQuery={setContactSearch}
          users={userList}
        />
      )}
    </div>
  );
}
