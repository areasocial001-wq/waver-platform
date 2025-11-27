import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { ContentGenerator as ContentGeneratorComponent } from "@/components/ContentGenerator";
import { Footer } from "@/components/Footer";

const ContentGenerator = () => {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background dark">
        <Navbar />
        <div className="pt-24">
          <ContentGeneratorComponent />
        </div>
        <Footer />
      </div>
    </AuthGuard>
  );
};

export default ContentGenerator;
