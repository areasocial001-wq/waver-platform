import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, Download, Save, Upload, X, ImageIcon, Images, Wand2, Heart, Trash2, FileDown, FileUp, Columns, Undo2, Redo2, Search, ArrowUpDown, Grid3X3, List, Plus, Settings2, Copy, Zap } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useImageGallery } from "@/contexts/ImageGalleryContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CustomPreset {
  id: string;
  name: string;
  filters: string[];
  intensity: number;
}

interface FilterState {
  filters: string[];
  intensity: number;
}

type FilterCategory = "all" | "classic" | "artistic" | "creative" | "atmospheric" | "custom";

interface ImageFilter {
  id: string;
  name: string;
  prompt: string;
  cssFilter: string;
  category: FilterCategory;
  isCustom?: boolean;
}

interface CustomFilterParams {
  brightness: number;
  contrast: number;
  saturate: number;
  sepia: number;
  hueRotate: number;
  blur: number;
  grayscale: number;
}

const imageFilters: ImageFilter[] = [
  // Classic Filters
  { id: "vintage", name: "Vintage", category: "classic", prompt: "Apply vintage film photography style with warm tones, grain, and faded colors", cssFilter: "sepia(0.4) contrast(1.1) brightness(0.95) saturate(0.9)" },
  { id: "hdr", name: "HDR", category: "classic", prompt: "Apply HDR effect with enhanced dynamic range, vivid colors and sharp details", cssFilter: "contrast(1.3) saturate(1.4) brightness(1.05)" },
  { id: "bw", name: "Bianco e Nero", category: "classic", prompt: "Convert to high contrast black and white with dramatic shadows", cssFilter: "grayscale(1) contrast(1.2)" },
  { id: "cinematic", name: "Cinematico", category: "classic", prompt: "Apply cinematic color grading with film-like tones and letterbox feel", cssFilter: "contrast(1.15) saturate(0.85) brightness(0.9) sepia(0.15)" },
  { id: "polaroid", name: "Polaroid", category: "classic", prompt: "Apply instant polaroid camera look with faded colors, warm tones, and slight vignette", cssFilter: "sepia(0.3) contrast(1.1) saturate(0.85) brightness(1.05)" },
  
  // Artistic Filters
  { id: "watercolor", name: "Acquerello", category: "artistic", prompt: "Transform into watercolor painting style with soft edges and flowing colors", cssFilter: "saturate(1.3) brightness(1.1) blur(0.5px)" },
  { id: "oil-painting", name: "Pittura a Olio", category: "artistic", prompt: "Transform into oil painting style with visible brush strokes and rich textures", cssFilter: "saturate(1.5) contrast(1.2)" },
  { id: "pop-art", name: "Pop Art", category: "artistic", prompt: "Apply pop art style with bold colors, halftone patterns and graphic look", cssFilter: "saturate(2) contrast(1.5) brightness(1.1)" },
  { id: "sketch", name: "Schizzo", category: "artistic", prompt: "Convert to pencil sketch style with detailed line work", cssFilter: "grayscale(0.8) contrast(1.4) brightness(1.1)" },
  { id: "anime", name: "Anime", category: "artistic", prompt: "Transform into anime/manga art style with cel shading", cssFilter: "saturate(1.4) contrast(1.2) brightness(1.05)" },
  { id: "duotone", name: "Duotone", category: "artistic", prompt: "Apply duotone effect with two contrasting colors creating a striking graphic look", cssFilter: "grayscale(1) contrast(1.3) sepia(0.6) hue-rotate(180deg) saturate(2)" },
  
  // Creative/Digital Filters
  { id: "neon", name: "Neon Glow", category: "creative", prompt: "Add neon glow effects with vibrant electric colors and light trails", cssFilter: "saturate(1.8) brightness(1.2) contrast(1.3) hue-rotate(15deg)" },
  { id: "glitch", name: "Glitch", category: "creative", prompt: "Apply digital glitch effect with chromatic aberration, scan lines, and distortion artifacts", cssFilter: "contrast(1.2) saturate(1.3) hue-rotate(5deg)" },
  { id: "vaporwave", name: "Vaporwave", category: "creative", prompt: "Apply vaporwave aesthetic with pink and cyan tones, retro 80s/90s feel, and dreamy atmosphere", cssFilter: "saturate(1.6) brightness(1.1) contrast(1.1) hue-rotate(-20deg)" },
  { id: "retrowave", name: "Retrowave", category: "creative", prompt: "Apply synthwave/retrowave style with neon purple and pink gradients, 80s futuristic aesthetic", cssFilter: "saturate(1.7) contrast(1.25) brightness(0.95) hue-rotate(-30deg)" },
  { id: "cyberpunk", name: "Cyberpunk", category: "creative", prompt: "Apply cyberpunk aesthetic with high contrast neon colors, futuristic urban feel, and electric atmosphere", cssFilter: "saturate(1.9) contrast(1.4) brightness(0.9) hue-rotate(10deg)" },
  { id: "lofi", name: "Lo-Fi", category: "creative", prompt: "Apply lo-fi aesthetic with muted colors, soft grain, and relaxed nostalgic atmosphere", cssFilter: "saturate(0.7) contrast(0.9) brightness(1.05) sepia(0.2)" },
  { id: "x-ray", name: "X-Ray", category: "creative", prompt: "Apply X-ray or negative effect with inverted colors and ethereal look", cssFilter: "invert(1) contrast(1.1) brightness(1.1)" },
  
  // Atmospheric Filters
  { id: "sunset", name: "Golden Hour", category: "atmospheric", prompt: "Apply warm golden hour sunset lighting with orange and amber tones", cssFilter: "sepia(0.25) saturate(1.3) brightness(1.1) contrast(1.05) hue-rotate(-10deg)" },
  { id: "cool-blue", name: "Cool Blue", category: "atmospheric", prompt: "Apply cool blue tones with moonlight atmosphere and calm feeling", cssFilter: "saturate(0.9) brightness(1.05) contrast(1.1) hue-rotate(20deg) sepia(0.1)" },
  { id: "infrared", name: "Infrared", category: "atmospheric", prompt: "Apply infrared photography effect with surreal colors and otherworldly atmosphere", cssFilter: "hue-rotate(180deg) saturate(1.5) contrast(1.2) brightness(1.1)" },
  { id: "thermal", name: "Thermal", category: "atmospheric", prompt: "Apply thermal camera effect with heat map colors from cool blues to hot oranges", cssFilter: "saturate(2) contrast(1.5) hue-rotate(60deg) brightness(1.1)" },
];

const filterCategories = [
  { id: "all" as FilterCategory, name: "Tutti", icon: "🎨" },
  { id: "classic" as FilterCategory, name: "Classici", icon: "📷" },
  { id: "artistic" as FilterCategory, name: "Artistici", icon: "🖌️" },
  { id: "creative" as FilterCategory, name: "Creativi", icon: "✨" },
  { id: "atmospheric" as FilterCategory, name: "Atmosferici", icon: "🌅" },
  { id: "custom" as FilterCategory, name: "Personalizzati", icon: "⚙️" },
];

