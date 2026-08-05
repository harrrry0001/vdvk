import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  accent?: "yellow" | "green" | "red" | "blue" | "purple";
  className?: string;
}

const accentColors = {
  yellow: "border-l-golden",
  green: "border-l-green-500",
  red: "border-l-red-500",
  blue: "border-l-blue-500",
  purple: "border-l-purple-500",
};

export function KPICard({ label, value, change, changeLabel, accent = "yellow", className }: KPICardProps) {
  const isPositive = change !== undefined && change >= 0;
  const showChange = change !== undefined;

  return (
    <div className={cn("kpi-card border-l-4", accentColors[accent], className)}>
      <p className="kpi-label">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="kpi-value">{value}</span>
        {showChange && (
          <span
            className={cn(
              "text-xs font-semibold flex items-center gap-0.5",
              isPositive ? "text-green-600" : "text-red-500"
            )}
          >
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? "+" : ""}
            {change}%
          </span>
        )}
      </div>
      {changeLabel && (
        <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">{changeLabel}</p>
      )}
    </div>
  );
}
