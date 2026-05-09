import React, { useState, useRef, useEffect } from 'react';
import type { Device, DeviceService, NetworkInterface } from './types';
import type { Connection } from './types';
import { simulateDhcp, generateConnectedRoutes, resolveDns } from './networkEngine';

interface DeviceDesktopProps {
  device: Device;
  allDevices?: Device[];
  connections?: Connection[];
  onUpdateDevice: (device: Device) => void;
  onClose: () => void;
  onLaunchTerminal?: () => void;
  onConnectWireless?: (clientId: string, apId: string) => void;
  onDisconnect?: (connectionId: string) => void;
}

export function DeviceDesktop({ device, allDevices = [], connections = [], onUpdateDevice, onClose, onLaunchTerminal, onConnectWireless, onDisconnect }: DeviceDesktopProps) {
  const isPcLike = device.type === 'pc' || device.type === 'laptop';
  const isServer = device.type === 'server';
  const isAP = device.type === 'accesspoint';

  const defaultTab = isPcLike ? 'desktop' : isServer ? 'services' : isAP ? 'admin' : 'network';
  const [tab, setTab] = useState<string>(defaultTab);

  const tabs = isPcLike
    ? ['desktop', 'network', ...(device.type === 'laptop' ? ['wireless'] : [])]
    : isServer
      ? ['services', 'network', 'storage']
      : isAP
        ? ['admin', 'wireless', 'network']
        : ['network'];

  const titleLabel = isPcLike
    ? `${device.name} — ${device.type === 'laptop' ? 'Laptop' : 'PC'} Desktop`
    : isServer
      ? `${device.name} — Server Console`
      : isAP
        ? `${device.name} — AP Admin Panel`
        : device.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-[640px] max-h-[85vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${device.status === 'up' ? 'bg-terminal' : 'bg-noc-red'}`} />
            <span className="text-xs font-display text-terminal">{titleLabel}</span>
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
          {onLaunchTerminal && (
            <button
              onClick={() => { onLaunchTerminal(); onClose(); }}
              className="ml-auto px-3 py-2 text-[10px] text-terminal hover:bg-terminal/10 border-l border-border"
            >
              ▶ TERMINAL
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'desktop' && isPcLike && (
            <PcDesktopTab
              device={device}
              allDevices={allDevices}
              connections={connections}
              onUpdate={onUpdateDevice}
              onOpenTab={setTab}
              onLaunchTerminal={onLaunchTerminal}
            />
          )}
          {tab === 'network' && <NetworkTab device={device} onUpdate={onUpdateDevice} />}
          {tab === 'wireless' && isAP && <APWirelessTab device={device} onUpdate={onUpdateDevice} />}
          {tab === 'wireless' && device.type === 'laptop' && (
            <LaptopWirelessTab
              device={device}
              allDevices={allDevices}
              connections={connections}
              onConnectWireless={onConnectWireless}
              onDisconnect={onDisconnect}
            />
          )}
          {tab === 'admin' && isAP && <APAdminTab device={device} allDevices={allDevices} connections={connections} onUpdate={onUpdateDevice} />}
          {tab === 'services' && isServer && <ServicesTab device={device} onUpdate={onUpdateDevice} />}
          {tab === 'storage' && isServer && <StorageTab device={device} onUpdate={onUpdateDevice} />}
        </div>
      </div>
    </div>
  );
}

function PcDesktopTab({ device, allDevices, connections, onUpdate, onOpenTab, onLaunchTerminal }: {
  device: Device; allDevices: Device[]; connections: Connection[];
  onUpdate: (d: Device) => void; onOpenTab: (t: string) => void; onLaunchTerminal?: () => void;
}) {
  const primary = device.interfaces[0];
  const linkUp = primary?.connected && primary?.status === 'up';

  const handleDhcp = () => {
    const result = simulateDhcp(device, primary.name, allDevices, connections);
    if (result.success && result.ip) {
      const newIfaces = [...device.interfaces];
      newIfaces[0] = { ...newIfaces[0], ip: result.ip, mask: result.mask };
      onUpdate({
        ...device,
        interfaces: newIfaces,
        defaultGateway: result.gateway || device.defaultGateway,
        dnsServer: result.dns || device.dnsServer,
        dhcpEnabled: true,
      });
    } else {
      alert('DHCP request failed: no DHCP server reachable.');
    }
  };

  const apps = [
    { id: 'cmd', label: 'Command Prompt', icon: '▶_', action: () => onLaunchTerminal?.() },
    { id: 'net', label: 'Network Settings', icon: '🛰', action: () => onOpenTab('network') },
    { id: 'browser', label: 'Web Browser', icon: '🌐', action: () => alert('Web browser is a stub: connect to a Server with HTTP enabled.') },
    { id: 'dhcp', label: 'Request DHCP', icon: '⇅', action: handleDhcp },
  ];
  if (device.type === 'laptop') {
    apps.push({ id: 'wifi', label: 'Wi-Fi', icon: '📶', action: () => onOpenTab('wireless') });
  }

  return (
    <div className="space-y-3">
      {/* Status banner */}
      <div className="border border-border rounded p-3 bg-background/40">
        <div className="text-[10px] text-muted-foreground uppercase mb-1">System Status</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
          <div className="text-muted-foreground">Hostname</div><div className="text-foreground">{device.hostname || device.name}</div>
          <div className="text-muted-foreground">Link</div>
          <div className={linkUp ? 'text-terminal' : 'text-noc-red'}>{linkUp ? 'Connected' : 'Disconnected'}</div>
          <div className="text-muted-foreground">IP</div><div className="text-foreground">{primary?.ip || '— (none)'}</div>
          <div className="text-muted-foreground">Mask</div><div className="text-foreground">{primary?.mask || '—'}</div>
          <div className="text-muted-foreground">Gateway</div><div className="text-foreground">{device.defaultGateway || '—'}</div>
          <div className="text-muted-foreground">DNS</div><div className="text-foreground">{device.dnsServer || '—'}</div>
          <div className="text-muted-foreground">DHCP</div><div className="text-foreground">{device.dhcpEnabled ? 'Enabled' : 'Static'}</div>
        </div>
      </div>

      {/* Apps grid */}
      <div>
        <div className="text-[10px] text-muted-foreground uppercase mb-2">Applications</div>
        <div className="grid grid-cols-3 gap-2">
          {apps.map(a => (
            <button
              key={a.id}
              onClick={a.action}
              className="border border-border rounded p-3 hover:border-terminal hover:bg-terminal/5 transition-colors flex flex-col items-center gap-1"
            >
              <span className="text-2xl">{a.icon}</span>
              <span className="text-[10px] text-foreground">{a.label}</span>
            </button>
          ))}
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
      <div className="flex items-center justify-between">
        <h4 className="text-xs text-terminal font-display">SERVER SERVICES</h4>
        <span className="text-[10px] text-muted-foreground">
          {device.services.filter(s => s.enabled).length}/{device.services.length} running
        </span>
      </div>
      {device.services.map((svc, idx) => (
        <ServiceCard key={svc.type} svc={svc} device={device} onToggle={() => toggleService(idx)} onUpdate={onUpdate} />
      ))}
    </div>
  );
}

function ServiceCard({ svc, device, onToggle, onUpdate }: {
  svc: DeviceService; device: Device; onToggle: () => void; onUpdate: (d: Device) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const desc: Record<string, string> = {
    dhcp: 'Dynamic Host Configuration Protocol — assigns IPs to clients.',
    dns: 'Domain Name System — resolves hostnames to IPs.',
    http: 'Web server — serves HTML pages on port 80.',
    ftp: 'File Transfer Protocol — file uploads/downloads.',
    tftp: 'Trivial FTP — used for IOS image transfer.',
    syslog: 'Centralized log collection from network devices.',
  };

  return (
    <div className="border border-border rounded">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${svc.enabled ? 'bg-terminal status-pulse' : 'bg-muted-foreground'}`} />
          <div>
            <span className="text-xs font-mono text-foreground uppercase">{svc.type}</span>
            <span className="text-[10px] text-muted-foreground ml-2">Port {svc.port}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setExpanded(e => !e)} className="text-[10px] text-muted-foreground hover:text-foreground px-2">
            {expanded ? '−' : '⚙'}
          </button>
          <button
            onClick={onToggle}
            className={`px-3 py-1 text-[10px] rounded border transition-colors ${svc.enabled ? 'border-terminal text-terminal bg-terminal/10' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            {svc.enabled ? 'RUNNING' : 'STOPPED'}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border p-3 space-y-2 bg-background/30">
          <p className="text-[10px] text-muted-foreground">{desc[svc.type]}</p>
          {svc.type === 'dhcp' && (
            <div className="text-[10px] font-mono text-muted-foreground">
              Pools: {device.dhcpPools.length} • Active leases: {device.dhcpPools.reduce((n, p) => n + p.leases.length, 0)}
            </div>
          )}
          {svc.type === 'dns' && (
            <div className="text-[10px] font-mono text-muted-foreground">
              Records: {(device.dnsRecords || []).length}
            </div>
          )}
          {svc.type === 'http' && (
            <input
              value={device.httpPageTitle || ''}
              onChange={e => onUpdate({ ...device, httpPageTitle: e.target.value })}
              placeholder="Page title"
              className="w-full bg-input border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground outline-none focus:border-terminal"
            />
          )}
        </div>
      )}
    </div>
  );
}

function StorageTab({ device, onUpdate }: { device: Device; onUpdate: (d: Device) => void }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs text-terminal font-display">HTTP CONTENT</h4>
      <div className="border border-border rounded p-3 space-y-2">
        <input
          value={device.httpPageTitle || ''}
          onChange={e => onUpdate({ ...device, httpPageTitle: e.target.value })}
          placeholder="Page title"
          className="w-full bg-input border border-border rounded px-2 py-1 text-xs font-mono text-foreground outline-none focus:border-terminal"
        />
        <textarea
          value={device.httpPageContent || ''}
          onChange={e => onUpdate({ ...device, httpPageContent: e.target.value })}
          placeholder="<html>Welcome</html>"
          rows={8}
          className="w-full bg-input border border-border rounded px-2 py-1 text-xs font-mono text-foreground outline-none focus:border-terminal resize-none"
        />
      </div>
    </div>
  );
}

function APAdminTab({ device, allDevices, connections, onUpdate }: {
  device: Device; allDevices: Device[]; connections: Connection[]; onUpdate: (d: Device) => void;
}) {
  const uplink = device.interfaces.find(i => i.name === 'Ethernet0');
  const uplinkUp = !!uplink?.connected && uplink?.status === 'up';
  // Wireless clients = laptops connected to this AP via wireless connection
  const clients = connections
    .filter(c => (c.from === device.id || c.to === device.id) && c.type === 'wireless')
    .map(c => allDevices.find(d => d.id === (c.from === device.id ? c.to : c.from)))
    .filter((d): d is Device => !!d);

  return (
    <div className="space-y-3">
      <div className="border border-border rounded p-3">
        <div className="text-[10px] text-muted-foreground uppercase mb-2">AP Status</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
          <div className="text-muted-foreground">Power</div>
          <div className={device.status === 'up' ? 'text-terminal' : 'text-noc-red'}>{device.status === 'up' ? 'ON' : 'OFF'}</div>
          <div className="text-muted-foreground">Uplink (Ethernet0)</div>
          <div className={uplinkUp ? 'text-terminal' : 'text-noc-red'}>{uplinkUp ? 'UP' : 'DOWN'}</div>
          <div className="text-muted-foreground">LAN IP</div>
          <div className="text-foreground">{uplink?.ip || device.apLanIp || '—'}</div>
          <div className="text-muted-foreground">Mode</div>
          <div className="text-foreground">{device.apMode || 'ap'}</div>
          <div className="text-muted-foreground">Channel</div>
          <div className="text-foreground">{device.channel || 1} ({device.frequency || '2.4GHz'})</div>
          <div className="text-muted-foreground">Connected clients</div>
          <div className="text-foreground">{clients.length} / {device.maxClients || 32}</div>
        </div>
      </div>

      <div className="border border-border rounded p-3">
        <div className="text-[10px] text-muted-foreground uppercase mb-2">SSID Broadcast</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-mono text-foreground">{device.ssid || '(unset)'}</div>
            <div className="text-[10px] text-muted-foreground">{device.wpaPassword ? 'WPA2 Secured' : 'OPEN'}</div>
          </div>
          <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={device.broadcastSsid !== false}
              onChange={e => onUpdate({ ...device, broadcastSsid: e.target.checked })}
            />
            Broadcast
          </label>
        </div>
      </div>

      <div className="border border-border rounded p-3">
        <div className="text-[10px] text-muted-foreground uppercase mb-2">Associated Clients</div>
        {clients.length === 0 ? (
          <p className="text-[10px] text-muted-foreground italic">No wireless clients connected.</p>
        ) : (
          <ul className="space-y-1 text-[11px] font-mono">
            {clients.map(c => {
              const wIface = c.interfaces.find(i => i.isWireless);
              return (
                <li key={c.id} className="flex justify-between">
                  <span className="text-foreground">{c.name}</span>
                  <span className="text-muted-foreground">{wIface?.ip || '—'} • {wIface?.macAddress}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border border-border rounded p-3 space-y-2">
        <div className="text-[10px] text-muted-foreground uppercase">Quick Settings</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <input type="checkbox" checked={!!device.macFilterEnabled} onChange={e => onUpdate({ ...device, macFilterEnabled: e.target.checked })} />
            MAC Filter
          </label>
          <label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <input type="checkbox" checked={!!device.apFirewall} onChange={e => onUpdate({ ...device, apFirewall: e.target.checked })} />
            Firewall
          </label>
          <label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <input type="checkbox" checked={!!device.apDhcpEnabled} onChange={e => onUpdate({ ...device, apDhcpEnabled: e.target.checked })} />
            DHCP Server
          </label>
          <div>
            <label className="text-[10px] text-muted-foreground">Max clients</label>
            <input
              type="number"
              value={device.maxClients || 32}
              onChange={e => onUpdate({ ...device, maxClients: parseInt(e.target.value) || 32 })}
              className="w-full bg-input border border-border rounded px-2 py-0.5 text-[11px] font-mono text-foreground outline-none focus:border-terminal"
            />
          </div>
        </div>
      </div>
    </div>
  );
}