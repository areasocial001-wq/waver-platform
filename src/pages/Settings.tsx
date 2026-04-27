import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { AuthGuard } from "@/components/AuthGuard";
import ProviderSettings from "@/components/ProviderSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Zap, Bell, Shield, Film, FileAudio, Sliders } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { NotificationSettings } from "@/components/NotificationSettings";
import { ApiThresholdSettings } from "@/components/ApiThresholdSettings";
import { AudioDebugPanel } from "@/components/story-mode/AudioDebugPanel";
import { AudioLevelsPanel } from "@/components/story-mode/AudioLevelsPanel";
import { AudioMixSettingsCard } from "@/components/story-mode/AudioMixSettingsCard";
import { AudioSceneTimelinePanel } from "@/components/story-mode/AudioSceneTimelinePanel";
import { useApiMonitoring, ThresholdSettings } from "@/hooks/useApiMonitoring";
import {
  isAutoRecoveryEnabled, setAutoRecoveryEnabled, loadAutoRecoveryFromSupabase,
  isLockCharacterDefaultEnabled, setLockCharacterDefaultEnabled, loadLockCharacterDefaultFromSupabase,
} from "@/lib/storyModePreferences";
import { toast } from "sonner";

export default function SettingsPage() {
  const { thresholds, notifyOnChange, saveSettings } = useApiMonitoring();
  const [autoRecovery, setAutoRecovery] = useState(true);
  const [lockCharacterDefault, setLockCharacterDefault] = useState(false);
  const [isSyncingPreference, setIsSyncingPreference] = useState(true);

  useEffect(() => {
    // Hydrate from local cache immediately, then refresh from Supabase
    setAutoRecovery(isAutoRecoveryEnabled());
    setLockCharacterDefault(isLockCharacterDefaultEnabled());
    (async () => {
      const [remoteAuto, remoteLock] = await Promise.all([
        loadAutoRecoveryFromSupabase(),
        loadLockCharacterDefaultFromSupabase(),
      ]);
      setAutoRecovery(remoteAuto);
      setLockCharacterDefault(remoteLock);
      setIsSyncingPreference(false);
    })();
  }, []);

  const handleToggleAutoRecovery = (next: boolean) => {
    setAutoRecovery(next);
    setAutoRecoveryEnabled(next); // writes local + fires Supabase sync
    toast.success(next
      ? "Auto-recovery attivato: gli asset scaduti verranno rigenerati automaticamente al reload (sincronizzato su tutti i tuoi dispositivi)."
      : "Auto-recovery disattivato: dovrai cliccare 'Rigenera' manualmente nel pannello pre-flight (sincronizzato su tutti i tuoi dispositivi).");
  };

  const handleToggleLockCharacterDefault = (next: boolean) => {
    setLockCharacterDefault(next);
    setLockCharacterDefaultEnabled(next);
    toast.success(next
      ? "Blocca identità di default attivato: ogni rigenerazione di scena partirà con il lock attivo (sincronizzato su tutti i dispositivi)."
      : "Blocca identità di default disattivato: dovrai attivarlo manualmente sulla singola scena quando serve.");
  };

  const handleSaveThresholds = async (newThresholds: ThresholdSettings, notify: boolean) => {
    await saveSettings(newThresholds, notify);
    toast.success("Impostazioni salvate!");
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container max-w-4xl py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Settings className="h-8 w-8" />
              Impostazioni
            </h1>
            <p className="text-muted-foreground mt-2">
              Configura le preferenze dell'applicazione e i provider AI
            </p>
          </div>

          <Tabs defaultValue="providers" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="providers" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Provider</span>
              </TabsTrigger>
              <TabsTrigger value="story-mode" className="flex items-center gap-2">
                <Film className="h-4 w-4" />
                <span className="hidden sm:inline">Story Mode</span>
              </TabsTrigger>
              <TabsTrigger value="audio-mix" className="flex items-center gap-2">
                <Sliders className="h-4 w-4" />
                <span className="hidden sm:inline">Mix Audio</span>
              </TabsTrigger>
              <TabsTrigger value="audio-debug" className="flex items-center gap-2">
                <FileAudio className="h-4 w-4" />
                <span className="hidden sm:inline">Debug Audio</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Notifiche</span>
              </TabsTrigger>
              <TabsTrigger value="api" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">API</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="providers">
              <ProviderSettings />
            </TabsContent>

            <TabsContent value="story-mode">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Film className="h-5 w-5" />
                    Story Mode
                  </CardTitle>
                  <CardDescription>
                    Comportamento del wizard di produzione (rigenerazione asset, pre-flight)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card">
                    <div className="space-y-1 flex-1">
                      <Label htmlFor="auto-recovery" className="text-base font-medium">
                        Auto-recovery al reload
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Quando ricarichi un progetto Story Mode con asset scaduti (URL <code className="text-xs">blob:</code> della sessione precedente),
                        rigenera automaticamente voci, SFX, musica e video senza chiederti conferma.
                      </p>
                      <p className="text-xs text-muted-foreground/80">
                        Disattivalo se preferisci confermare manualmente prima di consumare crediti API.
                      </p>
                    </div>
                    <Switch
                      id="auto-recovery"
                      checked={autoRecovery}
                      disabled={isSyncingPreference}
                      onCheckedChange={handleToggleAutoRecovery}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card">
                    <div className="space-y-1 flex-1">
                      <Label htmlFor="lock-character-default" className="text-base font-medium">
                        🔒 Blocca identità di default per tutte le rigenerazioni
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Quando rigeneri immagini o video di una scena, attiva automaticamente il vincolo di identità del personaggio
                        (stesso volto, outfit e contesto delle altre scene) senza dover cliccare il toggle sulla singola scena.
                      </p>
                      <p className="text-xs text-muted-foreground/80">
                        La preferenza per la singola scena, se impostata, ha precedenza su questo default globale.
                      </p>
                    </div>
                    <Switch
                      id="lock-character-default"
                      checked={lockCharacterDefault}
                      disabled={isSyncingPreference}
                      onCheckedChange={handleToggleLockCharacterDefault}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audio-mix">
              <AudioMixSettingsCard />
            </TabsContent>

            <TabsContent value="audio-debug">
              <div className="space-y-6">
                <AudioDebugPanel />
                <AudioSceneTimelinePanel />
                <AudioLevelsPanel />
              </div>
            </TabsContent>

            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notifiche
                  </CardTitle>
                  <CardDescription>
                    Gestisci le notifiche push e le preferenze di avviso
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <NotificationSettings />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="api">
              <ApiThresholdSettings 
                thresholds={thresholds}
                notifyOnChange={notifyOnChange}
                onSave={handleSaveThresholds}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthGuard>
  );
}
