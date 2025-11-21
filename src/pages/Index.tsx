import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { GenerateSection } from "@/components/GenerateSection";
import { HowItWorks } from "@/components/HowItWorks";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background dark">
        <Navbar />
        <Hero />
        <GenerateSection />
        <HowItWorks />
        <Footer />
      </div>
    </AuthGuard>
  );
};

export default Index;
