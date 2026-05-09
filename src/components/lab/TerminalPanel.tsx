import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Device } from './types';
import { generateConnectedRoutes, simulatePing, simulateTraceroute, simulateDhcp } from './networkEngine';

import type { PingResult } from './PingResultPopup';
import { processRouterCommand, getRouterPrompt, getRouterCompletions, type CliContext } from './cli/routerCommands';

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
    const trimmed = cmd.trim().toLowerCase();
    const parts = cmd.trim().split(/\s+/);
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
      output = processRouterCommand(cmd, ctx);
      if (output === '__CLEAR__') { setLines([]); return ''; }
    } else {
      output = '% No device selected';
    }

    return output;
  };

  const processPcCommand = (trimmed: string, parts: string[], dev: Device): string => {
    if (trimmed === 'help' || trimmed === '?') {
      return 'Available commands:\n  ipconfig        - Display IP configuration\n  ipconfig /all   - Display detailed IP configuration\n  ping <ip>       - Send ICMP echo\n  tracert <ip>    - Trace route\n  arp -a          - Display ARP table\n  nslookup <name> - DNS lookup\n  clear           - Clear screen';
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
      return 'Available commands:\n  ifconfig        - Display network interfaces\n  ip addr         - Display IP addresses\n  ip route        - Display routing table\n  ping <ip>       - Send ICMP echo\n  traceroute <ip> - Trace route\n  netstat -tlnp   - Show listening ports\n  service <name> start/stop - Manage services\n  clear           - Clear screen';
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      // Simple tab completion
      const parts = input.trim().split(' ');
      const prefix = parts.slice(0, -1).join(' ');
      const partial = parts[parts.length - 1].toLowerCase();
      const cmds = getCiscoCommands(device, mode);
      const candidates = cmds[prefix] || cmds[''] || [];
      const matches = candidates.filter(c => c.toLowerCase().startsWith(partial));
      if (matches.length === 1) {
        setInput(prefix ? `${prefix} ${matches[0]}` : matches[0]);
      } else if (matches.length > 1) {
        setLines(prev => [...prev, { type: 'output', text: matches.join('  ') }]);
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
        <form onSubmit={handleSubmit} className="flex items-center">
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
        </form>
      </div>
    </div>
  );
}