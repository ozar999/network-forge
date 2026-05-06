import React from 'react';

interface IconProps {
  className?: string;
  status?: 'up' | 'down';
}

export function RouterIcon({ className, status = 'up' }: IconProps) {
  const color = status === 'up' ? 'var(--terminal)' : 'var(--noc-red)';
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <ellipse cx="32" cy="20" rx="24" ry="10" stroke={color} strokeWidth="2" fill="none" />
      <line x1="8" y1="20" x2="8" y2="44" stroke={color} strokeWidth="2" />
      <line x1="56" y1="20" x2="56" y2="44" stroke={color} strokeWidth="2" />
      <ellipse cx="32" cy="44" rx="24" ry="10" stroke={color} strokeWidth="2" fill="none" />
      {/* Arrows */}
      <line x1="20" y1="32" x2="44" y2="32" stroke={color} strokeWidth="1.5" />
      <polyline points="40,28 44,32 40,36" stroke={color} strokeWidth="1.5" fill="none" />
      <polyline points="24,28 20,32 24,36" stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export function SwitchIcon({ className, status = 'up' }: IconProps) {
  const color = status === 'up' ? 'var(--terminal)' : 'var(--noc-red)';
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <rect x="6" y="18" width="52" height="28" rx="3" stroke={color} strokeWidth="2" />
      {/* Ports */}
      {[16, 24, 32, 40, 48].map((x) => (
        <rect key={x} x={x - 3} y="38" width="6" height="4" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.3" />
      ))}
      {/* Arrows */}
      <line x1="18" y1="30" x2="46" y2="30" stroke={color} strokeWidth="1.5" />
      <polyline points="42,26 46,30 42,34" stroke={color} strokeWidth="1.5" fill="none" />
      <polyline points="22,26 18,30 22,34" stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export function PcIcon({ className, status = 'up' }: IconProps) {
  const color = status === 'up' ? 'var(--terminal)' : 'var(--noc-red)';
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <rect x="10" y="8" width="44" height="32" rx="2" stroke={color} strokeWidth="2" />
      <rect x="14" y="12" width="36" height="24" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.1" />
      <line x1="26" y1="40" x2="26" y2="48" stroke={color} strokeWidth="2" />
      <line x1="38" y1="40" x2="38" y2="48" stroke={color} strokeWidth="2" />
      <rect x="18" y="48" width="28" height="4" rx="1" stroke={color} strokeWidth="2" />
      {/* Screen cursor */}
      <rect x="18" y="20" width="8" height="2" fill={color} fillOpacity="0.6" />
    </svg>
  );
}

export function FirewallIcon({ className, status = 'up' }: IconProps) {
  const color = status === 'up' ? 'var(--noc-yellow)' : 'var(--noc-red)';
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <rect x="10" y="10" width="44" height="44" rx="3" stroke={color} strokeWidth="2" />
      {/* Brick pattern */}
      <line x1="10" y1="22" x2="54" y2="22" stroke={color} strokeWidth="1" opacity="0.5" />
      <line x1="10" y1="34" x2="54" y2="34" stroke={color} strokeWidth="1" opacity="0.5" />
      <line x1="10" y1="46" x2="54" y2="46" stroke={color} strokeWidth="1" opacity="0.5" />
      <line x1="32" y1="10" x2="32" y2="22" stroke={color} strokeWidth="1" opacity="0.5" />
      <line x1="22" y1="22" x2="22" y2="34" stroke={color} strokeWidth="1" opacity="0.5" />
      <line x1="42" y1="22" x2="42" y2="34" stroke={color} strokeWidth="1" opacity="0.5" />
      <line x1="32" y1="34" x2="32" y2="46" stroke={color} strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

export function ServerIcon({ className, status = 'up' }: IconProps) {
  const color = status === 'up' ? 'var(--noc-cyan)' : 'var(--noc-red)';
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <rect x="12" y="6" width="40" height="16" rx="2" stroke={color} strokeWidth="2" />
      <rect x="12" y="24" width="40" height="16" rx="2" stroke={color} strokeWidth="2" />
      <rect x="12" y="42" width="40" height="16" rx="2" stroke={color} strokeWidth="2" />
      {/* Drive indicators */}
      <circle cx="20" cy="14" r="2" fill={color} fillOpacity="0.6" />
      <circle cx="20" cy="32" r="2" fill={color} fillOpacity="0.6" />
      <circle cx="20" cy="50" r="2" fill={color} fillOpacity="0.6" />
      <line x1="28" y1="14" x2="44" y2="14" stroke={color} strokeWidth="1" opacity="0.4" />
      <line x1="28" y1="32" x2="44" y2="32" stroke={color} strokeWidth="1" opacity="0.4" />
      <line x1="28" y1="50" x2="44" y2="50" stroke={color} strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

export const DeviceIconMap: Record<string, React.FC<IconProps>> = {
  router: RouterIcon,
  switch: SwitchIcon,
  pc: PcIcon,
  firewall: FirewallIcon,
  server: ServerIcon,
  laptop: LaptopIcon,
  accesspoint: AccessPointIcon,
};

export function LaptopIcon({ className, status = 'up' }: IconProps) {
  const color = status === 'up' ? 'var(--terminal)' : 'var(--noc-red)';
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <rect x="12" y="10" width="40" height="28" rx="2" stroke={color} strokeWidth="2" />
      <rect x="16" y="14" width="32" height="20" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.1" />
      <path d="M6 42 L12 38 L52 38 L58 42 Z" stroke={color} strokeWidth="2" fill="none" />
      <line x1="6" y1="42" x2="58" y2="42" stroke={color} strokeWidth="2" />
      {/* WiFi indicator */}
      <path d="M40 18 Q44 16 48 18" stroke={color} strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M42 20 Q44 19 46 20" stroke={color} strokeWidth="1" fill="none" opacity="0.5" />
      <circle cx="44" cy="22" r="1" fill={color} fillOpacity="0.5" />
    </svg>
  );
}

export function AccessPointIcon({ className, status = 'up' }: IconProps) {
  const color = status === 'up' ? 'var(--noc-cyan)' : 'var(--noc-red)';
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      {/* Base unit */}
      <ellipse cx="32" cy="44" rx="16" ry="6" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.1" />
      <line x1="32" y1="44" x2="32" y2="28" stroke={color} strokeWidth="2" />
      {/* Antenna */}
      <circle cx="32" cy="26" r="3" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.3" />
      {/* Signal waves */}
      <path d="M20 20 Q26 10 32 20" stroke={color} strokeWidth="1.5" fill="none" opacity="0.6" />
      <path d="M32 20 Q38 10 44 20" stroke={color} strokeWidth="1.5" fill="none" opacity="0.6" />
      <path d="M14 24 Q22 8 32 24" stroke={color} strokeWidth="1" fill="none" opacity="0.3" />
      <path d="M32 24 Q42 8 50 24" stroke={color} strokeWidth="1" fill="none" opacity="0.3" />
    </svg>
  );
}