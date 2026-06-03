import React, { useState, useEffect } from 'react';
import type { Device, Connection } from './types';
import { DeviceIconMap } from './DeviceIcons';

interface Props {
  device: Device;
  connections: Connection[];
  onClose: () => void;
  onUpdateDevice: (d: Device) => void;
  onOpenTerminal: (id: string) => void;
  onRemoveConnection: (connId: string) => void;
}

type Tab = 'interfaces' | 'routing' | 'network' | 'services' | 'wifi' | 'dhcp' | 'info';

function tabsFor(type: Device['type']): { id: Tab; label: string }[] {
  switch (type) {
    case 'router':
    case 'firewall':
      return [
        { id: 'interfaces', label: 'Interfaces' },
        { id: 'routing', label: 'Routing' },
        { id: 'info', label: 'Info' },
      ];
    case 'switch':
      return [
        { id: 'interfaces', label: 'Interfaces' },
        { id: 'info', label: 'Info' },
      ];
    case 'pc':
    case 'laptop':
      return [
        { id: 'network', label: 'Network' },
        { id: 'info', label: 'Info' },
      ];
    case 'server':
      return [
        { id: 'network', label: 'Network' },
        { id: 'services', label: 'Services' },
        { id: 'info', label: 'Info' },
      ];
    case 'accesspoint':
      return [
        { id: 'wifi', label: 'WiFi' },
        { id: 'dhcp', label: 'DHCP' },
        { id: 'info', label: 'Info' },
      ];
    default:
      return [{ id: 'info', label: 'Info' }];
  }
}

