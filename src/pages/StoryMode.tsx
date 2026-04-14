import { Navbar } from "@/components/Navbar";
import { AuthGuard } from "@/components/AuthGuard";
import { StoryModeWizard } from "@/components/story-mode/StoryModeWizard";
import { Film } from "lucide-react";

const StoryMode = () => {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Film className="w-4 h-4" />
              Story Mode
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Crea un Video Completo con l'AI
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Da una semplice descrizione a un video professionale di ~60-80 secondi con narrazione, scene generate e montaggio automatico
            </p>
          </div>
          <StoryModeWizard />
        </main>
      </div>
    </AuthGuard>
  );
};

export default StoryMode;
