import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff, BellRing } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export const NotificationSettings = () => {
  const { isSupported, isEnabled, permission, requestPermission } = usePushNotifications();

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <BellRing className="w-4 h-4 text-primary" />
          Notifiche Push
        </CardTitle>
        <CardDescription className="text-xs">
          Ricevi avvisi quando i video sono pronti
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isSupported ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 text-yellow-600">
            <BellOff className="w-4 h-4" />
            <span className="text-xs">Notifiche non supportate su questo browser</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
              <div className="flex items-center gap-3">
                {isEnabled ? (
                  <Bell className="w-4 h-4 text-green-500" />
                ) : (
                  <BellOff className="w-4 h-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-xs font-medium">
                    {isEnabled ? "Notifiche attive" : "Notifiche disattivate"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Ricevi avvisi per video completati/falliti
                  </p>
                </div>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={() => !isEnabled && requestPermission()}
              />
            </div>

            {!isEnabled && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={requestPermission}
              >
                <Bell className="w-4 h-4 mr-2" />
                Abilita Notifiche
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
