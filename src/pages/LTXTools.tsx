import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { LTXAdvancedTools } from "@/components/LTXAdvancedTools";
import { PremiumGate } from "@/components/PremiumGate";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Video } from "lucide-react";

export default function LTXToolsPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background dark">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Video className="w-6 h-6 text-orange-500" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">LTX Video Advanced</h1>
              <Badge variant="secondary" className="ml-2">
                <Sparkles className="w-3 h-3 mr-1" />
                Pro Tools
              </Badge>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Strumenti avanzati LTX Video: Audio-to-Video con sincronizzazione audio, Retake parziale e Extend video.
            </p>
          </div>
          
          <LTXAdvancedTools />
        </main>
      </div>
    </AuthGuard>
  );
}
