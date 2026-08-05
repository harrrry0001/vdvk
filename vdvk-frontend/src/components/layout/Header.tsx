import { Bell, Search, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/api/endpoints/notifications";
import { authApi } from "@/api/endpoints/auth";
import { ROLE_LABELS } from "@/lib/constants";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export function Header() {
  const { user, activeRole, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authApi.me().then((r) => r.data),
    staleTime: 60_000,
  });

  const displayName = profile?.name || user?.name || user?.username || "User";
  const displayRole = ROLE_LABELS[activeRole ?? ""] || activeRole;
  const displayDesignation = profile?.designation || user?.designation;

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data.count ?? 0),
    refetchInterval: 30_000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => notificationsApi.list({ limit: "5" }).then((r) => r.data ?? []),
    enabled: showNotifications,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header
      id="top-header"
      style={{ viewTransitionName: "top-bar" }}
      className="h-16 bg-charcoal sticky top-0 z-40 flex items-center justify-between px-8 border-l border-white/5"
    >
      <div className="flex items-center gap-8 flex-1">
        <h2 className="font-display text-2xl text-golden tracking-widest shrink-0">VDVK MIS</h2>

        <div className="relative max-w-xl w-full hidden md:block">
          <div className="relative flex items-center">
            <span className="absolute left-4 font-display text-[10px] text-golden border-r border-golden/30 pr-3 mr-3">
              SEARCH
            </span>
            <input
              type="text"
              placeholder="Search Mandal, VDVK, Commodity, Hub, Haat Bazaar..."
              className="w-full bg-white/5 border-none pl-24 pr-10 py-2 text-white text-xs
                         placeholder:text-white/20 focus:ring-1 focus:ring-golden transition-all outline-none"
            />
            <Search className="absolute right-4 text-white/30" size={16} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="text-white/60 hover:text-white relative p-1 focus:outline-none"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[8px] font-black text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute top-full right-0 w-80 bg-white mt-4 shadow-2xl border border-charcoal/10 z-50 overflow-hidden">
              <div className="bg-charcoal p-4 flex items-center justify-between">
                <h5 className="font-display text-xs text-golden tracking-widest">NOTIFICATIONS</h5>
                <span className="text-[10px] text-white/40 uppercase">
                  {unreadCount} Unread
                </span>
              </div>
              <div className="divide-y divide-charcoal/5 max-h-80 overflow-y-auto custom-scrollbar">
                {notifications.length === 0 && (
                  <div className="p-6 text-center text-xs text-gray-400">
                    No notifications
                  </div>
                )}
                {notifications.map((n: Notification) => (
                  <div
                    key={n.id}
                    onClick={() => !n.isRead && markReadMutation.mutate(n.id)}
                    className={`p-4 hover:bg-gray-50 cursor-pointer ${!n.isRead ? "bg-golden/5 border-l-2 border-golden" : ""}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-black uppercase text-charcoal/60">
                        {n.type}
                      </span>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-golden shrink-0" />
                      )}
                    </div>
                    <p className="text-xs font-semibold text-charcoal mb-1">{n.title}</p>
                    <p className="text-xs text-charcoal/50 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-charcoal/30 mt-2">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
              {notifications.length > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  className="block w-full text-center py-3 bg-gray-50 text-[10px] font-black uppercase hover:bg-gray-100"
                >
                  Mark All as Read
                </button>
              )}
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-white/10" />

        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/profile")} className="text-right hidden sm:block hover:opacity-80 transition-opacity">
            <p className="text-[10px] font-black text-golden uppercase tracking-tighter">
              {displayRole}
            </p>
            <p className="text-xs text-white font-bold">
              {displayName}
            </p>
            {displayDesignation && (
              <p className="text-[9px] text-white/40 font-medium mt-0.5">
                {displayDesignation}
              </p>
            )}
          </button>
          <button onClick={() => navigate("/profile")} className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden hover:border-golden/40 transition-colors">
            <span className="text-sm font-display text-white">{displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}</span>
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="text-white/40 hover:text-white transition-colors p-1"
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
