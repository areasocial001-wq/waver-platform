import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Mail, KeyRound, ArrowRight, Loader2, ArrowLeft, CheckCircle, UserPlus, LogIn } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { toast } from "sonner";

export default function Auth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [signupSent, setSignupSent] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Compila tutti i campi");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Credenziali non valide");
      } else if (error.message.includes("Email not confirmed")) {
        toast.error("Devi confermare la tua email prima di accedere. Controlla la tua casella di posta.");
      } else {
        toast.error(`Errore: ${error.message}`);
      }
    } else {
      toast.success("Accesso effettuato!");
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Compila tutti i campi");
      return;
    }
    if (password.length < 6) {
      toast.error("La password deve avere almeno 6 caratteri");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast.error(`Errore: ${error.message}`);
    } else {
      setSignupSent(true);
      toast.success("Registrazione avvenuta! Controlla la tua email per confermare l'account.");
    }
    setLoading(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error("Inserisci la tua email");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error(`Errore: ${error.message}`);
    } else {
      setResetSent(true);
      toast.success("Email di recupero inviata!");
    }
    setLoading(false);
  };

  const baseTransition = "transition-all duration-700 ease-out";
  const getAnimationClass = (delay: number) =>
    mounted
      ? `opacity-100 translate-y-0 ${baseTransition}`
      : `opacity-0 translate-y-8 ${baseTransition}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background dark relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-hero opacity-50" />
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s", animationDuration: "5s" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className={`text-center mb-8 ${getAnimationClass(0)}`} style={{ transitionDelay: "100ms" }}>
          <div className="inline-flex items-center justify-center gap-3 mb-6">
            <img src={logoImg} alt="AI Production Hub" className="w-16 h-16 rounded-full object-cover shadow-lg shadow-primary/20" />
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            AI Production Hub
          </h1>
          <p className="text-muted-foreground">
            La piattaforma AI per la produzione video professionale
          </p>
        </div>

        {/* Auth Card */}
        <Card className={`bg-card/30 backdrop-blur-xl border-border/50 shadow-2xl ${getAnimationClass(1)}`} style={{ transitionDelay: "200ms" }}>
          {showReset ? (
            <>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-14 h-14 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center mb-4 border border-primary/20">
                  {resetSent ? <CheckCircle className="w-7 h-7 text-green-500" /> : <Mail className="w-7 h-7 text-primary" />}
                </div>
                <CardTitle className="text-xl">{resetSent ? "Email Inviata!" : "Recupera Password"}</CardTitle>
                <CardDescription>
                  {resetSent ? "Controlla la tua casella email per il link di recupero" : "Inserisci la tua email per ricevere il link di reset"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!resetSent ? (
                  <form onSubmit={handlePasswordReset} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="reset-email" type="email" placeholder="email@esempio.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="pl-10 bg-background/50 border-border/50" required />
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg shadow-primary/20" disabled={loading}>
                      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Invio in corso...</> : <>Invia Link di Recupero<ArrowRight className="ml-2 h-4 w-4" /></>}
                    </Button>
                  </form>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Se l'email è associata a un account, riceverai un link per reimpostare la password.</p>
                )}
                <div className="mt-4 text-center">
                  <button type="button" onClick={() => { setShowReset(false); setResetSent(false); }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <ArrowLeft className="h-4 w-4" />Torna al login
                  </button>
                </div>
              </CardContent>
            </>
          ) : signupSent ? (
            <>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-14 h-14 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl flex items-center justify-center mb-4 border border-green-500/20">
                  <CheckCircle className="w-7 h-7 text-green-500" />
                </div>
                <CardTitle className="text-xl">Registrazione Completata!</CardTitle>
                <CardDescription>Controlla la tua email per confermare l'account e iniziare ad usare la piattaforma.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" onClick={() => setSignupSent(false)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />Torna al login
                </Button>
              </CardContent>
            </>
          ) : (
            <Tabs defaultValue="login" className="w-full">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-14 h-14 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center mb-4 border border-primary/20">
                  <Lock className="w-7 h-7 text-primary" />
                </div>
                <TabsList className="grid w-full grid-cols-2 bg-background/50">
                  <TabsTrigger value="login" className="gap-2">
                    <LogIn className="w-4 h-4" />Accedi
                  </TabsTrigger>
                  <TabsTrigger value="register" className="gap-2">
                    <UserPlus className="w-4 h-4" />Registrati
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="pt-4">
                {/* Login Tab */}
                <TabsContent value="login" className="space-y-5 mt-0">
                  <form onSubmit={handleSignIn} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signin-email" type="email" placeholder="email@esempio.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-background/50 border-border/50" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signin-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-background/50 border-border/50" required />
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg shadow-primary/20 group" disabled={loading}>
                      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Accesso in corso...</> : <>Accedi<ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /></>}
                    </Button>
                    <div className="text-center">
                      <button type="button" onClick={() => { setShowReset(true); setResetSent(false); setResetEmail(email); }} className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline">
                        Password dimenticata?
                      </button>
                    </div>
                  </form>
                </TabsContent>

                {/* Register Tab */}
                <TabsContent value="register" className="space-y-5 mt-0">
                  <form onSubmit={handleSignUp} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Nome completo</Label>
                      <div className="relative">
                        <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signup-name" type="text" placeholder="Mario Rossi" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10 bg-background/50 border-border/50" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signup-email" type="email" placeholder="email@esempio.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-background/50 border-border/50" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signup-password" type="password" placeholder="Minimo 6 caratteri" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-background/50 border-border/50" required />
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg shadow-primary/20 group" disabled={loading}>
                      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrazione...</> : <>Crea Account<ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /></>}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Riceverai un'email di conferma per attivare il tuo account.
                    </p>
                  </form>
                </TabsContent>
              </CardContent>
            </Tabs>
          )}
        </Card>

        {/* Feature highlights */}
        <div className={`mt-8 grid grid-cols-3 gap-3 ${getAnimationClass(7)}`} style={{ transitionDelay: "800ms" }}>
          <div className="p-3 rounded-xl bg-card/20 backdrop-blur-sm border border-border/30 text-center hover:border-primary/50 transition-colors duration-300 hover:scale-105">
            <div className="text-lg font-bold text-primary">1080p</div>
            <div className="text-[10px] text-muted-foreground">Ultra HD</div>
          </div>
          <div className="p-3 rounded-xl bg-card/20 backdrop-blur-sm border border-border/30 text-center hover:border-secondary/50 transition-colors duration-300 hover:scale-105">
            <div className="text-lg font-bold text-secondary">AI</div>
            <div className="text-[10px] text-muted-foreground">Powered</div>
          </div>
          <div className="p-3 rounded-xl bg-card/20 backdrop-blur-sm border border-border/30 text-center hover:border-accent/50 transition-colors duration-300 hover:scale-105">
            <div className="text-lg font-bold text-accent">Pro</div>
            <div className="text-[10px] text-muted-foreground">Tools</div>
          </div>
        </div>
      </div>
    </div>
  );
}
