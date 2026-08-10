import { useAuthStore } from "@/stores/authStore";
import { ROLES } from "@/lib/constants";
import type { Role } from "@/lib/constants";

export function useAuth() {
  const { user, isAuthenticated, activeRole, logout } = useAuthStore();

  const hasRole = (...roles: string[]) => {
    if (!user) return false;
    return roles.some((r) => user.roles.includes(r));
  };

  const isManagement = hasRole(ROLES.PO, ROLES.APD, ROLES.DPM);
  const isAdmin = hasRole(ROLES.MDA);
  const isMDA = isAdmin;
  const isAPM = hasRole(ROLES.APM);
  const isFieldUser = hasRole(
    ROLES.CC,
    ROLES.HUB_SUPERVISOR,
    ROLES.MPC_SUPERVISOR,
    ROLES.HAAT_SUPERVISOR,
    ROLES.VDVK_HEAD,
    ROLES.VDVK_FACILITY_SUPERVISOR
  );

  return {
    user,
    isAuthenticated,
    activeRole: activeRole as Role | null,
    hasRole,
    isManagement,
    isAdmin,
    isMDA,
    isAPM,
    isFieldUser,
    logout,
  };
}
