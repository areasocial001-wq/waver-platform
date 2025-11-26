import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Download, ArrowLeft } from "lucide-react";
import html2canvas from "html2canvas";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

interface StoryboardPanel {
  id: string;
  imageUrl: string | null;
  caption: string;
}

interface Storyboard {
  id: string;
  title: string;
  layout: string;
  panels: StoryboardPanel[];
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
  const storyboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStoryboard();
  }, [id]);

  const fetchStoryboard = async () => {
    try {
      const { data, error } = await supabase
        .from('storyboards')
        .select('*')
        .eq('id', id)
        .eq('is_public', true)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        toast.error("Storyboard non trovato o non pubblico");
        navigate("/");
        return;
      }

      setStoryboard({
        id: data.id,
        title: data.title,
        layout: data.layout,
        created_at: data.created_at,
        panels: (data.panels as unknown as StoryboardPanel[]) || []
      });
    } catch (error: any) {
      console.error("Error fetching storyboard:", error);
      toast.error("Errore nel caricamento dello storyboard");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
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
          toast.success("Storyboard esportato con successo!");
        }
      }, "image/png");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Errore durante l'esportazione");
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
            
            <Button 
              onClick={handleExport}
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
                  Esporta PNG
                </>
              )}
            </Button>
          </div>

          <Card className="p-8 bg-card/50" ref={storyboardRef}>
            <div className="mb-6 text-center">
              <h2 className="text-3xl font-bold text-foreground">{storyboard.title}</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Creato il {new Date(storyboard.created_at).toLocaleDateString('it-IT')}
              </p>
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
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}