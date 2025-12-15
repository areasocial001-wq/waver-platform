import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Loader2, Library, Plus, Filter, ChevronDown, ExternalLink } from "lucide-react";

interface StockLibraryDialogProps {
  onSelectImage: (imageUrl: string) => void;
  trigger?: React.ReactNode;
}

export const StockLibraryDialog = ({ onSelectImage, trigger }: StockLibraryDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [contentType, setContentType] = useState("resources");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Advanced filters
  const [orientation, setOrientation] = useState<string>("all");
  const [license, setLicense] = useState<string>("all");
  const [excludeAI, setExcludeAI] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [freeOnly, setFreeOnly] = useState(true); // Default ON for storyboard usage

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error("Inserisci un termine di ricerca");
      return;
    }

    setIsLoading(true);
    setResults([]);

    try {
      const filters: any = { 
        term: searchTerm, 
        contentType, 
        limit: 24 
      };
      
      // Add advanced filters
      if (orientation !== "all") filters.orientation = orientation;
      if (freeOnly) filters.license = "free";
      else if (license !== "all") filters.license = license;
      if (excludeAI) filters.excludeAI = true;
      if (dateFilter !== "all") filters.dateFilter = dateFilter;

      const { data, error } = await supabase.functions.invoke("freepik-stock", {
        body: filters,
      });

      if (error) throw error;

      setResults(data?.data || []);
      if ((data?.data?.length || 0) === 0) {
        toast.info("Nessun risultato trovato");
      }
    } catch (err: any) {
      console.error("Search error:", err);
      toast.error(err.message || "Errore nella ricerca");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectImage = async (item: any) => {
    const imageUrl = item.preview?.url || item.thumbnails?.[0]?.url || item.image?.url;

    if (!imageUrl) {
      toast.error("URL immagine non disponibile");
      return;
    }

    const isPremium = item?.premium === 1 || item?.premium === true || item?.licenses?.some((l: any) => l?.type === "premium");
    if (isPremium) {
      toast.warning("Questo asset è Premium: uso l'anteprima (non scaricabile via API).");
      onSelectImage(imageUrl);
      setIsOpen(false);
      return;
    }

    // Try to get high-res version via download endpoint
    try {
      const { data, error } = await supabase.functions.invoke("freepik-stock", {
        body: { action: "download", resourceId: item.id, contentType },
      });

      if (error) {
        const msg = (error as any)?.message || "";
        if (msg.includes("403")) {
          toast.warning("Download HD non autorizzato per questo asset: uso anteprima.");
        } else if (msg.includes("404")) {
          toast.warning("Download HD non disponibile per questo tipo: uso anteprima.");
        } else {
          toast.warning("Impossibile scaricare la versione HD: uso anteprima.");
        }
        onSelectImage(imageUrl);
      } else if (data?.data?.url) {
        onSelectImage(data.data.url);
        toast.success("Asset HD aggiunto al pannello!");
      } else {
        onSelectImage(imageUrl);
        toast.success("Asset aggiunto al pannello!");
      }
    } catch {
      onSelectImage(imageUrl);
      toast.success("Asset aggiunto al pannello!");
    }

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Library className="mr-2 h-4 w-4" />
            Stock Library
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            Freepik Stock Library
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Cerca immagini, icone, video..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resources">Immagini</SelectItem>
                <SelectItem value="icons">Icone</SelectItem>
                <SelectItem value="videos">Video</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? "bg-accent" : ""}
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleContent className="space-y-4 pt-2 pb-4 border-b border-border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Orientamento</Label>
                  <Select value={orientation} onValueChange={setOrientation}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      <SelectItem value="horizontal">Orizzontale</SelectItem>
                      <SelectItem value="vertical">Verticale</SelectItem>
                      <SelectItem value="square">Quadrato</SelectItem>
                      <SelectItem value="panoramic">Panoramico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Licenza</Label>
                  <Select value={license} onValueChange={setLicense}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte</SelectItem>
                      <SelectItem value="free">Gratuita</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Periodo</Label>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Sempre</SelectItem>
                      <SelectItem value="last_week">Ultima settimana</SelectItem>
                      <SelectItem value="last_month">Ultimo mese</SelectItem>
                      <SelectItem value="last_3_months">Ultimi 3 mesi</SelectItem>
                      <SelectItem value="last_year">Ultimo anno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Escludi AI</Label>
                  <div className="flex items-center h-8">
                    <Switch
                      checked={excludeAI}
                      onCheckedChange={setExcludeAI}
                    />
                    <span className="text-xs text-muted-foreground ml-2">
                      {excludeAI ? "Sì" : "No"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={freeOnly}
                  onCheckedChange={setFreeOnly}
                />
                <Label className="text-sm font-medium">Solo gratuiti</Label>
                <span className="text-xs text-muted-foreground">
                  (scaricabili via API)
                </span>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <ScrollArea className="h-[50vh]">
            {results.length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {results.map((item: any) => (
                  <Card
                    key={item.id}
                    className="overflow-hidden cursor-pointer group hover:border-primary/50 transition-colors"
                    onClick={() => handleSelectImage(item)}
                  >
                    <div className="relative aspect-square">
                      <img
                        src={item.preview?.url || item.thumbnails?.[0]?.url || item.image?.url}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button size="sm" variant="secondary">
                          <Plus className="h-4 w-4 mr-1" />
                          Usa
                        </Button>
                        {item.licenses?.some((l: any) => l?.type === "premium") && item.url && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-background/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(item.url, "_blank");
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <CardContent className="p-2">
                      <p className="text-xs truncate text-muted-foreground">{item.title}</p>
                      {item.licenses?.some((l: any) => l?.type === "premium") && (
                        <Badge variant="secondary" className="text-xs mt-1">Premium</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
                <Search className="h-12 w-12 mb-4 opacity-50" />
                <p>Cerca immagini nella libreria Freepik</p>
                <p className="text-sm">100+ milioni di asset disponibili</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
