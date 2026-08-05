import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authApi } from "@/api/endpoints/auth";
import { useAuth } from "@/hooks/useAuth";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import {
  User, Mail, Phone, MapPin, Shield, Clock, Save,
  Key, AlertTriangle, CheckCircle, X, Building,
} from "lucide-react";
import { useState } from "react";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(191),
  mobile: z.string().max(32).optional().or(z.literal("")),
  designation: z.string().max(191).optional().or(z.literal("")),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export function ProfilePage() {
  const { user, activeRole } = useAuth();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authApi.me().then((r) => r.data),
  });

  const {
    register: regProfile,
    handleSubmit: handleProfile,
    reset: resetProfile,
    formState: { errors: profileErrors, isDirty: profileDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: profile ? {
      name: profile.name ?? "",
      mobile: profile.mobile ?? "",
      designation: profile.designation ?? "",
    } : undefined,
  });

  const {
    register: regPassword,
    handleSubmit: handlePassword,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const profileMutation = useMutation({
    mutationFn: (data: ProfileForm) => authApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setSuccessMsg("Profile updated successfully");
      setEditMode(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to update profile";
      setErrorMsg(msg);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(data),
    onSuccess: () => {
      setSuccessMsg("Password changed successfully");
      resetPassword();
      setShowPassword(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to change password";
      setErrorMsg(msg);
    },
  });

  if (isLoading) return <PageLoading />;

  const initials = profile?.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "??";

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-display text-4xl tracking-tight text-charcoal">My Profile</h1>
        <p className="text-charcoal/50 text-sm font-medium uppercase tracking-[0.2em] mt-1">
          Manage your account settings
        </p>
      </div>

      {successMsg && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-5 py-3 text-sm font-semibold">
          <CheckCircle size={18} />
          {successMsg}
          <button onClick={() => setSuccessMsg(null)} className="ml-auto"><X size={16} /></button>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-600 rounded-xl px-5 py-3 text-sm font-semibold">
          <AlertTriangle size={18} />
          {errorMsg}
          <button onClick={() => setErrorMsg(null)} className="ml-auto"><X size={16} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Avatar card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full bg-charcoal flex items-center justify-center mb-6">
            <span className="font-display text-3xl text-golden">{initials}</span>
          </div>
          <h2 className="font-display text-xl text-charcoal">{profile?.name}</h2>
          <span className="text-[10px] font-black uppercase tracking-widest text-golden bg-charcoal/90 px-3 py-1 rounded-full mt-2">
            {activeRole}
          </span>
          <div className="w-full mt-6 pt-6 border-t border-gray-100 space-y-3">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <User size={16} className="text-gray-300" />
              <span className="font-mono text-xs">{profile?.username || user?.username}</span>
            </div>
            {profile?.email && (
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <Mail size={16} className="text-gray-300" />
                <span className="text-xs">{profile.email}</span>
              </div>
            )}
            {profile?.mobile && (
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <Phone size={16} className="text-gray-300" />
                <span className="font-mono text-xs">{profile.mobile}</span>
              </div>
            )}
            {profile?.mandal && (
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <MapPin size={16} className="text-gray-300" />
                <span className="text-xs">{profile.mandal}</span>
              </div>
            )}
          </div>
        </div>

        {/* Details panels */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Info / Edit */}
          <div className="bg-white rounded-2xl border border-gray-100 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-lg text-charcoal">Account Information</h3>
              {!editMode && (
                <button onClick={() => setEditMode(true)} className="text-xs font-bold text-golden bg-charcoal px-4 py-2 rounded-lg uppercase tracking-wider hover:opacity-90">
                  Edit Profile
                </button>
              )}
            </div>

            {!editMode ? (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="kpi-label">Full Name</p>
                  <p className="text-sm font-semibold">{profile?.name}</p>
                </div>
                <div>
                  <p className="kpi-label">Designation</p>
                  <p className="text-sm">{profile?.designation || "—"}</p>
                </div>
                <div>
                  <p className="kpi-label">Mobile</p>
                  <p className="text-sm font-mono">{profile?.mobile || "—"}</p>
                </div>
                <div>
                  <p className="kpi-label">Mandal</p>
                  <p className="text-sm">{profile?.mandal || "—"}</p>
                </div>
                <div>
                  <p className="kpi-label">Roles</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(profile?.roles ?? user?.roles ?? []).map((r: string) => (
                      <span key={r} className="text-[10px] font-bold uppercase bg-gray-100 px-2 py-0.5 rounded">{r}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="kpi-label">Active Role</p>
                  <p className="text-sm font-semibold text-golden">{profile?.activeRole || activeRole}</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleProfile((d) => profileMutation.mutate(d))} className="space-y-5">
                <div>
                  <label className="kpi-label">Full Name</label>
                  <input {...regProfile("name")} className="input-field" />
                  {profileErrors.name && <p className="text-red-500 text-xs mt-1">{profileErrors.name.message}</p>}
                </div>
                <div>
                  <label className="kpi-label">Mobile</label>
                  <input {...regProfile("mobile")} className="input-field" placeholder="+91 XXXXXXXXXX" />
                </div>
                <div>
                  <label className="kpi-label">Designation</label>
                  <input {...regProfile("designation")} className="input-field" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={!profileDirty || profileMutation.isPending} className="btn-bold">
                    <Save size={16} />
                    {profileMutation.isPending ? "Saving..." : "Save Changes"}
                  </button>
                  <button type="button" onClick={() => { setEditMode(false); resetProfile(); }} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Change Password */}
          <div className="bg-white rounded-2xl border border-gray-100 p-8">
            <h3 className="font-display text-lg text-charcoal mb-6">Change Password</h3>
            {!showPassword ? (
              <button onClick={() => setShowPassword(true)} className="btn-secondary flex items-center gap-2">
                <Key size={16} />
                Change Password
              </button>
            ) : (
              <form onSubmit={handlePassword((d) => passwordMutation.mutate(d))} className="space-y-5">
                <div>
                  <label className="kpi-label">Current Password</label>
                  <input type="password" {...regPassword("currentPassword")} className="input-field" />
                  {passwordErrors.currentPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.currentPassword.message}</p>}
                </div>
                <div>
                  <label className="kpi-label">New Password</label>
                  <input type="password" {...regPassword("newPassword")} className="input-field" />
                  {passwordErrors.newPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.newPassword.message}</p>}
                </div>
                <div>
                  <label className="kpi-label">Confirm New Password</label>
                  <input type="password" {...regPassword("confirmPassword")} className="input-field" />
                  {passwordErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.confirmPassword.message}</p>}
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={passwordMutation.isPending} className="btn-bold">
                    <Key size={16} />
                    {passwordMutation.isPending ? "Updating..." : "Update Password"}
                  </button>
                  <button type="button" onClick={() => { setShowPassword(false); resetPassword(); }} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Session Info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-8">
            <h3 className="font-display text-lg text-charcoal mb-4">Session</h3>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Shield size={16} className="text-emerald-500" />
              <span>Active session — authenticated as <strong>{user?.username}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