export function DeviceConfigPanel({ device, connections, onClose, onUpdateDevice, onOpenTerminal, onRemoveConnection }: Props) {
  const tabs = tabsFor(device.type);
  const [tab, setTab] = useState<Tab>(tabs[0].id);
  const Icon = DeviceIconMap[device.type];

  // Reset tab when device changes
  useEffect(() => { setTab(tabsFor(device.type)[0].id); }, [device.id, device.type]);

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const updateIface = (name: string, patch: Partial<Device['interfaces'][number]>) => {
    onUpdateDevice({
      ...device,
      interfaces: device.interfaces.map(i => i.name === name ? { ...i, ...patch } : i),
    });
  };

  return (
    <div className="absolute top-0 right-0 h-full w-[320px] bg-card border-l border-border shadow-2xl z-20 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/40">
        <div className={`w-2.5 h-2.5 rounded-full ${device.status === 'up' ? 'bg-terminal status-pulse' : 'bg-noc-red'}`} />
        {Icon && <div className="w-6 h-6"><Icon className="w-6 h-6" status={device.status} /></div>}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{device.hostname || device.name}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{device.type}</div>
        </div>
        <button
          onClick={() => onOpenTerminal(device.id)}
          className="px-2 py-1 text-[10px] rounded border border-border text-terminal hover:bg-accent transition-colors"
          title="Open console"
        >▶ Console</button>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded hover:bg-noc-red/20 text-muted-foreground hover:text-noc-red text-xs flex items-center justify-center"
          title="Close (Esc)"
        >✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-secondary/20 flex-shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-[11px] uppercase tracking-wider transition-colors border-b-2 ${
              tab === t.id
                ? 'border-terminal text-terminal'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 text-xs space-y-3">
        {tab === 'interfaces' && (
          <div className="space-y-2">
            {device.interfaces.map(iface => {
              const conn = connections.find(c => c.id === iface.connectionId);
              return (
                <div key={iface.name} className="border border-border rounded p-2 bg-background/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-terminal text-[11px]">{iface.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${iface.status === 'up' && iface.connected ? 'bg-terminal' : 'bg-muted-foreground'}`} />
                      <button
                        onClick={() => updateIface(iface.name, { status: iface.status === 'up' ? 'down' : 'up' })}
                        className="text-[9px] px-1.5 py-0.5 rounded border border-border hover:bg-accent"
                      >{iface.status === 'up' ? 'Shutdown' : 'No Shut'}</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      placeholder="IP address"
                      value={iface.ip || ''}
                      onChange={(e) => updateIface(iface.name, { ip: e.target.value || undefined })}
                      className="bg-background border border-border rounded px-1.5 py-1 text-[10px] font-mono text-foreground focus:border-terminal focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Subnet mask"
                      value={iface.mask || ''}
                      onChange={(e) => updateIface(iface.name, { mask: e.target.value || undefined })}
                      className="bg-background border border-border rounded px-1.5 py-1 text-[10px] font-mono text-foreground focus:border-terminal focus:outline-none"
                    />
                  </div>
                  <div className="mt-1 text-[9px] text-muted-foreground font-mono">MAC {iface.macAddress}</div>
                  {conn && (
                    <div className="mt-1 flex items-center justify-between text-[9px] text-noc-cyan">
                      <span>↔ {iface.connectedTo} / {iface.connectedInterface}</span>
                      <button
                        onClick={() => onRemoveConnection(conn.id)}
                        className="text-noc-red hover:underline"
                      >disconnect</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'routing' && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Routing Table</div>
            {device.routingTable.length === 0 ? (
              <div className="text-muted-foreground text-[11px]">No routes — configure via console.</div>
            ) : (
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-1">Type</th>
                    <th className="text-left">Network</th>
                    <th className="text-left">Next Hop</th>
                  </tr>
                </thead>
                <tbody>
                  {device.routingTable.map((r, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="py-1 text-terminal">{r.type}</td>
                      <td>{r.network}/{r.mask}</td>
                      <td>{r.nextHop || r.interface || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'network' && (
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Default Gateway</label>
              <input
                type="text"
                value={device.defaultGateway || ''}
                onChange={(e) => onUpdateDevice({ ...device, defaultGateway: e.target.value || undefined })}
                placeholder="192.168.0.1"
                className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] font-mono text-foreground focus:border-terminal focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">DNS Server</label>
              <input
                type="text"
                value={device.dnsServer || ''}
                onChange={(e) => onUpdateDevice({ ...device, dnsServer: e.target.value || undefined })}
                placeholder="8.8.8.8"
                className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] font-mono text-foreground focus:border-terminal focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-[11px] text-foreground pt-1">
              <input
                type="checkbox"
                checked={!!device.dhcpEnabled}
                onChange={(e) => onUpdateDevice({ ...device, dhcpEnabled: e.target.checked })}
              />
              <span>DHCP enabled (request IP automatically)</span>
            </label>
            <div className="pt-2 border-t border-border">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Interfaces</div>
              {device.interfaces.map(iface => (
                <div key={iface.name} className="grid grid-cols-[1fr_auto_auto] gap-1.5 items-center py-1">
                  <span className="font-mono text-[10px] text-terminal">{iface.name}</span>
                  <input
                    type="text"
                    placeholder="IP"
                    value={iface.ip || ''}
                    onChange={(e) => updateIface(iface.name, { ip: e.target.value || undefined })}
                    className="w-24 bg-background border border-border rounded px-1.5 py-0.5 text-[10px] font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Mask"
                    value={iface.mask || ''}
                    onChange={(e) => updateIface(iface.name, { mask: e.target.value || undefined })}
                    className="w-24 bg-background border border-border rounded px-1.5 py-0.5 text-[10px] font-mono"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'services' && (
          <div className="space-y-1.5">
            {device.services.length === 0 && <div className="text-muted-foreground">No services available.</div>}
            {device.services.map(svc => (
              <div key={svc.type} className="flex items-center justify-between border border-border rounded px-2 py-1.5 bg-background/40">
                <div>
                  <div className="text-[11px] font-semibold text-foreground uppercase">{svc.type}</div>
                  <div className="text-[9px] text-muted-foreground">port {svc.port}</div>
                </div>
                <button
                  onClick={() => onUpdateDevice({
                    ...device,
                    services: device.services.map(s => s.type === svc.type ? { ...s, enabled: !s.enabled } : s),
                  })}
                  className={`px-2 py-1 text-[10px] rounded border ${
                    svc.enabled
                      ? 'border-terminal text-terminal bg-terminal/10'
                      : 'border-border text-muted-foreground'
                  }`}
                >{svc.enabled ? '● Running' : '○ Stopped'}</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'wifi' && (
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">SSID</label>
              <input
                type="text"
                value={device.ssid || ''}
                onChange={(e) => onUpdateDevice({ ...device, ssid: e.target.value })}
                className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">WPA Password</label>
              <input
                type="text"
                value={device.wpaPassword || ''}
                onChange={(e) => onUpdateDevice({ ...device, wpaPassword: e.target.value })}
                className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Channel</label>
              <input
                type="number"
                min={1}
                max={11}
                value={device.channel || 1}
                onChange={(e) => onUpdateDevice({ ...device, channel: parseInt(e.target.value) || 1 })}
                className="w-20 bg-background border border-border rounded px-2 py-1 text-[11px] font-mono"
              />
            </div>
          </div>
        )}

        {tab === 'dhcp' && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[11px] text-foreground">
              <input
                type="checkbox"
                checked={!!device.apDhcpEnabled}
                onChange={(e) => onUpdateDevice({ ...device, apDhcpEnabled: e.target.checked })}
              />
              <span>DHCP server enabled</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-[9px] uppercase text-muted-foreground mb-0.5">Pool start</label>
                <input type="text" value={device.apDhcpPoolStart || ''} onChange={(e) => onUpdateDevice({ ...device, apDhcpPoolStart: e.target.value })} className="w-full bg-background border border-border rounded px-2 py-1 text-[10px] font-mono" />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-muted-foreground mb-0.5">Pool end</label>
                <input type="text" value={device.apDhcpPoolEnd || ''} onChange={(e) => onUpdateDevice({ ...device, apDhcpPoolEnd: e.target.value })} className="w-full bg-background border border-border rounded px-2 py-1 text-[10px] font-mono" />
              </div>
            </div>
          </div>
        )}

        {tab === 'info' && (
          <div className="space-y-2 font-mono text-[11px]">
            <Row label="Name" value={device.name} />
            <Row label="Hostname" value={device.hostname} />
            <Row label="Type" value={device.type} />
            <Row label="Status" value={device.status} />
            <Row label="Interfaces" value={String(device.interfaces.length)} />
            <Row label="Connected" value={String(device.interfaces.filter(i => i.connected).length)} />
            <Row label="Position" value={`${Math.round(device.x)}, ${Math.round(device.y)}`} />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between border-b border-border/40 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value || '—'}</span>
    </div>
  );
}