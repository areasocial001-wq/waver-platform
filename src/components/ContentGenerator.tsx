import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Copy, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";

const TEMPLATES = {
  instagram: [
    {
      title: "Post Motivazionale",
      description: "Post ispiratore per Instagram",
      prompt: "Crea un post motivazionale per Instagram con:\n- Un'apertura che cattura l'attenzione\n- Un messaggio ispiratore e positivo\n- 3-5 emoji pertinenti\n- 3-5 hashtag rilevanti\n- Call-to-action finale\n\nTema: [inserisci tema]"
    },
    {
      title: "Carosello Educativo",
      description: "Carosello multi-slide informativo",
      prompt: "Crea il contenuto per un carosello Instagram educativo su [argomento]:\n\nSlide 1 (Copertina): Titolo accattivante con emoji\nSlide 2-5: 4 punti chiave, uno per slide\nSlide 6: Recap con CTA\n\nIncludi emoji e mantieni testo breve e leggibile."
    },
    {
      title: "Promozione Prodotto",
      description: "Post per lanciare un prodotto",
      prompt: "Crea un post Instagram per promuovere [nome prodotto]:\n- Hook iniziale coinvolgente\n- 3 benefici principali\n- Prova sociale o testimonianza\n- Offerta speciale (se applicabile)\n- CTA chiara\n- Hashtag strategici"
    },
    {
      title: "Storia Personale",
      description: "Storytelling autentico",
      prompt: "Scrivi una storia personale per Instagram su [tema/esperienza]:\n- Inizia con un momento chiave\n- Sviluppa la storia con dettagli emotivi\n- Condividi la lezione appresa\n- Connetti con il pubblico\n- Emoji per umanizzare\n- CTA conversazionale"
    }
  ],
  twitter: [
    {
      title: "Thread Educativo",
      description: "Thread informativo multi-tweet",
      prompt: "Crea un thread Twitter educativo su [argomento]:\n\nTweet 1: Hook potente + promessa di valore\nTweet 2-7: 6 punti chiave, uno per tweet\nTweet finale: Riepilogo + CTA (follow, RT)\n\nMantieni ogni tweet sotto 280 caratteri e usa emoji."
    },
    {
      title: "Hot Take",
      description: "Opinione controversa ma argomentata",
      prompt: "Scrivi un hot take su [tema]:\n- Affermazione forte e controversa\n- 2-3 argomenti a supporto\n- Anticipa obiezioni\n- Conclusione che stimola discussione\n\nMax 280 caratteri per tweet, usa emoji strategicamente."
    },
    {
      title: "Mini Case Study",
      description: "Risultati concreti in formato thread",
      prompt: "Crea un mini case study Twitter su [progetto/risultato]:\n\nTweet 1: Risultato impressionante + context\nTweet 2: Situazione iniziale\nTweet 3-5: 3 strategie chiave applicate\nTweet 6: Risultati finali + metrica\nTweet 7: Takeaway + CTA"
    },
    {
      title: "Lista Curata",
      description: "Lista di risorse/strumenti utili",
      prompt: "Crea una lista Twitter di [numero] [strumenti/risorse] per [obiettivo]:\n\nTweet 1: Introduzione accattivante\nTweet 2-N: Un elemento per tweet con:\n  • Nome\n  • Breve descrizione\n  • Perché è utile\nTweet finale: Bonus tip + CTA"
    }
  ],
  blog: [
    {
      title: "Guida Completa",
      description: "Tutorial approfondito passo-passo",
      prompt: "Scrivi una guida completa su [argomento]:\n\n1. Introduzione accattivante con problema/opportunità\n2. Cosa imparerai (bullet points)\n3. 5-7 sezioni principali con:\n   - Sottotitolo chiaro\n   - Spiegazione dettagliata\n   - Esempi pratici\n4. Conclusione con recap\n5. Call-to-action\n\nOttimizzato SEO, 1500-2000 parole."
    },
    {
      title: "Listicle",
      description: "Articolo in formato lista",
      prompt: "Crea un articolo \"I migliori [numero] [cosa] per [obiettivo]\":\n\n• Intro: Perché questo elenco è utile\n• [Numero] elementi, ognuno con:\n  - Titolo\n  - Descrizione (150-200 parole)\n  - Pro e contro\n  - Quando usarlo\n• Conclusione: Come scegliere\n• Meta description ottimizzata"
    },
    {
      title: "Articolo Problema-Soluzione",
      description: "Identifica problema e offri soluzione",
      prompt: "Scrivi un articolo problema-soluzione su [tema]:\n\n1. Titolo accattivante con keyword\n2. Intro: Descrivi il problema comune\n3. Perché è importante risolverlo\n4. Soluzione dettagliata in 3-5 step\n5. Benefici della soluzione\n6. Esempi reali o case study\n7. Conclusione + CTA\n\n1000-1500 parole, SEO-friendly."
    },
    {
      title: "Confronto Prodotti",
      description: "Comparazione dettagliata",
      prompt: "Crea un articolo di confronto tra [Prodotto A] vs [Prodotto B]:\n\n• Intro: Contesto e per chi è utile\n• Panoramica di entrambi\n• Confronto su 5-6 criteri:\n  - Feature\n  - Prezzo\n  - Facilità d'uso\n  - Supporto\n  - Pro/Contro\n• Tabella comparativa\n• Verdetto finale\n• FAQ\n• CTA"
    }
  ],
  email: [
    {
      title: "Welcome Email",
      description: "Email di benvenuto per nuovi iscritti",
      prompt: "Scrivi una welcome email per [nome azienda/prodotto]:\n\n• Oggetto: Accogliente e personale\n• Benvenuto caloroso\n• Cosa aspettarsi (valore)\n• 1-2 risorse utili immediate\n• Come iniziare\n• Invito a rispondere/connettersi\n• Firma personale\n\nTono: amichevole e professionale."
    },
    {
      title: "Newsletter Settimanale",
      description: "Riepilogo contenuti della settimana",
      prompt: "Crea una newsletter settimanale per [nicchia/industria]:\n\n• Oggetto: Intrigante, max 50 caratteri\n• Intro personale\n• 3-5 highlights della settimana:\n  - Titolo accattivante\n  - Breve descrizione\n  - Link CTA\n• Sezione \"Quick Tips\"\n• P.S. personale o teaser\n• Footer con unsubscribe"
    },
    {
      title: "Email Promozionale",
      description: "Promozione prodotto/servizio",
      prompt: "Scrivi email promozionale per [prodotto/offerta]:\n\n• Oggetto: Beneficio chiaro + urgenza\n• Hook: Problema o opportunità\n• Presentazione offerta/prodotto\n• 3 benefici principali\n• Prova sociale (testimonianza)\n• Offerta speciale con scadenza\n• CTA multipli (2-3)\n• P.S. con ulteriore incentivo"
    },
    {
      title: "Email di Re-engagement",
      description: "Riattiva utenti inattivi",
      prompt: "Crea email di re-engagement per utenti inattivi:\n\n• Oggetto: Emotivo/nostalgico\n• Apertura: \"Ti mancava...\"\n• Cosa è cambiato/migliorato\n• Valore che stanno perdendo\n• Incentivo speciale per tornare\n• CTA chiara e semplice\n• Opzione di preferenze o unsubscribe\n\nTono: friendly, non colpevolizzante."
    }
  ],
  product: [
    {
      title: "Descrizione E-commerce",
      description: "Descrizione persuasiva per shop online",
      prompt: "Scrivi descrizione prodotto e-commerce per [nome prodotto]:\n\n• Titolo: Nome + beneficio principale\n• Intro: Hook emozionale (50 parole)\n• Caratteristiche principali (bullet points)\n• Benefici trasformativi (cosa risolve)\n• Specifiche tecniche\n• Come usarlo\n• Garanzie/Certificazioni\n• CTA forte\n\nTono: persuasivo ma genuino."
    },
    {
      title: "Descrizione Servizio",
      description: "Presenta servizio professionale",
      prompt: "Crea descrizione per servizio [tipo servizio]:\n\n• Headline: Risultato chiave\n• Problema che risolvi\n• Come funziona (3-4 step)\n• Cosa è incluso (lista dettagliata)\n• Chi è ideale per questo servizio\n• Casi d'uso o esempi\n• Pricing e pacchetti\n• Garanzie\n• CTA + prossimi passi"
    },
    {
      title: "Scheda Tecnica",
      description: "Descrizione dettagliata con specs",
      prompt: "Scrivi scheda tecnica completa per [prodotto]:\n\n• Overview del prodotto\n• Specifiche tecniche complete\n• Materiali e costruzione\n• Dimensioni e peso\n• Compatibilità\n• Contenuto della confezione\n• Requisiti di installazione/uso\n• Manutenzione e cura\n• Garanzia e certificazioni\n• FAQ tecniche"
    }
  ]
};

