import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const ContentGenerator = () => {
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState("general");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
    toast.success("Contenuto copiato!");
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Contenuto Generato</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copia
                </Button>
              </div>
              <div className="bg-muted p-4 rounded-lg min-h-[200px] whitespace-pre-wrap">
                {generatedContent}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
