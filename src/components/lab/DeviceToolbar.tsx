import React from 'react';
import type { DeviceType } from './types';
import { RouterIcon, SwitchIcon, PcIcon, FirewallIcon, ServerIcon } from './DeviceIcons';

const DEVICE_LIST: { type: DeviceType; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { type: 'router', label: 'Router', Icon: RouterIcon },
  { type: 'switch', label: 'Switch', Icon: SwitchIcon },
  { type: 'pc', label: 'PC', Icon: PcIcon },
  { type: 'firewall', label: 'Firewall', Icon: FirewallIcon },
  { type: 'server', label: 'Server', Icon: ServerIcon },
];

interface DeviceToolbarProps {
  onSave: () => void;
  onLoad: () => void;
  onClear: () => void;
  connectingFrom: string | null;
}

export function DeviceToolbar({ onSave, onLoad, onClear, connectingFrom }: DeviceToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-card/80 backdrop-blur-sm">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-2">Devices</span>
      {DEVICE_LIST.map(({ type, label, Icon }) => (
        <div
          key={type}
          draggable
          onDragStart={(e) => e.dataTransfer.setData('device-type', type)}
          className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded border border-transparent hover:border-border hover:bg-accent/50 cursor-grab active:cursor-grabbing transition-all"
          title={`Drag to add ${label}`}
        >
          <Icon className="w-8 h-8" />
          <span className="text-[9px] text-muted-foreground">{label}</span>
        </div>
      ))}
      <div className="flex-1" />
      {connectingFrom && (
        <span className="text-[10px] text-noc-cyan mr-3 animate-pulse">
          🔗 Click target device to connect...
        </span>
      )}
      <div className="flex gap-1">
        <button onClick={onSave} className="px-2 py-1 text-[10px] rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          💾 Save
        </button>
        <button onClick={onLoad} className="px-2 py-1 text-[10px] rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          📂 Load
        </button>
        <button onClick={onClear} className="px-2 py-1 text-[10px] rounded border border-border text-noc-red hover:bg-noc-red/10 transition-colors">
          🗑️ Clear
        </button>
      </div>
    </div>
  );
}