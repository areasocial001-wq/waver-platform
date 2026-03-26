import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  FileText, Loader2, Camera, Move, Lightbulb, Eye, Clock, StickyNote,
  CheckCircle2, Image as ImageIcon, Sparkles, ChevronDown, ChevronUp,
  Upload, Pencil, RotateCcw, X
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

const CAMERA_ANGLES = [
  "wide shot", "medium shot", "close-up", "extreme close-up", "bird's eye",
  "low angle", "high angle", "over the shoulder", "POV", "dutch angle"
];
const CAMERA_MOVEMENTS = [
  "static", "pan left", "pan right", "tilt up", "tilt down",
  "dolly in", "dolly out", "tracking", "crane", "handheld"
];
const LENSES = [
  "14mm ultra-wide", "24mm wide", "35mm standard", "50mm normal",
  "85mm portrait", "135mm telephoto", "200mm+ super telephoto", "macro"
];

export function ScriptToStoryboardDialog({ onImportPanels }: Props) {
  const [open, setOpen] = useState(false);
  const [script, setScript] = useState("");
  const [maxPanels, setMaxPanels] = useState("12");
  const [isParsing, setIsParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [expandedShot, setExpandedShot] = useState<number | null>(null);
  const [editingShot, setEditingShot] = useState<number | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File import handler
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingFile(true);
    const ext = file.name.split(".").pop()?.toLowerCase();

    try {
      if (ext === "txt") {
        const text = await file.text();
        setScript(text.slice(0, 4000));
        toast.success(`File "${file.name}" importato`);
      } else if (ext === "fdx") {
        const xml = await file.text();
        const extracted = parseFDX(xml);
        setScript(extracted.slice(0, 4000));
        toast.success(`Sceneggiatura Final Draft importata`);
      } else if (ext === "pdf") {
        // Use edge function to extract PDF text
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
        const { data, error } = await supabase.functions.invoke("extract-pdf-text", {
          body: { pdfBase64: base64 },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setScript((data?.text || "").slice(0, 4000));
        toast.success(`PDF "${file.name}" importato`);
      } else {
        toast.error("Formato file non supportato. Usa .txt, .pdf o .fdx");
      }
    } catch (err: any) {
      console.error("File import error:", err);
      toast.error(err.message || "Errore nell'importazione del file");
    } finally {
      setIsLoadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Parse Final Draft XML (.fdx)
  const parseFDX = (xml: string): string => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");
      const paragraphs = doc.querySelectorAll("Paragraph");
      const lines: string[] = [];

      paragraphs.forEach((p) => {
        const type = p.getAttribute("Type") || "";
        const textNodes = p.querySelectorAll("Text");
        const text = Array.from(textNodes).map(t => t.textContent || "").join("");

        if (!text.trim()) return;

        if (type === "Scene Heading") {
          lines.push(`\n${text.toUpperCase()}\n`);
        } else if (type === "Action") {
          lines.push(text);
        } else if (type === "Character") {
          lines.push(`\n${text.toUpperCase()}`);
        } else if (type === "Dialogue") {
          lines.push(`  ${text}`);
        } else if (type === "Parenthetical") {
          lines.push(`  (${text})`);
        } else if (type === "Transition") {
          lines.push(`\n${text.toUpperCase()}\n`);
        } else {
          lines.push(text);
        }
      });

      return lines.join("\n").trim();
    } catch {
      toast.error("Errore nel parsing del file Final Draft");
      return "";
    }
  };

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

  // Update a single shot field
  const updateShot = (index: number, field: keyof StoryboardShot, value: any) => {
    if (!parsed) return;
    const updatedShots = [...parsed.shots];
    updatedShots[index] = { ...updatedShots[index], [field]: value };
    setParsed({ ...parsed, shots: updatedShots });
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

  const handleRegenerateSketch = async (index: number) => {
    if (!parsed) return;
    const updatedShots = [...parsed.shots];
    updatedShots[index] = { ...updatedShots[index], sketchUrl: undefined };
    setParsed({ ...parsed, shots: updatedShots });
    await handleGenerateSingleSketch(index);
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
            Inserisci o importa una sceneggiatura e l'AI genererà i fotogrammi con bozzetti e indicazioni di regia
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {!parsed ? (
            <div className="space-y-4">
              {/* File import */}
              <div>
                <Label>Importa da file</Label>
                <div className="flex gap-2 mt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf,.fdx"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoadingFile}
                    className="gap-2"
                  >
                    {isLoadingFile ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Carica file
                  </Button>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">.txt</Badge>
                    <Badge variant="outline" className="text-[10px]">.pdf</Badge>
                    <Badge variant="outline" className="text-[10px]">.fdx</Badge>
                  </div>
                </div>
              </div>

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
              {/* Header */}
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

              {/* Actions */}
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

              {generatingAll && <Progress value={progress} className="h-2" />}

              {/* Shot list */}
              <div className="space-y-2">
                {parsed.shots.map((shot, i) => (
                  <Card key={i} className="overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setExpandedShot(expandedShot === i ? null : i);
                        if (editingShot === i) setEditingShot(null);
                      }}
                    >
                      <div className="w-16 h-12 rounded border bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {shot.isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : shot.sketchUrl ? (
                          <img src={shot.sketchUrl} alt={`Shot ${shot.shotNumber}`} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

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

                      {expandedShot === i ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Expanded details */}
                    {expandedShot === i && (
                      <div className="border-t px-3 py-3 bg-muted/30 space-y-3">
                        {/* Edit toggle */}
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant={editingShot === i ? "secondary" : "ghost"}
                            className="gap-1 h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingShot(editingShot === i ? null : i);
                            }}
                          >
                            {editingShot === i ? (
                              <><X className="h-3 w-3" /> Chiudi editor</>
                            ) : (
                              <><Pencil className="h-3 w-3" /> Modifica parametri</>
                            )}
                          </Button>
                        </div>

                        {editingShot === i ? (
                          /* Editing mode */
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs">Didascalia</Label>
                              <Input
                                value={shot.caption}
                                onChange={(e) => updateShot(i, "caption", e.target.value)}
                                className="mt-1 h-8 text-sm"
                                maxLength={80}
                              />
                            </div>

                            <div>
                              <Label className="text-xs">Descrizione visiva (EN)</Label>
                              <Textarea
                                value={shot.visualDescription}
                                onChange={(e) => updateShot(i, "visualDescription", e.target.value)}
                                className="mt-1 min-h-[60px] text-sm"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs flex items-center gap-1">
                                  <Camera className="h-3 w-3" /> Angolo di ripresa
                                </Label>
                                <Select
                                  value={shot.cameraAngle}
                                  onValueChange={(v) => updateShot(i, "cameraAngle", v)}
                                >
                                  <SelectTrigger className="mt-1 h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CAMERA_ANGLES.map(a => (
                                      <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-xs flex items-center gap-1">
                                  <Move className="h-3 w-3" /> Movimento camera
                                </Label>
                                <Select
                                  value={shot.cameraMovement}
                                  onValueChange={(v) => updateShot(i, "cameraMovement", v)}
                                >
                                  <SelectTrigger className="mt-1 h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CAMERA_MOVEMENTS.map(m => (
                                      <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-xs">🔍 Lente</Label>
                                <Select
                                  value={shot.lens}
                                  onValueChange={(v) => updateShot(i, "lens", v)}
                                >
                                  <SelectTrigger className="mt-1 h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {LENSES.map(l => (
                                      <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-xs flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> Durata (s)
                                </Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <Slider
                                    value={[shot.duration]}
                                    onValueChange={([v]) => updateShot(i, "duration", v)}
                                    min={2}
                                    max={10}
                                    step={1}
                                    className="flex-1"
                                  />
                                  <span className="text-xs font-mono w-6 text-right">{shot.duration}s</span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs flex items-center gap-1">
                                  <Lightbulb className="h-3 w-3" /> Illuminazione
                                </Label>
                                <Input
                                  value={shot.lighting}
                                  onChange={(e) => updateShot(i, "lighting", e.target.value)}
                                  className="mt-1 h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">🎭 Mood</Label>
                                <Input
                                  value={shot.mood}
                                  onChange={(e) => updateShot(i, "mood", e.target.value)}
                                  className="mt-1 h-8 text-sm"
                                />
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs flex items-center gap-1">
                                <StickyNote className="h-3 w-3" /> Note di regia
                              </Label>
                              <Input
                                value={shot.notes || ""}
                                onChange={(e) => updateShot(i, "notes", e.target.value)}
                                className="mt-1 h-8 text-sm"
                                placeholder="Note aggiuntive..."
                              />
                            </div>
                          </div>
                        ) : (
                          /* View mode */
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
                        )}

                        {shot.notes && editingShot !== i && (
                          <div className="flex items-start gap-2 text-xs">
                            <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{shot.notes}</span>
                          </div>
                        )}

                        {/* Sketch preview or actions */}
                        <div className="flex items-center gap-2">
                          {shot.sketchUrl ? (
                            <div className="w-full space-y-2">
                              <img
                                src={shot.sketchUrl}
                                alt={`Bozzetto #${shot.shotNumber}`}
                                className="w-full max-h-48 object-contain rounded border"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRegenerateSketch(i);
                                }}
                                disabled={shot.isGenerating || generatingAll}
                              >
                                <RotateCcw className="h-3 w-3" />
                                Rigenera bozzetto
                              </Button>
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