const TONES = {
  formal: {
    label: "Formale",
    description: "Tono professionale e istituzionale",
    instruction: "Riscrivi il seguente contenuto in tono formale e professionale, adatto a comunicazioni istituzionali o documenti ufficiali. Usa linguaggio elegante, preciso e rispettoso."
  },
  casual: {
    label: "Casual",
    description: "Tono amichevole e informale",
    instruction: "Riscrivi il seguente contenuto in tono casual e amichevole, come se stessi parlando con un amico. Usa linguaggio colloquiale, contrazioni e un approccio rilassato."
  },
  technical: {
    label: "Tecnico",
    description: "Tono esperto e dettagliato",
    instruction: "Riscrivi il seguente contenuto in tono tecnico e dettagliato, usando terminologia specialistica appropriata. Mantieni precisione e chiarezza per un pubblico esperto."
  },
  persuasive: {
    label: "Persuasivo",
    description: "Tono convincente e orientato all'azione",
    instruction: "Riscrivi il seguente contenuto in tono persuasivo e convincente, con focus sui benefici e call-to-action. Usa tecniche di copywriting per massimizzare l'engagement."
  },
  empathetic: {
    label: "Empatico",
    description: "Tono comprensivo e supportivo",
    instruction: "Riscrivi il seguente contenuto in tono empatico e comprensivo, mostrando sensibilità ed emozione. Connetti a livello umano con il lettore."
  }
};

