import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { LogOut, History, Sparkles, Home, Layout, FileText, Wand2, Activity, Film, Settings, Mic, Music, MoreHorizontal, ChevronDown, Gauge, UserCircle, FileJson } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { ApiStatusNavWidget } from "./ApiStatusNavWidget";
import { VoiceCloneDialog } from "./VoiceCloneDialog";
import { AudioExtractorDialog } from "./AudioExtractorDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [voiceCloneOpen, setVoiceCloneOpen] = useState(false);
  const [audioExtractorOpen, setAudioExtractorOpen] = useState(false);
  
  const isHistoryPage = location.pathname === "/history";
  const isStoryboardsPage = location.pathname === "/my-storyboards";
  const isContentGeneratorPage = location.pathname === "/content-generator";
  const isFreepikPage = location.pathname === "/freepik";
  const isApiMonitoringPage = location.pathname === "/api-monitoring";
  const isVideoEditorPage = location.pathname === "/video-editor";
  const isTalkingAvatarPage = location.pathname === "/talking-avatar";
  const isSettingsPage = location.pathname === "/settings";
  const isExportTestPage = location.pathname === "/export-test";
  const isViduToolsPage = location.pathname === "/vidu-tools";
  const isLTXToolsPage = location.pathname === "/ltx-tools";
  const isNLtoJSONPage = location.pathname === "/nl-to-json";
  const isSubPage = isHistoryPage || isStoryboardsPage || isContentGeneratorPage || isFreepikPage || isApiMonitoringPage || isVideoEditorPage || isTalkingAvatarPage || isSettingsPage || isExportTestPage || isViduToolsPage || isLTXToolsPage || isNLtoJSONPage;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Logout effettuato");
    navigate("/auth");
  };

  if (!user) return null;

  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {/* Logo */}
        <button 
          onClick={() => navigate("/")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
        >
          <Sparkles className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent hidden sm:block">
            AI Production Hub
          </h1>
        </button>
        
        {/* Right side controls */}
        <div className="flex items-center gap-2 overflow-hidden">
          {/* API Status Widget - hidden on mobile */}
          <div className="hidden md:block">
            <ApiStatusNavWidget />
          </div>
          
          {/* Email - hidden on small screens */}
          <span className="text-sm text-muted-foreground hidden lg:inline truncate max-w-[150px]">
            {user.email}
          </span>
          
          {isSubPage ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/")}
              className="bg-card hover:bg-accent text-foreground border-border"
            >
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
          ) : (
            <>
              {/* Primary navigation - visible on larger screens */}
              <div className="hidden xl:flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/my-storyboards")}
                  className="bg-card hover:bg-accent text-foreground border-border"
                >
                  <Layout className="w-4 h-4 mr-2" />
                  Storyboard
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/history")}
                  className="bg-card hover:bg-accent text-foreground border-border"
                >
                  <History className="w-4 h-4 mr-2" />
                  Storico
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/video-editor")}
                  className="bg-card hover:bg-accent text-foreground border-border"
                >
                  <Film className="w-4 h-4 mr-2" />
                  Editor
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/talking-avatar")}
                  className="bg-card hover:bg-accent text-foreground border-border"
                >
                  <UserCircle className="w-4 h-4 mr-2" />
                  Avatar
                </Button>
              </div>

              {/* Audio Tools Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    Audio
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Strumenti Audio</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setVoiceCloneOpen(true)}>
                    <Mic className="w-4 h-4 mr-2" />
                    Clona Voce
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAudioExtractorOpen(true)}>
                    <Music className="w-4 h-4 mr-2" />
                    Estrai Audio
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* More menu for other items */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-card hover:bg-accent text-foreground border-border"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline ml-2">Altro</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Navigazione</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  {/* Show on smaller screens */}
                  <div className="xl:hidden">
                    <DropdownMenuItem onClick={() => navigate("/my-storyboards")}>
                      <Layout className="w-4 h-4 mr-2" />
                      Storyboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/history")}>
                      <History className="w-4 h-4 mr-2" />
                      Storico
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/video-editor")}>
                      <Film className="w-4 h-4 mr-2" />
                      Editor
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/talking-avatar")}>
                      <UserCircle className="w-4 h-4 mr-2" />
                      Talking Avatar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </div>
                  
                  <DropdownMenuItem onClick={() => navigate("/content-generator")}>
                    <FileText className="w-4 h-4 mr-2" />
                    AI Content
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/vidu-tools")}>
                    <Film className="w-4 h-4 mr-2" />
                    Vidu Advanced
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/freepik")}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Freepik
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/nl-to-json")}>
                    <FileJson className="w-4 h-4 mr-2" />
                    Testo → JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/api-monitoring")}>
                    <Activity className="w-4 h-4 mr-2" />
                    API Monitor
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="w-4 h-4 mr-2" />
                    Impostazioni
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          
          {/* Logout Button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/30 hover:border-destructive/50 transition-colors"
              >
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Esci</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Conferma Logout</AlertDialogTitle>
                <AlertDialogDescription>
                  Sei sicuro di voler uscire dall'applicazione? Dovrai effettuare nuovamente l'accesso per continuare a utilizzare la piattaforma.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleSignOut}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Esci
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      
      {/* Voice Clone Dialog */}
      <VoiceCloneDialog
        open={voiceCloneOpen}
        onOpenChange={setVoiceCloneOpen}
      />
      
      {/* Audio Extractor Dialog */}
      <AudioExtractorDialog
        open={audioExtractorOpen}
        onOpenChange={setAudioExtractorOpen}
      />
    </nav>
  );
};
