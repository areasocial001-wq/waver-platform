import { TalkingAvatarGenerator } from "@/components/TalkingAvatarGenerator";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Sparkles } from "lucide-react";

export default function TalkingAvatarPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          {/* Page Header - consistent with other pages */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <UserCircle className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Talking Avatar</h1>
              <Badge variant="secondary" className="ml-2">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Powered
              </Badge>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Genera video di personaggi parlanti con lip-sync avanzato e consistenza del personaggio. 
              Crea storie animate con espressioni realistiche e voci personalizzate.
            </p>
          </div>
          
          {/* Main Content */}
          <TalkingAvatarGenerator />
        </main>
      </div>
    </AuthGuard>
  );
}