const defaultCustomFilterParams: CustomFilterParams = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  sepia: 0,
  hueRotate: 0,
  blur: 0,
  grayscale: 0,
};

const buildCssFilterFromParams = (params: CustomFilterParams): string => {
  const parts: string[] = [];
  if (params.brightness !== 100) parts.push(`brightness(${params.brightness / 100})`);
  if (params.contrast !== 100) parts.push(`contrast(${params.contrast / 100})`);
  if (params.saturate !== 100) parts.push(`saturate(${params.saturate / 100})`);
  if (params.sepia > 0) parts.push(`sepia(${params.sepia / 100})`);
  if (params.hueRotate !== 0) parts.push(`hue-rotate(${params.hueRotate}deg)`);
  if (params.blur > 0) parts.push(`blur(${params.blur}px)`);
  if (params.grayscale > 0) parts.push(`grayscale(${params.grayscale / 100})`);
  return parts.length > 0 ? parts.join(' ') : 'none';
};

const buildPromptFromParams = (params: CustomFilterParams): string => {
  const effects: string[] = [];
  if (params.brightness !== 100) effects.push(params.brightness > 100 ? 'brighter' : 'darker');
  if (params.contrast !== 100) effects.push(params.contrast > 100 ? 'high contrast' : 'low contrast');
  if (params.saturate !== 100) effects.push(params.saturate > 100 ? 'vibrant colors' : 'muted colors');
  if (params.sepia > 0) effects.push('sepia tones');
  if (params.hueRotate !== 0) effects.push('shifted colors');
  if (params.blur > 0) effects.push('soft blur');
  if (params.grayscale > 0) effects.push('desaturated');
  return effects.length > 0 ? `Apply ${effects.join(', ')} effect` : 'Custom filter';
};

// Quick presets for custom filters
interface QuickPreset {
  name: string;
  icon: string;
  params: CustomFilterParams;
}

const quickFilterPresets: QuickPreset[] = [
  { 
    name: "Vintage", 
    icon: "📷", 
    params: { brightness: 95, contrast: 110, saturate: 85, sepia: 35, hueRotate: 0, blur: 0, grayscale: 0 } 
  },
  { 
    name: "Cinema", 
    icon: "🎬", 
    params: { brightness: 90, contrast: 120, saturate: 90, sepia: 15, hueRotate: 0, blur: 0, grayscale: 0 } 
  },
  { 
    name: "Drammatico", 
    icon: "🎭", 
    params: { brightness: 85, contrast: 140, saturate: 110, sepia: 0, hueRotate: 0, blur: 0, grayscale: 0 } 
  },
  { 
    name: "Sogno", 
    icon: "💫", 
    params: { brightness: 110, contrast: 90, saturate: 120, sepia: 10, hueRotate: 15, blur: 1, grayscale: 0 } 
  },
  { 
    name: "Noir", 
    icon: "🖤", 
    params: { brightness: 95, contrast: 130, saturate: 0, sepia: 0, hueRotate: 0, blur: 0, grayscale: 100 } 
  },
  { 
    name: "Caldo", 
    icon: "🌅", 
    params: { brightness: 105, contrast: 105, saturate: 130, sepia: 25, hueRotate: -10, blur: 0, grayscale: 0 } 
  },
  { 
    name: "Freddo", 
    icon: "❄️", 
    params: { brightness: 100, contrast: 110, saturate: 90, sepia: 0, hueRotate: 20, blur: 0, grayscale: 10 } 
  },
  { 
    name: "Soft", 
    icon: "☁️", 
    params: { brightness: 105, contrast: 85, saturate: 95, sepia: 5, hueRotate: 0, blur: 0.5, grayscale: 0 } 
  },
];

type SortOption = "name" | "popularity" | "category";

// Sample image for filter previews (gradient placeholder)
const PREVIEW_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='40' viewBox='0 0 60 40'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23ff6b6b'/%3E%3Cstop offset='33%25' stop-color='%23feca57'/%3E%3Cstop offset='66%25' stop-color='%2354a0ff'/%3E%3Cstop offset='100%25' stop-color='%235f27cd'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='60' height='40'/%3E%3Ccircle cx='20' cy='15' r='6' fill='%23fff' opacity='0.8'/%3E%3Cpath d='M5 35 L20 20 L30 28 L45 15 L55 25 L55 40 L5 40 Z' fill='%23228B22' opacity='0.7'/%3E%3C/svg%3E";

// Provider and model types
type ImageProvider = "replicate" | "piapi";
interface ModelOption {
  id: string;
  name: string;
  provider: ImageProvider;
  description: string;
}

const imageModels: ModelOption[] = [
  // Replicate models
  { id: "black-forest-labs/flux-schnell", name: "Flux Schnell", provider: "replicate", description: "Veloce" },
  { id: "black-forest-labs/flux-dev", name: "Flux Dev", provider: "replicate", description: "Alta Qualità" },
  // PIAPI models
  { id: "flux", name: "PIAPI Flux.1", provider: "piapi", description: "Versatile" },
  { id: "qwen", name: "Qwen Image", provider: "piapi", description: "Creativo" },
  { id: "nano-banana", name: "Nano Banana", provider: "piapi", description: "Artistico" },
];

