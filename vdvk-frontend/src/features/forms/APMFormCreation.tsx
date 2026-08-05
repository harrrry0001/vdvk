import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ShoppingCart,
  IndianRupee,
  MapPin,
  Truck,
  Cog,
  Settings,
  ExternalLink,
  History,
  ArrowRight,
} from "lucide-react";
import { masterApi } from "@/api/endpoints/master";
import { mdaApi } from "@/api/endpoints/mda";
import { PageLoading } from "@/components/shared/LoadingSpinner";
import type { Facility, VDVK } from "@/types";

interface FormCardConfig {
  formNumber: string;
  title: string;
  icon: React.ElementType;
  collectionModes: string[];
  defaultCollectionMode: string;
  defaultDate: string;
  defaultVersions: number;
  route: string;
}

const formCardConfigs: FormCardConfig[] = [
  {
    formNumber: "4",
    title: "Sales Entry Register",
    icon: ShoppingCart,
    collectionModes: ["Offline App", "Web Portal", "Excel Upload"],
    defaultCollectionMode: "Offline App",
    defaultDate: "2025-05-15",
    defaultVersions: 1,
    route: "/forms/form4",
  },
  {
    formNumber: "10",
    title: "Fund Utilisation",
    icon: IndianRupee,
    collectionModes: ["Web Portal", "Offline App", "Excel Upload"],
    defaultCollectionMode: "Web Portal",
    defaultDate: "2025-05-10",
    defaultVersions: 2,
    route: "/forms/form10",
  },
  {
    formNumber: "12",
    title: "Field Visit Register",
    icon: MapPin,
    collectionModes: ["Offline App", "Web Portal"],
    defaultCollectionMode: "Offline App",
    defaultDate: "2025-05-01",
    defaultVersions: 1,
    route: "/forms/form12",
  },
  {
    formNumber: "2",
    title: "Stock Transfer",
    icon: Truck,
    collectionModes: ["Web Portal", "Excel Upload"],
    defaultCollectionMode: "Web Portal",
    defaultDate: "2025-04-15",
    defaultVersions: 1,
    route: "/forms/form2",
  },
  {
    formNumber: "3",
    title: "Processing Register",
    icon: Cog,
    collectionModes: ["Web Portal", "Offline App"],
    defaultCollectionMode: "Web Portal",
    defaultDate: "2025-04-20",
    defaultVersions: 1,
    route: "/forms/form3",
  },
  {
    formNumber: "8",
    title: "Machinery Utilisation",
    icon: Settings,
    collectionModes: ["Offline App", "Web Portal"],
    defaultCollectionMode: "Offline App",
    defaultDate: "2025-04-28",
    defaultVersions: 3,
    route: "/forms/form8",
  },
];

const auditTrailFallback = [
  {
    formId: "FRM-2025-012",
    formName: "Form 12 Field Visit Register",
    createdOn: "12-MAY-2025",
    createdBy: "APM Rajesh K.",
    status: "Active",
  },
  {
    formId: "FRM-2025-011",
    formName: "Form 8 Machinery Utilisation",
    createdOn: "28-APR-2025",
    createdBy: "APM Rajesh K.",
    status: "Active",
  },
  {
    formId: "FRM-2025-010",
    formName: "Form 4 Sales Entry",
    createdOn: "15-APR-2025",
    createdBy: "APM Rajesh K.",
    status: "Under Revision",
  },
];

const secondaryLinks = [
  {
    label: "Master Data",
    title: "Form 5 VDVK Registration",
    to: "/mda/vdvks",
  },
  {
    label: "Infrastructure",
    title: "Form 11 Facility Setup",
    to: "/mda/facilities",
  },
  {
    label: "Networking",
    title: "Contact Repository",
    to: "#",
  },
];

