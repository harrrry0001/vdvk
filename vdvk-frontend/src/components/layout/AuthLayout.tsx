import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
      <Outlet />
    </div>
  );
}
