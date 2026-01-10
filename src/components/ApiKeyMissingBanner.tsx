import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Settings } from "lucide-react";
import { Link } from "react-router-dom";

interface ApiKeyMissingBannerProps {
  apiName: string;
  description?: string;
  settingsPath?: string;
}

export function ApiKeyMissingBanner({ 
  apiName, 
  description,
  settingsPath = "/settings" 
}: ApiKeyMissingBannerProps) {
  return (
    <Alert className="border-yellow-500/50 bg-yellow-500/10">
      <AlertCircle className="h-4 w-4 text-yellow-500" />
      <AlertDescription className="flex items-center justify-between w-full">
        <div>
          <span className="font-medium text-yellow-600">{apiName} non configurata</span>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="ml-4 border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/20">
          <Link to={settingsPath}>
            <Settings className="h-4 w-4 mr-2" />
            Configura
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

interface MultiApiKeyBannerProps {
  missingKeys: { name: string; description?: string }[];
}

export function MultiApiKeyBanner({ missingKeys }: MultiApiKeyBannerProps) {
  if (missingKeys.length === 0) return null;
  
  return (
    <Alert className="border-yellow-500/50 bg-yellow-500/10">
      <AlertCircle className="h-4 w-4 text-yellow-500" />
      <AlertDescription>
        <div className="flex items-start justify-between">
          <div>
            <span className="font-medium text-yellow-600">API non configurate</span>
            <ul className="mt-2 space-y-1">
              {missingKeys.map((key) => (
                <li key={key.name} className="text-sm text-muted-foreground">
                  • <strong>{key.name}</strong>{key.description && `: ${key.description}`}
                </li>
              ))}
            </ul>
          </div>
          <Button asChild variant="outline" size="sm" className="ml-4 shrink-0 border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/20">
            <Link to="/settings">
              <Settings className="h-4 w-4 mr-2" />
              Impostazioni
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
