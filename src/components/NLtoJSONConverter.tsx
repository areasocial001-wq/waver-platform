import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Download, Loader2, FileJson, Film, Layout, Braces, RefreshCw } from "lucide-react";

type OutputFormat = "json2video" | "storyboard" | "generic";

const FORMAT_INFO: Record<OutputFormat, { label: string; icon: React.ReactNode; description: string; placeholder: string }> = {
  json2video: {
    label: "JSON2Video",
    icon: <Film className="w-4 h-4" />,
    description: "Genera un template JSON compatibile con JSON2Video (scene, elementi, transizioni)",
    placeholder: "Es: Crea un video di 30 secondi con una scena iniziale di un tramonto sul mare, poi un testo animato \"Benvenuto\" che appare al centro, seguito da una sequenza di immagini di una città di notte con musica ambient...",
  },
  storyboard: {
    label: "Storyboard",
    icon: <Layout className="w-4 h-4" />,
    description: "Converte una storia o sceneggiatura in pannelli storyboard con prompt per la generazione video",
    placeholder: "Es: Scena 1: Un detective cammina per una strada buia di notte sotto la pioggia. Dialogo: \"Questa città non dorme mai\". Scena 2: Zoom su un'insegna al neon rossa che lampeggia. SFX: pioggia e traffico...",
  },
  generic: {
    label: "Generico",
    icon: <Braces className="w-4 h-4" />,
    description: "Converte qualsiasi testo in una struttura JSON appropriata",
    placeholder: "Es: Un catalogo prodotti con 3 articoli: una maglietta blu taglia M a 29.99€, un paio di jeans neri taglia L a 59.99€, e delle scarpe bianche taglia 42 a 89.99€. Ogni prodotto ha un codice SKU e disponibilità in magazzino...",
  },
};

export const NLtoJSONConverter = () => {
  const [inputText, setInputText] = useState("");
  const [outputJson, setOutputJson] = useState<string | null>(null);
  const [format, setFormat] = useState<OutputFormat>("json2video");
  const [isLoading, setIsLoading] = useState(false);

  const handleConvert = async () => {
    if (!inputText.trim()) {
      toast.error("Inserisci del testo da convertire");
      return;
    }

    setIsLoading(true);
    setOutputJson(null);

    try {
      const { data, error } = await supabase.functions.invoke("nl-to-json", {
        body: { text: inputText, format, language: "it" },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const formatted = JSON.stringify(data.json, null, 2);
      setOutputJson(formatted);
      toast.success("Conversione completata!");
    } catch (err) {
      console.error("Conversion error:", err);
      toast.error("Errore durante la conversione. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!outputJson) return;
    navigator.clipboard.writeText(outputJson);
    toast.success("JSON copiato negli appunti");
  };

  const handleDownload = () => {
    if (!outputJson) return;
    const blob = new Blob([outputJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `output-${format}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File JSON scaricato");
  };

  const currentFormat = FORMAT_INFO[format];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-primary/10">
          <FileJson className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Testo → JSON</h2>
          <p className="text-muted-foreground">
            Converti linguaggio naturale in JSON strutturato
          </p>
        </div>
      </div>

      {/* Format Selector */}
      <Tabs value={format} onValueChange={(v) => { setFormat(v as OutputFormat); setOutputJson(null); }}>
        <TabsList className="grid w-full grid-cols-3">
          {(Object.keys(FORMAT_INFO) as OutputFormat[]).map((key) => (
            <TabsTrigger key={key} value={key} className="flex items-center gap-2">
              {FORMAT_INFO[key].icon}
              {FORMAT_INFO[key].label}
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(FORMAT_INFO) as OutputFormat[]).map((key) => (
          <TabsContent key={key} value={key}>
            <Badge variant="secondary" className="mb-4">
              {FORMAT_INFO[key].description}
            </Badge>
          </TabsContent>
        ))}
      </Tabs>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              📝 Testo in Input
            </CardTitle>
            <CardDescription>
              Descrivi in linguaggio naturale cosa vuoi ottenere
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={currentFormat.placeholder}
              className="min-h-[300px] resize-y font-mono text-sm"
              maxLength={10000}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {inputText.length}/10.000 caratteri
              </span>
              <Button
                onClick={handleConvert}
                disabled={isLoading || !inputText.trim()}
                className="gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Conversione...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Converti in JSON
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Output */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileJson className="w-5 h-5" />
              Output JSON
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              Risultato della conversione
              {outputJson && (
                <Badge variant="outline" className="text-xs">
                  {format.toUpperCase()}
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {outputJson ? (
              <pre className="bg-muted rounded-lg p-4 overflow-auto min-h-[300px] max-h-[500px] text-xs font-mono text-foreground whitespace-pre-wrap break-words">
                {outputJson}
              </pre>
            ) : (
              <div className="flex items-center justify-center min-h-[300px] text-muted-foreground border border-dashed border-border rounded-lg">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p>Analisi e conversione in corso...</p>
                  </div>
                ) : (
                  <p>Il JSON generato apparirà qui</p>
                )}
              </div>
            )}

            {outputJson && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                  <Copy className="w-4 h-4" />
                  Copia
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
                  <Download className="w-4 h-4" />
                  Scarica .json
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
