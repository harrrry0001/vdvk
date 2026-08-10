import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
import {
  User,
  Users,
  Building2,
  ClipboardList,
  Shield,
  ArrowRight,
  LogOut,
} from "lucide-react";
import { ROLES } from "@/lib/constants";

interface RoleCard {
  label: string;
  description: string;
  icon: React.ReactNode;
  role: string;
  path: string;
}

const fieldUserCards: RoleCard[] = [
  {
    label: "Collector / CC",
    description: "MFP Collection & Request Tracking",
    icon: <ClipboardList className="w-6 h-6" />,
    role: ROLES.CC,
    path: "/forms/form1",
  },
  {
    label: "Field Coordinator",
    description: "Supervisor Forms Hub",
    icon: <Users className="w-6 h-6" />,
    role: ROLES.HUB_SUPERVISOR,
    path: "/forms",
  },
  {
    label: "VDVK Head",
    description: "VDVK Performance Dashboard",
    icon: <Building2 className="w-6 h-6" />,
    role: ROLES.VDVK_HEAD,
    path: "/dashboard/vdvk-performance",
  },
  {
    label: "Haat Bazaar Supervisor",
    description: "Supervisor Forms Hub",
    icon: <Shield className="w-6 h-6" />,
    role: ROLES.HAAT_SUPERVISOR,
    path: "/forms",
  },
  {
    label: "VDVK Facility Supervisor",
    description: "Supervisor Forms Hub",
    icon: <Building2 className="w-6 h-6" />,
    role: ROLES.VDVK_FACILITY_SUPERVISOR,
    path: "/forms",
  },
];

export function RoleSelectionPage() {
  const navigate = useNavigate();
  const { user, hasRole, isManagement, isAdmin, isMDA, isAPM, isFieldUser, logout } = useAuth();
  const setActiveRole = useAuthStore((s) => s.setActiveRole);

  const handleRoleSelect = (card: RoleCard) => {
    setActiveRole(card.role);
    navigate(card.path);
  };

  const handleDashboard = () => {
    if (isManagement) {
      setActiveRole(user?.roles?.[0] ?? ROLES.PO);
    } else if (isAdmin) {
      setActiveRole(ROLES.MDA);
    } else if (isAPM) {
      setActiveRole(ROLES.APM);
    } else if (isMDA) {
      setActiveRole(ROLES.MDA);
    }
    navigate("/dashboard");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const showDashboard = isManagement || isAdmin || isMDA || isAPM;

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-3">
            VDVK MIS
          </p>
          <h1 className="text-2xl font-display text-charcoal">Select Your Role</h1>
          <p className="text-sm text-gray-500 mt-2">
            Welcome back, <span className="font-semibold text-charcoal">{user?.name}</span>.{" "}
            Choose a role context to continue.
          </p>
        </div>

        {/* Dashboard / Management roles */}
        {showDashboard && (
          <div className="mb-6">
            <p className="section-title">Management Roles</p>
            <button
              onClick={handleDashboard}
              className="w-full flex items-center justify-between bg-charcoal text-golden p-5 rounded-xl
                         hover:bg-charcoal-800 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-golden/10 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">
                    {isManagement ? "District Dashboard" : isAdmin ? "Admin Dashboard" : isAPM ? "APM Dashboard" : "Dashboard"}
                  </p>
                  <p className="text-xs text-golden/60 mt-0.5">Full management access</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* Field user roles */}
        {isFieldUser && (
          <div>
            <p className="section-title">Field User Roles</p>
            <div className="space-y-3">
              {fieldUserCards
                .filter((card) => hasRole(card.role))
                .map((card) => (
                  <button
                    key={card.role}
                    onClick={() => handleRoleSelect(card)}
                    className="w-full flex items-center justify-between bg-white border border-gray-200 p-4 rounded-xl
                               hover:border-charcoal/20 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-charcoal">
                        {card.icon}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-charcoal">{card.label}</p>
                        <p className="text-xs text-gray-500">{card.description}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-charcoal transition-colors" />
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Only dashboard-eligible user with no field roles */}
        {showDashboard && !isFieldUser && (
          <div className="text-center mt-6">
            <p className="text-sm text-gray-400 mb-4">
              You have management dashboard access. Continuing automatically...
            </p>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 mt-10 pt-6 border-t border-gray-200">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">
            Authenticated as {user?.username}
          </p>
          <button
            onClick={handleLogout}
            className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-red-500
                       flex items-center gap-1 transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
