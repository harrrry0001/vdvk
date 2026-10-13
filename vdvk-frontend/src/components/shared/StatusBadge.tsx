import { cn } from "@/lib/utils";
import type { FormStatus } from "@/lib/constants";

const statusStyles: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600 border-gray-200",
  Submitted: "bg-blue-50 text-blue-600 border-blue-200",
  Approved: "bg-green-50 text-green-600 border-green-200",
  Rejected: "bg-red-50 text-red-600 border-red-200",
  Verified: "bg-emerald-50 text-emerald-600 border-emerald-200",
  Active: "bg-green-50 text-green-600 border-green-200",
  Inactive: "bg-gray-100 text-gray-500 border-gray-200",
  Elite: "bg-green-50 text-green-600 border-green-200",
  Stable: "bg-blue-50 text-blue-600 border-blue-200",
  Warning: "bg-amber-50 text-amber-600 border-amber-200",
  Critical: "bg-red-50 text-red-600 border-red-200",
  Escalated: "bg-red-50 text-red-600 border-red-200",
  Pending: "bg-amber-50 text-amber-600 border-amber-200",
  "In Transit": "bg-indigo-50 text-indigo-600 border-indigo-200",
  Delivered: "bg-green-50 text-green-600 border-green-200",
  Maintenance: "bg-purple-50 text-purple-600 border-purple-200",
  Operational: "bg-green-50 text-green-600 border-green-200",
  Available: "bg-green-50 text-green-600 border-green-200",
  "In Use": "bg-blue-50 text-blue-600 border-blue-200",
  Idle: "bg-amber-50 text-amber-600 border-amber-200",
  "Under Maintenance": "bg-purple-50 text-purple-600 border-purple-200",
  "Out of Service": "bg-red-50 text-red-600 border-red-200",
};

interface StatusBadgeProps {
  status: FormStatus | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] || statusStyles.Draft;

  return (
    <span className={cn("status-badge border", style, className)}>
      {status}
    </span>
  );
}
