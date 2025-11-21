import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Settings, Zap, ExternalLink } from "lucide-react";

export const HowItWorks = () => {
  const steps = [
    {
      icon: Settings,
      title: "1. Prepara i Parametri",
      description: "Usa questa piattaforma per configurare tutti i parametri del tuo video: prompt, durata, risoluzione e stile.",
      color: "text-primary",
    },
    {
      icon: MessageSquare,
      title: "2. Vai su Discord",
      description: "Unisciti al server Discord di Waver e accedi al bot ufficiale per la generazione dei video.",
      color: "text-secondary",
    },
    {
      icon: Zap,
      title: "3. Genera il Video",
      description: "Usa il comando del bot con i parametri che hai configurato e ricevi il tuo video in pochi minuti!",
      color: "text-accent",
    },
  ];

  return (
    <section className="py-20 px-6 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Come Funziona
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Processo semplice in 3 passi per creare i tuoi video con Waver
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card key={index} className="border-border/50 bg-card/50 backdrop-blur-sm shadow-soft hover:shadow-glow-primary transition-all duration-300">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center mb-4 ${step.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-xl">{step.title}</CardTitle>
                  <CardDescription className="text-base">{step.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-primary" />
              Accedi al Bot Discord di Waver
            </CardTitle>
            <CardDescription className="text-base">
              Il bot Discord ufficiale di Waver è il modo più semplice per generare i tuoi video. 
              Unisciti alla community e inizia subito!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              size="lg"
              className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow-primary transition-all duration-300"
              onClick={() => window.open("http://opensource.bytedance.com/discord/invite", "_blank")}
            >
              Unisciti a Discord
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        <div className="mt-12 p-6 rounded-lg bg-muted/20 border border-border/50">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" />
            Comandi Discord Utili
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <code className="px-2 py-1 rounded bg-muted text-foreground">/generate</code>
              <span className="text-muted-foreground">Genera un video da testo</span>
            </div>
            <div className="flex items-start gap-2">
              <code className="px-2 py-1 rounded bg-muted text-foreground">/image-to-video</code>
              <span className="text-muted-foreground">Genera un video da immagine</span>
            </div>
            <div className="flex items-start gap-2">
              <code className="px-2 py-1 rounded bg-muted text-foreground">/help</code>
              <span className="text-muted-foreground">Mostra tutti i comandi disponibili</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
