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
  const [browserOpen, setBrowserOpen] = useState(false);
  const [showDiag, setShowDiag] = useState(false);
  const [, forceTick] = useState(0);

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
    { id: 'browser', label: 'Web Browser', icon: '🌐', action: () => setBrowserOpen(true) },
    { id: 'dhcp', label: 'Request DHCP', icon: '⇅', action: handleDhcp },
    { id: 'diag', label: 'Diagnostics', icon: '🔧', action: () => { setShowDiag(s => !s); forceTick(t => t + 1); } },
  ];
  if (device.type === 'laptop') {
    apps.push({ id: 'wifi', label: 'Wi-Fi', icon: '📶', action: () => onOpenTab('wireless') });
  }

  // Active DHCP lease info — find any DHCP server pool that holds our IP, or show client-side state
  const myIp = primary?.ip;
  let leaseInfo: { server: string; pool: string; expiry?: number } | null = null;
  if (myIp) {
    for (const dev of allDevices) {
      for (const pool of dev.dhcpPools || []) {
        const lease = pool.leases?.find(l => l.ip === myIp);
        if (lease) { leaseInfo = { server: dev.name, pool: pool.name, expiry: lease.expiry }; break; }
      }
      if (leaseInfo) break;
    }
  }

  const routes = generateConnectedRoutes(device);

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

      {showDiag && (
        <div className="border border-border rounded p-3 space-y-2 bg-background/40">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-muted-foreground uppercase">Diagnostics</div>
            <button onClick={() => forceTick(t => t + 1)} className="text-[10px] text-terminal hover:underline">↻ refresh</button>
          </div>
          <details open className="text-[10px] font-mono">
            <summary className="cursor-pointer text-terminal">ipconfig /all</summary>
            <pre className="whitespace-pre-wrap text-muted-foreground mt-1">{device.interfaces.map(i =>
              `${i.isWireless ? 'Wireless' : 'Ethernet'} adapter ${i.name}:\n  Physical Address . : ${i.macAddress}\n  DHCP Enabled . . . : ${device.dhcpEnabled ? 'Yes' : 'No'}\n  IPv4 Address . . . : ${i.ip || '—'}\n  Subnet Mask  . . . : ${i.mask || '—'}\n  Default Gateway  . : ${device.defaultGateway || '—'}\n  DNS Server . . . . : ${device.dnsServer || '—'}`
            ).join('\n\n')}</pre>
          </details>
          <details className="text-[10px] font-mono">
            <summary className="cursor-pointer text-terminal">route print</summary>
            <pre className="whitespace-pre-wrap text-muted-foreground mt-1">{routes.length === 0 ? 'No connected routes.' : routes.map(r => `${r.network.padEnd(18)} ${r.mask.padEnd(16)} on-link via ${r.interface}`).join('\n')}{device.defaultGateway ? `\n0.0.0.0            0.0.0.0          ${device.defaultGateway}` : ''}</pre>
          </details>
          <details className="text-[10px] font-mono">
            <summary className="cursor-pointer text-terminal">DHCP lease</summary>
            <pre className="whitespace-pre-wrap text-muted-foreground mt-1">{leaseInfo
              ? `Server: ${leaseInfo.server}\nPool:   ${leaseInfo.pool}\nIP:     ${myIp}\nExpiry: ${leaseInfo.expiry ? new Date(leaseInfo.expiry).toLocaleString() : 'static'}`
              : device.dhcpEnabled
                ? 'No active lease (try Request DHCP or `ipconfig /renew`).'
                : 'Static configuration — no DHCP lease.'}</pre>
          </details>
          <details className="text-[10px] font-mono">
            <summary className="cursor-pointer text-terminal">ARP table</summary>
            <pre className="whitespace-pre-wrap text-muted-foreground mt-1">{device.arpTable.length === 0 ? 'No ARP entries.' : device.arpTable.map(a => `${a.ip.padEnd(18)} ${a.mac}`).join('\n')}</pre>
          </details>
        </div>
      )}

      {browserOpen && (
        <BrowserApp device={device} allDevices={allDevices} connections={connections} onClose={() => setBrowserOpen(false)} />
      )}
    </div>
  );
}

