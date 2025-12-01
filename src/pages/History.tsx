import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useVideoPolling } from "@/hooks/useVideoPolling";
import { VideoGenerationCard } from "@/components/VideoGenerationCard";
import { StoryboardVideoBatchCard } from "@/components/StoryboardVideoBatchCard";

type VideoBatch = {
  id: string;
  transition_style: string | null;
  transition_speed: string | null;
  duration: number;
  camera_movement: string | null;
  audio_type: string | null;
};

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
  batch_id: string | null;
  sequence_order: number | null;
};

export default function History() {
  const [generations, setGenerations] = useState<VideoGeneration[]>([]);
  const [batches, setBatches] = useState<Map<string, VideoBatch>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchGenerations = async () => {
    try {
      const { data, error } = await supabase
        .from("video_generations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGenerations(data || []);

      // Fetch batch info for videos that belong to batches
      const batchIds = [...new Set(data?.filter(g => g.batch_id).map(g => g.batch_id))];
      if (batchIds.length > 0) {
        const { data: batchData, error: batchError } = await supabase
          .from("storyboard_video_batches")
          .select("id, transition_style, transition_speed, duration, camera_movement, audio_type")
          .in("id", batchIds);

        if (batchError) throw batchError;
        
        const batchMap = new Map<string, VideoBatch>();
        batchData?.forEach(batch => {
          batchMap.set(batch.id, batch as VideoBatch);
        });
        setBatches(batchMap);
      }
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
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
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
            <div className="space-y-6">
              {(() => {
                // Group videos by batch_id
                const videoBatches = new Map<string, VideoGeneration[]>();
                const standaloneVideos: VideoGeneration[] = [];

                generations.forEach(gen => {
                  if (gen.batch_id) {
                    const batch = videoBatches.get(gen.batch_id) || [];
                    batch.push(gen);
                    videoBatches.set(gen.batch_id, batch);
                  } else {
                    standaloneVideos.push(gen);
                  }
                });

                return (
                  <>
                    {/* Batch videos */}
                    {Array.from(videoBatches.entries()).map(([batchId, videos]) => (
                      <StoryboardVideoBatchCard 
                        key={batchId} 
                        batchId={batchId} 
                        videos={videos}
                        batchInfo={batches.get(batchId)}
                      />
                    ))}

                    {/* Standalone videos */}
                    {standaloneVideos.length > 0 && (
                      <>
                        {videoBatches.size > 0 && (
                          <div className="mt-8 mb-4">
                            <h2 className="text-xl font-semibold">Video Singoli</h2>
                            <p className="text-sm text-muted-foreground">Video generati individualmente</p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {standaloneVideos.map((generation) => (
                            <VideoGenerationCard key={generation.id} generation={generation} />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
        <Footer />
      </div>
    </AuthGuard>
  );
}
