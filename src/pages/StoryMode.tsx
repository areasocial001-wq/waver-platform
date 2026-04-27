import { Navbar } from "@/components/Navbar";
import { AuthGuard } from "@/components/AuthGuard";
import { StoryModeWizard } from "@/components/story-mode/StoryModeWizard";
import { Film, HardDrive, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const StoryMode = () => {
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
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Crea un Video Completo con l'AI
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Da una semplice descrizione a un video professionale di ~60-80 secondi con narrazione,<br />
              scene generate e montaggio automatico
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOptimize}
                disabled={optimizing}
                className="gap-2"
              >
                {optimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
                {optimizing ? "Ottimizzazione in corso..." : "Ottimizza spazio progetti"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/story-mode/voice-test")}
                className="gap-2"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Voice Test
              </Button>
            </div>
          </div>

          <StoryModeWizard />
        </main>
      </div>
    </AuthGuard>
  );
};

export default StoryMode;
