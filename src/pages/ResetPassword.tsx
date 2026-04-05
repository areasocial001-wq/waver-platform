import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, KeyRound, ArrowRight, Loader2, CheckCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    // Check URL hash for recovery token
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast.error("Compila tutti i campi");
      return;
    }
    if (password.length < 6) {
      toast.error("La password deve avere almeno 6 caratteri");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Le password non coincidono");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(`Errore: ${error.message}`);
    } else {
      setSuccess(true);
      toast.success("Password aggiornata con successo!");
      setTimeout(() => navigate("/"), 3000);
    }
    setLoading(false);
  };

  const baseTransition = "transition-all duration-700 ease-out";
  const animClass = mounted ? `opacity-100 translate-y-0 ${baseTransition}` : `opacity-0 translate-y-8 ${baseTransition}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background dark relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-hero opacity-50" />
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s", animationDuration: "5s" }} />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className={`text-center mb-8 ${animClass}`} style={{ transitionDelay: "100ms" }}>
          <div className="inline-flex items-center justify-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-sm border border-primary/20">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Reimposta Password
          </h1>
        </div>

        <Card className={`bg-card/30 backdrop-blur-xl border-border/50 shadow-2xl ${animClass}`} style={{ transitionDelay: "200ms" }}>
          {success ? (
            <>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-14 h-14 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl flex items-center justify-center mb-4 border border-green-500/20">
                  <CheckCircle className="w-7 h-7 text-green-500" />
                </div>
                <CardTitle className="text-xl">Password Aggiornata!</CardTitle>
                <CardDescription>Verrai reindirizzato alla dashboard tra pochi secondi...</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate("/")}>
                  Vai alla Dashboard
                </Button>
              </CardContent>
            </>
          ) : !isRecovery ? (
            <>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-14 h-14 bg-gradient-to-br from-destructive/20 to-destructive/10 rounded-2xl flex items-center justify-center mb-4 border border-destructive/20">
                  <ShieldCheck className="w-7 h-7 text-destructive" />
                </div>
                <CardTitle className="text-xl">Link non valido</CardTitle>
                <CardDescription>Questo link di recupero non è valido o è scaduto. Richiedi un nuovo link dalla pagina di login.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" onClick={() => navigate("/auth")}>
                  Torna al Login
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-14 h-14 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center mb-4 border border-primary/20">
                  <KeyRound className="w-7 h-7 text-primary" />
                </div>
                <CardTitle className="text-xl">Nuova Password</CardTitle>
                <CardDescription>Inserisci la tua nuova password</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nuova Password</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="new-password" type="password" placeholder="Minimo 6 caratteri" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-background/50 border-border/50" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Conferma Password</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="confirm-password" type="password" placeholder="Ripeti la password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 bg-background/50 border-border/50" required />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg shadow-primary/20 group" disabled={loading}>
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aggiornamento...</> : <>Aggiorna Password<ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /></>}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
