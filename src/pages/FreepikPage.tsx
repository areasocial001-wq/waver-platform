import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { FreepikTools } from "@/components/FreepikTools";
import { PremiumGate } from "@/components/PremiumGate";
import { Footer } from "@/components/Footer";

const FreepikPage = () => {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background dark">
        <Navbar />
        <div className="pt-24 pb-12 px-4 md:px-8 max-w-6xl mx-auto">
          <PremiumGate featureName="Freepik Tools">
            <FreepikTools />
          </PremiumGate>
        </div>
        <Footer />
      </div>
    </AuthGuard>
  );
};

export default FreepikPage;
