import React from 'react';
import type { DeviceType } from './types';
import { RouterIcon, SwitchIcon, PcIcon, FirewallIcon, ServerIcon, LaptopIcon, AccessPointIcon } from './DeviceIcons';

const DEVICE_LIST: { type: DeviceType; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { type: 'router', label: 'Router', Icon: RouterIcon },
  { type: 'switch', label: 'Switch', Icon: SwitchIcon },
  { type: 'pc', label: 'PC', Icon: PcIcon },
  { type: 'laptop', label: 'Laptop', Icon: LaptopIcon },
  { type: 'firewall', label: 'Firewall', Icon: FirewallIcon },
  { type: 'server', label: 'Server', Icon: ServerIcon },
  { type: 'accesspoint', label: 'AP', Icon: AccessPointIcon },
];

interface DeviceToolbarProps {
  onSave: () => void;
  onLoad: () => void;
  onClear: () => void;
  connectingFrom: string | null;
  deviceCount?: number;
  connectionCount?: number;
}

export function DeviceToolbar({ onSave, onLoad, onClear, connectingFrom, deviceCount = 0, connectionCount = 0 }: DeviceToolbarProps) {
  return (
    <div className="relative flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-card/90 via-card/70 to-card/90 backdrop-blur-xl">
      {/* Device palette pill */}
      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-background/40 border border-border/60 shadow-inner">
        <span className="text-[9px] text-muted-foreground uppercase tracking-[0.18em] pl-2 pr-1 font-display">Drag</span>
        {DEVICE_LIST.map(({ type, label, Icon }) => (
          <div
            key={type}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('device-type', type)}
            className="group relative flex items-center justify-center w-9 h-9 rounded-full border border-transparent hover:border-terminal/40 hover:bg-terminal/10 cursor-grab active:cursor-grabbing transition-all"
            title={`Drag to add ${label}`}
          >
            <Icon className="w-6 h-6" />
            <span className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-mono opacity-0 group-hover:opacity-100 text-terminal whitespace-nowrap bg-popover px-1.5 py-0.5 rounded border border-border z-10">{label}</span>
          </div>
        ))}
      </div>

      {/* Live stats */}
      <div className="hidden md:flex items-center gap-2 ml-2 px-3 py-1 rounded-full bg-background/30 border border-border/40 text-[10px] font-mono">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-terminal animate-pulse" /> <span className="text-muted-foreground">devices</span> <span className="text-terminal">{deviceCount}</span></span>
        <span className="text-border">·</span>
        <span className="flex items-center gap-1"><span className="text-muted-foreground">links</span> <span className="text-noc-cyan">{connectionCount}</span></span>
      </div>

      <div className="flex-1" />

      {connectingFrom && (
        <span className="text-[10px] text-noc-cyan mr-3 animate-pulse flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-noc-cyan animate-ping" /> Click target to connect
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 p-1 rounded-full bg-background/40 border border-border/60">
        <button onClick={onSave} title="Save lab" className="px-3 py-1 text-[10px] rounded-full hover:bg-terminal/15 hover:text-terminal text-muted-foreground transition-colors">
          💾 <span className="hidden sm:inline">Save</span>
        </button>
        <button onClick={onLoad} title="Load lab" className="px-3 py-1 text-[10px] rounded-full hover:bg-noc-cyan/15 hover:text-noc-cyan text-muted-foreground transition-colors">
          📂 <span className="hidden sm:inline">Load</span>
        </button>
        <button onClick={onClear} title="Clear workspace" className="px-3 py-1 text-[10px] rounded-full text-noc-red hover:bg-noc-red/15 transition-colors">
          🗑️ <span className="hidden sm:inline">Clear</span>
        </button>
      </div>
    </div>
  );
}