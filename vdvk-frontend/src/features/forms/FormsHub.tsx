import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Truck, Factory, ShoppingBag, Settings, Wallet, ClipboardCheck, Loader2 } from "lucide-react";
import { formsApi } from "@/api/endpoints/forms";

const formCards = [
  {
    form: "2",
    title: "STOCK TRANSFER",
    desc: "Record MFP movement between clusters, storage units, or central processing facilities. Track inter-unit inventory shifts.",
    tag: "Logistic Log",
    icon: Truck,
    path: "/forms/form2",
  },
  {
    form: "3",
    title: "PROCESSING",
    desc: "Record raw MFP processing stages into finished goods. Log inputs, value additions, and final inventory yields.",
    tag: "Production Log",
    icon: Factory,
    path: "/forms/form3",
  },
  {
    form: "4",
    title: "SALES ENTRY",
    desc: "Log retail and bulk sales of processed MFP products. Track revenue, customer details, and inventory reduction.",
    tag: "Revenue Log",
    icon: ShoppingBag,
    path: "/forms/form4",
  },
  {
    form: "8",
    title: "MACHINERY",
    desc: "Log machinery usage hours, output produced, fuel consumption, and service status for maintenance tracking.",
    tag: "Asset Log",
    icon: Settings,
    path: "/forms/form8",
  },
  {
    form: "10",
    title: "FUND UTILISATION",
    desc: "Track funds used for procurement, labour, and overheads. Log vouchers and reconcile petty cash expenses.",
    tag: "Expense Log",
    icon: Wallet,
    path: "/forms/form10",
  },
  {
    form: "12",
    title: "FIELD VISIT",
    desc: "Daily field visit log with findings and action taken. Document VDVK inspections and group meetings.",
    tag: "Visit Log",
    icon: ClipboardCheck,
    path: "/forms/form12",
  },
];

const FORM_TYPES = ["form1", "form2", "form3", "form4", "form8", "form10", "form12"] as const;

function normalizeEntry(raw: Record<string, unknown>): string {
  const commodity = (raw.commodity as string) ?? (raw.commodityName as string) ?? "";
  const quantity = (raw.quantity as string | number) ?? (raw.qty as string | number) ?? (raw.hours as string | number) ?? "";
  const unit = (raw.unit as string) ?? "";
  if (commodity && quantity) return `${commodity} — ${quantity}${unit ? ` ${unit}` : ""}`;
  if (commodity) return commodity;
  if (quantity) return `${quantity}${unit ? ` ${unit}` : ""}`;
  const desc = raw.description as string;
  return desc ?? "—";
}

function normalizeStatus(raw: Record<string, unknown>): string {
  const s = ((raw.status as string) ?? "").toLowerCase();
  if (s === "verified" || s === "approved") return "Verified";
  if (s === "pending" || s === "draft") return "Pending";
  return "Submitted";
}

function formatDate(raw: Record<string, unknown>): string {
  const d = (raw.createdAt as string) ?? (raw.date as string) ?? (raw.submissionDate as string);
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

export function FormsHub() {
  const queries = FORM_TYPES.map((ft) =>
    useQuery({
      queryKey: ["forms", ft],
      queryFn: () => formsApi.list(ft).then((r) => r.data ?? []),
      staleTime: 60_000,
    }),
  );

  const isLoading = queries.some((q) => q.isLoading);

  const recentSubmissions = useMemo(() => {
    const merged = queries.flatMap((q) => {
      const arr = Array.isArray(q.data) ? q.data : [];
      return arr.map((item: Record<string, unknown>) => ({
        ref: ((item.id as string) ?? (item._id as string) ?? (item.refId as string) ?? (item.ref as string) ?? "—") as string,
        formType: ((item.formType as string) ?? (item.form_type as string) ?? "—") as string,
        datetime: formatDate(item),
        entry: normalizeEntry(item),
        status: normalizeStatus(item),
        _sort: (item.createdAt as string) ?? (item.date as string) ?? "",
      }));
    });
    merged.sort((a, b) => b._sort.localeCompare(a._sort));
    return merged.slice(0, 8);
  }, queries);

  return (
    <div className="space-y-16">
      <div>
        <h1 className="font-display text-5xl tracking-tight text-charcoal mb-2">Supervisor Portal</h1>
        <p className="text-charcoal/50 text-sm font-medium uppercase tracking-[0.3em]">
          System ID: SUP-092-2024 · Active Shift
        </p>
      </div>

      {/* Form Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {formCards.map((card) => (
          <Link
            key={card.form}
            to={card.path}
            className="form-card text-left bg-white border-2 border-charcoal/5 hover:border-charcoal rounded-2xl p-8 flex flex-col group"
            style={{
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <div className="w-14 h-14 bg-charcoal text-golden flex items-center justify-center rounded-xl mb-6
                           group-hover:scale-110 transition-transform">
              <card.icon size={28} />
            </div>
            <h3 className="font-display text-2xl text-charcoal mb-3">
              FORM {card.form}: {card.title}
            </h3>
            <p className="text-sm text-charcoal/60 leading-relaxed flex-1 mb-8">
              {card.desc}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-charcoal/40">
                {card.tag}
              </span>
              <span className="bg-charcoal text-golden px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg">
                Open Form
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Submissions */}
      <div className="bg-white border-2 border-charcoal/5 rounded-3xl overflow-hidden">
        <div className="p-8 border-b border-charcoal/5 flex items-center justify-between">
          <h4 className="font-display text-2xl text-charcoal">Recent Submissions</h4>
          <Link
            to="/reports"
            className="text-[10px] font-black uppercase tracking-widest text-charcoal/40 hover:text-charcoal"
          >
            View All Activity
          </Link>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-charcoal/30" size={32} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white">
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-charcoal/40 border-b border-charcoal/5">
                    Ref ID
                  </th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-charcoal/40 border-b border-charcoal/5">
                    Form Type
                  </th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-charcoal/40 border-b border-charcoal/5">
                    Date/Time
                  </th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-charcoal/40 border-b border-charcoal/5">
                    Primary Entry
                  </th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-widest text-charcoal/40 border-b border-charcoal/5">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5">
                {recentSubmissions.map((sub) => (
                  <tr key={sub.ref} className="hover:bg-gray-50/50">
                    <td className="p-6">
                      <span className="font-mono text-xs font-bold">{sub.ref}</span>
                    </td>
                    <td className="p-6">
                      <span className="text-sm font-semibold">{sub.formType}</span>
                    </td>
                    <td className="p-6">
                      <span className="text-xs text-charcoal/60">{sub.datetime}</span>
                    </td>
                    <td className="p-6">
                      <span className="text-xs">{sub.entry}</span>
                    </td>
                    <td className="p-6">
                      <span
                        className={`inline-flex px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full ${
                          sub.status === "Submitted"
                            ? "bg-green-100 text-green-700"
                            : sub.status === "Verified"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentSubmissions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-sm text-charcoal/40">
                      No submissions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
