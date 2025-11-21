import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TextToVideoForm } from "./TextToVideoForm";
import { Video } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

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
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                L'Image to Video non è al momento disponibile con questa API. Utilizza la generazione Text to Video.
              </AlertDescription>
            </Alert>
            <TextToVideoForm />
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
