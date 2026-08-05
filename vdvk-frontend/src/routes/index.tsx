import { createBrowserRouter, Navigate } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthGuard, GuestGuard, RoleGuard } from "@/routes/guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { RoleSelectionPage } from "@/features/auth/RoleSelectionPage";
import { ProfilePage } from "@/features/auth/ProfilePage";
import { ContactRepository } from "@/features/dashboard/ContactRepository";
import { DistrictOverview } from "@/features/dashboard/DistrictOverview";
import { FundMonitoring } from "@/features/dashboard/FundMonitoring";
import { VDVKPerformancePage } from "@/features/dashboard/VDVKPerformance";
import { TrainingManagement } from "@/features/dashboard/TrainingManagement";
import { FieldVisitMonitoring } from "@/features/dashboard/FieldVisitMonitoring";
import { AssetsMachinery } from "@/features/dashboard/AssetsMachinery";
import { HubFacilityPerformance } from "@/features/dashboard/HubFacilityPerformance";
import { Form1Collection } from "@/features/forms/Form1Collection";
import { Form2StockTransfer } from "@/features/forms/Form2StockTransfer";
import { Form3Processing } from "@/features/forms/Form3Processing";
import { Form4SalesEntry } from "@/features/forms/Form4SalesEntry";
import { Form8MachineryUtilisation } from "@/features/forms/Form8MachineryUtilisation";
import { Form10FundUtilisation } from "@/features/forms/Form10FundUtilisation";
import { Form12FieldVisit } from "@/features/forms/Form12FieldVisit";
import { FormsHub } from "@/features/forms/FormsHub";
import { APMFormCreation } from "@/features/forms/APMFormCreation";
import { RequestTracking } from "@/features/requests/RequestTracking";
import { MDADashboard } from "@/features/mda/MDADashboard";
import { BeneficiaryManagement } from "@/features/mda/BeneficiaryManagement";
import { UserManagement } from "@/features/mda/UserManagement";
import { VDVKRegistration } from "@/features/mda/VDVKRegistration";
import { CommodityRateManagement } from "@/features/mda/CommodityRateManagement";
import { GradeExpCustomerMgmt } from "@/features/mda/GradeExpCustomerMgmt";
import { SchemeFacilityMaster } from "@/features/mda/SchemeFacilityMaster";
import { MachineryManagement } from "@/features/mda/MachineryManagement";
import { DataCorrection } from "@/features/mda/DataCorrection";
import { FacilityRegistration } from "@/features/mda/FacilityRegistration";
import { RatesManagement } from "@/features/mda/RatesManagement";
import { ReportsModule } from "@/features/reports/ReportsModule";
import { APMReportsContacts } from "@/features/dashboard/APMReportsContacts";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h2 className="section-heading text-2xl mb-2">{title}</h2>
        <p className="text-sm text-gray-400 uppercase tracking-widest">Coming Soon</p>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <GuestGuard>
        <LoginPage />
      </GuestGuard>
    ),
  },
  {
    path: "/role-selection",
    element: (
      <AuthGuard>
        <RoleSelectionPage />
      </AuthGuard>
    ),
  },
  {
    path: "/",
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "dashboard", element: <DistrictOverview /> },
      { path: "dashboard/vdvk-performance", element: <VDVKPerformancePage /> },
      { path: "dashboard/fund-monitoring", element: (
        <RoleGuard roles={["PO", "APD", "DPM"]}>
          <FundMonitoring />
        </RoleGuard>
      )},
      { path: "dashboard/machinery", element: <AssetsMachinery /> },
      { path: "dashboard/hub-performance", element: <HubFacilityPerformance /> },
      { path: "dashboard/training", element: <TrainingManagement /> },
      { path: "dashboard/field-visits", element: <FieldVisitMonitoring /> },

      { path: "contacts", element: <ContactRepository /> },

      { path: "forms", element: <FormsHub /> },
      { path: "forms/create", element: <APMFormCreation /> },
      { path: "forms/form1", element: <Form1Collection /> },
      { path: "forms/form2", element: <Form2StockTransfer /> },
      { path: "forms/form3", element: <Form3Processing /> },
      { path: "forms/form4", element: <Form4SalesEntry /> },
      { path: "forms/form8", element: <Form8MachineryUtilisation /> },
      { path: "forms/form10", element: <Form10FundUtilisation /> },
      { path: "forms/form12", element: <Form12FieldVisit /> },

      { path: "requests", element: <RequestTracking /> },

      {
        path: "mda",
        element: (
          <RoleGuard roles={["PO", "APD", "DPM", "Admin", "MDA"]}>
            <MDADashboard />
          </RoleGuard>
        ),
      },
      {
        path: "mda/vdvks",
        element: (
          <RoleGuard roles={["PO", "APD", "DPM", "Admin", "MDA"]}>
            <VDVKRegistration />
          </RoleGuard>
        ),
      },
      {
        path: "mda/beneficiaries",
        element: (
          <RoleGuard roles={["PO", "APD", "DPM", "Admin", "MDA"]}>
            <BeneficiaryManagement />
          </RoleGuard>
        ),
      },
      {
        path: "mda/machinery",
        element: (
          <RoleGuard roles={["PO", "APD", "DPM", "Admin", "MDA"]}>
            <MachineryManagement />
          </RoleGuard>
        ),
      },
      {
        path: "mda/facilities",
        element: (
          <RoleGuard roles={["PO", "APD", "DPM", "Admin", "MDA"]}>
            <FacilityRegistration />
          </RoleGuard>
        ),
      },
      {
        path: "mda/commodities",
        element: (
          <RoleGuard roles={["PO", "APD", "DPM", "Admin", "MDA"]}>
            <CommodityRateManagement />
          </RoleGuard>
        ),
      },
      {
        path: "mda/rates",
        element: (
          <RoleGuard roles={["PO", "APD", "DPM", "Admin", "MDA"]}>
            <RatesManagement />
          </RoleGuard>
        ),
      },
      {
        path: "mda/grades",
        element: (
          <RoleGuard roles={["PO", "APD", "DPM", "Admin", "MDA"]}>
            <GradeExpCustomerMgmt />
          </RoleGuard>
        ),
      },
      {
        path: "mda/schemes",
        element: (
          <RoleGuard roles={["PO", "APD", "DPM", "Admin", "MDA"]}>
            <SchemeFacilityMaster />
          </RoleGuard>
        ),
      },
      {
        path: "mda/users",
        element: (
          <RoleGuard roles={["PO", "APD", "DPM", "Admin", "MDA"]}>
            <UserManagement />
          </RoleGuard>
        ),
      },
      {
        path: "mda/data-correction",
        element: (
          <RoleGuard roles={["PO", "APD", "DPM", "Admin", "MDA"]}>
            <DataCorrection />
          </RoleGuard>
        ),
      },

      { path: "reports", element: <ReportsModule /> },
      { path: "reports/apm", element: <APMReportsContacts /> },
    ],
  },
]);
