import { ExternalLink } from "lucide-react";
import logoImg from "@/assets/logo.png";
import studiobookLogo from "@/assets/studiobook-logo.png";

export const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-card/30 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="AI Production Hub" className="w-12 h-12 rounded-full object-cover shadow-[0_0_15px_hsl(217,91%,60%/0.3)]" />
            <span className="text-sm font-medium">AI Production Hub</span>
            <img src={studiobookLogo} alt="StudioBook Edizioni" className="h-8 w-auto object-contain ml-2 bg-white/90 rounded px-1.5 py-0.5" />
            <span className="text-xs text-muted-foreground">v1.0</span>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a 
              href="/guide" 
              className="hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              Guida
            </a>
            <span className="text-border">|</span>
            <a 
              href="https://arxiv.org/pdf/2508.15761" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              Technical Report
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-border">|</span>
            <span>Waver 1.0 Engine</span>
          </div>

          <p className="text-xs text-muted-foreground">
            © 2025 Sistema di Produzione Video AI
          </p>
        </div>
      </div>
    </footer>
  );
};
