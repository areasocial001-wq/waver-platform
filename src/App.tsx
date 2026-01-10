import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ImageGalleryProvider } from "@/contexts/ImageGalleryContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import History from "./pages/History";
import MyStoryboards from "./pages/MyStoryboards";
import ViewStoryboard from "./pages/ViewStoryboard";
import ContentGenerator from "./pages/ContentGenerator";
import FreepikPage from "./pages/FreepikPage";
import ApiMonitoring from "./pages/ApiMonitoring";
import TalkingAvatarPage from "./pages/TalkingAvatar";
import JSON2VideoPage from "./pages/JSON2VideoPage";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ImageGalleryProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/history" element={<History />} />
            <Route path="/my-storyboards" element={<MyStoryboards />} />
            <Route path="/storyboard/:id" element={<ViewStoryboard />} />
            <Route path="/content-generator" element={<ContentGenerator />} />
            <Route path="/freepik" element={<FreepikPage />} />
            <Route path="/api-monitoring" element={<ApiMonitoring />} />
            <Route path="/talking-avatar" element={<TalkingAvatarPage />} />
            <Route path="/video-editor" element={<JSON2VideoPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ImageGalleryProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
