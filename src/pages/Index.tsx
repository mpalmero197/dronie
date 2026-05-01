import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import VerticalsSection from "@/components/VerticalsSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import PricingSection from "@/components/PricingSection";
import SplatHighlightSection from "@/components/SplatHighlightSection";
import FooterSection from "@/components/FooterSection";
import { useEffect } from "react";

export default function Index() {
  useEffect(() => {
    document.title = "Fast Drone Photogrammetry Software | Dronieapp";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", "Process drone imagery into orthomosaics, 3D point clouds, DSMs, and contour maps faster and cheaper than DroneDeploy or Maps Made Easy. Start free — no install required.");
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <VerticalsSection />
        <HowItWorksSection />
        <SplatHighlightSection />
        <PricingSection />
      </main>
      <FooterSection />
    </div>
  );
}
