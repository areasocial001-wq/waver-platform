import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ImageGalleryProvider } from "@/contexts/ImageGalleryContext";
import Landing from "./pages/Landing";
import ResetPassword from "./pages/ResetPassword";
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
import ViduToolsPage from "./pages/ViduTools";
import LTXToolsPage from "./pages/LTXTools";
import NLtoJSONPage from "./pages/NLtoJSON";
import TimelineEditorPage from "./pages/TimelineEditorPage";
import AdminDashboard from "./pages/AdminDashboard";
import PricingPage from "./pages/Pricing";
import LumaToolsPage from "./pages/LumaTools";
import FacelessVideoPage from "./pages/FacelessVideo";
import TrailerGeneratorPage from "./pages/TrailerGenerator";

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
            {/* Public routes */}
            <Route path="/landing" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/storyboard/:id" element={<ViewStoryboard />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Authenticated routes */}
            <Route path="/" element={<Index />} />
            <Route path="/history" element={<History />} />
            <Route path="/my-storyboards" element={<MyStoryboards />} />
            <Route path="/content-generator" element={<ContentGenerator />} />
            <Route path="/freepik" element={<FreepikPage />} />
            <Route path="/api-monitoring" element={<ApiMonitoring />} />
            <Route path="/talking-avatar" element={<TalkingAvatarPage />} />
            <Route path="/video-editor" element={<JSON2VideoPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/vidu-tools" element={<ViduToolsPage />} />
            <Route path="/ltx-tools" element={<LTXToolsPage />} />
            <Route path="/nl-to-json" element={<NLtoJSONPage />} />
            <Route path="/timeline-editor" element={<TimelineEditorPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ImageGalleryProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
