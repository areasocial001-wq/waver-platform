import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { Dashboard } from "@/components/Dashboard";
import { UnifiedPromptBar } from "@/components/UnifiedPromptBar";
import { GenerateSection } from "@/components/GenerateSection";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background dark">
        <Navbar />
        <Dashboard />
        <UnifiedPromptBar />
        <GenerateSection />
        <Footer />
      </div>
    </AuthGuard>
  );
};

export default Index;