function FormCard({
  config,
  facilities,
  vdvks,
}: {
  config: FormCardConfig;
  facilities: Facility[];
  vdvks: VDVK[];
}) {
  const [collectionMode, setCollectionMode] = useState(config.defaultCollectionMode);
  const [facility, setFacility] = useState("All Facilities");
  const [effectiveDate, setEffectiveDate] = useState(config.defaultDate);
  const [versions, setVersions] = useState(config.defaultVersions);

  const allFacilities = [
    "All Facilities",
    ...facilities.map((f) => f.name),
    ...vdvks.map((v) => v.name),
  ];

  return (
    <div className="card-lift bg-[#f8f9fa] border border-charcoal/10 rounded-2xl p-6 flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <div className="w-12 h-12 bg-charcoal text-golden flex items-center justify-center rounded-xl">
          <config.icon className="text-2xl" size={24} />
        </div>
        <span className="px-2 py-0.5 border border-charcoal text-charcoal text-[9px] font-black uppercase rounded">
          Form {config.formNumber}
        </span>
      </div>
      <h3 className="font-display text-xl text-charcoal mb-4">{config.title}</h3>

      <div className="space-y-4 mb-8">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-sage">
            Collection Mode
          </label>
          <select
            value={collectionMode}
            onChange={(e) => setCollectionMode(e.target.value)}
            className="w-full p-2 bg-white border border-gray-200 rounded text-xs font-bold"
          >
            {config.collectionModes.map((mode) => (
              <option key={mode}>{mode}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-sage">
            Target Facility
          </label>
          <select
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
            className="w-full p-2 bg-white border border-gray-200 rounded text-xs font-bold"
          >
            {allFacilities.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-sage">
              Effective From
            </label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full p-2 bg-white border border-gray-200 rounded text-xs font-bold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-sage">
              Versions
            </label>
            <input
              type="number"
              value={versions}
              onChange={(e) => setVersions(Number(e.target.value))}
              className="w-full p-2 bg-white border border-gray-200 rounded text-xs font-bold"
            />
          </div>
        </div>
      </div>

      <Link
        to={config.route}
        className="inline-flex items-center justify-center bg-charcoal text-white rounded-full py-3 px-6 font-black uppercase text-[10px] tracking-widest hover:bg-dark-gray transition-colors group mt-auto"
      >
        Open Form {config.formNumber}
        <ExternalLink size={14} className="ml-2 group-hover:scale-110 transition-transform" />
      </Link>
    </div>
  );
}

export function APMFormCreation() {
  const { data: vdvksData, isLoading: vdvksLoading } = useQuery({
    queryKey: ["master", "vdvks"],
    queryFn: () =>
      masterApi.getVdvks().then((r) => (Array.isArray(r.data) ? (r.data as VDVK[]) : [])),
  });

  const { data: facilitiesData, isLoading: facilitiesLoading } = useQuery({
    queryKey: ["mda", "facilities-by-type"],
    queryFn: () =>
      mdaApi
        .getFacilitiesByType()
        .then((r) => (Array.isArray(r.data) ? (r.data as Facility[]) : [])),
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["mda", "audit-trail", "forms"],
    queryFn: () =>
      mdaApi
        .getAuditTrail({ entity: "forms" })
        .then((r) => (Array.isArray(r.data) ? r.data : []))
        .catch(() => []),
  });

  if (vdvksLoading || facilitiesLoading) return <PageLoading />;

  const vdvks = vdvksData ?? [];
  const facilities = facilitiesData ?? [];
  const auditEntries =
    Array.isArray(auditData) && auditData.length > 0 ? auditData : auditTrailFallback;

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-12 border-b-8 border-charcoal pb-6">
        <h1 className="font-display text-6xl md:text-8xl leading-none text-charcoal">
          Form Catalog
        </h1>
        <p className="text-sage text-sm md:text-base font-bold uppercase tracking-[0.3em] mt-2">
          Configure and deploy operational data capture units
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
        {formCardConfigs.map((config) => (
          <FormCard
            key={config.formNumber}
            config={config}
            facilities={facilities}
            vdvks={vdvks}
          />
        ))}
      </div>

      <section className="mb-16">
        <div className="flex items-center justify-between mb-8 border-b-2 border-charcoal/5 pb-4">
          <h2 className="font-display text-3xl text-charcoal">Recently Created Forms</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-sage">
              Audit Trail
            </span>
            <History size={16} className="text-sage" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-charcoal/10">
                <th className="py-4 text-[10px] font-black uppercase tracking-widest text-sage">
                  Form ID
                </th>
                <th className="py-4 text-[10px] font-black uppercase tracking-widest text-sage">
                  Form Name
                </th>
                <th className="py-4 text-[10px] font-black uppercase tracking-widest text-sage">
                  Created On
                </th>
                <th className="py-4 text-[10px] font-black uppercase tracking-widest text-sage">
                  Created By
                </th>
                <th className="py-4 text-[10px] font-black uppercase tracking-widest text-sage">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {auditEntries.map((entry: Record<string, unknown>, idx: number) => {
                const formId = (entry.formId as string) ?? (entry.transactionId as string) ?? "";
                const formName =
                  (entry.formName as string) ?? (entry.formType as string) ?? "";
                const createdOn =
                  (entry.createdOn as string) ?? (entry.createdAt as string) ?? "";
                const createdBy =
                  (entry.createdBy as string) ?? (entry.performedBy as string) ?? "";
                const status =
                  (entry.status as string) ?? (entry.action as string) ?? "Active";
                const isActive = status === "Active";

                return (
                  <tr
                    key={idx}
                    className="border-b border-charcoal/5 hover:bg-[#f8f9fa] transition-colors"
                  >
                    <td className="py-5 font-mono font-bold">{formId}</td>
                    <td className="py-5 font-bold uppercase tracking-tight">{formName}</td>
                    <td className="py-5 font-mono">{createdOn}</td>
                    <td className="py-5 uppercase text-xs font-black">{createdBy}</td>
                    <td className="py-5">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-full ${
                          isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {secondaryLinks.map((link) => (
          <Link
            key={link.title}
            to={link.to}
            className="group p-6 border-2 border-charcoal hover:bg-charcoal hover:text-golden transition-all flex items-center justify-between"
          >
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest mb-1">
                {link.label}
              </p>
              <h4 className="font-display text-lg">{link.title}</h4>
            </div>
            <ArrowRight
              size={24}
              className="group-hover:translate-x-2 transition-transform"
            />
          </Link>
        ))}
      </section>

      <footer className="py-12 border-t border-charcoal/5 text-center">
        <p className="text-[10px] font-black text-sage uppercase tracking-[0.4em]">
          VDVK Operational Management System &bull; Secure Audit Log &bull; Cluster Paderu
        </p>
      </footer>
    </div>
  );
}