type Variant = {
  tone: keyof typeof TONES;
  content: string;
};

export const ContentGenerator = () => {
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState("general");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [selectedTones, setSelectedTones] = useState<(keyof typeof TONES)[]>(["formal", "casual", "technical"]);

  const applyTemplate = (template: typeof TEMPLATES.instagram[0]) => {
    setPrompt(template.prompt);
    setSelectedTemplate(template.title);
    toast.success(`Template "${template.title}" applicato!`);
  };

  const toggleTone = (tone: keyof typeof TONES) => {
    setSelectedTones(prev => 
      prev.includes(tone) 
        ? prev.filter(t => t !== tone)
        : [...prev, tone]
    );
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Inserisci un prompt");
      return;
    }

    setIsGenerating(true);
    setGeneratedContent("");

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-content`;
      
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          prompt,
          contentType 
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Limite di richieste superato. Riprova più tardi.");
          return;
        }
        if (response.status === 402) {
          toast.error("Crediti esauriti. Aggiungi crediti al tuo workspace.");
          return;
        }
        throw new Error('Errore nella generazione');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) {
        throw new Error('Stream non disponibile');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              setGeneratedContent(prev => prev + content);
            }
          } catch {
            // JSON parziale, riprova
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      toast.success("Contenuto generato!");
    } catch (error) {
      console.error('Errore:', error);
      toast.error("Errore nella generazione del contenuto");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (content: string = generatedContent) => {
    navigator.clipboard.writeText(content);
    toast.success("Contenuto copiato!");
  };

  const generateVariants = async () => {
    if (!generatedContent.trim()) {
      toast.error("Genera prima un contenuto");
      return;
    }

    if (selectedTones.length === 0) {
      toast.error("Seleziona almeno un tono");
      return;
    }

    setIsGeneratingVariants(true);
    setVariants([]);

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-content`;

      // Generate variants sequentially to avoid rate limits
      const newVariants: Variant[] = [];

      for (const tone of selectedTones) {
        const toneConfig = TONES[tone];
        const variantPrompt = `${toneConfig.instruction}\n\nContenuto originale:\n${generatedContent}`;

        let variantContent = "";

        const response = await fetch(CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            prompt: variantPrompt,
            contentType: "general"
          }),
        });

        if (!response.ok) {
          console.error(`Errore per variante ${tone}`);
          continue;
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (!reader) continue;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                variantContent += content;
              }
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }

        newVariants.push({ tone, content: variantContent });
        setVariants([...newVariants]); // Update UI progressively
      }

      toast.success(`${newVariants.length} varianti generate!`);
    } catch (error) {
      console.error('Errore:', error);
      toast.error("Errore nella generazione delle varianti");
    } finally {
      setIsGeneratingVariants(false);
    }
  };

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Generatore di Contenuti AI
          </CardTitle>
          <CardDescription>
            Crea contenuti professionali con l'intelligenza artificiale
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="custom" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="custom">Prompt Personalizzato</TabsTrigger>
              <TabsTrigger value="templates">Template Predefiniti</TabsTrigger>
            </TabsList>

            <TabsContent value="custom" className="space-y-6 mt-6">
              <div className="space-y-2">
                <Label htmlFor="contentType">Tipo di Contenuto</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Generale</SelectItem>
                    <SelectItem value="blog">Articolo Blog</SelectItem>
                    <SelectItem value="social">Post Social Media</SelectItem>
                    <SelectItem value="product">Descrizione Prodotto</SelectItem>
                    <SelectItem value="email">Email Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">Prompt</Label>
                <Textarea
                  id="prompt"
                  placeholder="Descrivi il contenuto che vuoi generare..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generazione in corso...
                  </>
                ) : (
                  "Genera Contenuto"
                )}
              </Button>

              {generatedContent && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Contenuto Generato</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard()}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copia
                      </Button>
                    </div>
                    <div className="bg-muted p-4 rounded-lg min-h-[200px] whitespace-pre-wrap">
                      {generatedContent}
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Genera Varianti con Toni Diversi</Label>
                      <p className="text-sm text-muted-foreground">
                        Seleziona i toni per cui vuoi generare versioni alternative del contenuto
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(TONES).map(([key, tone]) => (
                          <Button
                            key={key}
                            variant={selectedTones.includes(key as keyof typeof TONES) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleTone(key as keyof typeof TONES)}
                            disabled={isGeneratingVariants}
                          >
                            {tone.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={generateVariants}
                      disabled={isGeneratingVariants || selectedTones.length === 0}
                      className="w-full"
                      variant="secondary"
                    >
                      {isGeneratingVariants ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generazione varianti in corso...
                        </>
                      ) : (
                        `Genera ${selectedTones.length} Variante${selectedTones.length > 1 ? 'i' : ''}`
                      )}
                    </Button>

                    {variants.length > 0 && (
                      <div className="space-y-4 mt-4">
                        <Label>Varianti Generate</Label>
                        <div className="grid gap-4 md:grid-cols-2">
                          {variants.map((variant) => (
                            <Card key={variant.tone}>
                              <CardHeader>
                                <CardTitle className="text-base flex items-center justify-between">
                                  <span>{TONES[variant.tone].label}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(variant.content)}
                                  >
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                </CardTitle>
                                <CardDescription className="text-xs">
                                  {TONES[variant.tone].description}
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="bg-muted p-3 rounded-lg max-h-[300px] overflow-y-auto text-sm whitespace-pre-wrap">
                                  {variant.content}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="templates" className="space-y-6 mt-6">
              <Tabs defaultValue="instagram" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="instagram">Instagram</TabsTrigger>
                  <TabsTrigger value="twitter">Twitter</TabsTrigger>
                  <TabsTrigger value="blog">Blog</TabsTrigger>
                  <TabsTrigger value="email">Email</TabsTrigger>
                  <TabsTrigger value="product">Prodotti</TabsTrigger>
                </TabsList>

                {Object.entries(TEMPLATES).map(([category, templates]) => (
                  <TabsContent key={category} value={category} className="space-y-4 mt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      {templates.map((template, index) => (
                        <Card key={index} className="hover:shadow-lg transition-shadow">
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <FileText className="w-5 h-5 text-primary" />
                              {template.title}
                            </CardTitle>
                            <CardDescription>{template.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <Button
                              onClick={() => {
                                applyTemplate(template);
                                // Switch back to custom tab to see and edit the prompt
                                const customTab = document.querySelector('[value="custom"]') as HTMLElement;
                                customTab?.click();
                              }}
                              variant="outline"
                              className="w-full"
                            >
                              Usa Template
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
