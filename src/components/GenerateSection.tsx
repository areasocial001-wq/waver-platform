import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TextToVideoForm } from "./TextToVideoForm";
import { ImageToVideoForm } from "./ImageToVideoForm";
import { Video, Image } from "lucide-react";

export const GenerateSection = () => {
  return (
    <section id="generate" className="py-20 px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Inizia a Creare
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Scegli il metodo di generazione preferito e crea il tuo video in pochi secondi
          </p>
        </div>

        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8 bg-card/50 border border-border p-1">
            <TabsTrigger 
              value="text" 
              className="flex items-center gap-2 data-[state=inactive]:bg-muted data-[state=inactive]:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Video className="w-4 h-4" />
              Text to Video
            </TabsTrigger>
            <TabsTrigger 
              value="image" 
              className="flex items-center gap-2 data-[state=inactive]:bg-muted data-[state=inactive]:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Image className="w-4 h-4" />
              Image to Video
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
        </Tabs>
      </div>
    </section>
  );
};
