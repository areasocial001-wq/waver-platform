import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { ContentGenerator as ContentGeneratorComponent } from "@/components/ContentGenerator";
import { PremiumGate } from "@/components/PremiumGate";
import { Footer } from "@/components/Footer";

const ContentGenerator = () => {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background dark">
        <Navbar />
        <div className="pt-24">
          <PremiumGate featureName="AI Content Generator">
            <ContentGeneratorComponent />
          </PremiumGate>
        </div>
        <Footer />
      </div>
    </AuthGuard>
  );
};

export default ContentGenerator;
