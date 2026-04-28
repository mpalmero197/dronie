import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import MapViewer from "./pages/MapViewer.tsx";
import AdminPanel from "./pages/AdminPanel.tsx";
import ProjectDetail from "./pages/ProjectDetail.tsx";
import Gallery from "./pages/Gallery.tsx";
import FleetManagement from "./pages/FleetManagement.tsx";
import ActiveJobs from "./pages/ActiveJobs.tsx";
import PilotCompanion from "./pages/PilotCompanion.tsx";
import Install from "./pages/Install.tsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.tsx";
import TermsOfService from "./pages/TermsOfService.tsx";
import CookieConsent from "./components/CookieConsent.tsx";
import Subscription from "./pages/Subscription.tsx";
import NotFound from "./pages/NotFound.tsx";
import PlanWizard from "./pages/PlanWizard.tsx";
import SavedMissions from "./pages/SavedMissions.tsx";
import Workflow from "./pages/Workflow.tsx";
import SwarmOrchestration from "./pages/SwarmOrchestration.tsx";
import RealityCapture from "./pages/RealityCapture.tsx";
import RtkAlignment from "./pages/RtkAlignment.tsx";
import AiInsights from "./pages/AiInsights.tsx";
import Compliance from "./pages/Compliance.tsx";
import GaussianSplats from "./pages/GaussianSplats.tsx";
import PortfolioStudio from "./pages/PortfolioStudio.tsx";
import PublicPortfolio from "./pages/PublicPortfolio.tsx";
import Marketplace from "./pages/Marketplace.tsx";
import MarketplaceNew from "./pages/MarketplaceNew.tsx";
import MarketplaceDetail from "./pages/MarketplaceDetail.tsx";
import MarketplaceInbox from "./pages/MarketplaceInbox.tsx";
import VerticalLanding from "./pages/solutions/VerticalLanding.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/viewer/:projectId" element={<MapViewer />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/project/:projectId" element={<ProjectDetail />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/fleet" element={<FleetManagement />} />
            <Route path="/jobs" element={<ActiveJobs />} />
            <Route path="/jobs/:jobId/fly" element={<PilotCompanion />} />
            <Route path="/install" element={<Install />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/plan" element={<PlanWizard />} />
            <Route path="/missions" element={<SavedMissions />} />
            <Route path="/workflow" element={<Workflow />} />
            <Route path="/swarm" element={<SwarmOrchestration />} />
            <Route path="/reality" element={<RealityCapture />} />
            <Route path="/rtk" element={<RtkAlignment />} />
            <Route path="/insights" element={<AiInsights />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/splats" element={<GaussianSplats />} />
            <Route path="/portfolio" element={<PortfolioStudio />} />
            <Route path="/u/:username" element={<PublicPortfolio mode="home" />} />
            <Route path="/u/:username/photos" element={<PublicPortfolio mode="photos" />} />
            <Route path="/u/:username/videos" element={<PublicPortfolio mode="videos" />} />
            <Route path="/u/:username/album/:slug" element={<PublicPortfolio mode="album" />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/marketplace/new" element={<MarketplaceNew />} />
            <Route path="/marketplace/inbox" element={<MarketplaceInbox />} />
            <Route path="/marketplace/:id" element={<MarketplaceDetail />} />
            <Route path="/solutions/:vertical" element={<VerticalLanding />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <CookieConsent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
