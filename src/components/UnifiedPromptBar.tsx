import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Video, FileText, ImageIcon, Music, Newspaper, Send, Loader2, Sparkles, Upload, X,
} from "lucide-react";
import { StyleGallery, type VideoStyle } from "./StyleGallery";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "script" | "article" | "image" | "audio";

const modes = [
  { id: "script" as Mode, label: "Script to Video", icon: Video },
  { id: "article" as Mode, label: "Article to Video", icon: Newspaper },
  { id: "image" as Mode, label: "Image to Video", icon: ImageIcon },
  { id: "audio" as Mode, label: "Audio to Video", icon: Music },
];

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPTED_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm"];

export const UnifiedPromptBar = () => {
  const [mode, setMode] = useState<Mode>("script");
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<VideoStyle | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [articleResult, setArticleResult] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const placeholders: Record<Mode, string> = {
    script: "Descrivi il video che vuoi creare… es. 'Un drone sorvola una foresta incantata al tramonto'",
    article: "Incolla l'URL di un articolo o il testo da trasformare in video…",
    image: "Trascina un'immagine qui o descrivine il movimento…",
    audio: "Trascina un file audio qui o descrivi lo stile video…",
  };

  const handleFile = useCallback((file: File) => {
    const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
    const isAudio = ACCEPTED_AUDIO_TYPES.includes(file.type);

    if (!isImage && !isAudio) {
      toast.error("Formato non supportato. Usa immagini (JPG, PNG, WebP) o audio (MP3, WAV, OGG).");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File troppo grande (max 20MB)");
      return;
    }

    setAttachedFile(file);

    // Auto-switch mode
    if (isImage) {
      setMode("image");
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    } else if (isAudio) {
      setMode("audio");
      setFilePreview(null);
    }

    toast.success(`${file.name} allegato`);
  }, []);

  const removeFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setAttachedFile(null);
    setFilePreview(null);
  };

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleGenerate = async () => {
    if (!prompt.trim() && !attachedFile) {
      toast.error("Inserisci un prompt o allega un file");
      return;
    }

    if (mode !== "article" && !selectedStyle) {
      toast.error("Seleziona uno stile visivo");
      return;
    }

    setIsGenerating(true);

    try {
      if (mode === "article") {
        const { data, error } = await supabase.functions.invoke("article-to-video", {
          body: { input: prompt.trim(), style: selectedStyle?.id || "animation" },
        });

        if (error) throw error;
        setArticleResult(data?.summary || null);
        toast.success("Articolo analizzato! Script video generato.");
      } else {
        const stylePrefix = selectedStyle ? `[Stile: ${selectedStyle.name}] ${selectedStyle.promptModifier}. ` : "";
        const fullPrompt = stylePrefix + prompt.trim();

        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          toast.error("Devi essere autenticato");
          return;
        }

        // If there's an attached image, upload it first
        let imageUrl: string | null = null;
        if (attachedFile && ACCEPTED_IMAGE_TYPES.includes(attachedFile.type)) {
          const ext = attachedFile.name.split(".").pop() || "jpg";
          const path = `${userData.user.id}/${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("edited-frames")
            .upload(path, attachedFile);
          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("edited-frames")
            .getPublicUrl(path);
          imageUrl = urlData.publicUrl;
        }

        const { error } = await supabase.from("video_generations").insert({
          user_id: userData.user.id,
          prompt: fullPrompt,
          original_prompt: prompt.trim(),
          type: mode === "image" || imageUrl ? "image_to_video" : "text_to_video",
          status: "pending",
          duration: 5,
          provider: "kling",
          image_url: imageUrl,
        });

        if (error) throw error;
        toast.success("Video in coda per la generazione!");
        setPrompt("");
        removeFile();
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
            <motion.button
              key={m.id}
              onClick={() => setMode(m.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              layout
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                mode === m.id
                  ? "text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {mode === m.id && (
                <motion.div
                  layoutId="activeMode"
                  className="absolute inset-0 bg-primary rounded-full shadow-lg shadow-primary/25"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <m.icon className="w-4 h-4" />
                {m.label}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Prompt Input Card with Drag & Drop */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative bg-card border-2 rounded-2xl p-4 shadow-lg transition-all",
            isDragging
              ? "border-primary bg-primary/5 shadow-primary/20"
              : "border-border"
          )}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-10 rounded-2xl bg-primary/10 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-2 text-primary">
                <Upload className="w-8 h-8 animate-bounce" />
                <span className="font-medium text-sm">Rilascia il file qui</span>
              </div>
            </div>
          )}

          {/* Style + Attached file + Input Row */}
          <div className="flex items-start gap-3">
            {/* Style Indicator */}
            {selectedStyle && (
              <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
                <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-primary/40">
                  <img
                    src={selectedStyle.preview}
                    alt={selectedStyle.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[60px]">
                  {selectedStyle.name}
                </span>
              </div>
            )}

            {/* Attached File Preview */}
            {attachedFile && (
              <div className="shrink-0 relative pt-1">
                {filePreview ? (
                  <div className="w-14 h-14 rounded-lg overflow-hidden border-2 border-accent/40">
                    <img src={filePreview} alt="Attached" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg border-2 border-accent/40 bg-accent/10 flex items-center justify-center">
                    <Music className="w-6 h-6 text-accent" />
                  </div>
                )}
                <button
                  onClick={removeFile}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-destructive-foreground" />
                </button>
                <span className="text-[10px] text-muted-foreground truncate block max-w-[60px] text-center mt-0.5">
                  {attachedFile.name}
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
            <div className="shrink-0 flex flex-col gap-2 mt-1">
              <Button
                size="icon"
                onClick={handleGenerate}
                disabled={isGenerating || (!prompt.trim() && !attachedFile)}
                className="w-10 h-10 rounded-xl bg-primary hover:bg-primary/90"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>

              {/* File upload button for image/audio modes */}
              {(mode === "image" || mode === "audio") && !attachedFile && (
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10 rounded-xl"
                >
                  <Upload className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={
              mode === "image"
                ? ACCEPTED_IMAGE_TYPES.join(",")
                : mode === "audio"
                ? ACCEPTED_AUDIO_TYPES.join(",")
                : [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_AUDIO_TYPES].join(",")
            }
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />

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
              {attachedFile && (
                <Badge variant="secondary" className="text-xs">
                  📎 {attachedFile.name}
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {mode === "image" || mode === "audio"
                ? "Trascina un file o ⌘+Enter"
                : "⌘+Enter per generare"}
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
