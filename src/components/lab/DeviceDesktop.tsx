import React, { useState } from 'react';
import type { Device, DeviceService, NetworkInterface } from './types';

interface DeviceDesktopProps {
  device: Device;
  onUpdateDevice: (device: Device) => void;
  onClose: () => void;
}

export function DeviceDesktop({ device, onUpdateDevice, onClose }: DeviceDesktopProps) {
  const [tab, setTab] = useState<string>('network');

  const isPcLike = device.type === 'pc' || device.type === 'laptop';
  const isServer = device.type === 'server';
  const isAP = device.type === 'accesspoint';

  const tabs = isPcLike
    ? ['network', ...(device.type === 'laptop' ? ['wireless'] : []), 'terminal']
    : isServer
      ? ['services', 'network', 'terminal']
      : isAP
        ? ['wireless', 'network']
        : ['network'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-[560px] max-h-[80vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${device.status === 'up' ? 'bg-terminal' : 'bg-noc-red'}`} />
            <span className="text-xs font-display text-terminal">{device.name}</span>
            <span className="text-[10px] text-muted-foreground">— {device.type.toUpperCase()}</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs capitalize transition-colors ${tab === t ? 'text-terminal border-b-2 border-terminal bg-terminal/5' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'network' && <NetworkTab device={device} onUpdate={onUpdateDevice} />}
          {tab === 'wireless' && isAP && <APWirelessTab device={device} onUpdate={onUpdateDevice} />}
          {tab === 'wireless' && device.type === 'laptop' && <LaptopWirelessTab device={device} />}
          {tab === 'services' && isServer && <ServicesTab device={device} onUpdate={onUpdateDevice} />}
        </div>
      </div>
    </div>
  );
}

function NetworkTab({ device, onUpdate }: { device: Device; onUpdate: (d: Device) => void }) {
  const updateInterface = (idx: number, updates: Partial<NetworkInterface>) => {
    const newIfaces = [...device.interfaces];
    newIfaces[idx] = { ...newIfaces[idx], ...updates };
    onUpdate({ ...device, interfaces: newIfaces });
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs text-terminal font-display">NETWORK SETTINGS</h4>
      {device.interfaces.map((iface, idx) => (
        <div key={iface.name} className="border border-border rounded p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-foreground">{iface.name}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded ${iface.connected ? 'bg-terminal/10 text-terminal' : 'bg-muted text-muted-foreground'}`}>
              {iface.connected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">IP Address</label>
              <input
                type="text"
                value={iface.ip || ''}
                onChange={e => updateInterface(idx, { ip: e.target.value })}
                className="w-full bg-input border border-border rounded px-2 py-1 text-xs font-mono text-foreground outline-none focus:border-terminal"
                placeholder="192.168.1.1"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Subnet Mask</label>
              <input
                type="text"
                value={iface.mask || ''}
                onChange={e => updateInterface(idx, { mask: e.target.value })}
                className="w-full bg-input border border-border rounded px-2 py-1 text-xs font-mono text-foreground outline-none focus:border-terminal"
                placeholder="255.255.255.0"
              />
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground">MAC: {iface.macAddress}</div>
        </div>
      ))}
      {(device.type === 'pc' || device.type === 'laptop') && (
        <div className="border border-border rounded p-3 space-y-2">
          <h5 className="text-[10px] text-muted-foreground uppercase">Default Gateway</h5>
          <input
            type="text"
            value={device.defaultGateway || ''}
            onChange={e => onUpdate({ ...device, defaultGateway: e.target.value })}
            className="w-full bg-input border border-border rounded px-2 py-1 text-xs font-mono text-foreground outline-none focus:border-terminal"
            placeholder="192.168.1.1"
          />
          <h5 className="text-[10px] text-muted-foreground uppercase mt-2">DNS Server</h5>
          <input
            type="text"
            value={device.dnsServer || ''}
            onChange={e => onUpdate({ ...device, dnsServer: e.target.value })}
            className="w-full bg-input border border-border rounded px-2 py-1 text-xs font-mono text-foreground outline-none focus:border-terminal"
            placeholder="8.8.8.8"
          />
        </div>
      )}
    </div>
  );
}

function APWirelessTab({ device, onUpdate }: { device: Device; onUpdate: (d: Device) => void }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs text-terminal font-display">WIRELESS SETTINGS</h4>
      <div className="border border-border rounded p-3 space-y-2">
        <div>
          <label className="text-[10px] text-muted-foreground">SSID</label>
          <input
            type="text"
            value={device.ssid || ''}
            onChange={e => onUpdate({ ...device, ssid: e.target.value })}
            className="w-full bg-input border border-border rounded px-2 py-1 text-xs font-mono text-foreground outline-none focus:border-terminal"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">WPA Password</label>
          <input
            type="text"
            value={device.wpaPassword || ''}
            onChange={e => onUpdate({ ...device, wpaPassword: e.target.value })}
            className="w-full bg-input border border-border rounded px-2 py-1 text-xs font-mono text-foreground outline-none focus:border-terminal"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Channel</label>
          <select
            value={device.channel || 1}
            onChange={e => onUpdate({ ...device, channel: parseInt(e.target.value) })}
            className="w-full bg-input border border-border rounded px-2 py-1 text-xs font-mono text-foreground outline-none focus:border-terminal"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(ch => (
              <option key={ch} value={ch}>Channel {ch}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Mode</label>
          <select
            value={device.apMode || 'ap'}
            onChange={e => onUpdate({ ...device, apMode: e.target.value as 'ap' | 'repeater' })}
            className="w-full bg-input border border-border rounded px-2 py-1 text-xs font-mono text-foreground outline-none focus:border-terminal"
          >
            <option value="ap">Access Point</option>
            <option value="repeater">Repeater</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function LaptopWirelessTab({ device }: { device: Device }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs text-terminal font-display">WIRELESS NETWORKS</h4>
      <p className="text-[10px] text-muted-foreground">Scanning for available networks...</p>
      <p className="text-[10px] text-muted-foreground italic">Connect to an Access Point by placing this laptop near an AP on the canvas and using the right-click menu.</p>
    </div>
  );
}

function ServicesTab({ device, onUpdate }: { device: Device; onUpdate: (d: Device) => void }) {
  const toggleService = (idx: number) => {
    const newServices = [...device.services];
    newServices[idx] = { ...newServices[idx], enabled: !newServices[idx].enabled };
    onUpdate({ ...device, services: newServices });
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs text-terminal font-display">SERVER SERVICES</h4>
      {device.services.map((svc, idx) => (
        <div key={svc.type} className="flex items-center justify-between border border-border rounded p-3">
          <div>
            <span className="text-xs font-mono text-foreground uppercase">{svc.type}</span>
            <span className="text-[10px] text-muted-foreground ml-2">Port {svc.port}</span>
          </div>
          <button
            onClick={() => toggleService(idx)}
            className={`px-3 py-1 text-[10px] rounded border transition-colors ${svc.enabled ? 'border-terminal text-terminal bg-terminal/10' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            {svc.enabled ? 'RUNNING' : 'STOPPED'}
          </button>
        </div>
      ))}
    </div>
  );
}