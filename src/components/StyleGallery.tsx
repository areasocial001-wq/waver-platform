import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Palette } from "lucide-react";

export interface VideoStyle {
  id: string;
  name: string;
  category: string;
  preview: string; // emoji or color placeholder
  description: string;
  promptModifier: string;
}

const VIDEO_STYLES: VideoStyle[] = [
  {
    id: "animation",
    name: "Animation",
    category: "Cartoon",
    preview: "",
    description: "Stile animazione 3D fluida e colorata",
    promptModifier: "3D animated style, Pixar-like, vibrant colors, smooth animation",
  },
  {
    id: "claymation",
    name: "Claymation",
    category: "Cartoon",
    preview: "",
    description: "Stop-motion in plastilina artigianale",
    promptModifier: "claymation style, stop motion, handcrafted clay figures, warm lighting",
  },
  {
    id: "comic-noir",
    name: "Comic Noir",
    category: "Artistico",
    preview: "",
    description: "Fumetto dark con contrasti forti",
    promptModifier: "comic book noir style, high contrast black and white, dramatic shadows, ink strokes",
  },
  {
    id: "watercolor",
    name: "Watercolor",
    category: "Artistico",
    preview: "",
    description: "Acquerello delicato con sfumature morbide",
    promptModifier: "watercolor painting style, soft washes, delicate brushstrokes, pastel tones",
  },
  {
    id: "cinema",
    name: "Cinema",
    category: "Realistico",
    preview: "",
    description: "Cinematografico con color grading professionale",
    promptModifier: "cinematic style, anamorphic lens, professional color grading, film grain, shallow depth of field",
  },
  {
    id: "vintage-poster",
    name: "Vintage Poster",
    category: "Retrò",
    preview: "",
    description: "Poster retrò anni '50-'60",
    promptModifier: "vintage poster art style, retro 1950s aesthetic, bold typography, limited color palette",
  },
  {
    id: "sci-fi",
    name: "Sci-Fi",
    category: "Genere",
    preview: "",
    description: "Fantascienza con atmosfere futuristiche",
    promptModifier: "sci-fi style, futuristic, neon lighting, holographic elements, cyberpunk atmosphere",
  },
  {
    id: "collage",
    name: "Collage",
    category: "Artistico",
    preview: "",
    description: "Collage misto con texture e ritagli",
    promptModifier: "mixed media collage style, paper textures, layered cutouts, editorial design",
  },
  {
    id: "pen-ink",
    name: "Pen & Ink",
    category: "Artistico",
    preview: "",
    description: "Illustrazione a penna e inchiostro dettagliata",
    promptModifier: "pen and ink illustration style, detailed linework, cross-hatching, hand-drawn feel",
  },
  {
    id: "plastic-blocks",
    name: "Plastic Blocks",
    category: "Cartoon",
    preview: "",
    description: "Costruzioni in blocchetti colorati stile LEGO",
    promptModifier: "plastic building blocks style, LEGO-like, miniature world, toy aesthetic, bright colors",
  },
  {
    id: "halftone",
    name: "Halftone",
    category: "Retrò",
    preview: "",
    description: "Effetto mezzetinte pop art",
    promptModifier: "halftone dot pattern, pop art style, Ben-Day dots, comic print aesthetic",
  },
  {
    id: "motion-graphics",
    name: "Motion Graphics",
    category: "Moderno",
    preview: "",
    description: "Grafica in movimento pulita e moderna",
    promptModifier: "clean motion graphics, flat design, geometric shapes, smooth transitions, corporate style",
  },
];

// Color palette per style (gradient backgrounds)
const STYLE_COLORS: Record<string, string> = {
  animation: "from-blue-500/20 to-purple-500/20",
  claymation: "from-amber-500/20 to-orange-500/20",
  "comic-noir": "from-gray-800/40 to-gray-600/20",
  watercolor: "from-pink-300/20 to-sky-300/20",
  cinema: "from-yellow-600/20 to-red-800/20",
  "vintage-poster": "from-red-400/20 to-yellow-500/20",
  "sci-fi": "from-cyan-500/20 to-violet-600/20",
  collage: "from-green-400/20 to-yellow-400/20",
  "pen-ink": "from-gray-400/20 to-gray-200/20",
  "plastic-blocks": "from-red-500/20 to-blue-500/20",
  halftone: "from-rose-500/20 to-fuchsia-400/20",
  "motion-graphics": "from-indigo-500/20 to-sky-400/20",
};

const STYLE_EMOJIS: Record<string, string> = {
  animation: "🎬",
  claymation: "🧱",
  "comic-noir": "🦇",
  watercolor: "🎨",
  cinema: "📽️",
  "vintage-poster": "📯",
  "sci-fi": "🚀",
  collage: "✂️",
  "pen-ink": "✒️",
  "plastic-blocks": "🧩",
  halftone: "🔵",
  "motion-graphics": "◆",
};

const categories = [...new Set(VIDEO_STYLES.map((s) => s.category))];

interface StyleGalleryProps {
  selectedStyle: VideoStyle | null;
  onSelectStyle: (style: VideoStyle) => void;
}

export const StyleGallery = ({ selectedStyle, onSelectStyle }: StyleGalleryProps) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = activeCategory
    ? VIDEO_STYLES.filter((s) => s.category === activeCategory)
    : VIDEO_STYLES;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Palette className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Stili Visivi</h3>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setActiveCategory(null)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-all",
            !activeCategory
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Tutti
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-all",
              activeCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Style Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {filtered.map((style) => {
          const isSelected = selectedStyle?.id === style.id;
          return (
            <button
              key={style.id}
              onClick={() => onSelectStyle(style)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all hover:scale-105",
                isSelected
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              {/* Style Preview */}
              <div
                className={cn(
                  "w-full aspect-square rounded-lg flex items-center justify-center text-2xl bg-gradient-to-br",
                  STYLE_COLORS[style.id] || "from-muted to-muted"
                )}
              >
                {STYLE_EMOJIS[style.id] || "🎥"}
              </div>

              {/* Selected Checkmark */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}

              {/* Label */}
              <span className="text-xs font-medium text-foreground truncate w-full text-center">
                {style.name}
              </span>

              {/* Category Badge */}
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {style.category}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export { VIDEO_STYLES };
