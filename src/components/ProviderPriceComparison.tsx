import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingDown, TrendingUp, Minus, DollarSign, Zap, Clock, Star, Info, Music, Film, Image, Mic } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PriceData {
  provider: string;
  logo: string;
  price: string;
  unit: string;
  quality: 'high' | 'medium' | 'low';
  speed: 'fast' | 'medium' | 'slow';
  isRecommended?: boolean;
  notes?: string;
}

interface OperationPricing {
  operation: string;
  icon: React.ReactNode;
  label: string;
  providers: PriceData[];
}

const PRICING_DATA: OperationPricing[] = [
  {
    operation: 'music_generation',
    icon: <Music className="h-4 w-4" />,
    label: 'Generazione Musica',
    providers: [
      { 
        provider: 'AI/ML (Stable Audio)', 
        logo: '🤖', 
        price: '$0.10',
        unit: '/track',
        quality: 'high',
        speed: 'fast',
        isRecommended: true,
        notes: 'Stable Audio 2.0, ottimo rapporto qualità/prezzo'
      },
      { 
        provider: 'AI/ML (Suno)', 
        logo: '🤖', 
        price: '$0.50',
        unit: '/track (30s)',
        quality: 'high',
        speed: 'medium',
        notes: 'Modello Suno v4, ottima creatività'
      },
      { 
        provider: 'AI/ML (Udio)', 
        logo: '🤖', 
        price: '$0.40',
        unit: '/track (30s)',
        quality: 'high',
        speed: 'medium',
        notes: 'Udio v1.5, alta fedeltà'
      },
      { 
        provider: 'PiAPI', 
        logo: '🎬', 
        price: '$0.20',
        unit: '/30s',
        quality: 'medium',
        speed: 'slow',
        notes: 'Economico ma meno opzioni'
      },
    ]
  },
  {
    operation: 'sound_effects',
    icon: <Zap className="h-4 w-4" />,
    label: 'Effetti Sonori',
    providers: [
      { 
        provider: 'AI/ML (Stable Audio)', 
        logo: '🤖', 
        price: '$0.05',
        unit: '/effetto',
        quality: 'high',
        speed: 'fast',
        isRecommended: true,
        notes: 'Stable Audio, fino a 22s'
      },
    ]
  },
  {
    operation: 'text_to_speech',
    icon: <Mic className="h-4 w-4" />,
    label: 'Text-to-Speech',
    providers: [
      { 
        provider: 'Inworld TTS', 
        logo: '🗣️', 
        price: '$0.005',
        unit: '/1K caratteri',
        quality: 'high',
        speed: 'fast',
        isRecommended: true,
        notes: 'Voci multilingua, latenza <120ms, supporto IVC'
      },
      { 
        provider: 'AI/ML (OpenAI)', 
        logo: '🤖', 
        price: '$0.015',
        unit: '/1K caratteri',
        quality: 'medium',
        speed: 'fast',
        notes: 'TTS-1-HD, economico'
      },
    ]
  },
  {
    operation: 'video_generation',
    icon: <Film className="h-4 w-4" />,
    label: 'Generazione Video',
    providers: [
      { 
        provider: 'PiAPI (Kling)', 
        logo: '🎬', 
        price: '$1.00',
        unit: '/5s video',
        quality: 'high',
        speed: 'slow',
        isRecommended: true,
        notes: 'Kling v1.6 Pro, alta qualità'
      },
      { 
        provider: 'AI/ML (Runway)', 
        logo: '🤖', 
        price: '$0.50',
        unit: '/5s video',
        quality: 'high',
        speed: 'medium',
        notes: 'Gen-3 Alpha Turbo'
      },
      { 
        provider: 'AI/ML (Kling)', 
        logo: '🤖', 
        price: '$0.80',
        unit: '/5s video',
        quality: 'high',
        speed: 'medium',
        notes: 'Kling via gateway AI/ML'
      },
      { 
        provider: 'AI/ML (Veo)', 
        logo: '🤖', 
        price: '$1.20',
        unit: '/5s video',
        quality: 'high',
        speed: 'slow',
        notes: 'Google Veo 3.1, top quality'
      },
    ]
  },
  {
    operation: 'image_generation',
    icon: <Image className="h-4 w-4" />,
    label: 'Generazione Immagini',
    providers: [
      { 
        provider: 'AI/ML (FLUX)', 
        logo: '🤖', 
        price: '$0.06',
        unit: '/immagine',
        quality: 'high',
        speed: 'fast',
        isRecommended: true,
        notes: 'FLUX 1.1 Pro, fotorealistico'
      },
      { 
        provider: 'AI/ML (DALL-E 3)', 
        logo: '🤖', 
        price: '$0.04',
        unit: '/immagine',
        quality: 'high',
        speed: 'medium',
        notes: 'Ottimo per illustrazioni'
      },
      { 
        provider: 'AI/ML (SDXL)', 
        logo: '🤖', 
        price: '$0.02',
        unit: '/immagine',
        quality: 'medium',
        speed: 'fast',
        notes: 'Economico, buona qualità'
      },
      { 
        provider: 'PiAPI', 
        logo: '🎬', 
        price: '$0.03',
        unit: '/immagine',
        quality: 'medium',
        speed: 'medium',
        notes: 'Vari modelli disponibili'
      },
    ]
  },
];

