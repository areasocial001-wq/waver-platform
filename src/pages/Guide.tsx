import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Download, BookOpen, Video, Image, Mic, Music, Layout, Wand2,
  Film, FileJson, Gauge, Clapperboard, EyeOff, Settings,
  Shield, Activity, ChevronRight, Sparkles, Layers, Workflow
} from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

interface GuideSection {
  id: string;
  icon: React.ElementType;
  title: string;
  badge?: string;
  description: string;
  steps: string[];
  tips?: string[];
}

const guideSections: GuideSection[] = [
  {
    id: "getting-started",
    icon: BookOpen,
    title: "Primi Passi",
    description: "Crea un account, accedi alla dashboard e inizia a esplorare le funzionalità della piattaforma.",
    steps: [
      "Vai alla pagina di registrazione e crea un account con email o Google.",
      "Conferma il tuo indirizzo email cliccando sul link ricevuto.",
      "Accedi alla dashboard principale dove troverai tutti gli strumenti.",
      "Configura le tue API key nella sezione Impostazioni per sbloccare i provider.",
    ],
    tips: [
      "Tutte le funzionalità della piattaforma sono disponibili gratuitamente in fase di test.",
    ],
  },
  {
    id: "text-to-video",
    icon: Video,
    title: "Generazione Video da Testo",
    description: "Trasforma le tue descrizioni testuali in video con l'AI. Supporta più provider e modelli.",
    steps: [
      "Dalla dashboard, seleziona la modalità 'Text to Video'.",
      "Scrivi un prompt descrittivo nella lingua che preferisci.",
      "Scegli il provider (AIML, Vidu, LTX, Luma, Freepik, ecc.).",
      "Imposta durata, risoluzione e stile desiderato.",
      "Clicca 'Genera' e attendi il completamento.",
      "Scarica o salva il video nella cronologia.",
    ],
    tips: [
      "Usa l'Assistente AI Prompt per migliorare automaticamente i tuoi prompt.",
      "Il Safety Checker verifica che il prompt sia conforme alle linee guida.",
      "Puoi confrontare i risultati di più provider con il Multi-Provider.",
    ],
  },
  {
    id: "image-to-video",
    icon: Image,
    title: "Generazione Video da Immagine",
    description: "Anima le tue immagini statiche trasformandole in video con controllo del movimento.",
    steps: [
      "Seleziona la modalità 'Image to Video' dalla dashboard.",
      "Carica un'immagine sorgente (JPG, PNG, WebP).",
      "Aggiungi un prompt opzionale per guidare l'animazione.",
      "Configura il controllo del movimento (intensità, direzione camera).",
      "Genera il video e confronta con diverse impostazioni.",
    ],
    tips: [
      "Immagini ad alta risoluzione producono risultati migliori.",
      "Il Motion Control Form offre preset per movimenti di camera comuni.",
    ],
  },
  {
    id: "image-generation",
    icon: Sparkles,
    title: "Generazione Immagini",
    description: "Crea immagini con l'AI usando diversi modelli e stili artistici.",
    steps: [
      "Accedi al generatore immagini dalla dashboard.",
      "Scrivi un prompt dettagliato descrivendo l'immagine desiderata.",
      "Scegli il modello e lo stile (realistico, anime, artistico, ecc.).",
      "Imposta la risoluzione e il formato di output.",
      "Usa l'Inpainting Canvas per modificare parti specifiche dell'immagine.",
    ],
    tips: [
      "La Galleria Immagini salva automaticamente tutte le tue generazioni.",
      "Puoi usare le immagini generate come input per Image-to-Video.",
    ],
  },
  {
    id: "storyboard",
    icon: Layout,
    title: "Storyboard Editor",
    description: "Pianifica i tuoi video con lo storyboard visuale. Organizza scene, personaggi e dialoghi.",
    steps: [
      "Vai a 'I miei Storyboard' dalla navigazione.",
      "Crea un nuovo storyboard scegliendo layout e template.",
      "Aggiungi pannelli con descrizioni delle scene.",
      "Usa 'Script to Storyboard' per convertire automaticamente uno script.",
      "Associa personaggi e immagini di riferimento tramite il Character Lock Panel.",
      "Genera i video delle scene direttamente dallo storyboard.",
      "Condividi lo storyboard con link pubblico o protetto da password.",
    ],
    tips: [
      "I template storia offrono strutture narrative predefinite.",
      "Puoi generare batch di video da tutto lo storyboard.",
    ],
  },
  {
    id: "talking-avatar",
    icon: Mic,
    title: "Talking Avatar",
    description: "Crea avatar parlanti con sincronizzazione labiale e voci personalizzate.",
    steps: [
      "Accedi alla sezione Talking Avatar dalla navigazione.",
      "Carica un'immagine del volto o usa un avatar predefinito.",
      "Scrivi il testo del discorso o registra l'audio.",
      "Scegli la voce tra quelle disponibili o usa il Voice Cloning.",
      "Configura la lingua, velocità e emozione della voce.",
      "Genera l'avatar animato e scarica il risultato.",
    ],
    tips: [
      "Supporta batch di avatar per produzioni multiple.",
      "La timeline dedicata permette di montare più clip avatar.",
    ],
  },
  {
    id: "voice-cloning",
    icon: Mic,
    title: "Voice Cloning & TTS",
    description: "Clona la tua voce o genera speech da testo con voci naturali multi-lingua.",
    steps: [
      "Apri la finestra Voice Clone dalla barra di navigazione.",
      "Carica un campione audio della voce da clonare (min. 30 secondi).",
      "Assegna un nome alla voce clonata.",
      "Usa la voce clonata in qualsiasi generazione di Talking Avatar o TTS.",
      "La sezione Audio permette di generare musica e effetti sonori.",
    ],
  },
  {
    id: "timeline-editor",
    icon: Film,
    title: "Timeline Editor",
    description: "Monta i tuoi video con un editor timeline professionale con tracce audio e transizioni.",
    steps: [
      "Accedi al Timeline Editor dalla navigazione.",
      "Trascina i clip video generati sulla timeline.",
      "Aggiungi transizioni tra i clip (dissolve, wipe, zoom, ecc.).",
      "Inserisci tracce audio: musica, voiceover, effetti sonori.",
      "Regola i livelli audio con il mixer e l'equalizzatore.",
      "Esporta il video finale nel formato desiderato.",
    ],
    tips: [
      "L'Audio Mixer permette di bilanciare più tracce contemporaneamente.",
      "Puoi importare video esterni e combinarli con quelli generati.",
    ],
  },
  {
    id: "json2video",
    icon: FileJson,
    title: "JSON2Video Editor",
    description: "Crea video programmaticamente con l'editor JSON avanzato e template riutilizzabili.",
    steps: [
      "Accedi al Video Editor dalla navigazione.",
      "Crea un nuovo progetto o carica un template.",
      "Definisci le clip con immagini, video, testo e audio.",
      "Configura transizioni, sottotitoli e effetti sonori.",
      "Usa il convertitore NL-to-JSON per generare JSON da linguaggio naturale.",
      "Renderizza il progetto e scarica il video finale.",
    ],
    tips: [
      "I template possono essere salvati e riutilizzati.",
      "Il Template Manager permette di organizzare per categoria.",
    ],
  },
  {
    id: "workflow-ai",
    icon: Workflow,
    title: "Workflow AI (Nodi Visuali)",
    description: "Crea pipeline di produzione video con un editor a nodi visuale drag-and-drop.",
    steps: [
      "Accedi alla sezione Freepik Workflow dalla navigazione.",
      "Trascina i nodi sul canvas: immagini, video, audio, upscaler.",
      "Collega i nodi per creare il flusso di lavoro desiderato.",
      "Configura le impostazioni di ogni nodo (prompt, risoluzione, ecc.).",
      "Esegui il workflow per processare l'intera pipeline automaticamente.",
      "Salva il workflow come template per riutilizzarlo.",
    ],
    tips: [
      "Supporta nodi per Freepik, Vidu, LTX, Luma e altri provider.",
      "I workflow possono essere condivisi con altri utenti.",
    ],
  },
  {
    id: "faceless-video",
    icon: EyeOff,
    title: "Faceless Video",
    description: "Genera video automatici per social media senza bisogno di apparire in camera.",
    steps: [
      "Accedi alla sezione Faceless Video.",
      "Scegli il tipo di contenuto (educational, news, storytelling, ecc.).",
      "Inserisci l'argomento o lo script del video.",
      "L'AI genera automaticamente immagini, voiceover e montaggio.",
      "Personalizza il risultato e scarica il video finale.",
    ],
  },
  {
    id: "trailer-generator",
    icon: Clapperboard,
    title: "Trailer Generator",
    description: "Crea trailer cinematografici professionali con template e musica epica.",
    steps: [
      "Accedi al Trailer Generator dalla navigazione.",
      "Seleziona un template di trailer (azione, horror, drama, ecc.).",
      "Carica o genera le scene del trailer.",
      "L'AI suggerisce musica e transizioni appropriate.",
      "Personalizza il montaggio e aggiungi titoli e sottotitoli.",
      "Esporta il trailer in alta qualità.",
    ],
  },
  {
    id: "content-generator",
    icon: Wand2,
    title: "Generatore di Contenuti AI",
    description: "Genera script, descrizioni, prompt e testi per i tuoi progetti video.",
    steps: [
      "Accedi al Content Generator dalla navigazione.",
      "Scegli il tipo di contenuto (script, prompt, descrizione, ecc.).",
      "Inserisci il tema o l'argomento di partenza.",
      "L'AI genera il contenuto in base alle tue indicazioni.",
      "Modifica e raffina il risultato.",
      "Usa il contenuto generato negli altri strumenti della piattaforma.",
    ],
  },
  {
    id: "api-monitoring",
    icon: Activity,
    title: "Monitoraggio API",
    description: "Monitora lo stato, i tempi di risposta e l'affidabilità di tutti i provider configurati.",
    steps: [
      "Accedi all'API Monitoring dalla navigazione.",
      "Visualizza lo stato in tempo reale di tutti i provider.",
      "Configura soglie di allarme personalizzate.",
      "Consulta i grafici di uptime e tempi di risposta.",
      "Abilita le notifiche push per cambiamenti di stato.",
      "Analizza i log dettagliati per diagnosticare problemi.",
    ],
  },
  {
    id: "settings",
    icon: Settings,
    title: "Impostazioni & API Key",
    description: "Configura le API key dei provider, le preferenze e le impostazioni dell'account.",
    steps: [
      "Vai alla pagina Impostazioni dalla navigazione.",
      "Inserisci le API key per i provider che vuoi utilizzare.",
      "Configura il provider predefinito per ogni tipo di generazione.",
      "Imposta le preferenze di notifica (email, push).",
      "Gestisci il tuo profilo e le impostazioni di sicurezza.",
    ],
    tips: [
      "Le API key sono crittografate e salvate in modo sicuro.",
      "Puoi cambiare provider in qualsiasi momento senza perdere i dati.",
    ],
  },
];

