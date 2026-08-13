import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarStore } from "@/stores/sidebarStore";
import {
  LayoutDashboard, LayoutTemplate, ClipboardSignature, Factory, UserCheck,
  IndianRupee, Wrench, Cog, Building2, Building, ClipboardList, GraduationCap,
  Tags, MapPin, BookOpen, FileText, Users, DatabaseBackup, LogOut,
  Phone, FilePlus, PanelLeftClose, PanelLeftOpen,
  ShoppingCart, Banknote, Truck, Leaf, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

// PO/APD/DPM — Management overview
const managementNav: NavItem[] = [
  { label: "District Overview", path: "/dashboard", icon: <LayoutDashboard size={20} /> },
  { label: "VDVK Performance", path: "/dashboard/vdvk-performance", icon: <Factory size={20} /> },
  { label: "Fund Monitoring", path: "/dashboard/fund-monitoring", icon: <IndianRupee size={20} /> },
  { label: "Assets & Machinery", path: "/dashboard/machinery", icon: <Wrench size={20} /> },
  { label: "Hub & Facility Perf.", path: "/dashboard/hub-performance", icon: <Building2 size={20} /> },
  { label: "Request Tracking", path: "/requests", icon: <ClipboardList size={20} /> },
  { label: "Training", path: "/dashboard/training", icon: <GraduationCap size={20} /> },
  { label: "Field Visits", path: "/dashboard/field-visits", icon: <MapPin size={20} /> },
  { label: "Reports & Registers", path: "/reports", icon: <BookOpen size={20} /> },
  { label: "Contact Directory", path: "/contacts", icon: <Phone size={20} /> },
];

// MDA/Admin — Master data CRUD
const mdaNav: NavItem[] = [
  { label: "Admin Dashboard", path: "/mda", icon: <LayoutTemplate size={20} /> },
  { label: "VDVK Registration", path: "/mda/vdvks", icon: <Building size={20} /> },
  { label: "Beneficiary Mgmt", path: "/mda/beneficiaries", icon: <UserCheck size={20} /> },
  { label: "Machinery Mgmt", path: "/mda/machinery", icon: <Cog size={20} /> },
  { label: "Facility Mgmt", path: "/mda/facilities", icon: <Factory size={20} /> },
  { label: "Commodity & Rate", path: "/mda/commodities", icon: <Tags size={20} /> },
  { label: "Grade/Exp/Customer", path: "/mda/grades", icon: <ClipboardList size={20} /> },
  { label: "Scheme Mgmt", path: "/mda/schemes", icon: <LayoutTemplate size={20} /> },
  { label: "Rates Mgmt", path: "/mda/rates", icon: <IndianRupee size={20} /> },
  { label: "User Management", path: "/mda/users", icon: <Users size={20} /> },
  { label: "Data Correction", path: "/mda/data-correction", icon: <DatabaseBackup size={20} /> },
];

// APM — Mandal operations
const apmNav: NavItem[] = [
  { label: "Mandal Overview", path: "/dashboard", icon: <LayoutDashboard size={20} /> },
  { label: "Form Creation", path: "/forms/create", icon: <FilePlus size={20} /> },
  { label: "Request Tracking", path: "/requests", icon: <ClipboardList size={20} /> },
  { label: "VDVK Performance", path: "/dashboard/vdvk-performance", icon: <Factory size={20} /> },
  { label: "Facility Perf.", path: "/dashboard/hub-performance", icon: <Building2 size={20} /> },
  { label: "Assets & Machinery", path: "/dashboard/machinery", icon: <Wrench size={20} /> },
  { label: "Field Visits", path: "/dashboard/field-visits", icon: <MapPin size={20} /> },
  { label: "Training", path: "/dashboard/training", icon: <GraduationCap size={20} /> },
  { label: "Reports & Contacts", path: "/reports/apm", icon: <FileText size={20} /> },
  { label: "Contact Directory", path: "/contacts", icon: <Phone size={20} /> },
];

// Field users — Forms + basic views
// Field users — Role-specific forms
const ccNav: NavItem[] = [
  { label: "MFP Collection", path: "/forms/form1", icon: <Leaf size={20} /> },
  { label: "My Requests", path: "/requests", icon: <ClipboardList size={20} /> },
  { label: "District View", path: "/dashboard", icon: <LayoutDashboard size={20} /> },
  { label: "Reports", path: "/reports", icon: <BookOpen size={20} /> },
  { label: "Switch Role", path: "/role-selection", icon: <RefreshCw size={20} /> },
];

const supervisorNav: NavItem[] = [
  { label: "Stock Transfer", path: "/forms/form2", icon: <Truck size={20} /> },
  { label: "Processing", path: "/forms/form3", icon: <Factory size={20} /> },
  { label: "Machinery Use", path: "/forms/form8", icon: <Cog size={20} /> },
  { label: "Request Tracking", path: "/requests", icon: <ClipboardList size={20} /> },
  { label: "District View", path: "/dashboard", icon: <LayoutDashboard size={20} /> },
  { label: "Reports", path: "/reports", icon: <BookOpen size={20} /> },
  { label: "Switch Role", path: "/role-selection", icon: <RefreshCw size={20} /> },
];

const fieldNav: NavItem[] = [
  { label: "Forms Hub", path: "/forms", icon: <ClipboardList size={20} /> },
  { label: "MFP Collection", path: "/forms/form1", icon: <Leaf size={20} /> },
  { label: "Stock Transfer", path: "/forms/form2", icon: <Truck size={20} /> },
  { label: "Processing", path: "/forms/form3", icon: <Factory size={20} /> },
  { label: "Sales Entry", path: "/forms/form4", icon: <ShoppingCart size={20} /> },
  { label: "Machinery Use", path: "/forms/form8", icon: <Cog size={20} /> },
  { label: "Fund Use", path: "/forms/form10", icon: <Banknote size={20} /> },
  { label: "Field Visit", path: "/forms/form12", icon: <MapPin size={20} /> },
  { label: "Request Tracking", path: "/requests", icon: <ClipboardList size={20} /> },
  { label: "District View", path: "/dashboard", icon: <LayoutDashboard size={20} /> },
  { label: "Reports Hub", path: "/reports", icon: <BookOpen size={20} /> },
  { label: "Switch Role", path: "/role-selection", icon: <RefreshCw size={20} /> },
];

export function Sidebar() {
  const { hasRole, isManagement, isAdmin, isMDA, isAPM, isFieldUser, logout } = useAuth();
  const navigate = useNavigate();
  const { isCollapsed, toggle } = useSidebarStore();

  let navItems: NavItem[];
  let branding: string;

  if (isManagement) {
    navItems = isAdmin || isMDA
      ? [...managementNav, ...mdaNav]
      : managementNav;
    branding = "ITDA PADERU";
  } else if (isAdmin || isMDA) {
    navItems = mdaNav;
    branding = "ADMIN";
  } else if (isAPM) {
    navItems = apmNav;
    branding = "ITDA PADERU";
  } else if (hasRole("CC")) {
    navItems = ccNav;
    branding = "CC PORTAL";
  } else if (hasRole("Hub Supervisor", "MPC Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor")) {
    navItems = supervisorNav;
    branding = "SUPERVISOR";
  } else {
    navItems = fieldNav;
    branding = "FIELD PORTAL";
  }

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside
      id="sidebar-nav"
      style={{ viewTransitionName: "sidebar" }}
      className={cn(
        "fixed inset-y-0 left-0 bg-charcoal text-white flex flex-col z-50 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Branding */}
      <div className={cn(
        "flex items-center border-b border-white/5",
        isCollapsed ? "justify-center p-3" : "gap-3 p-6"
      )}>
        <img
          src="/logo.svg"
          alt="PMVDY Logo"
          className="shrink-0"
          style={{
            width: isCollapsed ? "48px" : "64px",
            height: isCollapsed ? "48px" : "64px",
            filter: "drop-shadow(0 2px 8px rgba(255,225,124,0.15))",
            transition: "all 0.3s ease-in-out",
          }}
        />
        {!isCollapsed && (
          <span className="font-display text-xl tracking-wider text-golden truncate">{branding}</span>
        )}
      </div>

      {/* Navigation */}
      <div className="overflow-y-auto custom-scrollbar flex-1 py-3 px-3">
        {!isCollapsed && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 px-3 mb-2">
            Navigation
          </p>
        )}
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={`${item.path}-${item.label}`}
              to={item.path}
              end={item.path === "/dashboard" || item.path === "/forms" || item.path === "/mda" || item.path === "/reports"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-4 rounded-lg transition-all",
                  isCollapsed ? "px-2 py-3 justify-center" : "px-4 py-3",
                  isActive
                    ? "bg-golden text-charcoal font-bold"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )
              }
              title={isCollapsed ? item.label : undefined}
            >
              <span className="text-xl shrink-0">{item.icon}</span>
              {!isCollapsed && (
                <span className="uppercase text-[10px] tracking-[0.16em] truncate">{item.label}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Logout + Collapse */}
      <div className={cn(
        "border-t border-white/5",
        isCollapsed ? "p-3 space-y-1" : "p-6 space-y-1"
      )}>
        <button
          onClick={toggle}
          className={cn(
            "flex items-center gap-4 text-white/40 hover:text-golden transition-all w-full",
            isCollapsed ? "justify-center p-2" : "px-4 py-3"
          )}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-4 text-white/40 hover:text-red-400 transition-all w-full",
            isCollapsed ? "justify-center p-2" : "px-4 py-3"
          )}
          title="Logout"
        >
          <LogOut size={20} />
          {!isCollapsed && (
            <span className="uppercase text-xs tracking-[0.2em]">Logout</span>
          )}
        </button>
      </div>
    </aside>
  );
}
