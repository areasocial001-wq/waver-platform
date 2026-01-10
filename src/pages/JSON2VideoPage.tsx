import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import JSON2VideoEditor from "@/components/JSON2VideoEditor";
import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const JSON2VideoPage = () => {
  const [searchParams] = useSearchParams();
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Get video URLs from query params (for storyboard integration)
  const batchId = searchParams.get("batchId");
  const storyboardId = searchParams.get("storyboardId");

  useEffect(() => {
    if (batchId) {
      loadBatchVideos(batchId);
    }
  }, [batchId]);

  const loadBatchVideos = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("video_generations")
        .select("video_url, sequence_order")
        .eq("batch_id", id)
        .eq("status", "completed")
        .order("sequence_order");

      if (error) throw error;

      const urls = data
        .filter(v => v.video_url)
        .map(v => v.video_url as string);

      if (urls.length === 0) {
        toast.warning("Nessun video completato in questo batch");
      } else {
        setVideoUrls(urls);
        toast.success(`Caricati ${urls.length} video dal batch`);
      }
    } catch (error) {
      console.error("Error loading batch videos:", error);
      toast.error("Errore nel caricamento dei video");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = (url: string) => {
    toast.success("Video finale pronto!");
    console.log("Final video URL:", url);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
          ) : (
            <JSON2VideoEditor 
              videoUrls={videoUrls}
              onComplete={handleComplete}
            />
          )}
        </main>
      </div>
    </AuthGuard>
  );
};

export default JSON2VideoPage;
