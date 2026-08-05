import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useSidebarStore } from "@/stores/sidebarStore";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const { isCollapsed } = useSidebarStore();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out",
          isCollapsed ? "ml-[72px]" : "ml-[260px]"
        )}
      >
        <Header />
        <main
          style={{ viewTransitionName: "main-content" }}
          className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-gray-50/50"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
