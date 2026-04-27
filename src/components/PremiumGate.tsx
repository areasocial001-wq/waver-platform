// Commercial features removed: PremiumGate is now a passthrough that
// always renders its children. Kept to avoid breaking imports.

interface PremiumGateProps {
  children: React.ReactNode;
  featureName?: string;
}

export const PremiumGate = ({ children }: PremiumGateProps) => {
  return <>{children}</>;
};
