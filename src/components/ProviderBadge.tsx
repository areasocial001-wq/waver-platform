import { Badge } from "@/components/ui/badge";
import { 
  VideoProviderType, 
  VIDEO_PROVIDERS, 
  getProviderInfo, 
  getProviderGroup,
  getGroupBadgeStyles,
  getGroupLabel 
} from "@/lib/videoProviderConfig";

interface ProviderBadgeProps {
  providerId: string;
  showGroup?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export function ProviderBadge({ 
  providerId, 
  showGroup = false, 
  size = 'default',
  className = '' 
}: ProviderBadgeProps) {
  const provider = getProviderInfo(providerId);
  const group = getProviderGroup(providerId);
  const groupStyles = getGroupBadgeStyles(group);
  
  if (showGroup) {
    return (
      <Badge 
        variant="secondary" 
        className={`${groupStyles.bg} ${groupStyles.text} border-0 ${
          size === 'sm' ? 'text-[10px] px-1.5 py-0 h-5' : ''
        } ${className}`}
      >
        {getGroupLabel(group)}
      </Badge>
    );
  }
  
  if (provider) {
    return (
      <Badge 
        variant="secondary" 
        className={`${provider.badgeColor} ${provider.textColor} border-0 ${
          size === 'sm' ? 'text-[10px] px-1.5 py-0 h-5' : ''
        } ${className}`}
      >
        {provider.shortName}
      </Badge>
    );
  }
  
  // Fallback per provider non riconosciuti
  return (
    <Badge 
      variant="secondary" 
      className={`${size === 'sm' ? 'text-[10px] px-1.5 py-0 h-5' : ''} ${className}`}
    >
      {providerId.toUpperCase()}
    </Badge>
  );
}

interface ProviderGroupBadgeProps {
  group: 'google' | 'aiml' | 'piapi' | 'freepik' | 'auto';
  size?: 'sm' | 'default';
  className?: string;
}

export function ProviderGroupBadge({ group, size = 'default', className = '' }: ProviderGroupBadgeProps) {
  const styles = getGroupBadgeStyles(group);
  
  return (
    <Badge 
      variant="secondary" 
      className={`${styles.bg} ${styles.text} border-0 ${
        size === 'sm' ? 'text-[10px] px-1.5 py-0 h-5' : ''
      } ${className}`}
    >
      {getGroupLabel(group)}
    </Badge>
  );
}
