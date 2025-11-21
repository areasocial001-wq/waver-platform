import { Hero } from "@/components/Hero";
import { GenerateSection } from "@/components/GenerateSection";
import { HowItWorks } from "@/components/HowItWorks";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background dark">
      <Hero />
      <GenerateSection />
      <HowItWorks />
      <Footer />
    </div>
  );
};

export default Index;
