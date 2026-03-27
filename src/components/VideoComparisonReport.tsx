import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Download, FileText, Camera, Star, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface VideoResult {
  provider: string;
  providerName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

interface VideoNote {
  provider: string;
  rating: number;
  notes: string;
  pros: string;
  cons: string;
}

interface VideoComparisonReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: VideoResult[];
  prompt: string;
  sourceImageUrl?: string;
}

export const VideoComparisonReport = ({
  open,
  onOpenChange,
  results,
  prompt,
  sourceImageUrl,
}: VideoComparisonReportProps) => {
  const [reportTitle, setReportTitle] = useState('Report Confronto Video');
  const [videoNotes, setVideoNotes] = useState<Record<string, VideoNote>>({});
  const [generalNotes, setGeneralNotes] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [videoScreenshots, setVideoScreenshots] = useState<Record<string, string>>({});
  const reportRef = useRef<HTMLDivElement>(null);

  const completedResults = results.filter(r => r.status === 'completed' && r.videoUrl);

  const updateNote = (provider: string, field: keyof VideoNote, value: string | number) => {
    setVideoNotes(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        provider,
        [field]: value,
      } as VideoNote,
    }));
  };

  const captureVideoScreenshot = async (provider: string, videoUrl: string) => {
    try {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = videoUrl;
      
      await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = reject;
        video.load();
      });

      // Seek to middle of video
      video.currentTime = video.duration / 2;
      
      await new Promise(resolve => {
        video.onseeked = resolve;
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      
      const screenshot = canvas.toDataURL('image/jpeg', 0.8);
      setVideoScreenshots(prev => ({ ...prev, [provider]: screenshot }));
      toast.success(`Screenshot catturato per ${provider}`);
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      toast.error('Errore nella cattura dello screenshot');
    }
  };

  const exportToPDF = async () => {
    if (!reportRef.current) return;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;

      pdf.addImage(imgData, 'PNG', imgX, 10, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`${reportTitle.replace(/\s+/g, '-')}-${Date.now()}.pdf`);
      
      toast.success('Report PDF esportato!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Errore nell\'esportazione del PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToJSON = () => {
    const reportData = {
      title: reportTitle,
      generatedAt: new Date().toISOString(),
      prompt,
      sourceImageUrl,
      results: completedResults.map(r => ({
        provider: r.provider,
        providerName: r.providerName,
        videoUrl: r.videoUrl,
        notes: videoNotes[r.provider] || null,
        screenshot: videoScreenshots[r.provider] || null,
      })),
      generalNotes,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle.replace(/\s+/g, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Report JSON esportato!');
  };

  const StarRating = ({ provider, value }: { provider: string; value: number }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => updateNote(provider, 'rating', star)}
          className="focus:outline-none"
        >
          <Star
            className={`h-5 w-5 transition-colors ${
              star <= value
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground hover:text-yellow-400'
            }`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Report Confronto Video
          </DialogTitle>
          <DialogDescription>
            Crea un report comparativo con screenshot, note e valutazioni
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          <div ref={reportRef} className="space-y-6 p-4 bg-background">
            {/* Report Header */}
            <div className="space-y-2">
              <Label>Titolo Report</Label>
              <Input
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="Inserisci il titolo del report"
              />
            </div>

            {/* Prompt Used */}
            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground">Prompt utilizzato</Label>
              <p className="text-sm mt-1">{prompt || 'Nessun prompt specificato'}</p>
            </div>

            {/* Source Image */}
            {sourceImageUrl && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Immagine sorgente</Label>
                <div className="w-48 aspect-video bg-muted rounded overflow-hidden">
                  <img src={sourceImageUrl} alt="Source" className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            {/* Video Comparison Cards */}
            <div className="space-y-4">
              <Label>Confronto Video</Label>
              
              {completedResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun video completato da confrontare</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {completedResults.map((result) => {
                    const notes = videoNotes[result.provider] || { rating: 0, notes: '', pros: '', cons: '' };
                    const screenshot = videoScreenshots[result.provider];
                    
                    return (
                      <Card key={result.provider} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{result.providerName}</Badge>
                          <StarRating provider={result.provider} value={notes.rating || 0} />
                        </div>

                        {/* Screenshot or Video Preview */}
                        <div className="aspect-video bg-black rounded overflow-hidden relative">
                          {screenshot ? (
                            <img src={screenshot} alt="Screenshot" className="w-full h-full object-contain" />
                          ) : (
                            <video
                              src={result.videoUrl}
                              className="w-full h-full object-contain"
                              muted
                            />
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute bottom-2 right-2"
                            onClick={() => captureVideoScreenshot(result.provider, result.videoUrl!)}
                          >
                            <Camera className="h-4 w-4 mr-1" />
                            Screenshot
                          </Button>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Pro</Label>
                            <Textarea
                              placeholder="Punti di forza..."
                              value={notes.pros || ''}
                              onChange={(e) => updateNote(result.provider, 'pros', e.target.value)}
                              rows={2}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Contro</Label>
                            <Textarea
                              placeholder="Punti deboli..."
                              value={notes.cons || ''}
                              onChange={(e) => updateNote(result.provider, 'cons', e.target.value)}
                              rows={2}
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Note aggiuntive</Label>
                            <Textarea
                              placeholder="Altre osservazioni..."
                              value={notes.notes || ''}
                              onChange={(e) => updateNote(result.provider, 'notes', e.target.value)}
                              rows={2}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* General Notes */}
            <div className="space-y-2">
              <Label>Note Generali e Conclusioni</Label>
              <Textarea
                placeholder="Scrivi le tue conclusioni sul confronto..."
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={exportToJSON}>
            <Download className="h-4 w-4 mr-2" />
            Esporta JSON
          </Button>
          <Button onClick={exportToPDF} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Esportazione...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Esporta PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};