export const ImageGenerationForm = () => {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [provider, setProvider] = useState<ImageProvider>("replicate");
  const [model, setModel] = useState("black-forest-labs/flux-schnell");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceFileName, setReferenceFileName] = useState<string | null>(null);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [filterIntensity, setFilterIntensity] = useState(100);
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [filterHistory, setFilterHistory] = useState<FilterState[]>([{ filters: [], intensity: 100 }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [filterSearch, setFilterSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("all");
  const [sortBy, setSortBy] = useState<SortOption>("category");
  const [filterUsage, setFilterUsage] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [customFilters, setCustomFilters] = useState<ImageFilter[]>([]);
  const [showCustomFilterDialog, setShowCustomFilterDialog] = useState(false);
  const [customFilterParams, setCustomFilterParams] = useState<CustomFilterParams>(defaultCustomFilterParams);
  const [customFilterName, setCustomFilterName] = useState("");
  const [editingCustomFilter, setEditingCustomFilter] = useState<ImageFilter | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const customFilterImportRef = useRef<HTMLInputElement>(null);
  const { images, addImage } = useImageGallery();

  // Load custom filters from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('customFilters');
    if (saved) {
      try {
        setCustomFilters(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading custom filters:', e);
      }
    }
  }, []);

  // Load filter usage from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('filterUsage');
    if (saved) {
      try {
        setFilterUsage(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading filter usage:', e);
      }
    }
  }, []);

  // Track filter usage
  const trackFilterUsage = (filterId: string) => {
    const newUsage = { ...filterUsage, [filterId]: (filterUsage[filterId] || 0) + 1 };
    setFilterUsage(newUsage);
    localStorage.setItem('filterUsage', JSON.stringify(newUsage));
  };

  // Combine built-in and custom filters
  const allFilters = [...imageFilters, ...customFilters];

  // Filter and sort filters
  const filteredFilters = allFilters
    .filter(filter => {
      const matchesSearch = filter.name.toLowerCase().includes(filterSearch.toLowerCase());
      const matchesCategory = activeCategory === "all" || filter.category === activeCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "popularity":
          return (filterUsage[b.id] || 0) - (filterUsage[a.id] || 0);
        case "category":
        default:
          return 0; // Keep original order
      }
    });

  // Save custom filter
  const saveCustomFilter = () => {
    if (!customFilterName.trim()) {
      toast.error("Inserisci un nome per il filtro");
      return;
    }

    const cssFilter = buildCssFilterFromParams(customFilterParams);
    const prompt = buildPromptFromParams(customFilterParams);

    if (editingCustomFilter) {
      // Update existing filter
      const updated = customFilters.map(f => 
        f.id === editingCustomFilter.id 
          ? { ...f, name: customFilterName.trim(), cssFilter, prompt }
          : f
      );
      setCustomFilters(updated);
      localStorage.setItem('customFilters', JSON.stringify(updated));
      toast.success(`Filtro "${customFilterName}" aggiornato!`);
    } else {
      // Create new filter
      const newFilter: ImageFilter = {
        id: `custom-${Date.now()}`,
        name: customFilterName.trim(),
        prompt,
        cssFilter,
        category: "custom",
        isCustom: true,
      };
      const updated = [...customFilters, newFilter];
      setCustomFilters(updated);
      localStorage.setItem('customFilters', JSON.stringify(updated));
      toast.success(`Filtro "${customFilterName}" creato!`);
    }

    resetCustomFilterDialog();
  };

  const deleteCustomFilter = (filterId: string) => {
    const updated = customFilters.filter(f => f.id !== filterId);
    setCustomFilters(updated);
    localStorage.setItem('customFilters', JSON.stringify(updated));
    setSelectedFilters(prev => prev.filter(id => id !== filterId));
    toast.success("Filtro personalizzato eliminato");
  };

  const editCustomFilter = (filter: ImageFilter) => {
    setEditingCustomFilter(filter);
    setCustomFilterName(filter.name);
    // Parse CSS filter back to params (approximate)
    const params = { ...defaultCustomFilterParams };
    const matches = filter.cssFilter.matchAll(/(\w+-?\w*)\(([^)]+)\)/g);
    for (const match of matches) {
      const [, prop, val] = match;
      const numVal = parseFloat(val);
      switch (prop) {
        case 'brightness': params.brightness = numVal * 100; break;
        case 'contrast': params.contrast = numVal * 100; break;
        case 'saturate': params.saturate = numVal * 100; break;
        case 'sepia': params.sepia = numVal * 100; break;
        case 'hue-rotate': params.hueRotate = numVal; break;
        case 'blur': params.blur = numVal; break;
        case 'grayscale': params.grayscale = numVal * 100; break;
      }
    }
    setCustomFilterParams(params);
    setShowCustomFilterDialog(true);
  };

  const resetCustomFilterDialog = () => {
    setShowCustomFilterDialog(false);
    setCustomFilterName("");
    setCustomFilterParams(defaultCustomFilterParams);
    setEditingCustomFilter(null);
  };

  // Duplicate an existing filter as base for new custom filter
  const duplicateFilter = (filter: ImageFilter) => {
    setEditingCustomFilter(null);
    setCustomFilterName(`${filter.name} (copia)`);
    
    // Parse CSS filter to params
    const params = { ...defaultCustomFilterParams };
    const matches = filter.cssFilter.matchAll(/(\w+-?\w*)\(([^)]+)\)/g);
    for (const match of matches) {
      const [, prop, val] = match;
      const numVal = parseFloat(val);
      switch (prop) {
        case 'brightness': params.brightness = numVal * 100; break;
        case 'contrast': params.contrast = numVal * 100; break;
        case 'saturate': params.saturate = numVal * 100; break;
        case 'sepia': params.sepia = numVal * 100; break;
        case 'hue-rotate': params.hueRotate = numVal; break;
        case 'blur': params.blur = numVal; break;
        case 'grayscale': params.grayscale = numVal * 100; break;
      }
    }
    setCustomFilterParams(params);
    setShowCustomFilterDialog(true);
    toast.info(`Filtro "${filter.name}" duplicato. Modifica e salva!`);
  };

  // Apply a quick preset
  const applyQuickPreset = (preset: QuickPreset) => {
    setCustomFilterParams(preset.params);
    if (!customFilterName) {
      setCustomFilterName(preset.name);
    }
    toast.success(`Preset "${preset.name}" applicato`);
  };

  // Export custom filters as JSON
  const exportCustomFilters = () => {
    if (customFilters.length === 0) {
      toast.error("Nessun filtro personalizzato da esportare");
      return;
    }
    
    const exportData = customFilters.map(f => ({
      name: f.name,
      cssFilter: f.cssFilter,
      prompt: f.prompt,
    }));
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `custom-filters-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`${customFilters.length} filtri esportati!`);
  };

  // Import custom filters from JSON
  const handleImportCustomFilters = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string) as Array<{
          name: string;
          cssFilter: string;
          prompt?: string;
        }>;
        
        if (!Array.isArray(imported)) {
          throw new Error("Formato non valido");
        }
        
        // Validate structure
        const valid = imported.every(f => f.name && f.cssFilter);
        
        if (!valid) {
          throw new Error("Struttura filtro non valida");
        }
        
        // Avoid duplicates by name
        const existingNames = customFilters.map(f => f.name.toLowerCase());
        const newFilters: ImageFilter[] = imported
          .filter(f => !existingNames.includes(f.name.toLowerCase()))
          .map(f => ({
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: f.name,
            cssFilter: f.cssFilter,
            prompt: f.prompt || buildPromptFromParams(defaultCustomFilterParams),
            category: "custom" as FilterCategory,
            isCustom: true,
          }));
        
        if (newFilters.length === 0) {
          toast.info("Tutti i filtri importati esistono già");
          return;
        }
        
        const updated = [...customFilters, ...newFilters];
        setCustomFilters(updated);
        localStorage.setItem('customFilters', JSON.stringify(updated));
        toast.success(`${newFilters.length} nuovi filtri importati!`);
        
      } catch (error) {
        console.error('Import error:', error);
        toast.error("Errore nell'importazione del file");
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (customFilterImportRef.current) {
      customFilterImportRef.current.value = "";
    }
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < filterHistory.length - 1;

  // Push new state to history
  const pushToHistory = (filters: string[], intensity: number) => {
    const newState: FilterState = { filters: [...filters], intensity };
    // Remove any future states if we're not at the end
    const newHistory = filterHistory.slice(0, historyIndex + 1);
    newHistory.push(newState);
    // Keep only last 50 states
    if (newHistory.length > 50) {
      newHistory.shift();
      setFilterHistory(newHistory);
    } else {
      setFilterHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  const undo = () => {
    if (!canUndo) return;
    const newIndex = historyIndex - 1;
    const prevState = filterHistory[newIndex];
    setSelectedFilters(prevState.filters);
    setFilterIntensity(prevState.intensity);
    setHistoryIndex(newIndex);
    updatePromptFromFilters(prevState.filters, prevState.intensity);
  };

  const redo = () => {
    if (!canRedo) return;
    const newIndex = historyIndex + 1;
    const nextState = filterHistory[newIndex];
    setSelectedFilters(nextState.filters);
    setFilterIntensity(nextState.intensity);
    setHistoryIndex(newIndex);
    updatePromptFromFilters(nextState.filters, nextState.intensity);
  };

  const updatePromptFromFilters = (filters: string[], intensity: number) => {
    const selectedFilterObjects = filters.map(id => 
      allFilters.find(f => f.id === id)
    ).filter(Boolean);
    
    if (selectedFilterObjects.length > 0) {
      const combinedPrompt = selectedFilterObjects
        .map(f => f?.prompt)
        .join(". Also ");
      setPrompt(combinedPrompt + (intensity !== 100 ? ` (intensity: ${intensity}%)` : ""));
    } else {
      setPrompt("");
    }
  };

  // Load custom presets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('customFilterPresets');
    if (saved) {
      try {
        setCustomPresets(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading presets:', e);
      }
    }
  }, []);

  // Save presets to localStorage
  const savePresetsToStorage = (presets: CustomPreset[]) => {
    localStorage.setItem('customFilterPresets', JSON.stringify(presets));
    setCustomPresets(presets);
  };

  const saveCurrentAsPreset = () => {
    if (!newPresetName.trim()) {
      toast.error("Inserisci un nome per il preset");
      return;
    }
    if (selectedFilters.length === 0) {
      toast.error("Seleziona almeno un filtro");
      return;
    }

    const newPreset: CustomPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      filters: [...selectedFilters],
      intensity: filterIntensity
    };

    savePresetsToStorage([...customPresets, newPreset]);
    setNewPresetName("");
    setShowSavePreset(false);
    toast.success(`Preset "${newPreset.name}" salvato!`);
  };

  const loadPreset = (preset: CustomPreset) => {
    setSelectedFilters(preset.filters);
    setFilterIntensity(preset.intensity);
    
    // Update prompt
    const selectedFilterObjects = preset.filters.map(id => 
      allFilters.find(f => f.id === id)
    ).filter(Boolean);
    
    if (selectedFilterObjects.length > 0) {
      const combinedPrompt = selectedFilterObjects
        .map(f => f?.prompt)
        .join(". Also ");
      setPrompt(combinedPrompt + ` (intensity: ${preset.intensity}%)`);
    }
    
    toast.success(`Preset "${preset.name}" caricato!`);
  };

  const deletePreset = (presetId: string) => {
    const updated = customPresets.filter(p => p.id !== presetId);
    savePresetsToStorage(updated);
    toast.success("Preset eliminato");
  };

  const exportPresets = () => {
    if (customPresets.length === 0) {
      toast.error("Nessun preset da esportare");
      return;
    }
    
    const dataStr = JSON.stringify(customPresets, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `filter-presets-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`${customPresets.length} preset esportati!`);
  };

  const handleImportPresets = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string) as CustomPreset[];
        
        if (!Array.isArray(imported)) {
          throw new Error("Formato non valido");
        }
        
        // Validate structure
        const valid = imported.every(p => 
          p.id && p.name && Array.isArray(p.filters) && typeof p.intensity === 'number'
        );
        
        if (!valid) {
          throw new Error("Struttura preset non valida");
        }
        
        // Merge with existing presets, avoiding duplicates by name
        const existingNames = customPresets.map(p => p.name.toLowerCase());
        const newPresets = imported.filter(p => !existingNames.includes(p.name.toLowerCase()));
        const merged = [...customPresets, ...newPresets.map(p => ({ ...p, id: Date.now().toString() + Math.random() }))];
        
        savePresetsToStorage(merged);
        toast.success(`${newPresets.length} nuovi preset importati!`);
        
      } catch (error) {
        console.error('Import error:', error);
        toast.error("Errore nell'importazione del file");
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (importInputRef.current) {
      importInputRef.current.value = "";
    }
  };

  const examplePrompts = [
    "A futuristic cityscape at sunset with flying cars",
    "Medieval fantasy castle surrounded by mystical forest",
    "Professional studio portrait photography setup",
    "Cyberpunk street scene with neon lights and rain"
  ];

  const editPrompts = [
    "Make it look like sunset",
    "Add dramatic lighting",
    "Convert to watercolor style",
    "Make it more vibrant and colorful"
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Per favore seleziona un file immagine");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("L'immagine deve essere inferiore a 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setReferenceImage(result);
      setReferenceFileName(file.name);
      toast.success("Immagine di riferimento caricata!");
    };
    reader.onerror = () => {
      toast.error("Errore nel caricamento dell'immagine");
    };
    reader.readAsDataURL(file);
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    setReferenceFileName(null);
    setSelectedFilters([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const selectFromGallery = (imageUrl: string, imagePrompt: string) => {
    setReferenceImage(imageUrl);
    setReferenceFileName(`Dalla galleria: ${imagePrompt.substring(0, 30)}...`);
    setShowGalleryPicker(false);
    toast.success("Immagine dalla galleria selezionata!");
  };

  const toggleFilter = (filterId: string) => {
    const isSelected = selectedFilters.includes(filterId);
    const newFilters = isSelected 
      ? selectedFilters.filter(f => f !== filterId)
      : [...selectedFilters, filterId];
    
    // Track usage when adding a filter
    if (!isSelected) {
      trackFilterUsage(filterId);
    }
    
    setSelectedFilters(newFilters);
    updatePromptFromFilters(newFilters, filterIntensity);
    pushToHistory(newFilters, filterIntensity);
  };

  const handleIntensityChange = (value: number[]) => {
    const newIntensity = value[0];
    setFilterIntensity(newIntensity);
    // Debounce history push for intensity changes
    pushToHistory(selectedFilters, newIntensity);
  };

  const clearAllFilters = () => {
    setSelectedFilters([]);
    setFilterIntensity(100);
    setPrompt("");
    pushToHistory([], 100);
  };

  // Calculate combined CSS filter for preview with intensity
  const getPreviewFilter = () => {
    if (selectedFilters.length === 0) return "none";
    
    const intensity = filterIntensity / 100;
    
    const filterValues: { [key: string]: number } = {
      sepia: 0,
      contrast: 1,
      brightness: 1,
      saturate: 1,
      grayscale: 0,
      blur: 0,
      hueRotate: 0
    };
    
    selectedFilters.forEach(filterId => {
      const filter = allFilters.find(f => f.id === filterId);
      if (filter?.cssFilter) {
        // Parse and combine CSS filter values
        const matches = filter.cssFilter.matchAll(/(\w+)\(([^)]+)\)/g);
        for (const match of matches) {
          const [, prop, val] = match;
          const numVal = parseFloat(val);
          
          switch (prop) {
            case 'sepia':
              filterValues.sepia = Math.min(1, filterValues.sepia + numVal);
              break;
            case 'contrast':
              filterValues.contrast *= numVal;
              break;
            case 'brightness':
              filterValues.brightness *= numVal;
              break;
            case 'saturate':
              filterValues.saturate *= numVal;
              break;
            case 'grayscale':
              filterValues.grayscale = Math.min(1, filterValues.grayscale + numVal);
              break;
            case 'blur':
              filterValues.blur += numVal;
              break;
            case 'hue-rotate':
              filterValues.hueRotate += numVal;
              break;
          }
        }
      }
    });
    
    // Apply intensity to filter values (lerp towards neutral)
    const applyIntensity = (value: number, neutral: number) => {
      return neutral + (value - neutral) * intensity;
    };
    
    const parts = [];
    if (filterValues.sepia > 0) parts.push(`sepia(${applyIntensity(filterValues.sepia, 0).toFixed(2)})`);
    if (filterValues.grayscale > 0) parts.push(`grayscale(${applyIntensity(filterValues.grayscale, 0).toFixed(2)})`);
    if (filterValues.contrast !== 1) parts.push(`contrast(${applyIntensity(filterValues.contrast, 1).toFixed(2)})`);
    if (filterValues.brightness !== 1) parts.push(`brightness(${applyIntensity(filterValues.brightness, 1).toFixed(2)})`);
    if (filterValues.saturate !== 1) parts.push(`saturate(${applyIntensity(filterValues.saturate, 1).toFixed(2)})`);
    if (filterValues.blur > 0) parts.push(`blur(${(filterValues.blur * intensity).toFixed(1)}px)`);
    if (filterValues.hueRotate !== 0) parts.push(`hue-rotate(${(filterValues.hueRotate * intensity).toFixed(0)}deg)`);
    
    return parts.length > 0 ? parts.join(' ') : 'none';
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Inserisci una descrizione per l'immagine");
      return;
    }

    setIsLoading(true);
    setGeneratedImage(null);

    try {
      if (referenceImage) {
        // Use Lovable AI for image editing
        console.log("Editing image with Lovable AI...");
        
        const { data, error } = await supabase.functions.invoke('edit-image', {
          body: { 
            prompt,
            referenceImage
          }
        });

        if (error) {
          console.error("Edge function error:", error);
          throw error;
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        if (data?.imageUrl) {
          setGeneratedImage(data.imageUrl);
          toast.success("Immagine modificata con successo!");
        } else {
          throw new Error("Nessun URL immagine ricevuto");
        }
      } else {
        // Standard image generation
        if (provider === "piapi") {
          // PIAPI image generation
          console.log("Calling piapi-image function with:", { prompt, aspectRatio, model });
          
          const { data, error } = await supabase.functions.invoke('piapi-image', {
            body: { 
              prompt,
              aspectRatio,
              model
            }
          });

          if (error) {
            console.error("PIAPI edge function error:", error);
            throw error;
          }

          if (data?.error) {
            throw new Error(data.error);
          }

          if (data?.taskId) {
            // Poll for result
            toast.info("Generazione avviata, attendere...");
            let attempts = 0;
            const maxAttempts = 60;
            
            while (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              const { data: statusData, error: statusError } = await supabase.functions.invoke('piapi-image', {
                body: { action: "status", taskId: data.taskId }
              });
              
              if (statusError) throw statusError;
              
              if (statusData?.status === "completed" && statusData?.imageUrl) {
                setGeneratedImage(statusData.imageUrl);
                toast.success("Immagine generata con successo!");
                break;
              } else if (statusData?.status === "failed") {
                throw new Error(statusData?.error || "Generazione fallita");
              }
              
              attempts++;
            }
            
            if (attempts >= maxAttempts) {
              throw new Error("Timeout nella generazione");
            }
          } else {
            throw new Error("Nessun taskId ricevuto");
          }
        } else {
          // Replicate image generation
          console.log("Calling generate-image function with:", { prompt, aspectRatio, model });

          const { data, error } = await supabase.functions.invoke('generate-image', {
            body: { 
              prompt,
              aspectRatio,
              model,
              outputFormat: "webp",
              outputQuality: 90
            }
          });

          if (error) {
            console.error("Edge function error:", error);
            throw error;
          }

          if (data?.error) {
            throw new Error(data.error);
          }

          if (data?.imageUrl) {
            setGeneratedImage(data.imageUrl);
            toast.success("Immagine generata con successo!");
          } else {
            throw new Error("Nessun URL immagine ricevuto");
          }
        }
      }

    } catch (error: any) {
      console.error("Error generating/editing image:", error);
      toast.error(error.message || "Errore nella generazione dell'immagine");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
      window.open(generatedImage, '_blank');
    }
  };

  const handleSaveToGallery = () => {
    if (generatedImage) {
      addImage({
        url: generatedImage,
        prompt,
        aspectRatio,
        model: referenceImage ? "lovable-ai-edit" : model,
      });
      toast.success("Immagine salvata nella galleria!");
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="border-accent/50 bg-accent/10">
        <Sparkles className="h-4 w-4 text-accent" />
        <AlertDescription>
          {referenceImage 
            ? "Modifica l'immagine caricata descrivendo le modifiche desiderate"
            : "Genera immagini professionali per scenografie e storyboard usando Replicate Flux AI"
          }
        </AlertDescription>
      </Alert>

      {/* Reference Image Upload Section */}
      <div className="space-y-2">
        <Label>Immagine di Riferimento (Opzionale)</Label>
        <div className="border-2 border-dashed border-border rounded-lg p-4 transition-colors hover:border-accent/50">
          {referenceImage ? (
            <div className="space-y-3">
              <div className="relative inline-block">
                <img 
                  src={referenceImage} 
                  alt="Reference" 
                  className="max-h-40 rounded-lg object-contain"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={removeReferenceImage}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {referenceFileName}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 gap-3">
              <div className="p-3 rounded-full bg-muted">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Carica immagine di riferimento</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Carica File
                </Button>
                <Dialog open={showGalleryPicker} onOpenChange={setShowGalleryPicker}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={images.length === 0}
                    >
                      <Images className="mr-2 h-4 w-4" />
                      Dalla Galleria ({images.length})
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Seleziona dalla Galleria</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-[400px] pr-4">
                      {images.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                          <ImageIcon className="h-12 w-12 mb-2" />
                          <p>Nessuna immagine nella galleria</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {images.map((img) => (
                            <div
                              key={img.id}
                              className="relative group cursor-pointer rounded-lg overflow-hidden border border-border hover:border-accent transition-colors"
                              onClick={() => selectFromGallery(img.url, img.prompt)}
                            >
                              <img
                                src={img.url}
                                alt={img.prompt}
                                className="w-full h-32 object-cover"
                              />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <p className="text-white text-xs px-2 text-center line-clamp-2">
                                  {img.prompt}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-xs text-muted-foreground">
                Seleziona un'immagine da modificare
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Live Preview with Filters */}
      {referenceImage && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                Anteprima Live con Filtri
              </Label>
              {selectedFilters.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowComparison(!showComparison)}
                  className="text-xs"
                >
                  <Columns className="mr-1 h-3 w-3" />
                  {showComparison ? "Vista Singola" : "Confronta"}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Clicca sui filtri per combinarli. L'anteprima mostra l'effetto in tempo reale.
            </p>
          </div>
          
          {/* Comparison View or Single Preview */}
          {showComparison && selectedFilters.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {/* Original Image */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-center text-muted-foreground">Originale</p>
                <div className="relative rounded-lg overflow-hidden border border-border bg-muted/20 p-2">
                  <img 
                    src={referenceImage} 
                    alt="Original" 
                    className="w-full h-48 rounded-lg object-contain"
                  />
                </div>
              </div>
              {/* Filtered Image */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-center text-accent">Con Filtri ({filterIntensity}%)</p>
                <div className="relative rounded-lg overflow-hidden border border-accent/30 bg-accent/5 p-2">
                  <img 
                    src={referenceImage} 
                    alt="Filtered" 
                    className="w-full h-48 rounded-lg object-contain transition-all duration-300"
                    style={{ filter: getPreviewFilter() }}
                  />
                  <div className="absolute top-2 right-2 bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded-full">
                    {selectedFilters.length} filtri
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="relative rounded-lg overflow-hidden border border-border bg-muted/20 p-2">
                <img 
                  src={referenceImage} 
                  alt="Preview" 
                  className="max-h-64 rounded-lg object-contain transition-all duration-300"
                  style={{ filter: getPreviewFilter() }}
                />
                {selectedFilters.length > 0 && (
                  <div className="absolute top-3 right-3 bg-accent text-accent-foreground text-xs px-2 py-1 rounded-full">
                    {selectedFilters.length} filtri attivi
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Intensity Slider */}
          {selectedFilters.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm flex items-center justify-between">
                <span>Intensità Filtri</span>
                <span className="text-accent font-medium">{filterIntensity}%</span>
              </Label>
              <Slider
                value={[filterIntensity]}
                onValueChange={handleIntensityChange}
                min={0}
                max={150}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Leggero</span>
                <span>Normale</span>
                <span>Intenso</span>
              </div>
            </div>
          )}

          {/* Filter Buttons */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Seleziona Filtri (puoi combinarne più di uno)</Label>
              {/* Undo/Redo Buttons */}
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={undo}
                  disabled={!canUndo}
                  className="h-7 w-7 p-0"
                  title="Annulla (Undo)"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={redo}
                  disabled={!canRedo}
                  className="h-7 w-7 p-0"
                  title="Ripristina (Redo)"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca filtri..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="pl-9 h-9"
              />
              {filterSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilterSearch("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Category Tabs and Sort/View Options */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1">
                {filterCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                      activeCategory === category.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{category.icon}</span>
                    <span>{category.name}</span>
                    {category.id !== "all" && (
                      <span className="text-[10px] opacity-70">
                        ({allFilters.filter(f => f.category === category.id).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
              
              {/* Sort and View Options */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="h-7 text-xs w-32">
                      <SelectValue placeholder="Ordina per" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">Categoria</SelectItem>
                      <SelectItem value="name">Nome A-Z</SelectItem>
                      <SelectItem value="popularity">Più usati</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="h-7 w-7 p-0"
                    title="Vista griglia"
                  >
                    <Grid3X3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="h-7 w-7 p-0"
                    title="Vista lista"
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Filter Grid with Thumbnails */}
            {viewMode === "grid" ? (
              <TooltipProvider delayDuration={300}>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {/* Add Custom Filter Button */}
                  <button
                    onClick={() => setShowCustomFilterDialog(true)}
                    className="group relative flex flex-col items-center justify-center p-2 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-accent/50 hover:bg-accent/10 transition-all duration-300"
                  >
                    <div className="w-full aspect-[3/2] flex items-center justify-center mb-1.5">
                      <Plus className="h-6 w-6 text-muted-foreground group-hover:text-accent group-hover:scale-110 transition-all duration-300" />
                    </div>
                    <span className="text-[10px] text-center text-muted-foreground group-hover:text-accent transition-colors">
                      Crea Filtro
                    </span>
                  </button>
                  
                  {filteredFilters.length > 0 ? (
                    filteredFilters.map((filter) => (
                      <Tooltip key={filter.id}>
                        <TooltipTrigger asChild>
                          <div className="group relative">
                            <button
                              onClick={() => toggleFilter(filter.id)}
                              className={`w-full relative flex flex-col items-center p-2 rounded-lg transition-all duration-300 ${
                                selectedFilters.includes(filter.id)
                                  ? "bg-accent/20 ring-2 ring-accent scale-[1.02]"
                                  : "bg-muted/30 hover:bg-muted/50 hover:scale-105 hover:shadow-lg hover:shadow-accent/10"
                              }`}
                            >
                              {/* Thumbnail Preview - Use reference image if available */}
                              <div className="relative w-full aspect-[3/2] rounded overflow-hidden mb-1.5">
                                <img 
                                  src={referenceImage || PREVIEW_IMAGE}
                                  alt={filter.name}
                                  className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                                  style={{ filter: filter.cssFilter }}
                                />
                                {/* Hover overlay with glow */}
                                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                {selectedFilters.includes(filter.id) && (
                                  <div className="absolute inset-0 bg-accent/30 flex items-center justify-center">
                                    <span className="text-accent-foreground text-lg drop-shadow-md">✓</span>
                                  </div>
                                )}
                                {filterUsage[filter.id] > 0 && sortBy === "popularity" && (
                                  <div className="absolute top-0.5 right-0.5 bg-primary text-primary-foreground text-[8px] px-1 rounded">
                                    {filterUsage[filter.id]}×
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] text-center leading-tight line-clamp-1 transition-colors duration-300 group-hover:text-accent">
                                {filter.name}
                              </span>
                            </button>
                            {/* Action buttons */}
                            <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* Duplicate button for all filters */}
                              <button
                                onClick={(e) => { e.stopPropagation(); duplicateFilter(filter); }}
                                className="p-1 rounded-full bg-muted hover:bg-primary text-muted-foreground hover:text-primary-foreground transition-colors"
                                title="Duplica come nuovo filtro"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                              {/* Edit/Delete only for custom filters */}
                              {filter.isCustom && (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); editCustomFilter(filter); }}
                                    className="p-1 rounded-full bg-muted hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
                                    title="Modifica filtro"
                                  >
                                    <Settings2 className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deleteCustomFilter(filter.id); }}
                                    className="p-1 rounded-full bg-muted hover:bg-destructive text-muted-foreground hover:text-destructive-foreground transition-colors"
                                    title="Elimina filtro"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[200px] text-center">
                          <p className="font-medium">{filter.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{filter.prompt}</p>
                          {filter.isCustom && <p className="text-xs text-accent mt-1">Filtro personalizzato</p>}
                        </TooltipContent>
                      </Tooltip>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground py-2 col-span-full">
                      Nessun filtro trovato per "{filterSearch}"
                    </p>
                  )}
                </div>
              </TooltipProvider>
            ) : (
              <TooltipProvider delayDuration={300}>
                <div className="flex flex-wrap gap-2">
                  {/* Add Custom Filter Button */}
                  <button
                    onClick={() => setShowCustomFilterDialog(true)}
                    className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-full border-2 border-dashed border-muted-foreground/30 hover:border-accent/50 hover:bg-accent/10 transition-all duration-300"
                  >
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Crea Filtro</span>
                  </button>
                  
                  {filteredFilters.length > 0 ? (
                    filteredFilters.map((filter) => (
                      <Tooltip key={filter.id}>
                        <TooltipTrigger asChild>
                          <div className="group relative">
                            <button
                              onClick={() => toggleFilter(filter.id)}
                              className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-full transition-all duration-300 ${
                                selectedFilters.includes(filter.id)
                                  ? "bg-accent text-accent-foreground ring-2 ring-accent/50 scale-105"
                                  : "bg-muted hover:bg-muted/80 hover:scale-105 hover:shadow-md text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {/* Mini Thumbnail - Use reference image if available */}
                              <div className="w-5 h-4 rounded overflow-hidden flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                                <img 
                                  src={referenceImage || PREVIEW_IMAGE}
                                  alt=""
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-125"
                                  style={{ filter: filter.cssFilter }}
                                />
                              </div>
                              <span className="transition-colors">{filter.name}</span>
                              {selectedFilters.includes(filter.id) && <span>✓</span>}
                              {filterUsage[filter.id] > 0 && sortBy === "popularity" && (
                                <span className="text-[9px] opacity-60">({filterUsage[filter.id]})</span>
                              )}
                            </button>
                            {/* Action buttons */}
                            <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); duplicateFilter(filter); }}
                                className="p-0.5 rounded-full bg-primary text-primary-foreground"
                                title="Duplica"
                              >
                                <Copy className="h-2.5 w-2.5" />
                              </button>
                              {filter.isCustom && (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); editCustomFilter(filter); }}
                                    className="p-0.5 rounded-full bg-accent text-accent-foreground"
                                    title="Modifica"
                                  >
                                    <Settings2 className="h-2.5 w-2.5" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deleteCustomFilter(filter.id); }}
                                    className="p-0.5 rounded-full bg-destructive text-destructive-foreground"
                                    title="Elimina"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px]">
                          <p className="font-medium">{filter.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{filter.prompt}</p>
                          {filter.isCustom && <p className="text-xs text-accent mt-1">Filtro personalizzato</p>}
                        </TooltipContent>
                      </Tooltip>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground py-2">
                      Nessun filtro trovato per "{filterSearch}"
                    </p>
                  )}
                </div>
              </TooltipProvider>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              {selectedFilters.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-xs text-muted-foreground"
                  >
                    <X className="mr-1 h-3 w-3" />
                    Rimuovi tutti
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSavePreset(true)}
                    className="text-xs"
                  >
                    <Heart className="mr-1 h-3 w-3" />
                    Salva Preset
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Save Preset Dialog */}
          {showSavePreset && (
            <Card className="p-4 space-y-3 border-accent/30 bg-accent/5">
              <Label className="text-sm font-medium">Salva come Preset Personalizzato</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome del preset..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={saveCurrentAsPreset} size="sm">
                  <Save className="mr-1 h-3 w-3" />
                  Salva
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowSavePreset(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Filtri: {selectedFilters.map(id => allFilters.find(f => f.id === id)?.name).join(", ")} | 
                Intensità: {filterIntensity}%
              </p>
            </Card>
          )}

          {/* Custom Filter Creator Dialog */}
          <Dialog open={showCustomFilterDialog} onOpenChange={(open) => !open && resetCustomFilterDialog()}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-accent" />
                  {editingCustomFilter ? "Modifica Filtro" : "Crea Filtro Personalizzato"}
                </DialogTitle>
                <DialogDescription>
                  Regola i parametri per creare il tuo filtro unico
                </DialogDescription>
              </DialogHeader>
              
              <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 py-4 pr-4">
                {/* Quick Presets */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    Preset Rapidi
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {quickFilterPresets.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => applyQuickPreset(preset)}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-muted/50 hover:bg-accent/20 hover:text-accent border border-transparent hover:border-accent/30 transition-all duration-200"
                      >
                        <span>{preset.icon}</span>
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filter Name */}
                <div className="space-y-2">
                  <Label htmlFor="customFilterName">Nome del Filtro</Label>
                  <Input
                    id="customFilterName"
                    placeholder="Es. Tramonto Dorato"
                    value={customFilterName}
                    onChange={(e) => setCustomFilterName(e.target.value)}
                  />
                </div>

                {/* Live Preview */}
                <div className="space-y-2">
                  <Label>Anteprima Live</Label>
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img 
                      src={referenceImage || PREVIEW_IMAGE}
                      alt="Preview"
                      className="w-full h-32 object-cover transition-all duration-300"
                      style={{ filter: buildCssFilterFromParams(customFilterParams) }}
                    />
                  </div>
                </div>

                {/* Parameter Sliders */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Luminosità</Label>
                      <span className="text-xs text-muted-foreground">{customFilterParams.brightness}%</span>
                    </div>
                    <Slider
                      value={[customFilterParams.brightness]}
                      onValueChange={([v]) => setCustomFilterParams(p => ({ ...p, brightness: v }))}
                      min={50}
                      max={150}
                      step={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Contrasto</Label>
                      <span className="text-xs text-muted-foreground">{customFilterParams.contrast}%</span>
                    </div>
                    <Slider
                      value={[customFilterParams.contrast]}
                      onValueChange={([v]) => setCustomFilterParams(p => ({ ...p, contrast: v }))}
                      min={50}
                      max={150}
                      step={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Saturazione</Label>
                      <span className="text-xs text-muted-foreground">{customFilterParams.saturate}%</span>
                    </div>
                    <Slider
                      value={[customFilterParams.saturate]}
                      onValueChange={([v]) => setCustomFilterParams(p => ({ ...p, saturate: v }))}
                      min={0}
                      max={200}
                      step={10}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Seppia</Label>
                      <span className="text-xs text-muted-foreground">{customFilterParams.sepia}%</span>
                    </div>
                    <Slider
                      value={[customFilterParams.sepia]}
                      onValueChange={([v]) => setCustomFilterParams(p => ({ ...p, sepia: v }))}
                      min={0}
                      max={100}
                      step={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Rotazione Tonalità</Label>
                      <span className="text-xs text-muted-foreground">{customFilterParams.hueRotate}°</span>
                    </div>
                    <Slider
                      value={[customFilterParams.hueRotate]}
                      onValueChange={([v]) => setCustomFilterParams(p => ({ ...p, hueRotate: v }))}
                      min={-180}
                      max={180}
                      step={15}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Sfocatura</Label>
                      <span className="text-xs text-muted-foreground">{customFilterParams.blur}px</span>
                    </div>
                    <Slider
                      value={[customFilterParams.blur]}
                      onValueChange={([v]) => setCustomFilterParams(p => ({ ...p, blur: v }))}
                      min={0}
                      max={10}
                      step={0.5}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Scala di Grigi</Label>
                      <span className="text-xs text-muted-foreground">{customFilterParams.grayscale}%</span>
                    </div>
                    <Slider
                      value={[customFilterParams.grayscale]}
                      onValueChange={([v]) => setCustomFilterParams(p => ({ ...p, grayscale: v }))}
                      min={0}
                      max={100}
                      step={5}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setCustomFilterParams(defaultCustomFilterParams)}
                    className="flex-1"
                  >
                    Reset
                  </Button>
                  <Button onClick={saveCustomFilter} className="flex-1">
                    <Save className="mr-2 h-4 w-4" />
                    {editingCustomFilter ? "Aggiorna" : "Salva Filtro"}
                  </Button>
                </div>
              </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* Custom Filters Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-accent" />
                I Tuoi Filtri Personalizzati ({customFilters.length})
              </Label>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => customFilterImportRef.current?.click()}
                  className="text-xs h-7 px-2"
                  title="Importa filtri personalizzati"
                >
                  <FileUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exportCustomFilters}
                  disabled={customFilters.length === 0}
                  className="text-xs h-7 px-2"
                  title="Esporta filtri personalizzati"
                >
                  <FileDown className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            {customFilters.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {customFilters.map((filter) => (
                  <div
                    key={filter.id}
                    className="group flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-accent/10 border border-accent/30 hover:border-accent/60 transition-all"
                  >
                    {/* Mini preview */}
                    <div className="w-4 h-3 rounded overflow-hidden">
                      <img 
                        src={referenceImage || PREVIEW_IMAGE}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{ filter: filter.cssFilter }}
                      />
                    </div>
                    <span className="text-accent-foreground">{filter.name}</span>
                    <button
                      onClick={() => editCustomFilter(filter)}
                      className="opacity-60 hover:opacity-100 transition-opacity"
                      title="Modifica"
                    >
                      <Settings2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => deleteCustomFilter(filter.id)}
                      className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-all"
                      title="Elimina"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nessun filtro personalizzato. Clicca "Crea Filtro" o duplica un filtro esistente.
              </p>
            )}
            
            {/* Hidden import input for custom filters */}
            <input
              ref={customFilterImportRef}
              type="file"
              accept=".json"
              onChange={handleImportCustomFilters}
              className="hidden"
            />
          </div>

          {/* Custom Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-400" />
                I Tuoi Preset Salvati ({customPresets.length})
              </Label>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => importInputRef.current?.click()}
                  className="text-xs h-7 px-2"
                  title="Importa preset"
                >
                  <FileUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exportPresets}
                  disabled={customPresets.length === 0}
                  className="text-xs h-7 px-2"
                  title="Esporta preset"
                >
                  <FileDown className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            {customPresets.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {customPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="group flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 hover:border-primary/50 transition-all"
                  >
                    <button
                      onClick={() => loadPreset(preset)}
                      className="hover:text-primary transition-colors"
                    >
                      {preset.name}
                    </button>
                    <button
                      onClick={() => deletePreset(preset.id)}
                      className="opacity-0 group-hover:opacity-100 ml-1 text-destructive hover:text-destructive/80 transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nessun preset salvato. Seleziona filtri e clicca "Salva Preset" per crearne uno.
              </p>
            )}
            
            {/* Hidden import input */}
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              onChange={handleImportPresets}
              className="hidden"
            />
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="prompt">
            {referenceImage ? "Descrivi le modifiche *" : "Descrizione Immagine *"}
          </Label>
          <Textarea
            id="prompt"
            placeholder={referenceImage 
              ? "Descrivi come vuoi modificare l'immagine..." 
              : "Descrivi l'immagine che vuoi creare in dettaglio..."
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="resize-none bg-background/50 border-border"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {(referenceImage ? editPrompts : examplePrompts).map((example, idx) => (
              <button
                key={idx}
                onClick={() => setPrompt(example)}
                className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {!referenceImage && (
          <div className="space-y-4">
            {/* Provider Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setProvider("replicate");
                  setModel("black-forest-labs/flux-schnell");
                }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  provider === "replicate" 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="text-sm font-medium">Replicate</div>
                <div className="text-xs text-muted-foreground">Flux AI Models</div>
              </button>
              <button
                onClick={() => {
                  setProvider("piapi");
                  setModel("flux");
                }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  provider === "piapi" 
                    ? "border-accent bg-accent/10" 
                    : "border-border hover:border-accent/50"
                }`}
              >
                <div className="text-sm font-medium">PIAPI</div>
                <div className="text-xs text-muted-foreground">Flux.1, Qwen, Nano</div>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aspectRatio">Aspect Ratio</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger id="aspectRatio" className="bg-background/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1">Quadrato (1:1)</SelectItem>
                    <SelectItem value="16:9">Panoramico (16:9)</SelectItem>
                    <SelectItem value="9:16">Verticale (9:16)</SelectItem>
                    <SelectItem value="4:3">Standard (4:3)</SelectItem>
                    <SelectItem value="3:4">Ritratto (3:4)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Modello ({provider === "replicate" ? "Replicate" : "PIAPI"})</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model" className="bg-background/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {imageModels
                      .filter(m => m.provider === provider)
                      .map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} ({m.description})
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <Button 
          onClick={handleGenerate}
          disabled={isLoading || !prompt.trim()}
          className="w-full bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-accent-foreground"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {referenceImage ? "Modifica in corso..." : "Generazione in corso..."}
            </>
          ) : (
            <>
              {referenceImage ? <Upload className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {referenceImage ? "Modifica Immagine" : "Genera Immagine"}
            </>
          )}
        </Button>

        {generatedImage && (
          <Card className="p-4 space-y-4 border-accent/20 bg-card/50">
            <div className="relative rounded-lg overflow-hidden">
              <img 
                src={generatedImage} 
                alt="Generated" 
                className="w-full h-auto"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={handleSaveToGallery}
                variant="default"
                className="w-full bg-gradient-to-r from-primary to-primary/80"
              >
                <Save className="mr-2 h-4 w-4" />
                Salva in Galleria
              </Button>
              <Button 
                onClick={handleDownload}
                variant="outline"
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                Scarica
              </Button>
            </div>
          </Card>
        )}

        {!generatedImage && !isLoading && !referenceImage && (
          <p className="text-sm text-muted-foreground text-center">
            Provider: <span className="font-medium text-foreground">{provider === "replicate" ? "Replicate" : "PIAPI"}</span> • 
            Aspect Ratio: <span className="font-medium text-foreground">{aspectRatio}</span> • 
            Modello: <span className="font-medium text-foreground">
              {imageModels.find(m => m.id === model)?.name || model}
            </span>
          </p>
        )}
      </div>
    </div>
  );
};