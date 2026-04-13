import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Palette } from "lucide-react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";

// Import preview images
import animationImg from "@/assets/styles/animation.jpg";
import claymationImg from "@/assets/styles/claymation.jpg";
import comicNoirImg from "@/assets/styles/comic-noir.jpg";
import watercolorImg from "@/assets/styles/watercolor.jpg";
import cinemaImg from "@/assets/styles/cinema.jpg";
import vintagePosterImg from "@/assets/styles/vintage-poster.jpg";
import sciFiImg from "@/assets/styles/sci-fi.jpg";
import collageImg from "@/assets/styles/collage.jpg";
import penInkImg from "@/assets/styles/pen-ink.jpg";
import plasticBlocksImg from "@/assets/styles/plastic-blocks.jpg";
import halftoneImg from "@/assets/styles/halftone.jpg";
import motionGraphicsImg from "@/assets/styles/motion-graphics.jpg";

export interface VideoStyle {
  id: string;
  name: string;
  category: string;
  preview: string;
  description: string;
  promptModifier: string;
}

const VIDEO_STYLES: VideoStyle[] = [
  {
    id: "animation",
    name: "Animation",
    category: "Cartoon",
    preview: animationImg,
    description: "Stile animazione 3D fluida e colorata",
    promptModifier: "3D animated style, Pixar-like, vibrant colors, smooth animation",
  },
  {
    id: "claymation",
    name: "Claymation",
    category: "Cartoon",
    preview: claymationImg,
    description: "Stop-motion in plastilina artigianale",
    promptModifier: "claymation style, stop motion, handcrafted clay figures, warm lighting",
  },
  {
    id: "comic-noir",
    name: "Comic Noir",
    category: "Artistico",
    preview: comicNoirImg,
    description: "Fumetto dark con contrasti forti",
    promptModifier: "comic book noir style, high contrast black and white, dramatic shadows, ink strokes",
  },
  {
    id: "watercolor",
    name: "Watercolor",
    category: "Artistico",
    preview: watercolorImg,
    description: "Acquerello delicato con sfumature morbide",
    promptModifier: "watercolor painting style, soft washes, delicate brushstrokes, pastel tones",
  },
  {
    id: "cinema",
    name: "Cinema",
    category: "Realistico",
    preview: cinemaImg,
    description: "Cinematografico con color grading professionale",
    promptModifier: "cinematic style, anamorphic lens, professional color grading, film grain, shallow depth of field",
  },
  {
    id: "vintage-poster",
    name: "Vintage Poster",
    category: "Retrò",
    preview: vintagePosterImg,
    description: "Poster retrò anni '50-'60",
    promptModifier: "vintage poster art style, retro 1950s aesthetic, bold typography, limited color palette",
  },
  {
    id: "sci-fi",
    name: "Sci-Fi",
    category: "Genere",
    preview: sciFiImg,
    description: "Fantascienza con atmosfere futuristiche",
    promptModifier: "sci-fi style, futuristic, neon lighting, holographic elements, cyberpunk atmosphere",
  },
  {
    id: "collage",
    name: "Collage",
    category: "Artistico",
    preview: collageImg,
    description: "Collage misto con texture e ritagli",
    promptModifier: "mixed media collage style, paper textures, layered cutouts, editorial design",
  },
  {
    id: "pen-ink",
    name: "Pen & Ink",
    category: "Artistico",
    preview: penInkImg,
    description: "Illustrazione a penna e inchiostro dettagliata",
    promptModifier: "pen and ink illustration style, detailed linework, cross-hatching, hand-drawn feel",
  },
  {
    id: "plastic-blocks",
    name: "Plastic Blocks",
    category: "Cartoon",
    preview: plasticBlocksImg,
    description: "Costruzioni in blocchetti colorati stile LEGO",
    promptModifier: "plastic building blocks style, LEGO-like, miniature world, toy aesthetic, bright colors",
  },
  {
    id: "halftone",
    name: "Halftone",
    category: "Retrò",
    preview: halftoneImg,
    description: "Effetto mezzetinte pop art",
    promptModifier: "halftone dot pattern, pop art style, Ben-Day dots, comic print aesthetic",
  },
  {
    id: "motion-graphics",
    name: "Motion Graphics",
    category: "Moderno",
    preview: motionGraphicsImg,
    description: "Grafica in movimento pulita e moderna",
    promptModifier: "clean motion graphics, flat design, geometric shapes, smooth transitions, corporate style",
  },
];

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
      <motion.div layout className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((style, index) => {
            const isSelected = selectedStyle?.id === style.id;
            return (
              <motion.button
                key={style.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 25, delay: index * 0.03 }}
                whileHover={{ scale: 1.08, y: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelectStyle(style)}
                className={cn(
                  "group relative flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                {/* Style Preview Image */}
                <div className="w-full aspect-square rounded-lg overflow-hidden">
                  <img
                    src={style.preview}
                    alt={style.name}
                    loading="lazy"
                    width={512}
                    height={512}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                </div>

                {/* Selected Checkmark */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Label */}
                <span className="text-xs font-medium text-foreground truncate w-full text-center">
                  {style.name}
                </span>

                {/* Category Badge */}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {style.category}
                </Badge>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export { VIDEO_STYLES };
