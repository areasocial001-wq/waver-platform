import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Trash2, Edit, Share2, Eye, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Storyboard {
  id: string;
  title: string;
  layout: string;
  template_type: string;
  panels: any[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export default function MyStoryboards() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchStoryboards();
  }, []);

  const fetchStoryboards = async () => {
    try {
      const { data, error } = await supabase
        .from('storyboards')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setStoryboards((data || []).map(item => ({
        id: item.id,
        title: item.title,
        layout: item.layout,
        template_type: item.template_type,
        is_public: item.is_public,
        created_at: item.created_at,
        updated_at: item.updated_at,
        panels: (item.panels as unknown as any[]) || []
      })));
    } catch (error: any) {
      console.error("Error fetching storyboards:", error);
      toast.error("Errore nel caricamento degli storyboard");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo storyboard?")) return;

    try {
      const { error } = await supabase
        .from('storyboards')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success("Storyboard eliminato!");
      fetchStoryboards();
    } catch (error: any) {
      console.error("Error deleting storyboard:", error);
      toast.error("Errore nell'eliminazione");
    }
  };

  const handleTogglePublic = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('storyboards')
        .update({ is_public: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      
      toast.success(currentStatus ? "Storyboard reso privato" : "Storyboard reso pubblico!");
      fetchStoryboards();
    } catch (error: any) {
      console.error("Error toggling public status:", error);
      toast.error("Errore nell'aggiornamento");
    }
  };

  const handleCopyShareLink = (id: string) => {
    const shareUrl = `${window.location.origin}/storyboard/${id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedId(id);
    toast.success("Link copiato!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getPanelCount = (panels: any[]) => {
    return panels.filter(p => p.imageUrl).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background dark">
        <Navbar />
        
        <main className="container mx-auto px-6 py-20">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold mb-2">I Miei Storyboard</h1>
                <p className="text-muted-foreground">
                  Gestisci e condividi i tuoi storyboard salvati
                </p>
              </div>
              <Button
                onClick={() => navigate("/#generate")}
                className="bg-gradient-to-r from-primary to-primary/80"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Storyboard
              </Button>
            </div>

            {storyboards.length === 0 ? (
              <Card className="text-center p-12">
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Non hai ancora creato nessuno storyboard
                  </p>
                  <Button onClick={() => navigate("/#generate")}>
                    Crea il tuo primo storyboard
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {storyboards.map((storyboard) => (
                  <Card key={storyboard.id} className="overflow-hidden hover:border-primary/50 transition-colors">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="truncate">{storyboard.title}</span>
                        {storyboard.is_public && (
                          <Eye className="h-4 w-4 text-green-500 flex-shrink-0" />
                        )}
                      </CardTitle>
                      <CardDescription>
                        Layout: {storyboard.layout} • {getPanelCount(storyboard.panels)}/{storyboard.panels.length} pannelli
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Aggiornato: {new Date(storyboard.updated_at).toLocaleDateString('it-IT')}
                      </p>
                      
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigate(`/?storyboardId=${storyboard.id}#generate`);
                          }}
                          className="flex-1"
                        >
                          <Edit className="mr-2 h-3 w-3" />
                          Modifica
                        </Button>
                        
                        <Button
                          size="sm"
                          variant={storyboard.is_public ? "default" : "outline"}
                          onClick={() => handleTogglePublic(storyboard.id, storyboard.is_public)}
                        >
                          <Share2 className="mr-2 h-3 w-3" />
                          {storyboard.is_public ? "Pubblico" : "Privato"}
                        </Button>
                      </div>

                      {storyboard.is_public && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleCopyShareLink(storyboard.id)}
                          className="w-full"
                        >
                          {copiedId === storyboard.id ? "✓ Copiato!" : "Copia Link"}
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(storyboard.id)}
                        className="w-full"
                      >
                        <Trash2 className="mr-2 h-3 w-3" />
                        Elimina
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </AuthGuard>
  );
}