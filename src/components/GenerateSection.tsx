import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TextToVideoForm } from "./TextToVideoForm";
import { ImageToVideoForm } from "./ImageToVideoForm";
import { ImageGenerationForm } from "./ImageGenerationForm";
import { StoryboardEditor } from "./StoryboardEditor";
import { VideoToAudioForm } from "./VideoToAudioForm";
import { VideoTranscriber } from "./VideoTranscriber";
import { PiAPIAudioGenerator } from "./PiAPIAudioGenerator";
import { MotionControlForm } from "./MotionControlForm";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { Video, Image, Sparkles, Layout, Volume2, Music, Wand2, FileText } from "lucide-react";

export const GenerateSection = () => {
  return (
    <section id="generate" className="py-20 px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Inizia a Creare
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
            Scegli il metodo di generazione preferito e crea il tuo video in pochi secondi
          </p>
          <div className="max-w-md mx-auto">
            <DiagnosticsPanel />
          </div>
        </div>

        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid w-full max-w-6xl mx-auto grid-cols-8 mb-8 bg-card/50 border border-border p-1">
            <TabsTrigger 
              value="text" 
              className="flex items-center gap-2 data-[state=inactive]:bg-muted data-[state=inactive]:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Video className="w-4 h-4" />
              <span className="hidden md:inline">Text to Video</span>
            </TabsTrigger>
            <TabsTrigger 
              value="image" 
              className="flex items-center gap-2 data-[state=inactive]:bg-muted data-[state=inactive]:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Image className="w-4 h-4" />
              <span className="hidden md:inline">Image to Video</span>
            </TabsTrigger>
            <TabsTrigger 
              value="motion-control" 
              className="flex items-center gap-2 data-[state=inactive]:bg-muted data-[state=inactive]:text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
            >
              <Wand2 className="w-4 h-4" />
              <span className="hidden md:inline">Motion Control</span>
            </TabsTrigger>
            <TabsTrigger 
              value="video-audio" 
              className="flex items-center gap-2 data-[state=inactive]:bg-muted data-[state=inactive]:text-foreground data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
            >
              <Volume2 className="w-4 h-4" />
              <span className="hidden md:inline">Video to Audio</span>
            </TabsTrigger>
            <TabsTrigger 
              value="transcribe" 
              className="flex items-center gap-2 data-[state=inactive]:bg-muted data-[state=inactive]:text-foreground data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden md:inline">Trascrivi</span>
            </TabsTrigger>
            <TabsTrigger 
              value="piapi-audio" 
              className="flex items-center gap-2 data-[state=inactive]:bg-muted data-[state=inactive]:text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
            >
              <Music className="w-4 h-4" />
              <span className="hidden md:inline">AI Music</span>
            </TabsTrigger>
            <TabsTrigger 
              value="generate-image" 
              className="flex items-center gap-2 data-[state=inactive]:bg-muted data-[state=inactive]:text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden md:inline">Genera Immagini</span>
            </TabsTrigger>
            <TabsTrigger 
              value="storyboard" 
              className="flex items-center gap-2 data-[state=inactive]:bg-muted data-[state=inactive]:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Layout className="w-4 h-4" />
              <span className="hidden md:inline">Storyboard</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text">
            <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-primary" />
                  Text to Video (T2V)
                </CardTitle>
                <CardDescription>
                  Descrivi il video che vuoi creare e lascia che Waver lo generi per te
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TextToVideoForm />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="image">
            <Card className="border-accent/20 bg-card/50 backdrop-blur-sm shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="w-5 h-5 text-accent" />
                  Image to Video (I2V)
                </CardTitle>
                <CardDescription>
                  Carica un'immagine e trasformala in un video dinamico
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImageToVideoForm />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="motion-control">
            <Card className="border-accent/20 bg-card/50 backdrop-blur-sm shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-accent" />
                  Kling 2.6 Motion Control
                </CardTitle>
                <CardDescription>
                  Trasferisci i movimenti da un video di riferimento a qualsiasi personaggio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MotionControlForm />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="video-audio">
            <Card className="border-secondary/20 bg-card/50 backdrop-blur-sm shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-secondary" />
                  Video to Audio (V2A)
                </CardTitle>
                <CardDescription>
                  Rigenera l'audio di un video esistente con TTS professionale ElevenLabs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VideoToAudioForm />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transcribe">
            <VideoTranscriber />
          </TabsContent>

          <TabsContent value="piapi-audio">
            <PiAPIAudioGenerator />
          </TabsContent>

          <TabsContent value="generate-image">
            <Card className="border-accent/20 bg-card/50 backdrop-blur-sm shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  Generazione Immagini
                </CardTitle>
                <CardDescription>
                  Crea scenografie e storyboard professionali con Replicate Flux AI
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImageGenerationForm />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="storyboard">
            <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layout className="w-5 h-5 text-primary" />
                  Editor Storyboard
                </CardTitle>
                <CardDescription>
                  Combina più immagini in uno storyboard professionale con layout personalizzabili
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StoryboardEditor />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};
