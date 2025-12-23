import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useVideoPolling } from "@/hooks/useVideoPolling";
import { VideoGenerationCard } from "@/components/VideoGenerationCard";
import { StoryboardVideoBatchCard } from "@/components/StoryboardVideoBatchCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ITEMS_PER_PAGE = 12;

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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      // Delete all video generations first
      const { error: videosError } = await supabase
        .from("video_generations")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Workaround to delete all

      if (videosError) throw videosError;

      // Delete all batches
      const { error: batchesError } = await supabase
        .from("storyboard_video_batches")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (batchesError) throw batchesError;

      toast.success("Storico eliminato con successo");
      setCurrentPage(1);
      fetchGenerations();
    } catch (error) {
      console.error("Error deleting all:", error);
      toast.error("Errore nell'eliminazione dello storico");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const fetchGenerations = async () => {
    try {
      setLoading(true);

      // Get total count first
      const { count, error: countError } = await supabase
        .from("video_generations")
        .select("*", { count: "exact", head: true });

      if (countError) throw countError;
      setTotalCount(count || 0);

      // Fetch paginated data (avoid selecting image_url because it can be very large)
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error } = await supabase
        .from("video_generations")
        .select(
          "id, type, prompt, duration, resolution, motion_intensity, image_name, status, created_at, prediction_id, video_url, error_message, batch_id, sequence_order"
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Normalize data
      const normalizedData: VideoGeneration[] = (data || []).map((gen: any) => ({
        ...gen,
        // don't load large previews in History list
        image_url: null,
        status: gen.status || "pending",
      }));

      setGenerations(normalizedData);

      // Fetch batch info for videos that belong to batches
      const batchIds = [...new Set((data || []).filter((g: any) => g.batch_id).map((g: any) => g.batch_id))];
      if (batchIds.length > 0) {
        const { data: batchData, error: batchError } = await supabase
          .from("storyboard_video_batches")
          .select("id, transition_style, transition_speed, duration, camera_movement, audio_type")
          .in("id", batchIds);

        if (batchError) throw batchError;

        const batchMap = new Map<string, VideoBatch>();
        batchData?.forEach((batch) => {
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

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  useEffect(() => {
    fetchGenerations();
  }, [currentPage]);

  useVideoPolling(generations, fetchGenerations);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Storico Generazioni</h1>
              <p className="text-muted-foreground">
                Tutte le tue richieste di generazione video salvate
                {totalCount > 0 && ` (${totalCount} totali)`}
              </p>
            </div>
            {totalCount > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    disabled={isDeletingAll}
                  >
                    {isDeletingAll ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Elimina tutto
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminare tutto lo storico?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Questa azione eliminerà permanentemente tutti i {totalCount} video dallo storico. 
                      L'operazione non può essere annullata.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteAll}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Elimina tutto
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
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
            <>
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
                          onDelete={fetchGenerations}
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
                              <VideoGenerationCard 
                                key={generation.id} 
                                generation={generation}
                                onDelete={fetchGenerations}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Precedente
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Successivo
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        <Footer />
      </div>
    </AuthGuard>
  );
}