const GuidePage = () => {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const handleDownloadPDF = () => {
    window.open("/guide-pdf", "_blank");
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background dark">
      <Navbar />
      <div className="pt-24 pb-12 px-4 md:px-8 max-w-7xl mx-auto">
        {/* Hero */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary font-medium">Documentazione Completa</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Guida alla Piattaforma
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            Tutto ciò che devi sapere per utilizzare al meglio <br />
            tutti gli strumenti di produzione video AI.
          </p>
          <Button onClick={handleDownloadPDF} size="lg" className="gap-2">
            <Download className="h-5 w-5" />
            Scarica PDF
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* Sidebar TOC */}
          <motion.aside
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="hidden lg:block"
          >
            <div className="sticky top-28">
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Indice
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-220px)]">
                    <nav className="space-y-0.5 px-4 pb-4">
                      {guideSections.map((section) => {
                        const Icon = section.icon;
                        return (
                          <button
                            key={section.id}
                            onClick={() => scrollToSection(section.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left ${
                              activeSection === section.id
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            }`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{section.title}</span>
                            {section.badge && (
                              <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                                {section.badge}
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </nav>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </motion.aside>

          {/* Main content */}
          <main className="space-y-6">
            <Accordion
              type="multiple"
              defaultValue={["getting-started"]}
              className="space-y-4"
            >
              {guideSections.map((section, i) => {
                const Icon = section.icon;
                return (
                  <motion.div
                    key={section.id}
                    id={section.id}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.03 } },
                    }}
                  >
                    <AccordionItem value={section.id} className="border border-border/50 rounded-lg bg-card/50 backdrop-blur-sm overflow-hidden">
                      <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 text-left">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-base">{section.title}</span>
                              {section.badge && (
                                <Badge variant="secondary" className="text-[10px]">{section.badge}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6">
                        <div className="space-y-4 pt-2">
                          <div>
                            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                              <Layers className="h-4 w-4 text-primary" />
                              Passaggi
                            </h4>
                            <ol className="space-y-2">
                              {section.steps.map((step, si) => (
                                <li key={si} className="flex items-start gap-3">
                                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                                    {si + 1}
                                  </span>
                                  <span className="text-sm text-muted-foreground">{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                          {section.tips && section.tips.length > 0 && (
                            <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                              <h4 className="text-sm font-semibold text-accent mb-2 flex items-center gap-2">
                                <Sparkles className="h-4 w-4" />
                                Suggerimenti
                              </h4>
                              <ul className="space-y-1.5">
                                {section.tips.map((tip, ti) => (
                                  <li key={ti} className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <ChevronRight className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                                    {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </motion.div>
                );
              })}
            </Accordion>
          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default GuidePage;
