import { Navbar } from "@/components/Navbar";
import { AuthGuard } from "@/components/AuthGuard";
import { StoryModeWizard } from "@/components/story-mode/StoryModeWizard";
import { Film, Lock, Sparkles, AlertTriangle, HardDrive, Loader2 } from "lucide-react";
import { useQuotas } from "@/hooks/useQuotas";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const StoryMode = () => {
  const { canUseStoryMode, remainingStoryMode, isStoryModeUnlimited, loading, quota } = useQuotas();
  const navigate = useNavigate();
  const [optimizing, setOptimizing] = useState(false);

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("migrate-base64-scenes", { body: {} });
      if (error) throw error;
      const migrated = data?.migrated ?? [];
      const totals = migrated.reduce(
        (acc: { scenes: number; bytes: number }, r: { scenesMigrated: number; bytesFreed: number }) => ({
          scenes: acc.scenes + (r.scenesMigrated || 0),
          bytes: acc.bytes + (r.bytesFreed || 0),
        }),
        { scenes: 0, bytes: 0 }
      );
      const mb = (totals.bytes / 1024 / 1024).toFixed(1);
      if (totals.scenes === 0) {
        toast.success("Nessun asset da migrare: i tuoi progetti sono già ottimizzati ✨");
      } else {
        toast.success(`✅ Ottimizzati ${totals.scenes} asset · ${mb} MB liberati dal database`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore sconosciuto";
      toast.error(`Ottimizzazione fallita: ${msg}`);
    } finally {
      setOptimizing(false);
    }
  };

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
              Da una semplice descrizione a un video professionale di ~60-80 secondi con narrazione,<br />
              scene generate e montaggio automatico
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
            <>
              {!loading && !isStoryModeUnlimited && remainingStoryMode === 1 && (
                <Alert variant="destructive" className="mb-6 border-yellow-500/50 bg-yellow-500/10 text-yellow-200 [&>svg]:text-yellow-400">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
                    <span>⚠️ Ti rimane <strong>1 solo progetto</strong> Story Mode questo mese. Usalo con saggezza!</span>
                    <Button variant="outline" size="sm" className="border-yellow-500/50 text-yellow-200 hover:bg-yellow-500/20" onClick={() => navigate("/pricing")}>
                      <Sparkles className="w-3 h-3 mr-1" />Upgrade
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <StoryModeWizard />
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
};

export default StoryMode;
