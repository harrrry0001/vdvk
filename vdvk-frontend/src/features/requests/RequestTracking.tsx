import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formsApi } from "@/api/endpoints/forms";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import { type ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Check, X, Eye, ArrowUp, Clock, PlusCircle } from "lucide-react";
import type { RequestItem } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { ROLES } from "@/lib/constants";

const statusTabs = ["All", "Pending", "Approved", "Rejected", "Escalated"];
const formTypes = ["All Forms", "Form 1", "Form 2", "Form 3", "Form 4", "Form 8", "Form 10"];
const ccRequestTypes = ["Machinery Repair", "Rate Query", "Advance Request", "Beneficiary Issue", "Other"];
const priorityLevels = ["Low", "Medium", "High"];

const REQUEST_FORM_TYPE = "cc-requests";

export function RequestTracking() {
  const { hasRole, user } = useAuth();
  const isCC = hasRole(ROLES.CC);
  const isAdminApprover = hasRole(ROLES.PO, ROLES.DPM, ROLES.APM, ROLES.APD, ROLES.Admin);

  const [activeTab, setActiveTab] = useState("All");
  const [selectedFormType, setSelectedFormType] = useState("All Forms");
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const queryClient = useQueryClient();

  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [newRequest, setNewRequest] = useState({
    requestType: "Machinery Repair",
    priority: "Medium",
    amount: "",
    description: "",
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const res = await formsApi.list(REQUEST_FORM_TYPE);
      return (res.data?.data ?? []) as RequestItem[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, formType }: { id: string; formType: string }) =>
      formsApi.approve(formType || REQUEST_FORM_TYPE, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setSelectedRequest(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, formType, remarks }: { id: string; formType: string; remarks: string }) =>
      formsApi.approve(formType || REQUEST_FORM_TYPE, id, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setSelectedRequest(null);
      setRejectionReason("");
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => formsApi.create(REQUEST_FORM_TYPE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setShowRaiseModal(false);
      setNewRequest({ requestType: "Machinery Repair", priority: "Medium", amount: "", description: "" });
    },
  });

  if (isLoading) return <PageLoading />;

  const mockRequests: RequestItem[] = requests?.length
    ? requests
    : [
        {
          id: "REQ-001",
          formType: REQUEST_FORM_TYPE,
          submittedBy: "Ramesh Kumar",
          submittedByRole: "CC",
          facility: "Paderu VDVK-12",
          amount: 28500,
          daysPending: 3,
          status: "Submitted" as const,
          with: "APM Paderu",
          dateSubmitted: "2025-08-02",
        },
        {
          id: "REQ-002",
          formType: REQUEST_FORM_TYPE,
          submittedBy: "Sita Devi",
          submittedByRole: "Hub Supervisor",
          facility: "Araku Hub",
          amount: 15200,
          daysPending: 15,
          status: "Escalated" as const,
          with: "DPM Paderu",
          dateSubmitted: "2025-07-21",
        },
        {
          id: "REQ-003",
          formType: REQUEST_FORM_TYPE,
          submittedBy: "Mohan Rao",
          submittedByRole: "MPC Supervisor",
          facility: "G.Madugula MPC",
          amount: 42000,
          daysPending: 1,
          status: "Approved" as const,
          with: "APM Paderu",
          dateSubmitted: "2025-08-04",
        },
        {
          id: "REQ-004",
          formType: REQUEST_FORM_TYPE,
          submittedBy: "Lakshmi Pathi",
          submittedByRole: "APM",
          facility: "Paderu Office",
          amount: 128000,
          daysPending: 2,
          status: "Rejected" as const,
          with: "DPM Paderu",
          dateSubmitted: "2025-08-03",
        },
        {
          id: "REQ-005",
          formType: REQUEST_FORM_TYPE,
          submittedBy: "Venkat Reddy",
          submittedByRole: "VDVK Facility Supervisor",
          facility: "Araku VDVK-05",
          amount: 8900,
          daysPending: 12,
          status: "Escalated" as const,
          with: "DPM Paderu",
          dateSubmitted: "2025-07-24",
        },
      ];

  const filtered = mockRequests.filter((r) => {
    const matchesTab = activeTab === "All" || r.status === activeTab;
    const matchesForm = selectedFormType === "All Forms" || r.formType === `form${selectedFormType.split(" ")[1]}`;
    return matchesTab && matchesForm;
  });

  const handleCreateRequest = () => {
    const facilityContext = user?.mandal ?? user?.facilityCode ?? "N/A";
    createMutation.mutate({
      requestType: newRequest.requestType,
      priority: newRequest.priority,
      facilityContext,
      amount: newRequest.amount ? Number(newRequest.amount) : 0,
      description: newRequest.description,
    });
  };

  const columns: ColumnDef<RequestItem>[] = [
    {
      accessorKey: "id",
      header: "Request ID",
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
    },
    {
      accessorKey: "requestType",
      header: "Type / Details",
      cell: ({ row }) => (
        <div>
          <span className="font-bold uppercase text-[10px] block text-gray-400">
            {row.original.requestType ?? row.original.formType}
          </span>
          <span className="text-xs text-charcoal">
            {row.original.description ?? ""}
          </span>
        </div>
      ),
    },
    { accessorKey: "submittedBy", header: "Submitted By" },
    { accessorKey: "facility", header: "Facility" },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ getValue }) => {
        const val = getValue<number>();
        if (val == null) return <span className="text-gray-400 text-xs">—</span>;
        return <span className="font-mono font-bold text-sm">&#8377; {val.toLocaleString("en-IN")}</span>;
      },
    },
    {
      accessorKey: "daysPending",
      header: "Days Pending",
      cell: ({ getValue, row }) => {
        const days = getValue<number>();
        const escalated = row.original.status === "Escalated";
        return (
          <span
            className={cn(
              "font-mono text-xs font-bold",
              escalated ? "text-red-500" : days > 7 ? "text-amber-500" : "text-gray-600"
            )}
          >
            <Clock className="w-3 h-3 inline mr-1" />
            {days} days
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
      header: "Actions",
      cell: ({ row }) => {
        const isFinal = row.original.status === "Approved" || row.original.status === "Rejected";
        const formType = row.original.formType || REQUEST_FORM_TYPE;

        if (isCC) {
          return (
            <button
              onClick={() => setSelectedRequest(row.original)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-charcoal"
              title="View"
            >
              <Eye className="w-4 h-4" />
            </button>
          );
        }

        if (isFinal) {
          return (
            <button
              onClick={() => setSelectedRequest(row.original)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-charcoal"
            >
              <Eye className="w-4 h-4" />
            </button>
          );
        }

        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => approveMutation.mutate({ id: row.original.id, formType })}
              className="p-1.5 rounded hover:bg-green-50 text-gray-400 hover:text-green-600"
              title="Approve"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setSelectedRequest(row.original);
                setRejectionReason("");
              }}
              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
              title="Reject"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600"
              title="Escalate"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  const counts = {
    All: mockRequests.length,
    Pending: mockRequests.filter((r) => r.status === "Submitted").length,
    Approved: mockRequests.filter((r) => r.status === "Approved").length,
    Rejected: mockRequests.filter((r) => r.status === "Rejected").length,
    Escalated: mockRequests.filter((r) => r.status === "Escalated").length,
  };

  const escalatedRequests = mockRequests.filter((r) => r.status === "Escalated");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <h2 className="text-xl font-display text-charcoal tracking-wide">Request Tracking</h2>
        {isCC && (
          <button
            onClick={() => setShowRaiseModal(true)}
            className="btn-bold rounded-lg"
          >
            <PlusCircle className="w-4 h-4" />
            Raise New Request
          </button>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {statusTabs.map((tab) => (
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
            <span className="ml-1.5 opacity-60">({counts[tab as keyof typeof counts] ?? 0})</span>
          </button>
        ))}
        <div className="ml-auto">
          <select
            value={selectedFormType}
            onChange={(e) => setSelectedFormType(e.target.value)}
            className="input-field py-1.5 w-36 text-xs"
          >
            {formTypes.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Escalation Queue */}
      {escalatedRequests.length > 0 && (
        <div className="dark-panel">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-sage/60 mb-4">
            Escalation Queue — Requires Immediate Attention
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {escalatedRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-white font-semibold">{req.id}</p>
                  <p className="text-xs text-red-400/80 mt-1">{req.daysPending} days pending</p>
                  <p className="text-xs text-sage/40">{req.submittedBy}</p>
                </div>
                <button
                  onClick={() => setSelectedRequest(req)}
                  className="px-3 py-1.5 text-xs font-bold bg-golden text-charcoal rounded-lg hover:bg-golden-600 transition-colors"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Requests Table */}
      <DataTable columns={columns} data={filtered} searchable searchPlaceholder="Search requests..." />

      {/* Raise Request Modal */}
      {showRaiseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl mx-4 shadow-2xl animate-slide-up">
            <div className="bg-charcoal p-6 flex justify-between items-center">
              <h3 className="font-display text-2xl text-golden tracking-widest">RAISE NEW REQUEST</h3>
              <button
                onClick={() => setShowRaiseModal(false)}
                className="text-golden hover:opacity-50 transition-opacity"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Request Type
                  </label>
                  <select
                    value={newRequest.requestType}
                    onChange={(e) => setNewRequest({ ...newRequest, requestType: e.target.value })}
                    className="w-full bg-gray-50 border-b-2 border-charcoal px-4 py-3 font-bold text-charcoal outline-none appearance-none"
                  >
                    {ccRequestTypes.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Priority Level
                  </label>
                  <select
                    value={newRequest.priority}
                    onChange={(e) => setNewRequest({ ...newRequest, priority: e.target.value })}
                    className="w-full bg-gray-50 border-b-2 border-charcoal px-4 py-3 font-bold text-charcoal outline-none appearance-none"
                  >
                    {priorityLevels.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Facility Context
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={user?.mandal ?? user?.facilityCode ?? "N/A"}
                    className="w-full bg-gray-100 border-b-2 border-gray-300 px-4 py-3 font-bold text-gray-500 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Amount (&#8377;)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold">&#8377;</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={newRequest.amount}
                      onChange={(e) => setNewRequest({ ...newRequest, amount: e.target.value })}
                      className="w-full bg-gray-50 border-b-2 border-charcoal pl-10 pr-4 py-3 font-bold text-charcoal outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 mb-8">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Detailed Description
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe the issue or requirement clearly..."
                  value={newRequest.description}
                  onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                  className="w-full bg-gray-50 border-b-2 border-charcoal px-4 py-3 font-bold text-charcoal outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-6">
                <button
                  type="button"
                  onClick={() => setShowRaiseModal(false)}
                  className="px-8 py-4 font-bold uppercase text-xs tracking-widest text-charcoal hover:underline underline-offset-4"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleCreateRequest}
                  disabled={createMutation.isPending}
                  className="px-12 py-4 bg-charcoal text-golden font-bold uppercase text-xs tracking-widest hover:opacity-90 disabled:opacity-50"
                >
                  {createMutation.isPending ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail/Reject Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-display text-charcoal">Request Details</h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-charcoal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="kpi-label">Request ID</p>
                <p className="font-mono text-sm">{selectedRequest.id}</p>
              </div>
              {selectedRequest.requestType && (
                <div>
                  <p className="kpi-label">Request Type</p>
                  <p className="font-semibold uppercase text-sm">{selectedRequest.requestType}</p>
                </div>
              )}
              {selectedRequest.priority && (
                <div>
                  <p className="kpi-label">Priority</p>
                  <p className="text-sm">{selectedRequest.priority}</p>
                </div>
              )}
              <div>
                <p className="kpi-label">Form Type</p>
                <p className="font-semibold uppercase">{selectedRequest.formType}</p>
              </div>
              <div>
                <p className="kpi-label">Submitted By</p>
                <p className="text-sm">{selectedRequest.submittedBy} ({selectedRequest.submittedByRole})</p>
              </div>
              <div>
                <p className="kpi-label">Facility</p>
                <p className="text-sm">{selectedRequest.facility}</p>
              </div>
              {selectedRequest.amount != null && (
                <div>
                  <p className="kpi-label">Amount</p>
                  <p className="font-mono font-bold text-sm">&#8377; {selectedRequest.amount.toLocaleString("en-IN")}</p>
                </div>
              )}
              <div>
                <p className="kpi-label">Status</p>
                <StatusBadge status={selectedRequest.status} />
              </div>
              {selectedRequest.description && (
                <div>
                  <p className="kpi-label">Description</p>
                  <p className="text-sm text-gray-700">{selectedRequest.description}</p>
                </div>
              )}

              {selectedRequest.status !== "Approved" && selectedRequest.status !== "Rejected" && isAdminApprover && (
                <div className="mt-4">
                  <label className="kpi-label">Rejection Reason</label>
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
              {selectedRequest.status !== "Approved" &&
                selectedRequest.status !== "Rejected" &&
                isAdminApprover && (
                  <>
                    <button
                      onClick={() =>
                        approveMutation.mutate({
                          id: selectedRequest.id,
                          formType: selectedRequest.formType || REQUEST_FORM_TYPE,
                        })
                      }
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
                            formType: selectedRequest.formType || REQUEST_FORM_TYPE,
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
              <button
                onClick={() => setSelectedRequest(null)}
                className="btn-secondary ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