const QualityBadge = ({ quality }: { quality: 'high' | 'medium' | 'low' }) => {
  const config = {
    high: { label: 'Alta', variant: 'default' as const, icon: <Star className="h-3 w-3" /> },
    medium: { label: 'Media', variant: 'secondary' as const, icon: <Minus className="h-3 w-3" /> },
    low: { label: 'Bassa', variant: 'outline' as const, icon: <TrendingDown className="h-3 w-3" /> },
  };
  const { label, variant, icon } = config[quality];
  
  return (
    <Badge variant={variant} className="text-[10px] gap-0.5">
      {icon} {label}
    </Badge>
  );
};

const SpeedBadge = ({ speed }: { speed: 'fast' | 'medium' | 'slow' }) => {
  const config = {
    fast: { label: 'Veloce', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
    medium: { label: 'Medio', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
    slow: { label: 'Lento', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  };
  const { label, className } = config[speed];
  
  return (
    <Badge variant="outline" className={`text-[10px] ${className}`}>
      <Clock className="h-2.5 w-2.5 mr-0.5" /> {label}
    </Badge>
  );
};

export default function ProviderPriceComparison() {
  const [activeTab, setActiveTab] = useState<string>('all');

  const findBestPrice = (providers: PriceData[]) => {
    // Simple heuristic: parse price and find lowest
    return providers.reduce((best, current) => {
      const bestPrice = parseFloat(best.price.replace('$', ''));
      const currentPrice = parseFloat(current.price.replace('$', ''));
      return currentPrice < bestPrice ? current : best;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          <CardTitle>Confronto Prezzi Provider</CardTitle>
        </div>
        <CardDescription>
          Prezzi stimati per operazione. I costi effettivi possono variare in base al volume e al piano tariffario.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex-wrap h-auto gap-1 mb-4">
            <TabsTrigger value="all" className="text-xs">
              Tutti
            </TabsTrigger>
            {PRICING_DATA.map((op) => (
              <TabsTrigger key={op.operation} value={op.operation} className="text-xs gap-1">
                {op.icon}
                <span className="hidden sm:inline">{op.label.split(' ')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            {PRICING_DATA.map((operation) => (
              <div key={operation.operation} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                    {operation.icon}
                  </div>
                  <h4 className="font-medium text-sm">{operation.label}</h4>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Provider</TableHead>
                        <TableHead>Prezzo</TableHead>
                        <TableHead className="hidden sm:table-cell">Qualità</TableHead>
                        <TableHead className="hidden sm:table-cell">Velocità</TableHead>
                        <TableHead className="hidden md:table-cell">Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operation.providers.map((provider, idx) => {
                        const isBest = findBestPrice(operation.providers).provider === provider.provider;
                        return (
                          <TableRow key={idx} className={provider.isRecommended ? 'bg-primary/5' : ''}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span>{provider.logo}</span>
                                <span className="text-sm">{provider.provider}</span>
                                {provider.isRecommended && (
                                  <Badge variant="default" className="text-[9px] px-1">
                                    Consigliato
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className={`font-bold ${isBest ? 'text-green-600' : ''}`}>
                                  {provider.price}
                                </span>
                                <span className="text-xs text-muted-foreground">{provider.unit}</span>
                                {isBest && (
                                  <TrendingDown className="h-3 w-3 text-green-600" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <QualityBadge quality={provider.quality} />
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <SpeedBadge speed={provider.speed} />
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs text-muted-foreground line-clamp-1 cursor-help">
                                      {provider.notes}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{provider.notes}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </TabsContent>

          {PRICING_DATA.map((operation) => (
            <TabsContent key={operation.operation} value={operation.operation}>
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    {operation.icon}
                  </div>
                  <div>
                    <h4 className="font-medium">{operation.label}</h4>
                    <p className="text-xs text-muted-foreground">
                      Confronta i prezzi tra i provider disponibili
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Provider</TableHead>
                        <TableHead>Prezzo</TableHead>
                        <TableHead>Qualità</TableHead>
                        <TableHead>Velocità</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operation.providers.map((provider, idx) => {
                        const isBest = findBestPrice(operation.providers).provider === provider.provider;
                        return (
                          <TableRow key={idx} className={provider.isRecommended ? 'bg-primary/5' : ''}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{provider.logo}</span>
                                <div>
                                  <div className="flex items-center gap-1">
                                    <span>{provider.provider}</span>
                                    {provider.isRecommended && (
                                      <Badge variant="default" className="text-[9px] px-1">
                                        Consigliato
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className={`text-lg font-bold ${isBest ? 'text-green-600' : ''}`}>
                                  {provider.price}
                                </span>
                                <span className="text-sm text-muted-foreground">{provider.unit}</span>
                                {isBest && (
                                  <Badge variant="outline" className="text-[9px] text-green-600 border-green-600">
                                    Più economico
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <QualityBadge quality={provider.quality} />
                            </TableCell>
                            <TableCell>
                              <SpeedBadge speed={provider.speed} />
                            </TableCell>
                            <TableCell>
                              <p className="text-sm text-muted-foreground">{provider.notes}</p>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <Separator className="my-4" />
        
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>
            I prezzi sono indicativi e basati sulle tariffe pubblicate a gennaio 2026.
            Consulta i siti ufficiali per i prezzi aggiornati. AI/ML API offre prezzi variabili
            in base al modello selezionato.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
