import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Download, ArrowLeft, Tag as TagIcon, FileText, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface StoryboardPanel {
  id: string;
  imageUrl: string | null;
  caption: string;
  note?: string;
}

interface Storyboard {
  id: string;
  title: string;
  layout: string;
  panels: StoryboardPanel[];
  tags: string[];
  created_at: string;
  
}

const LAYOUT_CONFIG: Record<string, { cols: number; rows: number }> = {
  "2x2": { cols: 2, rows: 2 },
  "3x2": { cols: 3, rows: 2 },
  "4x2": { cols: 4, rows: 2 },
  "2x3": { cols: 2, rows: 3 },
  "3x3": { cols: 3, rows: 3 },
};

export default function ViewStoryboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const storyboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStoryboard();
  }, [id]);

  const fetchStoryboard = async (attemptPassword?: string) => {
    try {
      // Use server-side verification for password-protected storyboards
      const { data: responseData, error: functionError } = await supabase.functions.invoke(
        'verify-storyboard-access',
        {
          body: { storyboardId: id, password: attemptPassword }
        }
      );

      if (functionError) {
        throw functionError;
      }

      // Check if password is required
      if (responseData?.requiresPassword) {
        setShowPasswordPrompt(true);
        setLoading(false);
        return;
      }

      // Handle error responses
      if (responseData?.error) {
        if (responseData.error === 'Invalid password') {
          setPasswordError("Password errata");
          setLoading(false);
          return;
        }
        throw new Error(responseData.error);
      }

      // Success - storyboard data received
      if (responseData?.success && responseData?.storyboard) {
        const data = responseData.storyboard;
        setStoryboard({
          id: data.id,
          title: data.title,
          layout: data.layout,
          created_at: data.created_at || new Date().toISOString(),
          tags: (data.tags as string[]) || [],
          panels: (data.panels as unknown as StoryboardPanel[]) || [],
          share_password: null, // Never expose password to client
        });
        setShowPasswordPrompt(false);
      } else {
        toast.error("Storyboard non trovato o non pubblico");
        navigate("/");
      }
    } catch (error: any) {
      console.error("Error fetching storyboard:", error);
      toast.error("Errore nel caricamento dello storyboard");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setLoading(true);
    fetchStoryboard(password);
  };

  const handleExportPNG = async () => {
    if (!storyboardRef.current || !storyboard) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(storyboardRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${storyboard.title.replace(/\s+/g, "_")}_storyboard.png`;
          link.click();
          URL.revokeObjectURL(url);
          toast.success("Storyboard esportato in PNG!");
        }
      }, "image/png");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Errore durante l'esportazione");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!storyboardRef.current || !storyboard) return;
    
    setIsExporting(true);
    try {
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Title
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text(storyboard.title, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Creation date
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Creato il ${new Date(storyboard.created_at).toLocaleDateString('it-IT')}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Tags
      if (storyboard.tags.length > 0) {
        pdf.text(`Tag: ${storyboard.tags.join(', ')}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10;
      }

      // Storyboard image
      const canvas = await html2canvas(storyboardRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      if (yPosition + imgHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;

      // Notes section
      const panelsWithNotes = storyboard.panels.filter(p => p.note?.trim() || p.caption?.trim());
      if (panelsWithNotes.length > 0) {
        if (yPosition > pageHeight - 40) {
          pdf.addPage();
          yPosition = margin;
        }

        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Didascalie e Note', margin, yPosition);
        yPosition += 10;

        panelsWithNotes.forEach((panel, idx) => {
          const panelIndex = storyboard.panels.findIndex(p => p.id === panel.id);
          
          if (yPosition > pageHeight - 30) {
            pdf.addPage();
            yPosition = margin;
          }

          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`Pannello ${panelIndex + 1}`, margin, yPosition);
          yPosition += 7;

          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');

          if (panel.caption?.trim()) {
            pdf.setFont('helvetica', 'italic');
            const captionLines = pdf.splitTextToSize(`Didascalia: ${panel.caption}`, pageWidth - (margin * 2));
            pdf.text(captionLines, margin + 5, yPosition);
            yPosition += captionLines.length * 5 + 3;
          }

          if (panel.note?.trim()) {
            pdf.setFont('helvetica', 'normal');
            const noteLines = pdf.splitTextToSize(`Note: ${panel.note}`, pageWidth - (margin * 2));
            pdf.text(noteLines, margin + 5, yPosition);
            yPosition += noteLines.length * 5 + 5;
          }

          yPosition += 5;
        });
      }

      pdf.save(`${storyboard.title.replace(/\s+/g, "_")}_storyboard.pdf`);
      toast.success("Storyboard esportato in PDF!");
    } catch (error) {
      console.error("Export PDF error:", error);
      toast.error("Errore durante l'esportazione PDF");
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showPasswordPrompt) {
    return (
      <div className="min-h-screen bg-background dark">
        <Navbar />
        <main className="container mx-auto px-6 py-20">
          <div className="max-w-md mx-auto">
            <Card className="p-8 bg-card/50">
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <Lock className="h-12 w-12 text-primary mx-auto" />
                  <h2 className="text-2xl font-bold">Storyboard Protetto</h2>
                  <p className="text-muted-foreground">
                    Questo storyboard è protetto da password. Inserisci la password per visualizzarlo.
                  </p>
                </div>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError("");
                      }}
                      placeholder="Inserisci la password..."
                      className="bg-background/50 border-border"
                      autoFocus
                    />
                    {passwordError && (
                      <p className="text-sm text-destructive">{passwordError}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/")}
                      className="flex-1"
                    >
                      Annulla
                    </Button>
                    <Button
                      type="submit"
                      disabled={!password.trim()}
                      className="flex-1 bg-gradient-to-r from-primary to-primary/80"
                    >
                      Accedi
                    </Button>
                  </div>
                </form>
              </div>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!storyboard) return null;

  const config = LAYOUT_CONFIG[storyboard.layout];

  return (
    <div className="min-h-screen bg-background dark">
      <Navbar />
      
      <main className="container mx-auto px-6 py-20">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna alla Home
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  disabled={isExporting}
                  variant="outline"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Esportazione...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Esporta
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPNG} disabled={isExporting}>
                  <Download className="mr-2 h-4 w-4" />
                  Esporta come PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} disabled={isExporting}>
                  <FileText className="mr-2 h-4 w-4" />
                  Esporta come PDF (con note)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Card className="p-8 bg-card/50" ref={storyboardRef}>
            <div className="mb-6 text-center space-y-3">
              <h2 className="text-3xl font-bold text-foreground">{storyboard.title}</h2>
              <p className="text-sm text-muted-foreground">
                Creato il {new Date(storyboard.created_at).toLocaleDateString('it-IT')}
              </p>
              {storyboard.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {storyboard.tags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      <TagIcon className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div 
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
                gridTemplateRows: `repeat(${config.rows}, 1fr)`,
              }}
            >
              {storyboard.panels.map((panel, index) => (
                <Card 
                  key={panel.id}
                  className="relative overflow-hidden border-border bg-background/30 aspect-video"
                >
                  {panel.imageUrl ? (
                    <>
                      <img 
                        src={panel.imageUrl} 
                        alt={`Panel ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {panel.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-sm">
                          {panel.caption}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Pannello {index + 1}
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {storyboard.panels.some(p => p.note?.trim()) && (
              <div className="mt-8 space-y-4">
                <h3 className="text-xl font-semibold text-foreground border-b border-border pb-2">
                  Note Tecniche e Creative
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {storyboard.panels.map((panel, index) => 
                    panel.note?.trim() ? (
                      <Card key={panel.id} className="p-4 bg-background/50 border-border">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              Pannello {index + 1}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {panel.note}
                          </p>
                        </div>
                      </Card>
                    ) : null
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}