import { Navbar } from "@/components/Navbar";
import { AuthGuard } from "@/components/AuthGuard";
import { StoryModeWizard } from "@/components/story-mode/StoryModeWizard";
import { Film, Lock, Sparkles } from "lucide-react";
import { useQuotas } from "@/hooks/useQuotas";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const StoryMode = () => {
  const { canUseStoryMode, remainingStoryMode, isStoryModeUnlimited, loading, quota } = useQuotas();
  const navigate = useNavigate();

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Film className="w-4 h-4" />
              Story Mode
              {!loading && !isStoryModeUnlimited && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {remainingStoryMode}/{quota.max_story_mode_monthly} rimasti
                </Badge>
              )}
              {!loading && isStoryModeUnlimited && (
                <Badge variant="secondary" className="ml-1 text-xs">∞ Illimitato</Badge>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Crea un Video Completo con l'AI
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Da una semplice descrizione a un video professionale di ~60-80 secondi con narrazione, scene generate e montaggio automatico
            </p>
          </div>

          {!loading && !canUseStoryMode ? (
            <div className="flex flex-col items-center justify-center py-16 gap-6">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <Lock className="w-10 h-10 text-destructive" />
              </div>
              <div className="text-center max-w-md">
                <h2 className="text-xl font-semibold mb-2">Limite Story Mode raggiunto</h2>
                <p className="text-muted-foreground mb-1">
                  Hai utilizzato tutti i {quota.max_story_mode_monthly} progetti Story Mode disponibili questo mese.
                </p>
                <p className="text-muted-foreground text-sm">
                  Passa a un piano superiore per ottenere più progetti mensili.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-sm">
                <div className="border rounded-lg p-3">
                  <p className="font-medium">Premium</p>
                  <p className="text-primary font-bold">5/mese</p>
                </div>
                <div className="border rounded-lg p-3 ring-2 ring-primary">
                  <p className="font-medium">Creator</p>
                  <p className="text-primary font-bold">15/mese</p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="font-medium">Business</p>
                  <p className="text-primary font-bold">∞ Illimitato</p>
                </div>
              </div>
              <Button onClick={() => navigate("/pricing")} className="gap-2">
                <Sparkles className="w-4 h-4" />
                Vedi i Piani
              </Button>
            </div>
          ) : (
            <StoryModeWizard />
          )}
        </main>
      </div>
    </AuthGuard>
  );
};

export default StoryMode;
