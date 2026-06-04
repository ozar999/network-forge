import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Device } from './types';
import { generateConnectedRoutes, simulatePing, simulateTraceroute, simulateDhcp } from './networkEngine';

import type { PingResult } from './PingResultPopup';
import { processRouterCommand, getRouterPrompt, getRouterCompletions, type CliContext } from './cli/routerCommands';
import { expandCiscoCommand, getSuggestions } from './cli/abbreviations';
import { trackEvent } from '@/lib/progress';

interface TerminalPanelProps {
  device: Device | null;
  onCommand: (deviceId: string, command: string) => string;
  allDevices?: Device[];
  connections?: import('./types').Connection[];
  onUpdateDevice?: (device: Device) => void;
  onPingResult?: (result: PingResult) => void;
}

interface TerminalLine {
  type: 'input' | 'output';
  text: string;
}

function getCiscoCommands(device: Device | null, mode: string): Record<string, string[]> {
  if (!device) return { '': ['help'] };
  const isPcLike = device.type === 'pc' || device.type === 'laptop';
  if (isPcLike) {
    return {
      '': ['ipconfig', 'ping', 'tracert', 'arp', 'nslookup', 'netstat', 'route', 'help', 'clear'],
      'ipconfig': ['/all', '/release', '/renew'],
      'route': ['print', 'add', 'delete'],
    };
  }
  if (device.type === 'server') {
    return {
      '': ['ifconfig', 'ip', 'ping', 'traceroute', 'netstat', 'service', 'help', 'clear'],
      'ip': ['addr', 'route'],
      'service': ['dhcpd', 'named', 'vsftpd', 'apache2', 'tftpd', 'rsyslog'],
      'service dhcpd': ['start', 'stop', 'status', 'restart'],
      'service named': ['start', 'stop', 'status', 'restart'],
      'service vsftpd': ['start', 'stop', 'status', 'restart'],
      'service apache2': ['start', 'stop', 'status', 'restart'],
      'service tftpd': ['start', 'stop', 'status', 'restart'],
      'service rsyslog': ['start', 'stop', 'status', 'restart'],
    };
  }
  if (device.type === 'accesspoint') return { '': [] };
  return getRouterCompletions(mode, device);
}

