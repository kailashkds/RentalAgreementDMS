import React from 'react';
import { useHasSensitiveInfoPermission } from '@/hooks/usePermissions';
import { 
  maskPhoneNumber, 
  maskAadharNumber, 
  maskPanNumber, 
  maskAmount, 
  maskPropertyAddress, 
  maskSensitiveText,
  maskDocumentUrl 
} from '@/lib/sensitiveInfoUtils';

interface SensitiveInfoProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  type?: 'default' | 'phone' | 'aadhar' | 'pan' | 'amount' | 'address' | 'document';
  value?: string | number | null;
}

/**
 * Component that conditionally shows sensitive information based on user permissions
 * If user has VIEW_SENSITIVE_INFO permission, shows the actual content
 * Otherwise, shows masked/hidden content
 */
export function SensitiveInfo({ 
  children, 
  fallback, 
  type = 'default', 
  value 
}: SensitiveInfoProps) {
  const hasSensitivePermission = useHasSensitiveInfoPermission();

  if (hasSensitivePermission) {
    return <>{children}</>;
  }

  // If a specific fallback is provided, use it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Generate masked content based on type
  let maskedContent: string;
  
  switch (type) {
    case 'phone':
      maskedContent = maskPhoneNumber(value?.toString());
      break;
    case 'aadhar':
      maskedContent = maskAadharNumber(value?.toString());
      break;
    case 'pan':
      maskedContent = maskPanNumber(value?.toString());
      break;
    case 'amount':
      maskedContent = maskAmount(value);
      break;
    case 'address':
      maskedContent = maskPropertyAddress(value?.toString());
      break;
    case 'document':
      maskedContent = maskDocumentUrl();
      break;
    default:
      maskedContent = maskSensitiveText(value?.toString());
      break;
  }

  return (
    <span className="text-muted-foreground italic" title="Sensitive information hidden">
      {maskedContent}
    </span>
  );
}

/**
 * Convenience components for specific types of sensitive information
 */
export function SensitivePhone({ phoneNumber }: { phoneNumber?: string | null }) {
  return (
    <SensitiveInfo type="phone" value={phoneNumber}>
      {phoneNumber}
    </SensitiveInfo>
  );
}

export function SensitiveAadhar({ aadharNumber }: { aadharNumber?: string | null }) {
  return (
    <SensitiveInfo type="aadhar" value={aadharNumber}>
      {aadharNumber}
    </SensitiveInfo>
  );
}

export function SensitivePan({ panNumber }: { panNumber?: string | null }) {
  return (
    <SensitiveInfo type="pan" value={panNumber}>
      {panNumber}
    </SensitiveInfo>
  );
}

export function SensitiveAmount({ amount }: { amount?: number | string | null }) {
  return (
    <SensitiveInfo type="amount" value={amount}>
      {typeof amount === 'number' ? `₹ ${amount.toLocaleString('en-IN')}` : amount}
    </SensitiveInfo>
  );
}

export function SensitiveAddress({ address }: { address?: string | null }) {
  return (
    <SensitiveInfo type="address" value={address}>
      {address}
    </SensitiveInfo>
  );
}

export function SensitiveDocument({ 
  children, 
  documentUrl 
}: { 
  children: React.ReactNode;
  documentUrl?: string | null;
}) {
  return (
    <SensitiveInfo type="document" value={documentUrl}>
      {children}
    </SensitiveInfo>
  );
}