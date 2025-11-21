import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Image, FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useVideoPolling } from "@/hooks/useVideoPolling";

type VideoGeneration = {
  id: string;
  type: "text_to_video" | "image_to_video";
  prompt: string | null;
  duration: number;
  resolution: string | null;
  motion_intensity: string | null;
  image_url: string | null;
  image_name: string | null;
  status: string;
  created_at: string;
  prediction_id: string | null;
  video_url: string | null;
  error_message: string | null;
};

export default function History() {
  const [generations, setGenerations] = useState<VideoGeneration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGenerations = async () => {
    try {
      const { data, error } = await supabase
        .from("video_generations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGenerations(data || []);
    } catch (error) {
      console.error("Error fetching generations:", error);
      toast.error("Errore nel caricare lo storico");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGenerations();
  }, []);

  useVideoPolling(generations, fetchGenerations);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("video_generations")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setGenerations(generations.filter(g => g.id !== id));
      toast.success("Richiesta eliminata");
    } catch (error) {
      console.error("Error deleting generation:", error);
      toast.error("Errore nell'eliminazione");
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Storico Generazioni</h1>
            <p className="text-muted-foreground">
              Tutte le tue richieste di generazione video salvate
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Caricamento...</p>
            </div>
          ) : generations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Nessuna generazione salvata ancora
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {generations.map((gen) => (
                <Card key={gen.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {gen.type === "image_to_video" ? (
                          <Image className="w-5 h-5 text-accent" />
                        ) : (
                          <FileText className="w-5 h-5 text-primary" />
                        )}
                        <div>
                          <CardTitle className="text-lg">
                            {gen.type === "image_to_video"
                              ? "Video da Immagine"
                              : "Video da Testo"}
                          </CardTitle>
                          <CardDescription>
                            {new Date(gen.created_at).toLocaleDateString("it-IT", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </CardDescription>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(gen.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {gen.prompt && (
                        <div>
                          <p className="text-sm font-medium mb-1">Prompt:</p>
                          <p className="text-sm text-muted-foreground">{gen.prompt}</p>
                        </div>
                      )}
                      
                      {gen.image_url && (
                        <div>
                          <p className="text-sm font-medium mb-2">Immagine:</p>
                          <img
                            src={gen.image_url}
                            alt={gen.image_name || "Preview"}
                            className="rounded-lg max-w-xs max-h-48 object-contain border border-border"
                          />
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 items-center">
                        <Badge variant="outline">
                          Durata: {gen.duration}s
                        </Badge>
                        {gen.resolution && (
                          <Badge variant="outline">
                            {gen.resolution}
                          </Badge>
                        )}
                        {gen.motion_intensity && (
                          <Badge variant="outline">
                            Movimento: {gen.motion_intensity}
                          </Badge>
                        )}
                        <Badge
                          variant={
                            gen.status === "completed" 
                              ? "default" 
                              : gen.status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {gen.status === "processing" && (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          )}
                          {gen.status === "completed" && "✓ Completato"}
                          {gen.status === "processing" && "Generazione..."}
                          {gen.status === "failed" && "✗ Errore"}
                          {gen.status === "pending" && "In attesa"}
                        </Badge>
                      </div>

                      {gen.status === "completed" && gen.video_url && (
                        <div className="mt-4">
                          <video
                            src={gen.video_url}
                            controls
                            className="w-full rounded-lg border border-border max-h-96"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => window.open(gen.video_url, "_blank")}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Scarica Video
                          </Button>
                        </div>
                      )}

                      {gen.status === "failed" && gen.error_message && (
                        <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-sm">
                          {gen.error_message}
                        </div>
                      )}

                      {gen.status === "processing" && (
                        <div className="mt-2 p-2 rounded bg-primary/10 text-primary text-sm">
                          Il video è in fase di generazione. La pagina si aggiornerà automaticamente.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
