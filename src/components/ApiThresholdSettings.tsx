import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings2, Save, RotateCcw } from "lucide-react";
import { ThresholdSettings } from "@/hooks/useApiMonitoring";

interface ApiThresholdSettingsProps {
  thresholds: ThresholdSettings;
  notifyOnChange: boolean;
  onSave: (thresholds: ThresholdSettings, notify: boolean) => void;
}

const DEFAULT_THRESHOLDS: ThresholdSettings = {
  Replicate: { warning: 1000, critical: 3000 },
  Freepik: { warning: 1000, critical: 3000 },
  Shotstack: { warning: 1000, critical: 3000 },
  ElevenLabs: { warning: 1000, critical: 3000 },
  "PIAPI Video": { warning: 1500, critical: 4000 },
  "PIAPI Image": { warning: 1500, critical: 4000 },
  "PIAPI Audio": { warning: 1500, critical: 4000 },
  "AIML API": { warning: 1500, critical: 4000 },
  "Google AI": { warning: 1000, critical: 3000 },
  "Luma AI": { warning: 1500, critical: 4000 },
  "OpenAI": { warning: 1000, critical: 3000 },
  "DashScope": { warning: 1500, critical: 4000 },
};

export const ApiThresholdSettings = ({ 
  thresholds, 
  notifyOnChange, 
  onSave 
}: ApiThresholdSettingsProps) => {
  const [localThresholds, setLocalThresholds] = useState<ThresholdSettings>(thresholds);
  const [localNotify, setLocalNotify] = useState(notifyOnChange);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalThresholds(thresholds);
    setLocalNotify(notifyOnChange);
  }, [thresholds, notifyOnChange]);

  const handleThresholdChange = (api: string, type: "warning" | "critical", value: string) => {
    const numValue = parseInt(value) || 0;
    setLocalThresholds(prev => ({
      ...prev,
      [api]: {
        ...prev[api],
        [type]: numValue,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(localThresholds, localNotify);
    setHasChanges(false);
  };

  const handleReset = () => {
    setLocalThresholds(DEFAULT_THRESHOLDS);
    setHasChanges(true);
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          Soglie Response Time
        </CardTitle>
        <CardDescription>
          Configura le soglie di allarme per i tempi di risposta (ms)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Notification toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
          <div>
            <p className="text-sm font-medium">Notifiche Push</p>
            <p className="text-xs text-muted-foreground">
              Ricevi notifiche quando lo stato cambia
            </p>
          </div>
          <Switch 
            checked={localNotify} 
            onCheckedChange={(checked) => {
              setLocalNotify(checked);
              setHasChanges(true);
            }}
          />
        </div>

        {/* Threshold settings per API */}
        <div className="space-y-3">
          {Object.entries(localThresholds).map(([api, values]) => (
            <div key={api} className="p-3 rounded-lg bg-background/50">
              <p className="text-sm font-medium mb-2">{api}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Warning (ms)
                  </Label>
                  <Input
                    type="number"
                    value={values.warning}
                    onChange={(e) => handleThresholdChange(api, "warning", e.target.value)}
                    className="h-8 text-sm mt-1"
                    min={0}
                    step={100}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Critical (ms)
                  </Label>
                  <Input
                    type="number"
                    value={values.critical}
                    onChange={(e) => handleThresholdChange(api, "critical", e.target.value)}
                    className="h-8 text-sm mt-1"
                    min={0}
                    step={100}
                  />
                </div>
              </div>
              <div className="flex gap-1 mt-2">
                <div className="h-1 flex-1 rounded-full bg-green-500/30" />
                <div className="h-1 flex-1 rounded-full bg-yellow-500/30" />
                <div className="h-1 flex-1 rounded-full bg-destructive/30" />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0ms</span>
                <span>{values.warning}ms</span>
                <span>{values.critical}ms</span>
                <span>∞</span>
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleReset}
            className="flex-1"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex-1"
          >
            <Save className="w-3 h-3 mr-1" />
            Salva
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
