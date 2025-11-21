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
      title: "2. Scegli il Metodo",
      description: "Waver è open source: puoi hostarlo tu stesso, usare servizi di terze parti, o attendere API future.",
      color: "text-secondary",
    },
    {
      icon: Zap,
      title: "3. Genera il Video",
      description: "Usa i parametri configurati con il tuo metodo scelto per generare il video!",
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

        <Card className="border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-accent" />
              Come Usare Waver
            </CardTitle>
            <CardDescription className="text-base">
              Waver è un modello open source. Ecco le tue opzioni per utilizzarlo:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <h4 className="font-semibold mb-2">🖥️ Self-Hosting</h4>
                <p className="text-sm text-muted-foreground">
                  Scarica e installa Waver sul tuo server seguendo le istruzioni su GitHub. Richiede GPU potente.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <h4 className="font-semibold mb-2">🌐 Servizi di Terze Parti</h4>
                <p className="text-sm text-muted-foreground">
                  Alcuni provider potrebbero offrire Waver come servizio API. Cerca "Waver API" online.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <h4 className="font-semibold mb-2">🔮 API Ufficiale (In Arrivo)</h4>
                <p className="text-sm text-muted-foreground">
                  ByteDance potrebbe rilasciare un'API ufficiale in futuro. Resta aggiornato sul repository GitHub.
                </p>
              </div>
            </div>
            <Button 
              size="lg"
              className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow-primary transition-all duration-300"
              onClick={() => window.open("https://github.com/FoundationVision/Waver", "_blank")}
            >
              Visita GitHub Ufficiale
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
