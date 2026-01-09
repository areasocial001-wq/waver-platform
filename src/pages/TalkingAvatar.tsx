import { TalkingAvatarGenerator } from "@/components/TalkingAvatarGenerator";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";

export default function TalkingAvatarPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Talking Avatar</h1>
            <p className="text-muted-foreground">
              Genera video di personaggi parlanti con lip-sync e consistenza del personaggio
            </p>
          </div>
          <TalkingAvatarGenerator />
        </div>
      </div>
    </AuthGuard>
  );
}
