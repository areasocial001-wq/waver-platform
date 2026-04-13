import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Video, FileText, ImageIcon, Music, Newspaper, Send, Loader2, Sparkles,
} from "lucide-react";
import { StyleGallery, type VideoStyle } from "./StyleGallery";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Mode = "script" | "article" | "image" | "audio";

const modes = [
  { id: "script" as Mode, label: "Script to Video", icon: Video },
  { id: "article" as Mode, label: "Article to Video", icon: Newspaper },
  { id: "image" as Mode, label: "Image to Video", icon: ImageIcon },
  { id: "audio" as Mode, label: "Audio to Video", icon: Music },
];

export const UnifiedPromptBar = () => {
  const [mode, setMode] = useState<Mode>("script");
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<VideoStyle | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [articleResult, setArticleResult] = useState<string | null>(null);

  const placeholders: Record<Mode, string> = {
    script: "Descrivi il video che vuoi creare… es. 'Un drone sorvola una foresta incantata al tramonto'",
    article: "Incolla l'URL di un articolo o il testo da trasformare in video…",
    image: "Descrivi il movimento che vuoi applicare all'immagine…",
    audio: "Descrivi lo stile video da abbinare al tuo audio…",
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Inserisci un prompt o un URL");
      return;
    }

    if (mode !== "article" && !selectedStyle) {
      toast.error("Seleziona uno stile visivo");
      return;
    }

    setIsGenerating(true);

    try {
      if (mode === "article") {
        // Article to video: summarize then generate
        const { data, error } = await supabase.functions.invoke("article-to-video", {
          body: { input: prompt.trim(), style: selectedStyle?.id || "animation" },
        });

        if (error) throw error;

        setArticleResult(data?.summary || null);
        toast.success("Articolo analizzato! Script video generato.");
      } else {
        // Build enhanced prompt with style
        const stylePrefix = selectedStyle ? `[Stile: ${selectedStyle.name}] ` : "";
        const fullPrompt = stylePrefix + prompt.trim();

        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          toast.error("Devi essere autenticato");
          return;
        }

        const { error } = await supabase.from("video_generations").insert({
          user_id: userData.user.id,
          prompt: fullPrompt,
          original_prompt: prompt.trim(),
          type: mode === "image" ? "image_to_video" : "text_to_video",
          status: "pending",
          duration: 5,
          provider: "kling",
        });

        if (error) throw error;
        toast.success("Video in coda per la generazione!");
        setPrompt("");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Errore durante la generazione");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="py-16 px-6">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">
            <span className="text-foreground">Crea il tuo </span>
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              video AI
            </span>
            <span className="text-foreground"> oggi</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Scegli la modalità, seleziona uno stile e descrivi la tua idea
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                mode === m.id
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <m.icon className="w-4 h-4" />
              {m.label}
            </button>
          ))}
        </div>

        {/* Prompt Input Card */}
        <div className="relative bg-card border border-border rounded-2xl p-4 shadow-lg">
          {/* Style + Input Row */}
          <div className="flex items-start gap-3">
            {/* Style Indicator */}
            {selectedStyle && (
              <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
                <div
                  className="w-10 h-10 rounded-lg bg-cover bg-center border-2 border-primary/40"
                  style={{
                    backgroundImage: `url(${selectedStyle.preview})`,
                    backgroundColor: `hsl(var(--muted))`,
                  }}
                />
                <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[60px]">
                  {selectedStyle.name}
                </span>
              </div>
            )}

            {/* Textarea */}
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholders[mode]}
              className="flex-1 min-h-[80px] max-h-[160px] resize-none border-0 bg-transparent focus-visible:ring-0 text-base placeholder:text-muted-foreground/60"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleGenerate();
                }
              }}
            />

            {/* Send Button */}
            <Button
              size="icon"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="shrink-0 w-10 h-10 rounded-xl bg-primary hover:bg-primary/90 mt-1"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Bottom bar info */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                {mode === "article" ? "AI Summary" : "AI Enhanced"}
              </Badge>
              {selectedStyle && (
                <Badge variant="secondary" className="text-xs">
                  {selectedStyle.name}
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              ⌘+Enter per generare
            </span>
          </div>
        </div>

        {/* Article Result */}
        {articleResult && mode === "article" && (
          <div className="mt-6 p-4 bg-card border border-border rounded-xl">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Script generato dall'articolo
            </h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{articleResult}</p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => {
                setMode("script");
                setPrompt(articleResult);
                setArticleResult(null);
              }}
            >
              Usa come prompt video
            </Button>
          </div>
        )}

        {/* Style Gallery */}
        <div className="mt-8">
          <StyleGallery
            selectedStyle={selectedStyle}
            onSelectStyle={setSelectedStyle}
          />
        </div>
      </div>
    </section>
  );
};