function BrowserApp({ device, allDevices, connections, onClose }: {
  device: Device; allDevices: Device[]; connections: Connection[]; onClose: () => void;
}) {
  const [url, setUrl] = useState('http://');
  const [page, setPage] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; title?: string; body?: string; error?: string; resolvedIp?: string }>({ status: 'idle' });

  // Reachability check (lightweight — share simulatePing path lookup)
  const tryLoad = (raw: string) => {
    setPage({ status: 'loading' });
    let target = raw.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].trim();
    if (!target) return setPage({ status: 'error', error: 'Invalid URL.' });

    // Resolve host: IP literal or DNS lookup
    let ip: string | null = null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
      ip = target;
    } else {
      ip = resolveDns(target, device.dnsServer, allDevices);
      if (!ip) return setPage({ status: 'error', error: `DNS lookup failed for "${target}". Check DNS server (${device.dnsServer || 'not configured'}).` });
    }

    const server = allDevices.find(d => d.interfaces.some(i => i.ip === ip));
    if (!server) return setPage({ status: 'error', error: `Host ${ip} unreachable — no device has this IP.`, resolvedIp: ip });
    if (server.status === 'down') return setPage({ status: 'error', error: `Server ${server.name} is powered off.`, resolvedIp: ip });
    const httpSvc = server.services?.find(s => s.type === 'http');
    if (!httpSvc || !httpSvc.enabled) return setPage({ status: 'error', error: `ERR_CONNECTION_REFUSED — HTTP service is not running on ${server.name}.`, resolvedIp: ip });

    setPage({
      status: 'ok',
      title: server.httpPageTitle || `Welcome to ${server.name}`,
      body: server.httpPageContent || `<h1>It works!</h1><p>This page is served by ${server.name} on ${ip}.</p>`,
      resolvedIp: ip,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-[560px] max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/50 rounded-t-lg">
          <span className="text-xs text-terminal font-display">🌐 Web Browser</span>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); tryLoad(url); }} className="flex gap-2 p-2 border-b border-border">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="http://192.168.1.10  or  http://intranet.local"
            className="flex-1 bg-input border border-border rounded px-2 py-1 text-xs font-mono outline-none focus:border-terminal"
          />
          <button type="submit" className="px-3 py-1 text-[10px] border border-terminal text-terminal rounded hover:bg-terminal/10">GO</button>
        </form>
        <div className="flex-1 overflow-y-auto p-4 bg-background">
          {page.status === 'idle' && <p className="text-xs text-muted-foreground italic">Enter a URL or IP to browse a server's HTTP page.</p>}
          {page.status === 'loading' && <p className="text-xs text-muted-foreground">Loading…</p>}
          {page.status === 'error' && (
            <div className="text-xs">
              <div className="text-noc-red font-display mb-1">⚠ This site can't be reached</div>
              <p className="text-muted-foreground">{page.error}</p>
              {page.resolvedIp && <p className="text-[10px] text-muted-foreground mt-1">Resolved: {page.resolvedIp}</p>}
            </div>
          )}
          {page.status === 'ok' && (
            <div>
              <h2 className="text-sm text-terminal font-display mb-2">{page.title}</h2>
              <div className="text-xs text-foreground prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: page.body || '' }} />
              <p className="text-[10px] text-muted-foreground mt-3 italic">Served from {page.resolvedIp}</p>
            </div>
          )}
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

function LaptopWirelessTab({ device, allDevices, connections, onConnectWireless, onDisconnect }: {
  device: Device;
  allDevices: Device[];
  connections: Connection[];
  onConnectWireless?: (clientId: string, apId: string) => void;
  onDisconnect?: (connectionId: string) => void;
}) {
  const wIface = device.interfaces.find(i => i.isWireless);
  const currentConn = connections.find(c => c.type === 'wireless' && (c.from === device.id || c.to === device.id));
  const currentApId = currentConn ? (currentConn.from === device.id ? currentConn.to : currentConn.from) : null;
  const currentAp = currentApId ? allDevices.find(d => d.id === currentApId) : null;

  const aps = allDevices.filter(d =>
    d.type === 'accesspoint' &&
    d.status === 'up' &&
    d.broadcastSsid !== false &&
    d.id !== currentApId
  );

  return (
    <div className="space-y-3">
      <h4 className="text-xs text-terminal font-display">WI-FI</h4>
      {!wIface && <p className="text-[10px] text-noc-red">This device has no wireless adapter.</p>}

      {currentAp && (
        <div className="border border-terminal/40 rounded p-3 bg-terminal/5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-terminal font-mono">📶 {currentAp.ssid || currentAp.name}</div>
              <div className="text-[10px] text-muted-foreground">
                Connected • Ch {currentAp.channel || 1} • {currentAp.wpaPassword ? 'WPA2' : 'OPEN'}
              </div>
              {wIface?.ip && <div className="text-[10px] text-muted-foreground">IP: {wIface.ip}</div>}
            </div>
            <button
              onClick={() => currentConn && onDisconnect?.(currentConn.id)}
              className="px-2 py-1 text-[10px] border border-noc-red text-noc-red rounded hover:bg-noc-red/10"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] text-muted-foreground uppercase mb-1">Available Networks</div>
        {aps.length === 0 && <p className="text-[10px] text-muted-foreground italic">No SSIDs in range. Add an Access Point and power it on.</p>}
        <ul className="space-y-1">
          {aps.map(ap => {
            const clientCount = connections.filter(c => c.type === 'wireless' && (c.from === ap.id || c.to === ap.id)).length;
            return (
              <li key={ap.id} className="flex items-center justify-between border border-border rounded p-2 hover:border-terminal/60">
                <div>
                  <div className="text-xs font-mono text-foreground">📶 {ap.ssid || ap.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Ch {ap.channel || 1} • {ap.wpaPassword ? 'WPA2' : 'OPEN'} • {clientCount}/{ap.maxClients || 32} clients
                  </div>
                </div>
                <button
                  onClick={() => onConnectWireless?.(device.id, ap.id)}
                  disabled={!wIface || !!currentConn}
                  className="px-2 py-1 text-[10px] border border-terminal text-terminal rounded hover:bg-terminal/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Connect
                </button>
              </li>
            );
          })}
        </ul>
        {currentConn && aps.length > 0 && (
          <p className="text-[10px] text-muted-foreground italic mt-2">Disconnect from current network to switch.</p>
        )}
      </div>
    </div>
  );
}

function ServicesTab({ device, onUpdate }: { device: Device; onUpdate: (d: Device) => void }) {
  const setService = (idx: number, enabled: boolean) => {
    const newServices = [...device.services];
    newServices[idx] = { ...newServices[idx], enabled };
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
        <ServiceCard
          key={svc.type}
          svc={svc}
          device={device}
          onStart={() => setService(idx, true)}
          onStop={() => setService(idx, false)}
          onRestart={() => { setService(idx, false); setTimeout(() => setService(idx, true), 150); }}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

function ServiceCard({ svc, device, onStart, onStop, onRestart, onUpdate }: {
  svc: DeviceService; device: Device;
  onStart: () => void; onStop: () => void; onRestart: () => void;
  onUpdate: (d: Device) => void;
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
        <div className="flex items-center gap-1">
          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${svc.enabled ? 'border-terminal text-terminal bg-terminal/10' : 'border-border text-muted-foreground'}`}>
            {svc.enabled ? 'RUNNING' : 'STOPPED'}
          </span>
          <button
            onClick={onStart}
            disabled={svc.enabled}
            className="px-2 py-1 text-[10px] rounded border border-terminal text-terminal hover:bg-terminal/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >Start</button>
          <button
            onClick={onStop}
            disabled={!svc.enabled}
            className="px-2 py-1 text-[10px] rounded border border-noc-red text-noc-red hover:bg-noc-red/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >Stop</button>
          <button
            onClick={onRestart}
            className="px-2 py-1 text-[10px] rounded border border-border text-muted-foreground hover:text-foreground"
          >↻</button>
          <button onClick={() => setExpanded(e => !e)} className="text-[10px] text-muted-foreground hover:text-foreground px-1">
            {expanded ? '−' : '⚙'}
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