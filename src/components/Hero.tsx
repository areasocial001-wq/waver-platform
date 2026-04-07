import { Button } from "@/components/ui/button";
import { Video, Image } from "lucide-react";
import logoImg from "@/assets/logo.png";

export const Hero = () => {
  const scrollToGenerate = () => {
    document.getElementById("generate")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-hero opacity-50 animate-gradient bg-[length:200%_200%]" />
      
      {/* Floating orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
      
      <div className="relative z-10 container mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-card/50 backdrop-blur-sm mb-8 animate-pulse-slow">
          <img src={logoImg} alt="AI Production Hub" className="w-6 h-6 rounded-full" />
          <span className="text-sm text-muted-foreground">Powered by AI Production Hub</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent leading-tight">
          Trasforma le tue idee<br />in video straordinari
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
          Crea video di alta qualità fino a 1080p da testo o immagini con l'intelligenza artificiale di Waver
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button 
            size="lg" 
            onClick={scrollToGenerate}
            className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow-primary transition-all duration-300 group"
          >
            <Video className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
            Genera Video
          </Button>
          
          <Button 
            size="lg" 
            onClick={scrollToGenerate}
            className="bg-gradient-accent text-accent-foreground hover:opacity-90 shadow-glow-accent transition-all duration-300 group"
          >
            <Image className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
            Da Immagine a Video
          </Button>
        </div>
        
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="p-6 rounded-xl bg-card/30 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-colors">
            <div className="text-3xl font-bold text-primary mb-2">1080p</div>
            <div className="text-sm text-muted-foreground">Risoluzione Ultra HD</div>
          </div>
          
          <div className="p-6 rounded-xl bg-card/30 backdrop-blur-sm border border-border/50 hover:border-secondary/50 transition-colors">
            <div className="text-3xl font-bold text-secondary mb-2">4-8s</div>
            <div className="text-sm text-muted-foreground">Durata Flessibile</div>
          </div>
          
          <div className="p-6 rounded-xl bg-card/30 backdrop-blur-sm border border-border/50 hover:border-accent/50 transition-colors">
            <div className="text-3xl font-bold text-accent mb-2">Top 3</div>
            <div className="text-sm text-muted-foreground">Ranking Globale AI</div>
          </div>
        </div>
      </div>
    </section>
  );
};
