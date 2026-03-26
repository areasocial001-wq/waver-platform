import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  FileText, Loader2, Camera, Move, Lightbulb, Eye, Clock, StickyNote,
  CheckCircle2, Image as ImageIcon, Sparkles, ChevronDown, ChevronUp
} from "lucide-react";

export interface StoryboardShot {
  shotNumber: number;
  caption: string;
  visualDescription: string;
  cameraAngle: string;
  cameraMovement: string;
  lens: string;
  lighting: string;
  mood: string;
  duration: number;
  notes?: string;
  sketchUrl?: string;
  isGenerating?: boolean;
}

interface ParsedResult {
  shots: StoryboardShot[];
  title: string;
  synopsis: string;
}

interface Props {
  onImportPanels: (panels: { imageUrl: string | null; caption: string; note?: string }[], title?: string) => void;
}

export function ScriptToStoryboardDialog({ onImportPanels }: Props) {
  const [open, setOpen] = useState(false);
  const [script, setScript] = useState("");
  const [maxPanels, setMaxPanels] = useState("12");
  const [isParsing, setIsParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [expandedShot, setExpandedShot] = useState<number | null>(null);

  const handleParse = async () => {
    if (!script.trim() || script.trim().length < 20) {
      toast.error("Inserisci una sceneggiatura di almeno 20 caratteri");
      return;
    }

    setIsParsing(true);
    setParsed(null);

    try {
      const { data, error } = await supabase.functions.invoke("script-to-storyboard", {
        body: { script: script.trim(), maxPanels: parseInt(maxPanels), action: "parse" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (!data?.shots?.length) {
        throw new Error("Nessuna inquadratura generata");
      }

      setParsed(data);
      toast.success(`${data.shots.length} inquadrature analizzate`);
    } catch (err: any) {
      console.error("Parse error:", err);
      toast.error(err.message || "Errore nell'analisi della sceneggiatura");
    } finally {
      setIsParsing(false);
    }
  };

  const generateSingleSketch = async (shot: StoryboardShot, index: number): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-sketch", {
        body: {
          visualDescription: shot.visualDescription,
          cameraAngle: shot.cameraAngle,
          lighting: shot.lighting,
          mood: shot.mood,
          lens: shot.lens,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data?.imageUrl || null;
    } catch (err: any) {
      console.error(`Sketch generation error for shot ${index + 1}:`, err);
      return null;
    }
  };

  const handleGenerateAllSketches = async () => {
    if (!parsed) return;

    setGeneratingAll(true);
    setGeneratedCount(0);

    const updatedShots = [...parsed.shots];

    for (let i = 0; i < updatedShots.length; i++) {
      updatedShots[i] = { ...updatedShots[i], isGenerating: true };
      setParsed({ ...parsed, shots: [...updatedShots] });

      const imageUrl = await generateSingleSketch(updatedShots[i], i);

      updatedShots[i] = {
        ...updatedShots[i],
        sketchUrl: imageUrl || undefined,
        isGenerating: false,
      };
      setParsed({ ...parsed, shots: [...updatedShots] });
      setGeneratedCount(i + 1);

      // Small delay to avoid rate limiting
      if (i < updatedShots.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setGeneratingAll(false);
    const successCount = updatedShots.filter(s => s.sketchUrl).length;
    toast.success(`${successCount}/${updatedShots.length} bozzetti generati`);
  };

  const handleGenerateSingleSketch = async (index: number) => {
    if (!parsed) return;
    const updatedShots = [...parsed.shots];
    updatedShots[index] = { ...updatedShots[index], isGenerating: true };
    setParsed({ ...parsed, shots: updatedShots });

    const imageUrl = await generateSingleSketch(updatedShots[index], index);

    updatedShots[index] = {
      ...updatedShots[index],
      sketchUrl: imageUrl || undefined,
      isGenerating: false,
    };
    setParsed({ ...parsed, shots: updatedShots });

    if (imageUrl) {
      toast.success(`Bozzetto #${index + 1} generato`);
    } else {
      toast.error(`Errore nella generazione del bozzetto #${index + 1}`);
    }
  };

  const handleImport = () => {
    if (!parsed) return;

    const panels = parsed.shots.map(shot => ({
      imageUrl: shot.sketchUrl || null,
      caption: shot.caption,
      note: [
        `📹 ${shot.cameraAngle} | 🎥 ${shot.cameraMovement} | 🔍 ${shot.lens}`,
        `💡 ${shot.lighting} | 🎭 ${shot.mood}`,
        `⏱ ${shot.duration}s`,
        shot.notes || "",
      ].filter(Boolean).join("\n"),
    }));

    onImportPanels(panels, parsed.title);
    setOpen(false);
    setParsed(null);
    setScript("");
    toast.success("Storyboard importato con successo!");
  };

  const progress = parsed ? (generatedCount / parsed.shots.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />
          Da Sceneggiatura
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Script → Storyboard AI
          </DialogTitle>
          <DialogDescription>
            Inserisci una sceneggiatura o sinossi e l'AI genererà automaticamente i fotogrammi con bozzetti e indicazioni di regia
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {!parsed ? (
            <div className="space-y-4">
              <div>
                <Label>Sceneggiatura / Sinossi</Label>
                <Textarea
                  value={script}
                  onChange={e => setScript(e.target.value)}
                  placeholder="Inserisci la tua sceneggiatura, sinossi o descrizione dettagliata della storia..."
                  className="min-h-[200px] mt-1"
                  maxLength={4000}
                />
                <p className="text-xs text-muted-foreground mt-1">{script.length}/4000 caratteri</p>
              </div>

              <div>
                <Label>Numero massimo di inquadrature</Label>
                <Select value={maxPanels} onValueChange={setMaxPanels}>
                  <SelectTrigger className="w-[200px] mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 inquadrature</SelectItem>
                    <SelectItem value="8">8 inquadrature</SelectItem>
                    <SelectItem value="12">12 inquadrature</SelectItem>
                    <SelectItem value="16">16 inquadrature</SelectItem>
                    <SelectItem value="20">20 inquadrature</SelectItem>
                    <SelectItem value="24">24 inquadrature</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleParse}
                disabled={isParsing || script.trim().length < 20}
                className="w-full bg-gradient-to-r from-primary to-primary/80"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analisi in corso...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analizza Sceneggiatura
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header with title and synopsis */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4 pb-3">
                  <h3 className="font-semibold text-lg">{parsed.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{parsed.synopsis}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary">{parsed.shots.length} inquadrature</Badge>
                    <Badge variant="secondary">
                      {parsed.shots.reduce((sum, s) => sum + s.duration, 0)}s durata totale
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Generate all sketches */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleGenerateAllSketches}
                  disabled={generatingAll}
                  variant="outline"
                  className="flex-1"
                >
                  {generatingAll ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generazione bozzetti... ({generatedCount}/{parsed.shots.length})
                    </>
                  ) : (
                    <>
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Genera tutti i bozzetti
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleImport}
                  className="bg-gradient-to-r from-primary to-primary/80"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Importa nello Storyboard
                </Button>
              </div>

              {generatingAll && (
                <Progress value={progress} className="h-2" />
              )}

              {/* Shot list */}
              <div className="space-y-2">
                {parsed.shots.map((shot, i) => (
                  <Card key={i} className="overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedShot(expandedShot === i ? null : i)}
                    >
                      {/* Sketch thumbnail or placeholder */}
                      <div className="w-16 h-12 rounded border bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {shot.isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : shot.sketchUrl ? (
                          <img src={shot.sketchUrl} alt={`Shot ${shot.shotNumber}`} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

                      {/* Shot info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            #{shot.shotNumber}
                          </span>
                          <span className="text-sm font-medium truncate">{shot.caption}</span>
                        </div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px] h-5 gap-1">
                            <Camera className="h-2.5 w-2.5" />{shot.cameraAngle}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] h-5 gap-1">
                            <Move className="h-2.5 w-2.5" />{shot.cameraMovement}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] h-5 gap-1">
                            <Clock className="h-2.5 w-2.5" />{shot.duration}s
                          </Badge>
                        </div>
                      </div>

                      {/* Expand toggle */}
                      {expandedShot === i ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Expanded details */}
                    {expandedShot === i && (
                      <div className="border-t px-3 py-3 bg-muted/30 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="flex items-start gap-2">
                            <Eye className="h-3.5 w-3.5 mt-0.5 text-primary" />
                            <div>
                              <span className="font-medium text-xs text-muted-foreground">Descrizione visiva</span>
                              <p className="text-xs">{shot.visualDescription}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                              <span className="text-xs"><strong>Illuminazione:</strong> {shot.lighting}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs">🔍 <strong>Lente:</strong> {shot.lens}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs">🎭 <strong>Mood:</strong> {shot.mood}</span>
                            </div>
                          </div>
                        </div>

                        {shot.notes && (
                          <div className="flex items-start gap-2 text-xs">
                            <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{shot.notes}</span>
                          </div>
                        )}

                        {/* Sketch preview or generate button */}
                        <div className="flex items-center gap-2">
                          {shot.sketchUrl ? (
                            <div className="w-full">
                              <img
                                src={shot.sketchUrl}
                                alt={`Bozzetto #${shot.shotNumber}`}
                                className="w-full max-h-48 object-contain rounded border"
                              />
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGenerateSingleSketch(i);
                              }}
                              disabled={shot.isGenerating || generatingAll}
                            >
                              {shot.isGenerating ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <ImageIcon className="mr-1 h-3 w-3" />
                              )}
                              Genera bozzetto
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {/* Back button */}
              <Button
                variant="ghost"
                onClick={() => setParsed(null)}
                className="w-full"
              >
                ← Torna alla sceneggiatura
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
