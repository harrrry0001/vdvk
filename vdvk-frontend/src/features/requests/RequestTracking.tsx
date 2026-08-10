import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardApi } from "@/api/endpoints/dashboard";
import { formsApi } from "@/api/endpoints/forms";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { type ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Check, X, Eye, Clock, AlertTriangle } from "lucide-react";
import type { RequestItem } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { ROLES } from "@/lib/constants";

// Forms an APM may approve/reject (pending with APM).
const APM_FORMS = new Set(["form1", "form2", "form3", "form8"]);
// Forms a DPM may approve/reject (pending with DPM).
const DPM_FORMS = new Set(["form4", "form10"]);

type StatusTab = "All" | "Pending" | "Approved" | "Rejected" | "Escalated";

export function RequestTracking() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<StatusTab>("All");
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [vdvkFilter, setVdvkFilter] = useState("all");
  const [mandalFilter, setMandalFilter] = useState("all");

  const isCC = hasRole(ROLES.CC);
  const isAPM = hasRole(ROLES.APM);
  const isDPM = hasRole(ROLES.DPM);

  // PO/APD/DPM view all; CC views only their own (server-side filtered).
  const { data: payload, isLoading } = useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const res = await dashboardApi.getRequests();
      return (res.data?.requests ?? []) as RequestItem[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, formKey }: { id: string; formKey: string }) =>
      formsApi.approve(formKey, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setSelectedRequest(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, formKey, remarks }: { id: string; formKey: string; remarks: string }) =>
      formsApi.reject(formKey, id, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setSelectedRequest(null);
      setRejectionReason("");
    },
  });

  // Whether the current user may approve/reject a given form, per the Approval
  // Responsibility Matrix. PO and CC are strictly view-only.
  const canActOn = (formKey?: string) => {
    if (!formKey) return false;
    if (isAPM) return APM_FORMS.has(formKey);
    if (isDPM) return DPM_FORMS.has(formKey);
    return false;
  };

  // Derived escalation status per the Request Status Indicators.
  const classify = (r: RequestItem): RequestItem => {
    const days = r.daysPending ?? 0;
    if (r.status === "Submitted" && days >= 7) return { ...r, status: "Escalated" as const };
    return r;
  };

  const classified = useMemo<RequestItem[]>(() => (payload ?? []).map(classify), [payload]);

  const list = classified;
  const vdvkOptions = new Set(list.map((r) => r.locationName || "").filter(Boolean));
  const mandalOptions = new Set(list.map((r) => r.mandal || "").filter(Boolean));

  const filtered = list.filter((r: RequestItem) => {
    const matchesTab =
      activeTab === "All" || r.status === activeTab || (activeTab === "Pending" && r.status === "Submitted");
    const matchesVdvk = vdvkFilter === "all" || r.locationName === vdvkFilter;
    const matchesMandal = mandalFilter === "all" || r.mandal === mandalFilter;
    return matchesTab && matchesVdvk && matchesMandal;
  });

  const counts = {
    All: list.length,
    Pending: list.filter((r) => r.status === "Submitted").length,
    Approved: list.filter((r) => r.status === "Approved").length,
    Rejected: list.filter((r) => r.status === "Rejected").length,
    Escalated: list.filter((r) => r.status === "Escalated").length,
  };

  const escalatedRequests = list.filter((r) => r.status === "Escalated");

  const columns: ColumnDef<RequestItem>[] = [
    {
      accessorKey: "requestId",
      header: "Request ID",
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>() ?? ""}</span>,
    },
    {
      accessorKey: "formLabel",
      header: "Input Form",
      cell: ({ getValue }) => (
        <span className="text-xs font-bold uppercase tracking-wider text-charcoal/70">{getValue<string>() ?? ""}</span>
      ),
    },
    {
      accessorKey: "locationName",
      header: "VDVK / Facility",
      cell: ({ getValue }) => <span className="text-sm">{getValue<string>() ?? "—"}</span>,
    },
    {
      accessorKey: "submittedBy",
      header: "Submitted By",
      cell: ({ row }) => (
        <div>
          <span className="text-sm">{row.original.submittedBy}</span>
          {row.original.submittedByRole && (
            <span className="block text-[10px] text-gray-400 uppercase tracking-wider">{row.original.submittedByRole}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Date Created",
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return <span className="text-xs text-gray-500">{v ? new Date(v).toLocaleDateString() : "—"}</span>;
      },
    },
    {
      accessorKey: "pendingWith",
      header: "Pending With",
      cell: ({ getValue }) => <span className="text-xs font-semibold text-charcoal/70">{getValue<string>() ?? "None"}</span>,
    },
    {
      accessorKey: "daysPending",
      header: "Days Pending",
      cell: ({ getValue, row }) => {
        const days = getValue<number>() ?? 0;
        const escalated = row.original.status === "Escalated";
        return (
          <span className={cn("font-mono text-xs font-bold", escalated ? "text-red-500" : days >= 6 ? "text-amber-500" : "text-gray-600")}>
            <Clock className="w-3 h-3 inline mr-1" />
            {days} d
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        const r = row.original;
        const isFinal = r.status === "Approved" || r.status === "Rejected";
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setSelectedRequest(r); setRejectionReason(""); }}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-charcoal"
              title="View"
            >
              <Eye className="w-4 h-4" />
            </button>
            {!isFinal && canActOn(r.formKey) && (
              <>
                <button
                  onClick={() => approveMutation.mutate({ id: r.id, formKey: r.formKey! })}
                  className="p-1.5 rounded hover:bg-green-50 text-gray-400 hover:text-green-600"
                  title="Approve"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setSelectedRequest(r); setRejectionReason(""); }}
                  className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                  title="Reject"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  if (isLoading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display text-charcoal tracking-wide">
          {isCC ? "My Requests" : "Request Monitoring"}
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          {isCC
            ? "Your MFP Collection submissions and their approval status."
            : "Centralised view of all approval-tracked requests."}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["All", "Pending", "Approved", "Rejected", "Escalated"] as StatusTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-xs font-semibold rounded-lg transition-colors",
              activeTab === tab
                ? "bg-charcoal text-golden"
                : "bg-white border border-gray-200 text-gray-500 hover:text-charcoal"
            )}
          >
            {tab}
            <span className="ml-1.5 opacity-60">({counts[tab] ?? 0})</span>
          </button>
        ))}

        {isCC && (
          <div className="ml-auto flex items-center gap-2">
            <select value={mandalFilter} onChange={(e) => setMandalFilter(e.target.value)} className="input-field py-1.5 w-40 text-xs">
              <option value="all">All Mandals</option>
              {[...mandalOptions].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={vdvkFilter} onChange={(e) => setVdvkFilter(e.target.value)} className="input-field py-1.5 w-44 text-xs">
              <option value="all">All VDVKs</option>
              {[...vdvkOptions].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Escalation queue */}
      {escalatedRequests.length > 0 && (
        <div className="dark-panel">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-sage/60 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Escalation Queue — Requires Immediate Attention
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {escalatedRequests.map((req) => (
              <div key={req.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-semibold">{req.requestId}</p>
                  <p className="text-xs text-red-400/80 mt-1">{req.daysPending} days pending</p>
                  <p className="text-xs text-sage/40">{req.locationName || req.submittedBy}</p>
                </div>
                <button onClick={() => setSelectedRequest(req)} className="px-3 py-1.5 text-xs font-bold bg-golden text-charcoal rounded-lg hover:bg-golden-600 transition-colors">
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <DataTable columns={columns} data={filtered} searchable searchPlaceholder="Search requests..." />

      {/* Detail / Approve-Reject Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-display text-charcoal">Request Details</h3>
              <button onClick={() => setSelectedRequest(null)} className="text-gray-400 hover:text-charcoal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="kpi-label">Request ID</p>
                <p className="font-mono text-sm">{selectedRequest.requestId || selectedRequest.id}</p>
              </div>
              <div>
                <p className="kpi-label">Input Form</p>
                <p className="font-semibold uppercase text-sm">{selectedRequest.formLabel || selectedRequest.formType}</p>
              </div>
              <div>
                <p className="kpi-label">VDVK / Facility</p>
                <p className="text-sm">{selectedRequest.locationName || "—"}</p>
              </div>
              <div>
                <p className="kpi-label">Mandal</p>
                <p className="text-sm">{selectedRequest.mandal || "—"}</p>
              </div>
              <div>
                <p className="kpi-label">Submitted By</p>
                <p className="text-sm">{selectedRequest.submittedBy} {selectedRequest.submittedByRole ? `(${selectedRequest.submittedByRole})` : ""}</p>
              </div>
              <div>
                <p className="kpi-label">Pending With</p>
                <p className="text-sm">{selectedRequest.pendingWith || selectedRequest.with || "None"}</p>
              </div>
              <div>
                <p className="kpi-label">Status</p>
                <StatusBadge status={selectedRequest.status} />
              </div>
              {selectedRequest.remarks && (
                <div>
                  <p className="kpi-label">Approval Remarks</p>
                  <p className="text-sm text-gray-700">{selectedRequest.remarks}</p>
                </div>
              )}
              {selectedRequest.status !== "Approved" && selectedRequest.status !== "Rejected" && canActOn(selectedRequest.formKey) && (
                <div className="mt-4">
                  <label className="kpi-label">Rejection Reason (mandatory for reject)</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="input-field mt-1 resize-none"
                    rows={3}
                    placeholder="Enter reason for rejection..."
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
              {selectedRequest.status !== "Approved" && selectedRequest.status !== "Rejected" && canActOn(selectedRequest.formKey) && (
                <>
                  <button
                    onClick={() => approveMutation.mutate({ id: selectedRequest.id, formKey: selectedRequest.formKey! })}
                    className="btn-primary bg-green-600 text-white hover:bg-green-700 border-none flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      if (rejectionReason.trim()) {
                        rejectMutation.mutate({
                          id: selectedRequest.id,
                          formKey: selectedRequest.formKey!,
                          remarks: rejectionReason,
                        });
                      }
                    }}
                    disabled={!rejectionReason.trim()}
                    className="btn-danger flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </>
              )}
              <button onClick={() => setSelectedRequest(null)} className="btn-secondary ml-auto">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
