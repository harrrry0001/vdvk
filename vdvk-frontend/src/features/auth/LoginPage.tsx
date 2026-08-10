import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { authApi } from "@/api/endpoints/auth";
import { useAuthStore } from "@/stores/authStore";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login(data);
      const { accessToken, refreshToken, user } = res.data;
      login(accessToken, refreshToken, { ...user, userId: user.id });
      navigate("/role-selection");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Login failed. Please check your credentials.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-white">
      {/* Left Panel: Login Form (40%) */}
      <div
        className="w-full lg:w-[40%] flex flex-col items-center justify-center p-8 md:p-16 bg-white relative z-10"
        style={{ viewTransitionName: "main-content" }}
      >
        <div className="w-full max-w-[420px]">
          {/* Logo Section */}
          <div className="mb-12 flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="w-14 h-14 mb-8 flex items-center justify-center bg-[#171e19] text-[#ffe17c] rounded-full shadow-lg shadow-[#171e19]/10">
              <img
                src="/logo.svg"
                alt="PMVDY Logo"
                className="shrink-0"
                style={{
                  filter: "drop-shadow(0 2px 8px rgba(255,225,124,0.15))",
                  transition: "all 0.3s ease-in-out",
                }}
              />
            </div>
            <h1 className="font-display text-4xl text-[#171e19] tracking-wider mb-2">
              VDVK MIS{" "}
              <span className="highlight-bar relative z-[1] after:content-[''] after:absolute after:left-[-5%] after:bottom-[2px] after:w-[110%] after:h-[12px] after:bg-[#ffe17c] after:-rotate-1 after:-z-[1]">
                Dashboard
              </span>
            </h1>
            <p className="text-sm font-medium text-[#171e19]/60 uppercase tracking-widest">
              Van Dhan Vikas Kendra System
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl px-5 py-3 mb-6 uppercase tracking-wider">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Username */}
            <div>
              <label className="block text-xs font-bold text-[#171e19] uppercase tracking-tighter mb-2">
                Username
              </label>
              <input
                type="text"
                placeholder="Official ID or Email"
                {...register("username")}
                autoComplete="username"
                className="w-full h-14 px-5 border border-[#171e19]/10 rounded-xl
                           focus:ring-2 focus:ring-[#ffe17c] focus:border-[#171e19] outline-none transition-all
                           placeholder:text-[#171e19]/30 font-medium"
              />
              {errors.username && (
                <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider mt-1">
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-[#171e19] uppercase tracking-tighter">
                  Password
                </label>
                <a
                  href="#"
                  className="text-xs font-bold text-[#171e19] hover:underline uppercase"
                >
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("password")}
                  autoComplete="current-password"
                  className="w-full h-14 px-5 border border-[#171e19]/10 rounded-xl pr-12
                             focus:ring-2 focus:ring-[#ffe17c] focus:border-[#171e19] outline-none transition-all
                             placeholder:text-[#171e19]/30 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-[#171e19]/40 hover:text-[#171e19]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-[#171e19] hover:bg-[#272727] text-white rounded-full
                         transition-all flex items-center justify-center gap-3 group
                         font-display text-lg tracking-widest disabled:opacity-60"
            >
              <span>{loading ? "Signing in..." : "Sign In"}</span>
              <ArrowRight className="group-hover:translate-x-1 transition-transform text-[#ffe17c]" size={20} />
            </button>
          </form>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-[#171e19]/5">
            <p className="text-[11px] font-medium leading-relaxed text-[#171e19]/40 uppercase tracking-wide">
              Property of Integrated Tribal Development Agency (ITDA), Paderu. Unauthorized access
              prohibited. Activities logged under official protocol.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel: Visual Hero (60%) */}
      <div className="hidden lg:flex w-[60%] relative bg-[#171e19] flex-col items-center justify-center p-12 overflow-hidden">
        {/* Grid Background */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(#272727 1px, transparent 1px), linear-gradient(90deg, #272727 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Top Accent Line */}
        <div className="absolute top-12 left-0 w-32 h-[2px] bg-[#ffe17c]" />

        {/* Main Hero Content */}
        <div className="relative z-20 text-center max-w-2xl">
          <div className="inline-block px-4 py-1 bg-[#ffe17c] text-[#171e19] text-xs font-black uppercase tracking-[0.2em] mb-8">
            Official MIS Portal
          </div>
          <h2 className="font-display text-6xl xl:text-7xl text-white mb-8 leading-[0.9] tracking-tighter">
            Empowering{" "}
            <span className="text-[#ffe17c]">Tribal</span>{" "}
            Communities
          </h2>
          <p className="text-white/40 font-medium text-lg mb-16 max-w-lg mx-auto tracking-tight">
            Driving economic prosperity through sustainable digital infrastructure for Minor Forest
            Produce management.
          </p>

          {/* KPI Minimalist Grid */}
          <div className="grid grid-cols-3 gap-0 border border-white/10">
            <div className="p-8 border-r border-white/10 flex flex-col items-center">
              <span className="font-display text-[#ffe17c] text-4xl">2,450+</span>
              <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-2">
                Active Units
              </span>
            </div>
            <div className="p-8 border-r border-white/10 flex flex-col items-center">
              <span className="font-display text-[#ffe17c] text-4xl">1.2L+</span>
              <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-2">
                Beneficiaries
              </span>
            </div>
            <div className="p-8 flex flex-col items-center">
              <span className="font-display text-[#ffe17c] text-4xl">₹85Cr</span>
              <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-2">
                Revenue
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Branding */}
        <div className="absolute bottom-12 left-12 right-12 flex justify-between items-end">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-[#ffe17c] uppercase tracking-[0.3em]">
              Division
            </span>
            <span className="font-display text-2xl text-white">ITDA PADERU</span>
          </div>
          <div className="font-display text-white/20 text-sm tracking-widest">Ver 2.4.0</div>
        </div>
      </div>
    </div>
  );
}
