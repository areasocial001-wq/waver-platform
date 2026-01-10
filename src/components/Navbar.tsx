import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { LogOut, History, Sparkles, Home, Layout, FileText, Wand2, Activity, Film } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { ApiStatusNavWidget } from "./ApiStatusNavWidget";
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

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const isHistoryPage = location.pathname === "/history";
  const isStoryboardsPage = location.pathname === "/my-storyboards";
  const isContentGeneratorPage = location.pathname === "/content-generator";
  const isFreepikPage = location.pathname === "/freepik";
  const isApiMonitoringPage = location.pathname === "/api-monitoring";
  const isVideoEditorPage = location.pathname === "/video-editor";

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
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <button 
          onClick={() => navigate("/")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Sparkles className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            AI Production Hub
          </h1>
        </button>
        
        <div className="flex items-center gap-3">
          {/* API Status Widget */}
          <ApiStatusNavWidget />
          
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user.email}
          </span>
          {isHistoryPage || isStoryboardsPage || isContentGeneratorPage || isFreepikPage || isApiMonitoringPage || isVideoEditorPage ? (
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
                onClick={() => navigate("/content-generator")}
                className="bg-card hover:bg-accent text-foreground border-border"
              >
                <FileText className="w-4 h-4 mr-2" />
                AI Content
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/freepik")}
                className="bg-card hover:bg-accent text-foreground border-border"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Freepik
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/api-monitoring")}
                className="bg-card hover:bg-accent text-foreground border-border"
              >
                <Activity className="w-4 h-4 mr-2" />
                API
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
            </>
          )}
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/30 hover:border-destructive/50 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Esci
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
    </nav>
  );
};
