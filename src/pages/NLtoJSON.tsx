import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { NLtoJSONConverter } from "@/components/NLtoJSONConverter";

const NLtoJSON = () => {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background dark">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <NLtoJSONConverter />
        </div>
        <Footer />
      </div>
    </AuthGuard>
  );
};

export default NLtoJSON;
