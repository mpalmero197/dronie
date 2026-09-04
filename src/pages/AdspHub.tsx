import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Activity, Radar, ShieldCheck, Layers } from "lucide-react";
import AppShell from "@/components/shell/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import ServiceCatalog from "@/components/adsp/ServiceCatalog";
import DeconflictionPanel from "@/components/adsp/DeconflictionPanel";
import ConformancePanel from "@/components/adsp/ConformancePanel";
import ProviderCompliance from "@/components/adsp/ProviderCompliance";

export default function AdspHub() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  return (
    <>
      <Helmet>
        <title>Automated Data Services | Dronie ADSP</title>
        <meta
          name="description"
          content="Strategic deconfliction, conformance monitoring, terrain, aeronautical and weather data services for drone operations, with the published performance and evidence records a Part 146 automated data service provider must keep."
        />
        <link rel="canonical" href="https://dronieapp.com/adsp" />
        <meta property="og:title" content="Automated Data Services | Dronie ADSP" />
        <meta property="og:description" content="Deconflict your operating volume, monitor conformance in flight, and keep an auditable evidence trail." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://dronieapp.com/adsp" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <AppShell
        title="Automated Data Services"
        subtitle="Deconfliction, conformance, terrain, aeronautical and weather services with a full evidence trail"
      >
        <main className="p-4 sm:p-6 space-y-6">
          <Tabs defaultValue="deconflict">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="deconflict" className="gap-1.5"><Radar className="w-4 h-4" /> Deconfliction</TabsTrigger>
              <TabsTrigger value="conformance" className="gap-1.5"><Activity className="w-4 h-4" /> Conformance</TabsTrigger>
              <TabsTrigger value="catalog" className="gap-1.5"><Layers className="w-4 h-4" /> Services</TabsTrigger>
              <TabsTrigger value="compliance" className="gap-1.5"><ShieldCheck className="w-4 h-4" /> Compliance</TabsTrigger>
            </TabsList>

            <TabsContent value="deconflict" className="mt-5"><DeconflictionPanel /></TabsContent>
            <TabsContent value="conformance" className="mt-5"><ConformancePanel /></TabsContent>
            <TabsContent value="catalog" className="mt-5"><ServiceCatalog /></TabsContent>
            <TabsContent value="compliance" className="mt-5"><ProviderCompliance /></TabsContent>
          </Tabs>
        </main>
      </AppShell>
    </>
  );
}