export function TerminalPanel({ device, onCommand, allDevices = [], connections = [], onUpdateDevice, onPingResult }: TerminalPanelProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [mode, setMode] = useState<'user' | 'privileged' | 'config' | 'config-if'>('user');
  const [currentInterface, setCurrentInterface] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const hostname = device?.hostname || device?.name || 'Router';
  const isPcLike = device?.type === 'pc' || device?.type === 'laptop';
  const isServer = device?.type === 'server';

  const getPrompt = useCallback(() => {
    if (isPcLike) return `C:\\>`;
    if (isServer) return `${hostname}$`;
    if (device) return getRouterPrompt(device, mode, currentInterface);
    return `Router>`;
  }, [hostname, mode, isPcLike, isServer, currentInterface]);

  useEffect(() => {
    if (device) {
      setLines([
        { type: 'output', text: `\n${device.name} Console` },
        { type: 'output', text: `Type "help" for available commands\n` },
      ]);
      setMode('user');
    }
  }, [device?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines]);

  const processCommand = (cmd: string) => {
    // Expand Cisco abbreviations (en -> enable, sh ip int br -> show ip interface brief, ...)
    const expanded = device ? expandCiscoCommand(cmd, device, mode) : cmd;
    const trimmed = expanded.trim().toLowerCase();
    const parts = expanded.trim().split(/\s+/);
    let output = '';

    if (trimmed === 'clear') {
      setLines([]);
      return '';
    }

    // Access Point — no CLI
    if (device?.type === 'accesspoint') {
      return 'Access Points are configured via GUI only. Double-click the device to open the admin panel.';
    }

    // PC/Laptop commands
    if (isPcLike && device) {
      return processPcCommand(trimmed, parts, device);
    }

    // Server commands
    if (isServer && device) {
      return processServerCommand(trimmed, parts, device);
    }

    // Cisco IOS commands
    if (device) {
      const ctx: CliContext = {
        device, mode, currentInterface, currentSubmode: '', currentDhcpPool: '', currentAcl: '',
        allDevices, connections, onUpdateDevice, onPingResult,
        setMode: (m: string) => setMode(m as any),
        setCurrentInterface,
        setCurrentSubmode: () => {},
        setCurrentDhcpPool: () => {},
        setCurrentAcl: () => {},
      };
      output = processRouterCommand(expanded, ctx);
      if (output === '__CLEAR__') { setLines([]); return ''; }
    } else {
      output = '% No device selected';
    }

    return output;
  };

  const processPcCommand = (trimmed: string, parts: string[], dev: Device): string => {
    if (trimmed === 'help' || trimmed === '?') {
      return 'Available commands:\n  ipconfig            - Display IP configuration\n  ipconfig /all       - Detailed IP configuration\n  ipconfig /release   - Release DHCP lease\n  ipconfig /renew     - Renew DHCP lease\n  ping <ip>           - Send ICMP echo\n  tracert <ip>        - Trace route\n  arp -a              - Display ARP table\n  nslookup <name>     - DNS lookup\n  route print         - Print routing table\n  netstat -an         - Show connections\n  clear               - Clear screen';
    }
    if (trimmed === 'ipconfig /release') {
      if (!onUpdateDevice) return 'Cannot modify device.';
      const newIfaces = dev.interfaces.map(i => ({ ...i, ip: undefined, mask: undefined }));
      onUpdateDevice({ ...dev, interfaces: newIfaces, defaultGateway: undefined });
      return dev.interfaces.map(i =>
        `${i.isWireless ? 'Wireless' : 'Ethernet'} adapter ${i.name}:\n\n   Connection-specific DNS Suffix  . :\n   IPv4 Address. . . . . . . . . . :\n   Subnet Mask . . . . . . . . . . :\n   Default Gateway . . . . . . . . :`
      ).join('\n\n');
    }
    if (trimmed === 'ipconfig /renew') {
      if (!onUpdateDevice) return 'Cannot modify device.';
      const primary = dev.interfaces[0];
      const result = simulateDhcp(dev, primary.name, allDevices, connections);
      if (!result.success) {
        return `An error occurred while renewing interface ${primary.name}:\nunable to contact your DHCP server.`;
      }
      const newIfaces = [...dev.interfaces];
      newIfaces[0] = { ...newIfaces[0], ip: result.ip, mask: result.mask };
      onUpdateDevice({
        ...dev,
        interfaces: newIfaces,
        defaultGateway: result.gateway || dev.defaultGateway,
        dnsServer: result.dns || dev.dnsServer,
        dhcpEnabled: true,
      });
      return `${primary.isWireless ? 'Wireless' : 'Ethernet'} adapter ${primary.name}:\n\n   Connection-specific DNS Suffix  . :\n   IPv4 Address. . . . . . . . . . : ${result.ip}\n   Subnet Mask . . . . . . . . . . : ${result.mask}\n   Default Gateway . . . . . . . . : ${result.gateway || ''}`;
    }
    if (trimmed === 'route print' || trimmed === 'route') {
      const routes = generateConnectedRoutes(dev);
      const header = '===========================================================================\nIPv4 Route Table\n===========================================================================\nNetwork Destination        Netmask          Gateway       Interface  Metric';
      const rows = routes.map(r =>
        `${r.network.padEnd(20)} ${r.mask.padEnd(16)} On-link       ${(dev.interfaces.find(i => i.name === r.interface)?.ip || '').padEnd(11)} 1`
      );
      const def = dev.defaultGateway
        ? `0.0.0.0              0.0.0.0          ${dev.defaultGateway.padEnd(13)} ${(dev.interfaces[0]?.ip || '').padEnd(11)} 1`
        : '';
      return [header, def, ...rows, '==========================================================================='].filter(Boolean).join('\n');
    }
    if (trimmed === 'netstat -an' || trimmed === 'netstat') {
      return 'Active Connections\n\n  Proto  Local Address          Foreign Address        State\n  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING\n  TCP    0.0.0.0:445            0.0.0.0:0              LISTENING';
    }
    if (trimmed === 'ipconfig') {
      return dev.interfaces.map(i =>
        `${i.isWireless ? 'Wireless' : 'Ethernet'} adapter ${i.name}:\n\n   Connection-specific DNS Suffix  . :\n   IPv4 Address. . . . . . . . . . : ${i.ip || 'Not configured'}\n   Subnet Mask . . . . . . . . . . : ${i.mask || 'Not configured'}\n   Default Gateway . . . . . . . . : ${dev.defaultGateway || 'Not configured'}`
      ).join('\n\n');
    }
    if (trimmed === 'ipconfig /all') {
      return dev.interfaces.map(i =>
        `${i.isWireless ? 'Wireless' : 'Ethernet'} adapter ${i.name}:\n\n   Description . . . . . . . . . . : ${i.isWireless ? 'Wireless Network Adapter' : 'Ethernet Adapter'}\n   Physical Address. . . . . . . . : ${i.macAddress}\n   DHCP Enabled. . . . . . . . . . : ${dev.dhcpEnabled ? 'Yes' : 'No'}\n   IPv4 Address. . . . . . . . . . : ${i.ip || 'Not configured'}\n   Subnet Mask . . . . . . . . . . : ${i.mask || 'Not configured'}\n   Default Gateway . . . . . . . . : ${dev.defaultGateway || 'Not configured'}\n   DNS Server  . . . . . . . . . . : ${dev.dnsServer || 'Not configured'}`
      ).join('\n\n');
    }
    if (trimmed.startsWith('ping ')) {
      const ip = parts[1];
      if (ip) {
        const result = simulatePing(dev, ip, allDevices, connections);
        if (onPingResult) {
          onPingResult({
            sourceDevice: dev.name,
            sourceIp: dev.interfaces.find(i => i.ip)?.ip || 'N/A',
            destIp: ip,
            success: result.success,
            reason: result.reason,
          });
        }
        return `Pinging ${ip} with 32 bytes of data:\n${result.success ? 'Reply from ' + ip + ': bytes=32 time<1ms TTL=128\nReply from ' + ip + ': bytes=32 time<1ms TTL=128\nReply from ' + ip + ': bytes=32 time<1ms TTL=128\nReply from ' + ip + ': bytes=32 time<1ms TTL=128' : 'Request timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.'}\n\nPing statistics for ${ip}:\n    Packets: Sent = 4, Received = ${result.success ? 4 : 0}, Lost = ${result.success ? 0 : 4} (${result.success ? 0 : 100}% loss)`;
      }
    }
    if (trimmed.startsWith('tracert ')) {
      const ip = parts[1];
      if (ip) return simulateTraceroute(dev, ip, allDevices, connections);
    }
    if (trimmed === 'arp -a') {
      if (dev.arpTable.length === 0) {
        return 'No ARP Entries Found.';
      }
      return '  Internet Address      Physical Address      Type\n' +
        dev.arpTable.map(a => `  ${a.ip.padEnd(22)}${a.mac.padEnd(22)}dynamic`).join('\n');
    }
    if (trimmed.startsWith('nslookup ')) {
      return `Server:  ${dev.dnsServer || 'Unknown'}\nAddress: ${dev.dnsServer || 'N/A'}\n\n*** ${dev.dnsServer || 'dns'} can't find ${parts[1]}: Non-existent domain`;
    }
    return `'${parts[0]}' is not recognized as an internal or external command.`;
  };

  const processServerCommand = (trimmed: string, parts: string[], dev: Device): string => {
    if (trimmed === 'help' || trimmed === '?') {
      return 'Available commands:\n  ifconfig                       - Display network interfaces\n  ifconfig <iface> up/down       - Toggle interface\n  ip addr                        - Display IP addresses\n  ip route                       - Display routing table\n  ping <ip>                      - Send ICMP echo\n  traceroute <ip>                - Trace route\n  netstat -tlnp                  - Show listening ports\n  service <name> start|stop|status|restart\n  systemctl <action> <name>      - Manage services\n  clear                          - Clear screen';
    }
    // service / systemctl management
    const svcMap: Record<string, string> = {
      dhcpd: 'dhcp', named: 'dns', bind9: 'dns', apache2: 'http', httpd: 'http',
      vsftpd: 'ftp', tftpd: 'tftp', 'tftpd-hpa': 'tftp', rsyslog: 'syslog', syslog: 'syslog',
    };
    let svcParts: string[] | null = null;
    if (parts[0] === 'service' && parts.length >= 3) {
      svcParts = [parts[1], parts[2]];
    } else if (parts[0] === 'systemctl' && parts.length >= 3) {
      svcParts = [parts[2].replace(/\.service$/, ''), parts[1]];
    }
    if (svcParts) {
      const [name, action] = svcParts;
      const svcType = svcMap[name];
      if (!svcType) return `Unit ${name}.service not found.`;
      const idx = dev.services.findIndex(s => s.type === svcType);
      if (idx < 0) return `Unit ${name}.service not found.`;
      const svc = dev.services[idx];
      if (action === 'status') {
        return `● ${name}.service\n   Loaded: loaded\n   Active: ${svc.enabled ? 'active (running)' : 'inactive (dead)'}\n   Listen: 0.0.0.0:${svc.port}`;
      }
      if (action === 'start' || action === 'stop' || action === 'restart') {
        if (!onUpdateDevice) return 'Cannot modify device.';
        const enabled = action === 'stop' ? false : true;
        const newServices = [...dev.services];
        newServices[idx] = { ...svc, enabled };
        onUpdateDevice({ ...dev, services: newServices });
        return action === 'restart'
          ? `Restarting ${name}.service... [  OK  ]`
          : action === 'start'
            ? `Starting ${name}.service... [  OK  ]`
            : `Stopping ${name}.service... [  OK  ]`;
      }
      return `Unknown action: ${action}`;
    }
    // ifconfig <iface> up/down
    if (parts[0] === 'ifconfig' && parts.length >= 3 && (parts[2] === 'up' || parts[2] === 'down')) {
      if (!onUpdateDevice) return 'Cannot modify device.';
      const idx = dev.interfaces.findIndex(i => i.name === parts[1]);
      if (idx < 0) return `${parts[1]}: error fetching interface information: Device not found`;
      const newIfaces = [...dev.interfaces];
      newIfaces[idx] = { ...newIfaces[idx], status: parts[2] as 'up' | 'down' };
      onUpdateDevice({ ...dev, interfaces: newIfaces });
      return '';
    }
    if (trimmed === 'ifconfig' || trimmed === 'ip addr') {
      return dev.interfaces.map(i =>
        `${i.name}: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n    inet ${i.ip || 'not configured'}  netmask ${i.mask || 'N/A'}\n    ether ${i.macAddress}  txqueuelen 1000`
      ).join('\n\n');
    }
    if (trimmed === 'ip route') {
      const routes = generateConnectedRoutes(dev);
      if (routes.length === 0) return 'No routes configured.';
      return routes.map(r => `${r.network}/${r.mask} dev ${r.interface} proto kernel scope link`).join('\n');
    }
    if (trimmed.startsWith('ping ')) {
      const ip = parts[1];
      if (ip) {
        const result = simulatePing(dev, ip, allDevices, connections);
        return `PING ${ip} 56(84) bytes of data.\n${result.success ? `64 bytes from ${ip}: icmp_seq=1 ttl=64 time=0.5 ms\n64 bytes from ${ip}: icmp_seq=2 ttl=64 time=0.4 ms\n--- ${ip} ping statistics ---\n2 packets transmitted, 2 received, 0% packet loss` : `--- ${ip} ping statistics ---\n2 packets transmitted, 0 received, 100% packet loss`}`;
      }
    }
    if (trimmed.startsWith('traceroute ')) {
      const ip = parts[1];
      if (ip) return simulateTraceroute(dev, ip, allDevices, connections);
    }
    if (trimmed === 'netstat -tlnp' || trimmed === 'netstat') {
      const running = dev.services.filter(s => s.enabled);
      if (running.length === 0) return 'No active connections.';
      return 'Proto Recv-Q Send-Q Local Address           State       PID/Program\n' +
        running.map(s => `tcp   0      0      0.0.0.0:${String(s.port).padEnd(16)}LISTEN      -/${s.type}`).join('\n');
    }
    return `-bash: ${parts[0]}: command not found`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = getPrompt();
    const newLines: TerminalLine[] = [
      ...lines,
      { type: 'input', text: `${prompt} ${input}` },
    ];

    const output = processCommand(input);
    if (input.trim()) trackEvent('command_run', { cmd: input.trim().split(/\s+/)[0] });
    if (output) {
      newLines.push({ type: 'output', text: output });
    }

    setLines(newLines);
    if (input.trim()) {
      setHistory(prev => [input, ...prev]);
    }
    setInput('');
    setHistoryIndex(-1);
  };

  // Recompute suggestions whenever input changes.
  useEffect(() => {
    if (!device || !input.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const next = getSuggestions(input, device, mode, 6);
    setSuggestions(next);
    setSuggestionIndex(0);
    setShowSuggestions(next.length > 0);
  }, [input, device, mode]);

  const acceptSuggestion = (s: string) => {
    const trailingSpace = /\s$/.test(input);
    const tokens = input.trim().split(/\s+/).filter(Boolean);
    const prefix = trailingSpace || tokens.length === 0 ? tokens.join(' ') : tokens.slice(0, -1).join(' ');
    setInput((prefix ? prefix + ' ' : '') + s + ' ');
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && suggestions.length > 0 && input.trim() && !input.endsWith(' ') && suggestions[suggestionIndex]?.toLowerCase() !== input.trim().split(/\s+/).pop()?.toLowerCase())) {
        if (e.key === 'Tab') {
          e.preventDefault();
          acceptSuggestion(suggestions[suggestionIndex]);
          return;
        }
      }
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const next = historyIndex + 1;
        setHistoryIndex(next);
        setInput(history[next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const next = historyIndex - 1;
        setHistoryIndex(next);
        setInput(history[next]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length === 1) {
        acceptSuggestion(suggestions[0]);
      } else if (suggestions.length > 1) {
        acceptSuggestion(suggestions[suggestionIndex]);
      }
    }
  };

  if (!device) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">Select a device to open terminal</p>
          <p className="text-xs mt-1 opacity-60">Click any device on the canvas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/50">
        <div className={`w-2 h-2 rounded-full ${device.status === 'up' ? 'bg-terminal status-pulse' : 'bg-noc-red'}`} />
        <span className="text-xs font-semibold text-terminal">{device.name} — Console</span>
        <span className="text-xs text-muted-foreground ml-auto">{device.type.toUpperCase()}</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className={line.type === 'input' ? 'text-terminal-bright' : 'text-terminal whitespace-pre-wrap'}>
            {line.text}
          </div>
        ))}
        <form onSubmit={handleSubmit} className="flex items-center relative">
          <span className="text-terminal-bright mr-1">{getPrompt()}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-terminal-bright outline-none caret-terminal"
            autoFocus
            spellCheck={false}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 min-w-[200px] max-w-[360px] bg-popover border border-border rounded-md shadow-lg z-50 overflow-hidden">
              {suggestions.map((s, i) => (
                <div
                  key={s}
                  onMouseDown={(ev) => { ev.preventDefault(); acceptSuggestion(s); }}
                  className={`px-3 py-1 text-xs font-mono cursor-pointer ${
                    i === suggestionIndex
                      ? 'bg-terminal/20 text-terminal-bright'
                      : 'text-foreground hover:bg-accent'
                  }`}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}