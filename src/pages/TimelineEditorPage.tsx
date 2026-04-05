import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { TimelineEditor } from "@/components/timeline/TimelineEditor";
import { useStoryboardToTimeline } from "@/hooks/useStoryboardToTimeline";
import { PremiumGate } from "@/components/PremiumGate";
import { Badge } from "@/components/ui/badge";
import { Film, Loader2 } from "lucide-react";

const TimelineEditorPage = () => {
  const [searchParams] = useSearchParams();
  const storyboardId = searchParams.get('storyboard') || undefined;
  const { videoItems, loading } = useStoryboardToTimeline(storyboardId);

  const initialItems = videoItems.length > 0
    ? [{ trackType: 'video' as const, items: videoItems }]
    : undefined;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-20">
        <div className="container mx-auto max-w-[1600px] px-4 py-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Timeline Editor</h1>
              <p className="text-muted-foreground mt-1">
                Editor multi-traccia professionale per video, voiceover, musica e SFX
              </p>
            </div>
            {storyboardId && (
              <Badge variant="secondary" className="gap-1.5">
                <Film className="w-3.5 h-3.5" />
                {loading ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Importazione storyboard...</>
                ) : (
                  <>{videoItems.length} clip importati dallo storyboard</>
                )}
              </Badge>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
            {!loading && <TimelineEditor initialItems={initialItems} />}
            {loading && (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TimelineEditorPage;
