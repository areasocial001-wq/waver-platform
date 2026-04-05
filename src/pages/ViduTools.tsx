import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { ViduAdvancedTools } from "@/components/ViduAdvancedTools";
import { PremiumGate } from "@/components/PremiumGate";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Video } from "lucide-react";

export default function ViduToolsPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background dark">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-teal-500/10">
                <Video className="w-6 h-6 text-teal-500" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Vidu Advanced</h1>
              <Badge variant="secondary" className="ml-2">
                <Sparkles className="w-3 h-3 mr-1" />
                Pro Tools
              </Badge>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Strumenti avanzati Vidu: Reference to Video, Start-End interpolation, Lip Sync e Upscale.
            </p>
          </div>
          
          <ViduAdvancedTools />
        </main>
      </div>
    </AuthGuard>
  );
}
