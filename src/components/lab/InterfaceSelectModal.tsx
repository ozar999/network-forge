import React, { useState } from 'react';
import type { Device, NetworkInterface } from './types';

interface InterfaceSelectModalProps {
  device: Device;
  onSelect: (interfaceName: string) => void;
  onClose: () => void;
  title?: string;
}

export function InterfaceSelectModal({ device, onSelect, onClose, title }: InterfaceSelectModalProps) {
  const availableInterfaces = device.interfaces.filter(i => !i.connected);

  if (availableInterfaces.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-card border border-border rounded-lg p-4 min-w-72 shadow-xl" onClick={e => e.stopPropagation()}>
          <h3 className="text-sm font-display text-terminal mb-3">{title || 'Select Interface'}</h3>
          <p className="text-xs text-muted-foreground">No available interfaces on {device.name}</p>
          <button onClick={onClose} className="mt-3 px-3 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-4 min-w-80 max-h-96 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-display text-terminal mb-1">{title || 'Select Interface'}</h3>
        <p className="text-[10px] text-muted-foreground mb-3">{device.name} — choose an interface</p>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {availableInterfaces.map(iface => (
            <button
              key={iface.name}
              onClick={() => onSelect(iface.name)}
              className="w-full text-left px-3 py-2 rounded border border-border hover:border-terminal/50 hover:bg-terminal/5 transition-all flex items-center justify-between group"
            >
              <div>
                <span className="text-xs text-foreground font-mono">{iface.name}</span>
                {iface.ip && (
                  <span className="text-[10px] text-muted-foreground ml-2">{iface.ip}/{iface.mask}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${iface.status === 'up' ? 'bg-terminal/10 text-terminal' : 'bg-noc-red/10 text-noc-red'}`}>
                  {iface.status.toUpperCase()}
                </span>
                {iface.isWireless && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-noc-cyan/10 text-noc-cyan">WIFI</span>
                )}
              </div>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-3 px-3 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}