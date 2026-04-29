import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Lock } from "lucide-react";
import logoImg from "@/assets/logo.png";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <img
          src={logoImg}
          alt="AI Production Hub"
          className="w-24 h-24 mx-auto rounded-full object-cover ring-1 ring-border"
        />

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground border border-border rounded-full px-3 py-1">
            <Lock className="w-3 h-3" />
            Test environment · accesso riservato
          </div>
          <h1 className="text-3xl font-bold tracking-tight">AI Production Hub</h1>
          <p className="text-sm text-muted-foreground">
            Ambiente di test interno. Effettua l'accesso per continuare.
          </p>
        </div>

        <Button
          size="lg"
          className="w-full gap-2"
          onClick={() => navigate("/auth")}
        >
          Accedi
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
