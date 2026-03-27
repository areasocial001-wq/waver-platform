import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Video, Wand2, Mic, Layout, Zap, ArrowRight, CheckCircle2 } from "lucide-react";

const features = [
  {
    icon: Video,
    title: "Generazione Video AI",
    description: "Crea video professionali da testo o immagini con i migliori modelli AI sul mercato.",
  },
  {
    icon: Layout,
    title: "Storyboard Intelligenti",
    description: "Organizza le tue scene con storyboard interattivi e converti in video con un click.",
  },
  {
    icon: Wand2,
    title: "Editing Avanzato",
    description: "Timeline editor, transizioni, effetti e sottotitoli automatici per un risultato professionale.",
  },
  {
    icon: Mic,
    title: "Audio & Voiceover",
    description: "Clonazione vocale, text-to-speech, musica AI e mixing audio integrato.",
  },
];

const plans = [
  {
    name: "Free",
    price: "€0",
    period: "/mese",
    features: ["5 generazioni video/mese", "Risoluzione 720p", "1 progetto storyboard", "Supporto community"],
    cta: "Inizia Gratis",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "€29",
    period: "/mese",
    features: ["50 generazioni video/mese", "Risoluzione Full HD", "Storyboard illimitati", "Clonazione vocale", "Timeline editor", "Supporto prioritario"],
    cta: "Prova Pro",
    highlighted: true,
  },
  {
    name: "Business",
    price: "€79",
    period: "/mese",
    features: ["200 generazioni video/mese", "Risoluzione 4K", "Tutto di Pro +", "API access", "Multi-provider", "Account manager dedicato"],
    cta: "Contattaci",
    highlighted: false,
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold">AI Production Hub</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Accedi
            </Button>
            <Button onClick={() => navigate("/auth")}>
              Registrati
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            La piattaforma AI per la produzione video
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Crea Video Professionali con l'
            <span className="text-primary">Intelligenza Artificiale</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Genera, edita e produci video straordinari utilizzando i migliori modelli AI. 
            Dalla sceneggiatura al video finale, tutto in un'unica piattaforma.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8">
              Inizia Gratuitamente
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => {
              document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
            }} className="text-lg px-8">
              Scopri le Funzionalità
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Tutto ciò che ti serve per produrre video AI</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Una suite completa di strumenti AI per ogni fase della produzione video.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="bg-card rounded-xl p-6 border border-border hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Piani e Prezzi</h2>
            <p className="text-muted-foreground text-lg">Scegli il piano più adatto alle tue esigenze</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl p-8 border ${
                  plan.highlighted
                    ? "border-primary bg-primary/5 shadow-lg scale-105"
                    : "border-border bg-card"
                }`}
              >
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                  onClick={() => navigate("/auth")}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">AI Production Hub</span>
          </div>
          <p>© {new Date().getFullYear()} AI Production Hub. Tutti i diritti riservati.</p>
        </div>
      </footer>
    </div>
  );
}
