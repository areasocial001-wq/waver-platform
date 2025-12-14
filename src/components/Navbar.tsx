import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { LogOut, History, Sparkles, Home, Layout, FileText, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const isHistoryPage = location.pathname === "/history";
  const isStoryboardsPage = location.pathname === "/my-storyboards";
  const isContentGeneratorPage = location.pathname === "/content-generator";
  const isFreepikPage = location.pathname === "/freepik";

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
            Waver Platform
          </h1>
        </button>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user.email}
          </span>
          {isHistoryPage || isStoryboardsPage || isContentGeneratorPage || isFreepikPage ? (
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
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="bg-card hover:bg-accent text-foreground border-border"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Esci
          </Button>
        </div>
      </div>
    </nav>
  );
};
