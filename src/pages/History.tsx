import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight, Trash2, Wrench, RefreshCw, AlertTriangle, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { useVideoPolling } from "@/hooks/useVideoPolling";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { VideoGenerationCard } from "@/components/VideoGenerationCard";
import { StoryboardVideoBatchCard } from "@/components/StoryboardVideoBatchCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [isRepairing, setIsRepairing] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [failedCount, setFailedCount] = useState(0);
  
  const { isSupported: pushSupported, isEnabled: pushEnabled, requestPermission } = usePushNotifications();

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      const { error: videosError } = await supabase
        .from("video_generations")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (videosError) throw videosError;

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

  const handleRepairLinks = async () => {
    setIsRepairing(true);
    try {
      // Fetch all completed videos that might need repair
      const { data: videosToRepair, error: fetchError } = await supabase
        .from("video_generations")
        .select("id, video_url, prediction_id")
        .eq("status", "completed")
        .not("video_url", "is", null);

      if (fetchError) throw fetchError;

      let repairedCount = 0;

      for (const video of videosToRepair || []) {
        // Check if the video URL is broken (points to non-existent storage)
        const isBrokenStorageUrl = video.video_url?.includes("/storage/v1/object/") || 
          (video.video_url?.includes("video-proxy") && video.video_url?.includes("storage%2Fv1"));
        
        if (!isBrokenStorageUrl) continue;
        
        // If we have a prediction_id, try to re-fetch the video URL from the API
        if (video.prediction_id && !video.prediction_id.startsWith('kling:') && 
            !video.prediction_id.startsWith('freepik:') && !video.prediction_id.startsWith('replicate:')) {
          
          // Call generate-video to re-poll and update the URL
          const { data, error } = await supabase.functions.invoke("generate-video", {
            body: { operationId: video.prediction_id, generationId: video.id }
          });

          if (!error && data?.status === "succeeded") {
            repairedCount++;
          }
        }
      }

      if (repairedCount > 0) {
        toast.success(`${repairedCount} link video riparati con successo`);
        fetchGenerations();
      } else {
        toast.info("Nessun link da riparare trovato (o i video erano già validi)");
      }
    } catch (error) {
      console.error("Error repairing links:", error);
      toast.error("Errore nella riparazione dei link");
    } finally {
      setIsRepairing(false);
    }
  };

  const handleRetry = async (generation: VideoGeneration) => {
    try {
      toast.info("Avvio nuova generazione...");
      
      // Create new generation with same parameters
      const { data: newGen, error: insertError } = await supabase
        .from("video_generations")
        .insert({
          type: generation.type,
          prompt: generation.prompt,
          duration: generation.duration,
          resolution: generation.resolution,
          motion_intensity: generation.motion_intensity,
          image_url: generation.image_url,
          image_name: generation.image_name,
          status: "processing",
          user_id: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Call the generate-video function
      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: {
          prompt: generation.prompt,
          duration: generation.duration,
          resolution: generation.resolution,
          motionIntensity: generation.motion_intensity,
          type: generation.type,
          imageUrl: generation.image_url,
          generationId: newGen.id,
        },
      });

      if (error) throw error;

      // Update with prediction ID
      if (data?.id) {
        await supabase
          .from("video_generations")
          .update({ prediction_id: data.id })
          .eq("id", newGen.id);
      }

      toast.success("Generazione avviata con successo");
      fetchGenerations();
    } catch (error) {
      console.error("Error retrying generation:", error);
      toast.error("Errore nell'avvio della nuova generazione");
    }
  };

  const fetchGenerations = async () => {
    try {
      setLoading(true);

      // Get total count
      const { count, error: countError } = await supabase
        .from("video_generations")
        .select("*", { count: "exact", head: true });

      if (countError) throw countError;
      setTotalCount(count || 0);

      // Get failed count
      const { count: failedCountResult, error: failedCountError } = await supabase
        .from("video_generations")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed");

      if (!failedCountError) {
        setFailedCount(failedCountResult || 0);
      }

      // Fetch paginated data
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from("video_generations")
        .select(
          "id, type, prompt, duration, resolution, motion_intensity, image_name, status, created_at, prediction_id, video_url, error_message, batch_id, sequence_order, image_url"
        )
        .order("created_at", { ascending: false });

      // Apply filter for errors tab
      if (activeTab === "errors") {
        query = query.eq("status", "failed");
      }

      const { data, error } = await query.range(from, to);

      if (error) throw error;

      const normalizedData: VideoGeneration[] = (data || []).map((gen: any) => ({
        ...gen,
        status: gen.status || "pending",
      }));

      setGenerations(normalizedData);

      // Fetch batch info
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

  const totalPages = Math.ceil(
    (activeTab === "errors" ? failedCount : totalCount) / ITEMS_PER_PAGE
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  useEffect(() => {
    fetchGenerations();
  }, [currentPage, activeTab]);

  useVideoPolling(generations, fetchGenerations);

  const renderGenerationsList = (gens: VideoGeneration[], showRetry = false) => {
    const videoBatches = new Map<string, VideoGeneration[]>();
    const standaloneVideos: VideoGeneration[] = [];

    gens.forEach(gen => {
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
                <div key={generation.id} className="space-y-2">
                  <VideoGenerationCard 
                    generation={generation}
                    onDelete={fetchGenerations}
                  />
                  {showRetry && generation.status === "failed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleRetry(generation)}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Riprova generazione
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </>
    );
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Storico Generazioni</h1>
              <p className="text-muted-foreground">
                Tutte le tue richieste di generazione video salvate
                {totalCount > 0 && ` (${totalCount} totali)`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {pushSupported && (
                <Button
                  variant={pushEnabled ? "secondary" : "outline"}
                  onClick={requestPermission}
                  disabled={pushEnabled}
                >
                  {pushEnabled ? (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Notifiche attive
                    </>
                  ) : (
                    <>
                      <BellOff className="w-4 h-4 mr-2" />
                      Abilita notifiche
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleRepairLinks}
                disabled={isRepairing || totalCount === 0}
              >
                {isRepairing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wrench className="w-4 h-4 mr-2" />
                )}
                Ripara link video
              </Button>
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
          </div>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }} className="mb-6">
            <TabsList>
              <TabsTrigger value="all">
                Tutti i video
                {totalCount > 0 && <span className="ml-2 text-xs">({totalCount})</span>}
              </TabsTrigger>
              <TabsTrigger value="errors" className="relative">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Errori
                {failedCount > 0 && (
                  <span className="ml-2 text-xs bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5">
                    {failedCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
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
                  {renderGenerationsList(generations)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="errors" className="mt-6">
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Caricamento...</p>
                </div>
              ) : generations.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="space-y-2">
                      <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto" />
                      <p className="text-muted-foreground">
                        Nessun video con errori
                      </p>
                      <p className="text-sm text-muted-foreground">
                        I video che falliscono appariranno qui con l'opzione per riprovare
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {renderGenerationsList(generations, true)}
                </div>
              )}
            </TabsContent>
          </Tabs>

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
        </div>
        <Footer />
      </div>
    </AuthGuard>
  );
}
