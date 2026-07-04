import Navbar from "@/components/Navbar";
import { Helmet } from "react-helmet-async";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import VerticalsSection from "@/components/VerticalsSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import PricingSection from "@/components/PricingSection";
import DoneForYouSection from "@/components/DoneForYouSection";
import SplatHighlightSection from "@/components/SplatHighlightSection";
import AboutContentSection from "@/components/AboutContentSection";
import PhotogrammetryGuideSection from "@/components/PhotogrammetryGuideSection";
import FaqSection from "@/components/FaqSection";
import FooterSection from "@/components/FooterSection";
import { useEffect } from "react";

export default function Index() {
  useEffect(() => {
    document.title = "Fast Drone Photogrammetry Software | Dronieapp";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", "Turn drone imagery into orthomosaics, 3D point clouds, DSMs, and contour maps. Faster and cheaper than DroneDeploy. Start free.");
  }, []);

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Fast Drone Photogrammetry Software | Dronieapp</title>
        <meta name="description" content="Turn drone imagery into orthomosaics, 3D point clouds, DSMs, and contour maps. Faster and cheaper than DroneDeploy. Start free." />
        <link rel="canonical" href="https://dronieapp.com/" />
        <meta property="og:url" content="https://dronieapp.com/" />
        <meta property="og:title" content="Fast Drone Photogrammetry Software | Dronieapp" />
        <meta property="og:description" content="Turn drone imagery into orthomosaics, 3D point clouds, DSMs, and contour maps. Faster and cheaper than DroneDeploy. Start free." />
      </Helmet>
      <Navbar />
      <main>
        <HeroSection />
        <AboutContentSection />
        <FeaturesSection />
        <VerticalsSection />
        <HowItWorksSection />
        <PhotogrammetryGuideSection />
        <SplatHighlightSection />
        <DoneForYouSection />
        <PricingSection />
        <FaqSection />
      </main>
      <FooterSection />
    </div>
  );
}
