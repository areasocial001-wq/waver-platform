import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { TimelineEditor } from "@/components/timeline/TimelineEditor";

const TimelineEditorPage = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-20">
        <div className="container mx-auto max-w-[1600px] px-4 py-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">Timeline Editor</h1>
            <p className="text-muted-foreground mt-1">
              Editor multi-traccia professionale per video, voiceover, musica e SFX
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
            <TimelineEditor />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TimelineEditorPage;
