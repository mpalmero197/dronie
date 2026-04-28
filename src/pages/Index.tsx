import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import VerticalsSection from "@/components/VerticalsSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import PricingSection from "@/components/PricingSection";
import FooterSection from "@/components/FooterSection";

export default function Index() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <VerticalsSection />
      <HowItWorksSection />
      <PricingSection />
      <FooterSection />
    </div>
  );
}
