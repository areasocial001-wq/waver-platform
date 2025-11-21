import { Github, ExternalLink, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-card/30 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-lg mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Waver Video Generator
            </h3>
            <p className="text-sm text-muted-foreground">
              Piattaforma di generazione video AI basata su Waver 1.0, 
              il modello foundation per video di livello industriale.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-foreground">Risorse</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a 
                  href="http://www.waver.video/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  Sito Ufficiale Waver
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a 
                  href="https://arxiv.org/pdf/2508.15761" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  Technical Report
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a 
                  href="http://opensource.bytedance.com/discord/invite" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  Discord Community
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-foreground">Open Source</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("https://github.com/FoundationVision/Waver", "_blank")}
              className="bg-muted/50 hover:bg-muted border-border/50"
            >
              <Github className="w-4 h-4 mr-2" />
              GitHub Repository
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Waver è un progetto open-source di FoundationVision
            </p>
          </div>
        </div>

        <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2025 Waver Video Generator. Interfaccia non ufficiale.
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            Creato con <Heart className="w-4 h-4 text-accent fill-accent" /> usando Lovable
          </p>
        </div>
      </div>
    </footer>
  );
};
